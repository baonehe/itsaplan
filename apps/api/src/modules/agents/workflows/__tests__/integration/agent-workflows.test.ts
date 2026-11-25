import { describe, it, expect, beforeEach } from 'bun:test';
import { agentRun, agentWorkflowRun, db } from '@repo/db';
import { asc, eq } from 'drizzle-orm';
import { apiKeyApi, authedApi, type Api, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { createAgent } from '#tests/helpers/agents';
import { markRunFailed, markRunSuccess } from '../../../core/run-queue';

const workflows = (api: Api, projectKey = 'MKT') => api.projects({ projectKey }).workflows;

async function setup() {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  await createProject(asOwner, { key: 'MKT', name: 'Marketing' });
  const columns = (await asOwner.projects({ projectKey: 'MKT' }).get()).data!.columns;
  const writer = (
    await createAgent(asOwner, 'MKT', { name: 'Writer', username: 'writer', kind: 'internal' })
  ).data!.agent.id;
  const reviewer = (
    await createAgent(asOwner, 'MKT', { name: 'Reviewer', username: 'reviewer', kind: 'internal' })
  ).data!.agent.id;
  return { asOwner, columns, writer, reviewer };
}

async function runsOf(workflowRunId: number) {
  const run = (
    await db.select().from(agentWorkflowRun).where(eq(agentWorkflowRun.id, workflowRunId))
  )[0]!;
  return run;
}

async function pendingAgentRun() {
  const rows = await db
    .select()
    .from(agentRun)
    .where(eq(agentRun.status, 'pending'))
    .orderBy(asc(agentRun.id));
  expect(rows).toHaveLength(1);
  return rows[0]!;
}

describe('agent workflows', () => {
  beforeEach(resetDb);

  it('creates a workflow and refuses steps it cannot run', async () => {
    const { asOwner, writer, reviewer } = await setup();
    const created = await workflows(asOwner).post({
      name: 'Release notes',
      steps: [
        { name: 'Draft', agentId: writer, prompt: 'Draft the notes.', kind: 'work' },
        { name: 'Check', agentId: reviewer, prompt: 'Check the draft.', kind: 'review' },
      ],
    });
    expect(created.status).toBe(201);
    expect(created.data).toMatchObject({
      name: 'Release notes',
      status: 'active',
      trigger: 'manual',
      columnId: null,
      maxRounds: 3,
      runningRuns: 0,
      lastRunStatus: null,
    });

    const reviewFirst = await workflows(asOwner).post({
      name: 'Bad',
      steps: [{ name: 'Check', agentId: reviewer, prompt: '', kind: 'review' }],
    });
    expect(reviewFirst.status).toBe(400);

    const strangeAgent = await workflows(asOwner).post({
      name: 'Bad',
      steps: [{ name: 'Draft', agentId: 999_999, prompt: '', kind: 'work' }],
    });
    expect(strangeAgent.status).toBe(400);

    const noColumn = await workflows(asOwner).post({
      name: 'Bad',
      trigger: 'status',
      steps: [{ name: 'Draft', agentId: writer, prompt: '', kind: 'work' }],
    });
    expect(noColumn.status).toBe(400);

    const list = (await workflows(asOwner).get()).data!;
    expect(list.items.map((item) => item.name)).toEqual(['Release notes']);
  });

  it('hands the output of each step to the next one and ends when the last succeeds', async () => {
    const { asOwner, writer, reviewer } = await setup();
    const workflowId = (
      await workflows(asOwner).post({
        name: 'Two writers',
        steps: [
          { name: 'Draft', agentId: writer, prompt: 'Draft it.', kind: 'work' },
          { name: 'Polish', agentId: reviewer, prompt: 'Polish it.', kind: 'work' },
        ],
      })
    ).data!.id;

    const started = await workflows(asOwner)({ workflowId }).runs.post({ input: 'A brief' });
    expect(started.status).toBe(201);
    const runId = started.data!.id;
    expect(started.data).toMatchObject({ status: 'running', currentStep: 0, stepCount: 2 });

    const first = await pendingAgentRun();
    expect(first).toMatchObject({ agentId: writer, trigger: 'api', parentRunId: null });
    expect(first.prompt).toContain('step 1 of 2: Draft');
    expect(first.prompt).toContain('A brief');

    await markRunSuccess(first.id, 'Draft v1', null);
    const second = await pendingAgentRun();
    expect(second).toMatchObject({ agentId: reviewer, parentRunId: first.id, rootRunId: first.id });
    expect(second.prompt).toContain('Draft v1');

    await markRunSuccess(second.id, 'Final text', null);
    const detail = (await workflows(asOwner)({ workflowId }).runs({ runId }).get()).data!;
    expect(detail).toMatchObject({ status: 'success', currentStep: null, error: null });
    expect(detail.steps.map((step) => [step.name, step.executionState, step.output])).toEqual([
      ['Draft', 'success', 'Draft v1'],
      ['Polish', 'success', 'Final text'],
    ]);
  });

  it('sends the work back with the notes, and fails after the last round', async () => {
    const { asOwner, writer, reviewer } = await setup();
    const workflowId = (
      await workflows(asOwner).post({
        name: 'Reviewed',
        maxRounds: 2,
        steps: [
          { name: 'Draft', agentId: writer, prompt: 'Draft it.', kind: 'work' },
          { name: 'Check', agentId: reviewer, prompt: 'Check it.', kind: 'review' },
        ],
      })
    ).data!.id;
    const runId = (await workflows(asOwner)({ workflowId }).runs.post({ input: 'Brief' })).data!.id;

    await markRunSuccess((await pendingAgentRun()).id, 'Draft v1', null);
    const review = await pendingAgentRun();
    expect(review.prompt).toContain('VERDICT: approve');
    await markRunSuccess(review.id, '**VERDICT: revise**\nName the version.', null);

    const redo = await pendingAgentRun();
    expect(redo.agentId).toBe(writer);
    expect(redo.prompt).toContain('round 2');
    expect(redo.prompt).toContain('Draft v1');
    expect(redo.prompt).toContain('Name the version.');
    expect((await runsOf(runId)).round).toBe(2);

    await markRunSuccess(redo.id, 'Draft v2', null);
    await markRunSuccess((await pendingAgentRun()).id, 'VERDICT: revise\nStill wrong.', null);
    expect(await runsOf(runId)).toMatchObject({
      status: 'failed',
      error: 'Not approved after 2 rounds',
    });
  });

  it('ends when the review approves', async () => {
    const { asOwner, writer, reviewer } = await setup();
    const workflowId = (
      await workflows(asOwner).post({
        name: 'Reviewed',
        steps: [
          { name: 'Draft', agentId: writer, prompt: '', kind: 'work' },
          { name: 'Check', agentId: reviewer, prompt: '', kind: 'review' },
        ],
      })
    ).data!.id;
    const runId = (await workflows(asOwner)({ workflowId }).runs.post({})).data!.id;
    await markRunSuccess((await pendingAgentRun()).id, 'Draft', null);
    await markRunSuccess((await pendingAgentRun()).id, 'VERDICT: approve\nGood.', null);
    expect((await runsOf(runId)).status).toBe('success');
  });

  it('fails when a step fails or a review gives no verdict', async () => {
    const { asOwner, writer, reviewer } = await setup();
    const workflowId = (
      await workflows(asOwner).post({
        name: 'Reviewed',
        steps: [
          { name: 'Draft', agentId: writer, prompt: '', kind: 'work' },
          { name: 'Check', agentId: reviewer, prompt: '', kind: 'review' },
        ],
      })
    ).data!.id;

    const failing = (await workflows(asOwner)({ workflowId }).runs.post({})).data!.id;
    await markRunFailed((await pendingAgentRun()).id, 'model error');
    expect(await runsOf(failing)).toMatchObject({
      status: 'failed',
      error: 'Step 1 failed: model error',
    });

    const silent = (await workflows(asOwner)({ workflowId }).runs.post({})).data!.id;
    await markRunSuccess((await pendingAgentRun()).id, 'Draft', null);
    await markRunSuccess((await pendingAgentRun()).id, 'Looks fine to me.', null);
    expect(await runsOf(silent)).toMatchObject({
      status: 'failed',
      error: 'Step 2 gave no verdict',
    });
  });

  it('cancels a run and the step it is on', async () => {
    const { asOwner, writer } = await setup();
    const workflowId = (
      await workflows(asOwner).post({
        name: 'One step',
        steps: [{ name: 'Draft', agentId: writer, prompt: '', kind: 'work' }],
      })
    ).data!.id;
    const runId = (await workflows(asOwner)({ workflowId }).runs.post({})).data!.id;
    const step = await pendingAgentRun();

    const canceled = await workflows(asOwner)({ workflowId }).runs({ runId }).cancel.post();
    expect(canceled.status).toBe(200);
    expect(canceled.data).toMatchObject({ status: 'canceled' });
    const [after] = await db.select().from(agentRun).where(eq(agentRun.id, step.id));
    expect(after!.status).toBe('canceled');

    const again = await workflows(asOwner)({ workflowId }).runs({ runId }).cancel.post();
    expect(again.status).toBe(409);
  });

  it('starts on an issue that enters its column, once while it runs', async () => {
    const { asOwner, columns, writer } = await setup();
    const [first, second] = columns;
    const workflowId = (
      await workflows(asOwner).post({
        name: 'On review',
        trigger: 'status',
        columnId: second!.id,
        steps: [{ name: 'Review', agentId: writer, prompt: 'Look at it.', kind: 'work' }],
      })
    ).data!.id;
    const issues = asOwner.projects({ projectKey: 'MKT' }).issues;

    const created = (await issues.post({ columnId: second!.id, title: 'Created there' })).data!;
    const moved = (await issues.post({ columnId: first!.id, title: 'Moved there' })).data!;
    await asOwner.issues({ issueId: moved.id }).patch({ columnId: second!.id });
    await asOwner.issues({ issueId: moved.id }).patch({ columnId: first!.id });
    await asOwner.issues({ issueId: moved.id }).patch({ columnId: second!.id });

    const runs = (await workflows(asOwner)({ workflowId }).runs.get()).data!;
    expect(runs.map((run) => run.issueId).sort()).toEqual([created.id, moved.id].sort());
    const stepRuns = await db.select().from(agentRun).orderBy(asc(agentRun.id));
    expect(stepRuns.map((run) => [run.issueId, run.trigger])).toEqual([
      [created.id, 'field'],
      [moved.id, 'field'],
    ]);
    expect(stepRuns[0]!.prompt).toContain('"Created there"');
  });

  it('does not start again when one of its own agents moves the issue into its column', async () => {
    const { asOwner, columns } = await setup();
    const [first, second] = columns;
    const mover = (
      await createAgent(asOwner, 'MKT', { name: 'Mover', username: 'mover', kind: 'external' })
    ).data!;
    const workflowId = (
      await workflows(asOwner).post({
        name: 'On review',
        trigger: 'status',
        columnId: second!.id,
        steps: [{ name: 'Review', agentId: mover.agent.id, prompt: '', kind: 'work' }],
      })
    ).data!.id;
    const issue = (
      await asOwner.projects({ projectKey: 'MKT' }).issues.post({
        columnId: first!.id,
        title: 'Task',
      })
    ).data!;

    const moved = await apiKeyApi(mover.apiKey!)
      .issues({ issueId: issue.id })
      .patch({ columnId: second!.id });
    expect(moved.status).toBe(200);

    expect((await workflows(asOwner)({ workflowId }).runs.get()).data).toEqual([]);
  });

  it('answers 404 for a workflow of another project', async () => {
    const { asOwner, writer } = await setup();
    await createProject(asOwner, { key: 'OPS', name: 'Ops' });
    const workflowId = (
      await workflows(asOwner).post({
        name: 'Mine',
        steps: [{ name: 'Draft', agentId: writer, prompt: '', kind: 'work' }],
      })
    ).data!.id;

    expect((await workflows(asOwner, 'OPS')({ workflowId }).runs.post({})).status).toBe(404);
    expect((await workflows(asOwner, 'OPS')({ workflowId }).patch({ name: 'x' })).status).toBe(404);
    expect((await workflows(asOwner, 'OPS')({ workflowId }).delete()).status).toBe(404);
  });
});
