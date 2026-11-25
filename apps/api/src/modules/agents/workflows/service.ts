import {
  agentRun,
  agentWorkflow,
  agentWorkflowRun,
  agentWorkflowRunStep,
  aiAgent,
  db,
  issue,
  project,
  projectColumn,
  user,
  type AgentWorkflowStep,
} from '@repo/db';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { HttpError, iso } from '#shared/lib';
import { agentWorksInProject, canTriggerAgent } from '../core/service';
import { executionState } from '../core/run-queue';
import { cancelAgentRun } from '../queue/service';
import { startWorkflowRun } from './engine';

export interface WorkflowInput {
  name: string;
  status: 'active' | 'paused';
  trigger: 'manual' | 'status';
  columnId: number | null;
  maxRounds: number;
  steps: AgentWorkflowStep[];
}

const workflowColumns = {
  id: agentWorkflow.id,
  name: agentWorkflow.name,
  status: agentWorkflow.status,
  trigger: agentWorkflow.trigger,
  columnId: agentWorkflow.columnId,
  maxRounds: agentWorkflow.maxRounds,
  steps: agentWorkflow.steps,
  runningRuns: sql<number>`(
    select count(*)::int from ${agentWorkflowRun} r
    where r.workflow_id = ${agentWorkflow.id} and r.status = 'running'
  )`,
  lastRunStatus: sql<string | null>`(
    select r.status from ${agentWorkflowRun} r
    where r.workflow_id = ${agentWorkflow.id}
    order by r.id desc limit 1
  )`,
  createdAt: agentWorkflow.createdAt,
  updatedAt: agentWorkflow.updatedAt,
};

type SelectedWorkflow = Awaited<ReturnType<typeof selectWorkflows>>[number];

function selectWorkflows() {
  return db.select(workflowColumns).from(agentWorkflow);
}

