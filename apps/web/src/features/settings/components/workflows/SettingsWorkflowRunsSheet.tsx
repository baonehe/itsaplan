import { useTranslations } from 'next-intl';
import type { AgentWorkflow } from '@/lib/api/endpoints/agentWorkflows';
import { useAgentWorkflowRuns, useCancelAgentWorkflowRun } from '@/services/agentWorkflows.service';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useSettingsCan } from '../../context/settingsPermission';
import { SettingsWorkflowRunItem } from './SettingsWorkflowRunItem';

export function SettingsWorkflowRunsSheet({
  projectKey,
  workflow,
  onClose,
}: {
  projectKey: string;
  workflow: AgentWorkflow | null;
  onClose: () => void;
}) {
  const t = useTranslations('settings.workflows');
  const can = useSettingsCan();
  const query = useAgentWorkflowRuns(projectKey, workflow?.id ?? null);
  const cancelRun = useCancelAgentWorkflowRun(projectKey);
  const runs = query.data ?? [];
  return (
    <Sheet open={workflow != null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b bg-muted/30">
          <SheetTitle className="truncate text-base">{workflow?.name}</SheetTitle>
          <SheetDescription className="text-xs">{t('runHistory')}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {query.isLoading && <ListSkeleton rows={4} className="p-4" rowClassName="h-12" />}
          {query.isError && (
            <p role="alert" className="p-4 text-xs text-destructive">
              {t('loadFailed')}
            </p>
          )}
          {query.isSuccess && runs.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">{t('noRuns')}</p>
          )}
          {workflow && runs.length > 0 && (
            <ul>
              {runs.map((run) => (
                <SettingsWorkflowRunItem
                  key={run.id}
                  projectKey={projectKey}
                  workflowId={workflow.id}
                  run={run}
                  canCancel={can('edit')}
                  canceling={cancelRun.isPending}
                  onCancel={() => cancelRun.mutate({ workflowId: workflow.id, runId: run.id })}
                />
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
