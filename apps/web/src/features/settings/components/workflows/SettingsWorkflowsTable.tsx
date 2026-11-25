import { useTranslations } from 'next-intl';
import type { AgentWorkflow } from '@/lib/api/endpoints/agentWorkflows';
import type { Column } from '@/lib/api/endpoints/columns';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SettingsWorkflowRow } from './SettingsWorkflowRow';

export function SettingsWorkflowsTable({
  workflows,
  columns,
  onToggle,
  onRun,
  onHistory,
  onEdit,
  onDelete,
}: {
  workflows: AgentWorkflow[];
  columns: Column[];
  onToggle: (workflow: AgentWorkflow) => void;
  onRun: (workflow: AgentWorkflow) => void;
  onHistory: (workflow: AgentWorkflow) => void;
  onEdit: (workflow: AgentWorkflow) => void;
  onDelete: (workflow: AgentWorkflow) => void;
}) {
  const t = useTranslations('settings.workflows');
  const tCommon = useTranslations('common');
  const head = 'text-xs font-medium text-muted-foreground';
  return (
    <Table className="min-w-[820px] table-fixed">
      <colgroup>
        <col className="w-[42%]" />
        <col className="w-[22%]" />
        <col className="w-[18%]" />
        <col className="w-[18%]" />
      </colgroup>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className={head}>{t('workflow')}</TableHead>
          <TableHead className={head}>{t('trigger')}</TableHead>
          <TableHead className={head}>{t('lastRun')}</TableHead>
          <TableHead className={`text-end ${head}`}>{tCommon('actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {workflows.map((workflow) => (
          <SettingsWorkflowRow
            key={workflow.id}
            workflow={workflow}
            columnName={columns.find((column) => column.id === workflow.columnId)?.name ?? null}
            onToggle={() => onToggle(workflow)}
            onRun={() => onRun(workflow)}
            onHistory={() => onHistory(workflow)}
            onEdit={() => onEdit(workflow)}
            onDelete={() => onDelete(workflow)}
          />
        ))}
      </TableBody>
    </Table>
  );
}