function mapWorkflow(row: SelectedWorkflow) {
  return {
    ...row,
    status: row.status as 'active' | 'paused',
    trigger: row.trigger as 'manual' | 'status',
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export type WorkflowRow = ReturnType<typeof mapWorkflow>;

export async function listWorkflows(
  projectId: number,
  window: { limit: number; offset: number },
): Promise<{ items: WorkflowRow[]; total: number }> {
  const [rows, counted] = await Promise.all([
    selectWorkflows()
      .where(eq(agentWorkflow.projectId, projectId))
      .orderBy(desc(agentWorkflow.id))
      .limit(window.limit)
      .offset(window.offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(agentWorkflow)
      .where(eq(agentWorkflow.projectId, projectId)),
  ]);
  return { items: rows.map(mapWorkflow), total: counted[0]?.count ?? 0 };
}

export async function getWorkflow(projectId: number, workflowId: number): Promise<WorkflowRow> {
  const [row] = await selectWorkflows().where(
    and(eq(agentWorkflow.id, workflowId), eq(agentWorkflow.projectId, projectId)),
  );
  if (!row) throw new HttpError(404, 'Workflow not found');
  return mapWorkflow(row);
}

async function assertSteps(
  projectId: number,
  steps: AgentWorkflowStep[],
  actorUserId: string,
): Promise<void> {
  if (steps[0]?.kind !== 'work') throw new HttpError(400, 'The first step must be a work step');
  for (const [index, step] of steps.entries()) {
    if (step.kind === 'review' && steps[index - 1]?.kind !== 'work') {
      throw new HttpError(400, `Step ${index + 1} reviews a step that is not a work step`);
    }
    if (!(await agentWorksInProject(step.agentId, projectId))) {
      throw new HttpError(400, `Select an agent from this project for step ${index + 1}`);
    }
    if (!(await canTriggerAgent(step.agentId, actorUserId))) {
      throw new HttpError(403, `The agent of step ${index + 1} only takes tasks from its owner`);
    }
  }
}

async function assertTrigger(projectId: number, input: WorkflowInput): Promise<void> {
  if (input.trigger === 'manual') {
    if (input.columnId !== null) throw new HttpError(400, 'A manual workflow takes no column');
    return;
  }
  if (input.columnId === null) throw new HttpError(400, 'Column is required');
  const [column] = await db
    .select({ id: projectColumn.id })
    .from(projectColumn)
    .where(and(eq(projectColumn.id, input.columnId), eq(projectColumn.projectId, projectId)));
  if (!column) throw new HttpError(400, 'Select a column from this project');
}

async function assertWorkflow(
  projectId: number,
  input: WorkflowInput,
  actorUserId: string,
): Promise<void> {
  if (!input.name.trim()) throw new HttpError(400, 'Name is required');
  await assertTrigger(projectId, input);
  await assertSteps(projectId, input.steps, actorUserId);
}

export async function createWorkflow(
  projectId: number,
  input: WorkflowInput,
  actorUserId: string,
): Promise<WorkflowRow> {
  await assertWorkflow(projectId, input, actorUserId);
  const [row] = await db
    .insert(agentWorkflow)
    .values({ ...input, name: input.name.trim(), projectId })
    .returning({ id: agentWorkflow.id });
  return getWorkflow(projectId, row!.id);
}

export async function updateWorkflow(
  projectId: number,
  workflowId: number,
  patch: Partial<WorkflowInput>,
  actorUserId: string,
): Promise<WorkflowRow> {
  const current = await getWorkflow(projectId, workflowId);
  const trigger = patch.trigger ?? current.trigger;
  const next: WorkflowInput = {
    name: patch.name ?? current.name,
    status: patch.status ?? current.status,
    trigger,
    columnId: trigger === 'manual' ? null : (patch.columnId ?? current.columnId),
    maxRounds: patch.maxRounds ?? current.maxRounds,
    steps: patch.steps ?? current.steps,
  };
  await assertWorkflow(projectId, next, actorUserId);
  await db
    .update(agentWorkflow)
    .set({ ...next, name: next.name.trim(), updatedAt: new Date() })
    .where(eq(agentWorkflow.id, workflowId));
  return getWorkflow(projectId, workflowId);
}

export async function deleteWorkflow(projectId: number, workflowId: number): Promise<void> {
  await getWorkflow(projectId, workflowId);
  await db.delete(agentWorkflow).where(eq(agentWorkflow.id, workflowId));
}

export async function runWorkflow(
  projectId: number,
  workflowId: number,
  input: { input?: string; issueId?: number },
  actorUserId: string,
): Promise<WorkflowRunDetail> {
  const workflow = await getWorkflow(projectId, workflowId);
  if (input.issueId !== undefined) {
    const [row] = await db
      .select({ id: issue.id })
      .from(issue)
      .where(and(eq(issue.id, input.issueId), eq(issue.projectId, projectId)));
    if (!row) throw new HttpError(404, 'Issue not found');
  }
  await assertSteps(projectId, workflow.steps, actorUserId);
  const runId = await startWorkflowRun({
    workflowId,
    projectId,
    issueId: input.issueId ?? null,
    input: input.input ?? '',
    steps: workflow.steps,
    maxRounds: workflow.maxRounds,
    requestedByUserId: actorUserId,
    startedByUserId: actorUserId,
  });
  if (runId === null) throw new HttpError(409, 'This workflow is already running on this issue');
  return getWorkflowRun(projectId, workflowId, runId);
}

const runColumns = {
  id: agentWorkflowRun.id,
  status: agentWorkflowRun.status,
  issueId: agentWorkflowRun.issueId,
  issueIdentifier: sql<string | null>`case when ${issue.id} is null then null
    else ${project.key} || '-' || ${issue.sequenceNumber} end`,
  input: agentWorkflowRun.input,
  round: agentWorkflowRun.round,
  steps: agentWorkflowRun.steps,
  currentStep: sql<number | null>`(
    select s.position from ${agentWorkflowRunStep} s
    where s.workflow_run_id = ${agentWorkflowRun.id}
    order by s.id desc limit 1
  )`,
  error: agentWorkflowRun.error,
  startedByName: user.name,
  createdAt: agentWorkflowRun.createdAt,
  finishedAt: agentWorkflowRun.finishedAt,
};

function selectRuns() {
  return db
    .select(runColumns)
    .from(agentWorkflowRun)
    .leftJoin(issue, eq(issue.id, agentWorkflowRun.issueId))
    .leftJoin(project, eq(project.id, issue.projectId))
    .leftJoin(user, eq(user.id, agentWorkflowRun.startedByUserId));
}

function mapRun(row: Awaited<ReturnType<typeof selectRuns>>[number]) {
  const { steps, ...rest } = row;
  return {
    ...rest,
    status: row.status as 'running' | 'success' | 'failed' | 'canceled',
    stepCount: steps.length,
    currentStep: row.status === 'running' ? row.currentStep : null,
    createdAt: iso(row.createdAt),
    finishedAt: row.finishedAt ? iso(row.finishedAt) : null,
  };
}

export type WorkflowRunRow = ReturnType<typeof mapRun>;

export async function listWorkflowRuns(
  projectId: number,
  workflowId: number,
): Promise<WorkflowRunRow[]> {
  await getWorkflow(projectId, workflowId);
  const rows = await selectRuns()
    .where(eq(agentWorkflowRun.workflowId, workflowId))
    .orderBy(desc(agentWorkflowRun.id))
    .limit(50);
  return rows.map(mapRun);
}

export type WorkflowRunDetail = Awaited<ReturnType<typeof getWorkflowRun>>;

export async function getWorkflowRun(projectId: number, workflowId: number, runId: number) {
  await getWorkflow(projectId, workflowId);
  const [row] = await selectRuns().where(
    and(eq(agentWorkflowRun.id, runId), eq(agentWorkflowRun.workflowId, workflowId)),
  );
  if (!row) throw new HttpError(404, 'Workflow run not found');
  const links = await db
    .select({
      agentRunId: agentWorkflowRunStep.agentRunId,
      position: agentWorkflowRunStep.position,
      round: agentWorkflowRunStep.round,
      agentName: user.name,
      executionState,
      output: agentRun.output,
      error: agentRun.lastError,
      startedAt: agentRun.startedAt,
      finishedAt: agentRun.finishedAt,
    })
    .from(agentWorkflowRunStep)
    .innerJoin(agentRun, eq(agentRun.id, agentWorkflowRunStep.agentRunId))
    .innerJoin(aiAgent, eq(aiAgent.id, agentRun.agentId))
    .innerJoin(user, eq(user.id, aiAgent.userId))
    .where(eq(agentWorkflowRunStep.workflowRunId, runId))
    .orderBy(asc(agentWorkflowRunStep.id));
  return {
    ...mapRun(row),
    steps: links.map((link) => {
      const step = row.steps[link.position];
      return {
        ...link,
        name: step?.name ?? `Step ${link.position + 1}`,
        kind: step?.kind ?? 'work',
        startedAt: link.startedAt ? iso(link.startedAt) : null,
        finishedAt: link.finishedAt ? iso(link.finishedAt) : null,
      };
    }),
  };
}

export async function cancelWorkflowRun(
  projectId: number,
  workflowId: number,
  runId: number,
  actorUserId: string,
): Promise<WorkflowRunDetail> {
  await getWorkflow(projectId, workflowId);
  const [canceled] = await db
    .update(agentWorkflowRun)
    .set({ status: 'canceled', canceledByUserId: actorUserId, finishedAt: new Date() })
    .where(
      and(
        eq(agentWorkflowRun.id, runId),
        eq(agentWorkflowRun.workflowId, workflowId),
        eq(agentWorkflowRun.status, 'running'),
      ),
    )
    .returning({ id: agentWorkflowRun.id });
  if (!canceled) {
    await getWorkflowRun(projectId, workflowId, runId);
    throw new HttpError(409, 'This workflow run has already ended');
  }
  const [current] = await db
    .select({ agentRunId: agentWorkflowRunStep.agentRunId })
    .from(agentWorkflowRunStep)
    .where(eq(agentWorkflowRunStep.workflowRunId, runId))
    .orderBy(desc(agentWorkflowRunStep.id))
    .limit(1);
  if (current) await cancelAgentRun(current.agentRunId, actorUserId);
  return getWorkflowRun(projectId, workflowId, runId);
}
