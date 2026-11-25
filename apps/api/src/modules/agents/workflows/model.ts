import { t } from 'elysia';
import { pageQueryFields, pageResponse } from '#shared/pagination';
import { agentExecutionState } from '../model';

export const MAX_WORKFLOW_STEPS = 10;

export const workflowParams = t.Object({
  projectKey: t.String(),
  workflowId: t.Numeric(),
});

export const workflowRunParams = t.Object({
  projectKey: t.String(),
  workflowId: t.Numeric(),
  runId: t.Numeric(),
});

const workflowStatus = t.UnionEnum(['active', 'paused'], { default: undefined });

const workflowTrigger = t.UnionEnum(['manual', 'status'], { default: undefined });

const workflowStep = t.Object({
  name: t.String({ minLength: 1, maxLength: 120 }),
  agentId: t.Number(),
  prompt: t.String({ maxLength: 20_000 }),
  kind: t.UnionEnum(['work', 'review']),
});

export const createWorkflowBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 120 }),
  status: t.Optional(workflowStatus),
  trigger: t.Optional(workflowTrigger),
  columnId: t.Optional(t.Nullable(t.Number())),
  maxRounds: t.Optional(t.Integer({ minimum: 1, maximum: 10 })),
  steps: t.Array(workflowStep, { minItems: 1, maxItems: MAX_WORKFLOW_STEPS }),
});

export const updateWorkflowBody = t.Partial(createWorkflowBody);

export const startWorkflowRunBody = t.Object({
  input: t.Optional(t.String({ maxLength: 20_000 })),
  issueId: t.Optional(t.Number()),
});

export const WorkflowResponse = t.Object({
  id: t.Number(),
  name: t.String(),
  status: t.UnionEnum(['active', 'paused']),
  trigger: t.UnionEnum(['manual', 'status']),
  columnId: t.Nullable(t.Number()),
  maxRounds: t.Number(),
  steps: t.Array(workflowStep),
  runningRuns: t.Number(),
  lastRunStatus: t.Nullable(t.String()),
  createdAt: t.String(),
  updatedAt: t.String(),
});

export const WorkflowPageResponse = pageResponse(WorkflowResponse);

export const workflowPageQuery = t.Object(pageQueryFields);

const workflowRunStatus = t.UnionEnum(['running', 'success', 'failed', 'canceled']);

export const WorkflowRunResponse = t.Object({
  id: t.Number(),
  status: workflowRunStatus,
  issueId: t.Nullable(t.Number()),
  issueIdentifier: t.Nullable(t.String()),
  input: t.String(),
  round: t.Number(),
  stepCount: t.Number(),
  currentStep: t.Nullable(t.Number()),
  error: t.Nullable(t.String()),
  startedByName: t.Nullable(t.String()),
  createdAt: t.String(),
  finishedAt: t.Nullable(t.String()),
});

export const WorkflowRunListResponse = t.Array(WorkflowRunResponse);

export const WorkflowRunStepResponse = t.Object({
  agentRunId: t.Number(),
  position: t.Number(),
  round: t.Number(),
  name: t.String(),
  kind: t.UnionEnum(['work', 'review']),
  agentName: t.String(),
  executionState: agentExecutionState,
  output: t.Nullable(t.String()),
  error: t.Nullable(t.String()),
  startedAt: t.Nullable(t.String()),
  finishedAt: t.Nullable(t.String()),
});

export const WorkflowRunDetailResponse = t.Composite([
  WorkflowRunResponse,
  t.Object({ steps: t.Array(WorkflowRunStepResponse) }),
]);
