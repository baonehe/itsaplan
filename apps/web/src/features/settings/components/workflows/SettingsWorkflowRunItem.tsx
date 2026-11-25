import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import type { AgentWorkflowRun } from '@/lib/api/endpoints/agentWorkflows';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { workflowRunDotClass } from '../../utils/workflowSteps';
import { SettingsWorkflowRunSteps } from './SettingsWorkflowRunSteps';

export function SettingsWorkflowRunItem({
  projectKey,
  workflowId,
  run,
  canCancel,
  canceling,
  onCancel,
}: {
  projectKey: string;
  workflowId: number;
  run: AgentWorkflowRun;
  canCancel: boolean;
  canceling: boolean;
  onCancel: () => void;
}) {
  const t = useTranslations('settings.workflows');
  const format = useFormatter();
  const [open, setOpen] = useState(run.status === 'running');
  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <li className="space-y-2 border-b p-4">
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-start gap-2 text-start"
          onClick={() => setOpen(!open)}
        >
          <Chevron className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span
            className={cn('mt-1.5 size-2 shrink-0 rounded-full', workflowRunDotClass(run.status))}
          />
          <span className="min-w-0 space-y-0.5">
            <span className="block text-sm font-medium">
              {t(`runStatus.${run.status}`)}
              {run.currentStep !== null &&
                ` · ${t('atStep', { step: run.currentStep + 1, count: run.stepCount })}`}
              {run.round > 1 && ` · ${t('round', { round: run.round })}`}
            </span>
            <span className="block text-xs text-muted-foreground">
              {format.dateTime(new Date(run.createdAt), {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
              {run.issueIdentifier && ` · ${run.issueIdentifier}`}
              {run.startedByName && ` · ${t('startedBy', { name: run.startedByName })}`}
            </span>
          </span>
        </button>
        {canCancel && run.status === 'running' && (
          <Button size="sm" variant="outline" disabled={canceling} onClick={onCancel}>
            {t('cancelRun')}
          </Button>
        )}
      </div>
      {run.error && <p className="ps-10 text-xs text-destructive">{run.error}</p>}
      {open && (
        <div className="space-y-2 ps-10">
          {run.input && (
            <p
              dir="auto"
              className="line-clamp-3 text-xs whitespace-pre-wrap text-muted-foreground"
            >
              {run.input}
            </p>
          )}
          <SettingsWorkflowRunSteps
            projectKey={projectKey}
            workflowId={workflowId}
            runId={run.id}
          />
        </div>
      )}
    </li>
  );
}
