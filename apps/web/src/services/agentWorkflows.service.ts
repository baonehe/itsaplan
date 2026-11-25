import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelAgentWorkflowRun,
  createAgentWorkflow,
  deleteAgentWorkflow,
  getAgentWorkflowRun,
  listAgentWorkflowRuns,
  listAgentWorkflows,
  runAgentWorkflow,
  updateAgentWorkflow,
  type AgentWorkflowInput,
} from '@/lib/api/endpoints/agentWorkflows';
import type { PageParams } from '@/lib/api/core/paging';
import { qk } from '@/services/queryKeys';
import { useLiveRefresh } from '@/hooks/useLiveRefresh';
import { usePermissions } from '@/hooks/usePermissions';
import { revScope } from '@/utils/revScopes';

function useWorkflowRefresh(projectKey: string, active: boolean) {
  const { can } = usePermissions();
  const readsAgents = can('ai_agents', 'read');
  useLiveRefresh({
    scope: active ? revScope.runnerQueue : null,
    targets: [qk.agentWorkflows(projectKey)],
    enabled: readsAgents,
  });
  return readsAgents ? false : 5_000;
}

export function useAgentWorkflows(projectKey: string, params: PageParams) {
  const pollMs = useWorkflowRefresh(projectKey, true);
  return useQuery({
    queryKey: qk.agentWorkflowPage(projectKey, params),
    queryFn: () => listAgentWorkflows(projectKey, params),
    placeholderData: keepPreviousData,
    refetchInterval: (query) =>
      query.state.data?.items.some((workflow) => workflow.runningRuns > 0) ? pollMs : false,
  });
}

export function useAgentWorkflowRuns(projectKey: string, workflowId: number | null) {
  const pollMs = useWorkflowRefresh(projectKey, workflowId != null);
  return useQuery({
    queryKey: qk.agentWorkflowRuns(projectKey, workflowId ?? 0),
    queryFn: () => listAgentWorkflowRuns(projectKey, workflowId!),
    enabled: workflowId != null,
    refetchInterval: pollMs,
  });
}

export function useAgentWorkflowRun(
  projectKey: string,
  workflowId: number | null,
  runId: number | null,
) {
  const pollMs = useWorkflowRefresh(projectKey, runId != null);
  return useQuery({
    queryKey: qk.agentWorkflowRun(projectKey, workflowId ?? 0, runId ?? 0),
    queryFn: () => getAgentWorkflowRun(projectKey, workflowId!, runId!),
    enabled: workflowId != null && runId != null,
    refetchInterval: pollMs,
  });
}

export function useCreateAgentWorkflow(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AgentWorkflowInput) => createAgentWorkflow(projectKey, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.agentWorkflows(projectKey) }),
  });
}

export function useUpdateAgentWorkflow(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Partial<AgentWorkflowInput> }) =>
      updateAgentWorkflow(projectKey, id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.agentWorkflows(projectKey) }),
  });
}

export function useDeleteAgentWorkflow(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteAgentWorkflow(projectKey, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.agentWorkflows(projectKey) }),
  });
}

export function useRunAgentWorkflow(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: string }) =>
      runAgentWorkflow(projectKey, id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.agentWorkflows(projectKey) }),
  });
}

export function useCancelAgentWorkflowRun(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ workflowId, runId }: { workflowId: number; runId: number }) =>
      cancelAgentWorkflowRun(projectKey, workflowId, runId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.agentWorkflows(projectKey) }),
  });
}
