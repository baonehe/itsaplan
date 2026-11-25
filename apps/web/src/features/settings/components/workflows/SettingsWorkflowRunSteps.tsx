import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAgentWorkflowRun } from '@/services/agentWorkflows.service';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import { cn } from '@/lib/utils';
import { runnerQueuePath } from '@/utils/paths';
import { workflowRunDotClass } from '../../utils/workflowSteps';

export function SettingsWorkflowRunSteps({
  projectKey,
  workflowId,
  runId,
}: {
  projectKey: string;
  workflowId: number;
  runId: number;
}) {
  const t = useTranslations('settings.workflows');
  const query = useAgentWorkflowRun(projectKey, workflowId, runId);
  if (query.isLoading) return <ListSkeleton rows={2} rowClassName="h-10" />;
  if (!query.data) return null;
  return (
    <ol className="space-y-2">
      {query.data.steps.map((step) => (
        <li key={step.agentRunId} className="space-y-1.5 rounded-md border bg-background p-2.5">
          <div className="flex items-center gap-2 text-sm">
            <span
              className={cn(
                'size-2 shrink-0 rounded-full',
                workflowRunDotClass(step.executionState),
              )}
            />
            <span className="font-medium">
              {step.position + 1}. {step.name}
            </span>
            <span className="text-xs text-muted-foreground">
              {step.agentName} · {t(`stepState.${step.executionState}`)}
              {step.round > 1 && ` · ${t('round', { round: step.round })}`}
            </span>
            <Link
              href={`${runnerQueuePath(projectKey)}/${step.agentRunId}`}
              className="ms-auto text-muted-foreground hover:text-foreground"
              aria-label={t('openRun')}
              title={t('openRun')}
            >
              <ExternalLink className="size-3.5" />
            </Link>
          </div>
          {step.error && <p className="text-xs text-destructive">{step.error}</p>}
          {step.output && (
            <p
              dir="auto"
              className="line-clamp-6 text-xs whitespace-pre-wrap text-muted-foreground"
            >
              {step.output}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
