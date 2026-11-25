import type { ProjectAgent } from '@/lib/api/endpoints/agents';
import type { AgentWorkflowStep } from '@/lib/api/endpoints/agentWorkflows';

export function newWorkflowStep(agents: ProjectAgent[]): AgentWorkflowStep {
  return { name: '', agentId: agents[0]?.id ?? 0, prompt: '', kind: 'work' };
}

export function stepsInOrder(steps: AgentWorkflowStep[]): boolean {
  return steps.every(
    (step, index) => step.kind === 'work' || (index > 0 && steps[index - 1]!.kind === 'work'),
  );
}

export function workflowRunDotClass(status: string): string {
  if (status === 'success') return 'bg-emerald-500';
  if (status === 'failed') return 'bg-red-500';
  if (status === 'canceled') return 'bg-muted-foreground/40';
  return 'bg-amber-500';
}
