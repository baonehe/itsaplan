import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { AgentWorkflow, AgentWorkflowInput } from '@/lib/api/endpoints/agentWorkflows';
import { aiAgentsPath } from '@/utils/paths';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/page/EmptyState';
import ListPager from '@/components/common/ListPager';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import { usePaging } from '@/hooks/usePaging';
import { useAgentDirectory } from '@/hooks/useProjectAgents';
import {
  useAgentWorkflows,
  useCreateAgentWorkflow,
  useDeleteAgentWorkflow,
  useRunAgentWorkflow,
  useUpdateAgentWorkflow,
} from '@/services/agentWorkflows.service';
import { useSettingsCan } from '../../context/settingsPermission';
import SettingsConfirmDeleteDialog from '../crud/SettingsConfirmDeleteDialog';
import { SettingsWorkflowDialog } from './SettingsWorkflowDialog';
import { SettingsWorkflowRunsSheet } from './SettingsWorkflowRunsSheet';
import { SettingsWorkflowStartDialog } from './SettingsWorkflowStartDialog';
import { SettingsWorkflowsTable } from './SettingsWorkflowsTable';

export function SettingsWorkflows({
  project,
  requestNew,
  onNewHandled,
}: {
  project: ProjectDetail;
  requestNew: boolean;
  onNewHandled: () => void;
}) {
  const t = useTranslations('settings.workflows');
  const projectKey = project.project.ref;
  const can = useSettingsCan();
  const paging = usePaging();
  const workflowsQuery = useAgentWorkflows(projectKey, paging.params);
  const agentsQuery = useAgentDirectory();
  const workflows = workflowsQuery.data?.items ?? [];
  const agents = agentsQuery.data ?? [];
  const createWorkflow = useCreateAgentWorkflow(projectKey);
  const updateWorkflow = useUpdateAgentWorkflow(projectKey);
  const deleteWorkflow = useDeleteAgentWorkflow(projectKey);
  const runWorkflow = useRunAgentWorkflow(projectKey);
  const [editing, setEditing] = useState<AgentWorkflow | 'new' | null>(null);
  const [deleting, setDeleting] = useState<AgentWorkflow | null>(null);
  const [starting, setStarting] = useState<AgentWorkflow | null>(null);
  const [history, setHistory] = useState<AgentWorkflow | null>(null);

  useEffect(() => {
    if (!requestNew) return;
    setEditing('new');
    onNewHandled();
  }, [requestNew, onNewHandled]);

  if (agentsQuery.isError || workflowsQuery.isError) {
    return (
      <EmptyState title={t('loadFailed')} description={t('loadFailedHint')}>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void Promise.all([agentsQuery.refetch(), workflowsQuery.refetch()])}
        >
          {t('tryAgain')}
        </Button>
      </EmptyState>
    );
  }

  if (agentsQuery.isLoading || workflowsQuery.isLoading) {
    return <ListSkeleton rows={3} rowClassName="h-12" />;
  }

  if (agents.length === 0) {
    return (
      <EmptyState title={t('noAgents')} description={t('noAgentsHint')}>
        {can('edit') && (
          <Button size="sm" asChild>
            <Link href={aiAgentsPath(projectKey)}>{t('createAgent')}</Link>
          </Button>
        )}
      </EmptyState>
    );
  }

  async function save(value: AgentWorkflowInput) {
    if (editing === 'new') await createWorkflow.mutateAsync(value);
    else if (editing) await updateWorkflow.mutateAsync({ id: editing.id, patch: value });
    setEditing(null);
  }

  async function start(workflow: AgentWorkflow, input: string) {
    await runWorkflow.mutateAsync({ id: workflow.id, input });
    toast.success(t('started'));
    setStarting(null);
    setHistory(workflow);
  }

  return (
    <>
      {workflows.length === 0 ? (
        <EmptyState title={t('empty')} description={t('emptyHint')} />
      ) : (
        <div className="space-y-4">
          <SettingsWorkflowsTable
            workflows={workflows}
            columns={project.columns}
            onToggle={(workflow) =>
              updateWorkflow.mutate({
                id: workflow.id,
                patch: { status: workflow.status === 'active' ? 'paused' : 'active' },
              })
            }
            onRun={setStarting}
            onHistory={setHistory}
            onEdit={setEditing}
            onDelete={setDeleting}
          />
          <ListPager paging={paging} total={workflowsQuery.data?.total ?? 0} />
        </div>
      )}

      {editing && (
        <SettingsWorkflowDialog
          key={editing === 'new' ? 'new' : editing.id}
          projectKey={projectKey}
          agents={agents}
          columns={project.columns}
          initial={editing === 'new' ? undefined : editing}
          saving={createWorkflow.isPending || updateWorkflow.isPending}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}

      {starting && (
        <SettingsWorkflowStartDialog
          projectKey={projectKey}
          workflow={starting}
          starting={runWorkflow.isPending}
          onStart={(input) => start(starting, input)}
          onClose={() => setStarting(null)}
        />
      )}

      {deleting && (
        <SettingsConfirmDeleteDialog
          title={t('delete')}
          confirmLabel={t('delete')}
          message={t.rich('deleteMessage', {
            name: deleting.name,
            v: (chunks) => <span className="font-medium">{chunks}</span>,
          })}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await deleteWorkflow.mutateAsync(deleting.id);
            setDeleting(null);
          }}
        />
      )}

      <SettingsWorkflowRunsSheet
        projectKey={projectKey}
        workflow={history}
        onClose={() => setHistory(null)}
      />
    </>
  );
}
