import {
  agentRun,
  agentWorkflow,
  agentWorkflowRun,
  agentWorkflowRunStep,
  aiAgent,
  db,
  issue,
  project,
  type AgentWorkflowStep,
} from '@repo/db';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { onProjectEvent, type ProjectEvent } from '#modules/webhooks/emit';
import { rootRunOf } from '../core/run-queue';
import { agentWorksInProject } from '../core/service';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type WorkflowRunRow = typeof agentWorkflowRun.$inferSelect;

export type Verdict = { verdict: 'approve' | 'revise'; notes: string };

const VERDICT_LINE = /^[\s*_`#>]*VERDICT[\s*_`]*:[\s*_`]*(approve|revise)\b/i;

export function parseVerdict(output: string): Verdict | null {
  const text = output.trim();
  const newline = text.indexOf('\n');
  const first = newline === -1 ? text : text.slice(0, newline);
  const match = first.match(VERDICT_LINE);
  if (!match) return null;
  return {
    verdict: match[1]!.toLowerCase() as Verdict['verdict'],
    notes: newline === -1 ? '' : text.slice(newline + 1).trim(),
  };
}

export function stepPrompt(input: {
  workflowName: string;
  steps: AgentWorkflowStep[];
  position: number;
  round: number;
  issueLead: string | null;
  handoff: string;
  notes: string | null;
}): string {
  const step = input.steps[input.position]!;
  const round = input.round > 1 ? `, round ${input.round}` : '';
  const lines = [
    `Workflow "${input.workflowName}", step ${input.position + 1} of ${input.steps.length}: ${step.name}${round}.`,
  ];
  if (input.issueLead) lines.push(input.issueLead);
  if (step.prompt.trim()) lines.push('', step.prompt.trim());
  if (input.handoff.trim()) lines.push('', '## Input', '', input.handoff.trim());
  if (input.notes !== null) {
    lines.push(
      '',
      '## Review notes',
      '',
      input.notes || 'The reviewer asked for changes without notes.',
      '',
      'Revise the work in the input to address these notes and return the full revised result.',
    );
  }
  if (step.kind === 'review') {
    lines.push(
      '',
      'Start your answer with one line that reads exactly "VERDICT: approve" or',
      '"VERDICT: revise". After "VERDICT: revise", list what has to change.',
    );
  }
  return lines.join('\n');
}

async function issueLead(tx: Tx, issueId: number | null): Promise<string | null> {
  if (issueId == null) return null;
  const [row] = await tx
    .select({ key: project.key, number: issue.sequenceNumber, title: issue.title })
    .from(issue)
    .innerJoin(project, eq(project.id, issue.projectId))
    .where(eq(issue.id, issueId));
  return row ? `Work item ${row.key}-${row.number}: "${row.title}".` : null;
}

async function lastWorkOutput(tx: Tx, run: WorkflowRunRow): Promise<string> {
  const links = await tx
    .select({ position: agentWorkflowRunStep.position, output: agentRun.output })
    .from(agentWorkflowRunStep)
    .innerJoin(agentRun, eq(agentRun.id, agentWorkflowRunStep.agentRunId))
    .where(and(eq(agentWorkflowRunStep.workflowRunId, run.id), eq(agentRun.status, 'success')))
    .orderBy(desc(agentWorkflowRunStep.id));
  const work = links.find((link) => run.steps[link.position]?.kind === 'work');
  return work ? (work.output ?? '') : run.input;
}

class StepError extends Error {}

async function queueStep(
  tx: Tx,
  run: WorkflowRunRow,
  next: { position: number; round: number; parentRunId: number | null; notes: string | null },
): Promise<void> {
  const step = run.steps[next.position]!;
  if (!(await agentWorksInProject(step.agentId, run.projectId))) {
    throw new StepError(`The agent of step ${next.position + 1} no longer works in this project`);
  }
  const [workflow] = await tx
    .select({ name: agentWorkflow.name })
    .from(agentWorkflow)
    .where(eq(agentWorkflow.id, run.workflowId));
  const prompt = stepPrompt({
    workflowName: workflow?.name ?? 'Workflow',
    steps: run.steps,
    position: next.position,
    round: next.round,
    issueLead: await issueLead(tx, run.issueId),
    handoff: await lastWorkOutput(tx, run),
    notes: next.notes,
  });
  const [queued] = await tx
    .insert(agentRun)
    .values({
      agentId: step.agentId,
      projectId: run.projectId,
      issueId: run.issueId,
      trigger: run.issueId == null ? 'api' : 'field',
      requestedByUserId: run.requestedByUserId,
      startedByUserId: run.startedByUserId,
      parentRunId: next.parentRunId,
      rootRunId: rootRunOf(next.parentRunId),
      prompt,
    })
    .returning({ id: agentRun.id });
  await tx.insert(agentWorkflowRunStep).values({
    workflowRunId: run.id,
    agentRunId: queued!.id,
    position: next.position,
    round: next.round,
  });
  if (next.round !== run.round) {
    await tx
      .update(agentWorkflowRun)
      .set({ round: next.round })
      .where(eq(agentWorkflowRun.id, run.id));
  }
}

async function finish(
  tx: Tx,
  runId: number,
  status: 'success' | 'failed' | 'canceled',
  error: string | null,
): Promise<void> {
  await tx
    .update(agentWorkflowRun)
    .set({ status, error, finishedAt: new Date() })
    .where(and(eq(agentWorkflowRun.id, runId), eq(agentWorkflowRun.status, 'running')));
}

export async function startWorkflowRun(input: {
  workflowId: number;
  projectId: number;
  issueId: number | null;
  input: string;
  steps: AgentWorkflowStep[];
  maxRounds: number;
  requestedByUserId: string | null;
  startedByUserId: string | null;
}): Promise<number | null> {
  return db.transaction(async (tx) => {
    const [run] = await tx
      .insert(agentWorkflowRun)
      .values({
        workflowId: input.workflowId,
        projectId: input.projectId,
        issueId: input.issueId,
        input: input.input,
        steps: input.steps,
        maxRounds: input.maxRounds,
        requestedByUserId: input.requestedByUserId,
        startedByUserId: input.startedByUserId,
      })
      .onConflictDoNothing()
      .returning();
    if (!run) return null;
    try {
      await queueStep(tx, run, { position: 0, round: 1, parentRunId: null, notes: null });
    } catch (error) {
      if (!(error instanceof StepError)) throw error;
      await finish(tx, run.id, 'failed', error.message);
    }
    return run.id;
  });
}

export async function advanceWorkflowRun(workflowRunId: number): Promise<void> {
  await db.transaction(async (tx) => {
    const [run] = await tx
      .select()
      .from(agentWorkflowRun)
      .where(and(eq(agentWorkflowRun.id, workflowRunId), eq(agentWorkflowRun.status, 'running')))
      .for('update');
    if (!run) return;
    const [last] = await tx
      .select({
        position: agentWorkflowRunStep.position,
        agentRunId: agentWorkflowRunStep.agentRunId,
        status: agentRun.status,
        output: agentRun.output,
        error: agentRun.lastError,
      })
      .from(agentWorkflowRunStep)
      .innerJoin(agentRun, eq(agentRun.id, agentWorkflowRunStep.agentRunId))
      .where(eq(agentWorkflowRunStep.workflowRunId, run.id))
      .orderBy(desc(agentWorkflowRunStep.id))
      .limit(1);
    if (!last) {
      await finish(tx, run.id, 'failed', 'The run of the current step was deleted');
      return;
    }
    if (last.status === 'pending') return;
    if (last.status === 'canceled') {
      await finish(tx, run.id, 'canceled', null);
      return;
    }
    const label = `Step ${last.position + 1}`;
    if (last.status === 'failed') {
      await finish(tx, run.id, 'failed', `${label} failed: ${last.error ?? 'no error recorded'}`);
      return;
    }
    let next = { position: last.position + 1, round: run.round, notes: null as string | null };
    if (run.steps[last.position]?.kind === 'review') {
      const verdict = parseVerdict(last.output ?? '');
      if (!verdict) {
        await finish(tx, run.id, 'failed', `${label} gave no verdict`);
        return;
      }
      if (verdict.verdict === 'revise') {
        if (run.round >= run.maxRounds) {
          await finish(tx, run.id, 'failed', `Not approved after ${run.maxRounds} rounds`);
          return;
        }
        next = { position: last.position - 1, round: run.round + 1, notes: verdict.notes };
      }
    }
    if (next.position >= run.steps.length) {
      await finish(tx, run.id, 'success', null);
      return;
    }
    try {
      await queueStep(tx, run, { ...next, parentRunId: last.agentRunId });
    } catch (error) {
      if (!(error instanceof StepError)) throw error;
      await finish(tx, run.id, 'failed', error.message);
    }
  });
}

export async function advanceRunningWorkflowRuns(): Promise<void> {
  const running = await db
    .select({ id: agentWorkflowRun.id })
    .from(agentWorkflowRun)
    .where(eq(agentWorkflowRun.status, 'running'));
  for (const run of running) await advanceWorkflowRun(run.id);
}

async function onRunsFinished(event: ProjectEvent): Promise<void> {
  const payloads = (await event.load()) as { id: number }[];
  if (payloads.length === 0) return;
  const runs = await db
    .selectDistinct({ id: agentWorkflowRunStep.workflowRunId })
    .from(agentWorkflowRunStep)
    .where(
      inArray(
        agentWorkflowRunStep.agentRunId,
        payloads.map((payload) => payload.id),
      ),
    );
  for (const run of runs) await advanceWorkflowRun(run.id);
}

async function onIssuesInColumn(event: ProjectEvent): Promise<void> {
  const workflows = await db
    .select({
      id: agentWorkflow.id,
      columnId: agentWorkflow.columnId,
      steps: agentWorkflow.steps,
      maxRounds: agentWorkflow.maxRounds,
    })
    .from(agentWorkflow)
    .where(
      and(
        eq(agentWorkflow.projectId, event.projectId),
        eq(agentWorkflow.trigger, 'status'),
        eq(agentWorkflow.status, 'active'),
      ),
    );
  if (workflows.length === 0) return;
  const startedByUserId = typeof event.actor === 'string' ? event.actor : null;
  const [actorAgent] = startedByUserId
    ? await db.select({ id: aiAgent.id }).from(aiAgent).where(eq(aiAgent.userId, startedByUserId))
    : [];
  const started = workflows.filter(
    (workflow) => !workflow.steps.some((step) => step.agentId === actorAgent?.id),
  );
  if (started.length === 0) return;
  const issues = (await event.load()) as { id: number; projectId: number; columnId: number }[];
  for (const row of issues) {
    if (row.projectId !== event.projectId) continue;
    for (const workflow of started) {
      if (workflow.columnId !== row.columnId) continue;
      await startWorkflowRun({
        workflowId: workflow.id,
        projectId: event.projectId,
        issueId: row.id,
        input: '',
        steps: workflow.steps,
        maxRounds: workflow.maxRounds,
        requestedByUserId: null,
        startedByUserId,
      });
    }
  }
}

async function onWorkflowEvent(event: ProjectEvent): Promise<void> {
  if (event.type === 'agent_run.finished') await onRunsFinished(event);
  if (event.type === 'issue.created' || event.type === 'issue.state_changed') {
    await onIssuesInColumn(event);
  }
}

onProjectEvent(onWorkflowEvent);
