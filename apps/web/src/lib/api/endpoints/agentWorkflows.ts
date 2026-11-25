import { request } from '@/lib/api/core/client';
import type { AgentRun } from '@/lib/api/endpoints/agents';
import { pageQuery, type Page, type PageParams } from '@/lib/api/core/paging';

export type AgentWorkflowStepKind = 'work' | 'review';

export interface AgentWorkflowStep {
  name: string;
  agentId: number;
  prompt: string;
  kind: AgentWorkflowStepKind;
}

export type AgentWorkflowTrigger = 'manual' | 'status';

export type AgentWorkflowRunStatus = 'running' | 'success' | 'failed' | 'canceled';

export interface AgentWorkflow {
  id: number;
  name: string;
  status: 'active' | 'paused';
  trigger: AgentWorkflowTrigger;
  columnId: number | null;
  maxRounds: number;
  steps: AgentWorkflowStep[];
  runningRuns: number;
  lastRunStatus: AgentWorkflowRunStatus | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentWorkflowInput {
  name: string;
  status?: 'active' | 'paused';
  trigger: AgentWorkflowTrigger;
  columnId: number | null;
  maxRounds: number;
  steps: AgentWorkflowStep[];
}

export interface AgentWorkflowRun {
  id: number;
  status: AgentWorkflowRunStatus;
  issueId: number | null;
  issueIdentifier: string | null;
  input: string;
  round: number;
  stepCount: number;
  currentStep: number | null;
  error: string | null;
  startedByName: string | null;
  createdAt: string;
  finishedAt: string | null;
}

export interface AgentWorkflowRunStep {
  agentRunId: number;
  position: number;
  round: number;
  name: string;
  kind: AgentWorkflowStepKind;
  agentName: string;
  executionState: AgentRun['executionState'];
  output: string | null;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface AgentWorkflowRunDetail extends AgentWorkflowRun {
  steps: AgentWorkflowRunStep[];
}

const base = (projectKey: string) => `/projects/${projectKey}/workflows`;

export const listAgentWorkflows = (projectKey: string, params: PageParams) =>
  request<Page<AgentWorkflow>>(`${base(projectKey)}${pageQuery(params)}`);

export const createAgentWorkflow = (projectKey: string, input: AgentWorkflowInput) =>
  request<AgentWorkflow>(base(projectKey), { method: 'POST', body: JSON.stringify(input) });

export const updateAgentWorkflow = (
  projectKey: string,
  workflowId: number,
  patch: Partial<AgentWorkflowInput>,
) =>
  request<AgentWorkflow>(`${base(projectKey)}/${workflowId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });

export const deleteAgentWorkflow = (projectKey: string, workflowId: number) =>
  request<void>(`${base(projectKey)}/${workflowId}`, { method: 'DELETE' });

export const runAgentWorkflow = (projectKey: string, workflowId: number, input: string) =>
  request<AgentWorkflowRunDetail>(`${base(projectKey)}/${workflowId}/runs`, {
    method: 'POST',
    body: JSON.stringify({ input }),
  });

export const listAgentWorkflowRuns = (projectKey: string, workflowId: number) =>
  request<AgentWorkflowRun[]>(`${base(projectKey)}/${workflowId}/runs`);

export const getAgentWorkflowRun = (projectKey: string, workflowId: number, runId: number) =>
  request<AgentWorkflowRunDetail>(`${base(projectKey)}/${workflowId}/runs/${runId}`);

export const cancelAgentWorkflowRun = (projectKey: string, workflowId: number, runId: number) =>
  request<AgentWorkflowRunDetail>(`${base(projectKey)}/${workflowId}/runs/${runId}/cancel`, {
    method: 'POST',
  });
