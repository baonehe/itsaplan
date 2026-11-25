import { History, MoreHorizontal, Pause, Pencil, Play, Trash2, Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AgentWorkflow } from '@/lib/api/endpoints/agentWorkflows';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TableCell, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import SettingsIconButton from '../SettingsIconButton';
import { useSettingsCan } from '../../context/settingsPermission';
import { workflowRunDotClass } from '../../utils/workflowSteps';

export function SettingsWorkflowRow({
  workflow,
  columnName,
  onToggle,
  onRun,
  onHistory,
  onEdit,
  onDelete,
}: {
  workflow: AgentWorkflow;
  columnName: string | null;
  onToggle: () => void;
  onRun: () => void;
  onHistory: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations('settings.workflows');
  const can = useSettingsCan();
  const automatic = workflow.trigger === 'status';
  return (
    <TableRow className="cursor-pointer" onClick={onHistory}>
      <TableCell className="px-3 py-4 align-top whitespace-normal">
        <div className="flex min-w-0 items-start gap-2.5">
          <span
            className={cn(
              'mt-[7px] size-2 shrink-0 rounded-full',
              workflow.status === 'active' ? 'bg-emerald-500' : 'bg-muted-foreground/40',
            )}
            title={t(workflow.status === 'active' ? 'statusActive' : 'statusPaused')}
          />
          <div className="flex min-w-0 flex-col gap-0.5 pt-0.5">
            <span className="truncate text-sm font-medium">{workflow.name}</span>
            <span className="truncate text-xs text-muted-foreground">
              {workflow.steps.map((step) => step.name).join(' → ')}
            </span>
          </div>
        </div>
      </TableCell>
      <TableCell className="px-3 py-4 align-top text-sm whitespace-normal">
        {automatic ? t('entersColumn', { column: columnName ?? '' }) : t('manual')}
      </TableCell>
      <TableCell className="px-3 py-4 align-top whitespace-normal">
        {workflow.lastRunStatus ? (
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'size-2 shrink-0 rounded-full',
                workflowRunDotClass(workflow.lastRunStatus),
              )}
            />
            <span className="text-sm">{t(`runStatus.${workflow.lastRunStatus}`)}</span>
            {workflow.runningRuns > 1 && (
              <span className="text-xs text-muted-foreground">
                {t('running', { count: workflow.runningRuns })}
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">{t('noRunsShort')}</span>
        )}
      </TableCell>
      <TableCell className="px-3 py-3 align-top">
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {can('edit') && (
            <SettingsIconButton title={t('run')} onClick={onRun}>
              <Zap className="size-4" />
            </SettingsIconButton>
          )}
          {can('edit') && automatic && (
            <SettingsIconButton
              title={workflow.status === 'active' ? t('pause') : t('resume')}
              onClick={onToggle}
            >
              {workflow.status === 'active' ? (
                <Pause className="size-4" />
              ) : (
                <Play className="size-4" />
              )}
            </SettingsIconButton>
          )}
          <SettingsIconButton title={t('runHistory')} onClick={onHistory}>
            <History className="size-4" />
          </SettingsIconButton>
          {(can('edit') || can('delete')) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('moreActions')}
                  className="size-11 text-muted-foreground hover:text-foreground sm:size-8"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {can('edit') && (
                  <DropdownMenuItem className="min-h-11 sm:min-h-8" onSelect={onEdit}>
                    <Pencil />
                    {t('edit')}
                  </DropdownMenuItem>
                )}
                {can('edit') && can('delete') && <DropdownMenuSeparator />}
                {can('delete') && (
                  <DropdownMenuItem
                    className="min-h-11 sm:min-h-8"
                    variant="destructive"
                    onSelect={onDelete}
                  >
                    <Trash2 />
                    {t('delete')}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
