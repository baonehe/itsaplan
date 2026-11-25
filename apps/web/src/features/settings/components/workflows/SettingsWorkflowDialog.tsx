import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ProjectAgent } from '@/lib/api/endpoints/agents';
import type { Column } from '@/lib/api/endpoints/columns';
import type {
  AgentWorkflow,
  AgentWorkflowInput,
  AgentWorkflowStep,
  AgentWorkflowTrigger,
} from '@/lib/api/endpoints/agentWorkflows';
import Modal from '@/components/common/overlay/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { newWorkflowStep, stepsInOrder } from '../../utils/workflowSteps';
import { SettingsScheduleField } from '../schedules/SettingsScheduleField';
import { SettingsWorkflowStepList } from './SettingsWorkflowStepList';

export function SettingsWorkflowDialog({
  projectKey,
  agents,
  columns,
  initial,
  saving,
  onSave,
  onClose,
}: {
  projectKey: string;
  agents: ProjectAgent[];
  columns: Column[];
  initial?: AgentWorkflow;
  saving: boolean;
  onSave: (value: AgentWorkflowInput) => Promise<void>;
  onClose: () => void;
}) {
  const t = useTranslations('settings.workflows');
  const tCommon = useTranslations('common');
  const [name, setName] = useState(initial?.name ?? '');
  const [trigger, setTrigger] = useState<AgentWorkflowTrigger>(initial?.trigger ?? 'manual');
  const [columnId, setColumnId] = useState(String(initial?.columnId ?? columns[0]?.id ?? ''));
  const [maxRounds, setMaxRounds] = useState(String(initial?.maxRounds ?? 3));
  const [steps, setSteps] = useState<AgentWorkflowStep[]>(
    initial?.steps ?? [newWorkflowStep(agents)],
  );
  const rounds = Number(maxRounds);
  const isValid =
    name.trim().length > 0 &&
    (trigger === 'manual' || Number(columnId) > 0) &&
    Number.isInteger(rounds) &&
    rounds >= 1 &&
    rounds <= 10 &&
    stepsInOrder(steps) &&
    steps.every((step) => step.name.trim().length > 0 && step.agentId > 0);
  let submitLabel = initial ? t('save') : t('create');
  if (saving) submitLabel = tCommon('saving');

  async function submit() {
    if (!isValid) return;
    await onSave({
      name: name.trim(),
      trigger,
      columnId: trigger === 'status' ? Number(columnId) : null,
      maxRounds: rounds,
      steps: steps.map((step) => ({ ...step, name: step.name.trim(), prompt: step.prompt.trim() })),
    });
  }

  return (
    <Modal
      title={initial ? t('editTitle') : t('newTitle')}
      description={t('dialogDescription')}
      scope={projectKey}
      onClose={onClose}
      wide
    >
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-[1fr_12rem_6rem]">
          <SettingsScheduleField htmlFor="workflow-name" label={tCommon('name')}>
            <Input
              id="workflow-name"
              autoFocus
              required
              maxLength={120}
              value={name}
              placeholder={t('namePlaceholder')}
              onChange={(event) => setName(event.target.value)}
            />
          </SettingsScheduleField>
          <SettingsScheduleField htmlFor="workflow-trigger" label={t('trigger')}>
            <Select
              value={trigger}
              onValueChange={(value) => setTrigger(value as AgentWorkflowTrigger)}
            >
              <SelectTrigger id="workflow-trigger" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">{t('triggers.manual')}</SelectItem>
                <SelectItem value="status">{t('triggers.status')}</SelectItem>
              </SelectContent>
            </Select>
          </SettingsScheduleField>
          <SettingsScheduleField htmlFor="workflow-rounds" label={t('maxRounds')}>
            <Input
              id="workflow-rounds"
              type="number"
              min={1}
              max={10}
              value={maxRounds}
              title={t('maxRoundsHint')}
              onChange={(event) => setMaxRounds(event.target.value)}
            />
          </SettingsScheduleField>
        </div>

        {trigger === 'status' && (
          <SettingsScheduleField htmlFor="workflow-column" label={t('column')}>
            <Select value={columnId} onValueChange={setColumnId}>
              <SelectTrigger id="workflow-column" className="w-full sm:w-64">
                <SelectValue placeholder={t('selectColumn')} />
              </SelectTrigger>
              <SelectContent>
                {columns.map((column) => (
                  <SelectItem key={column.id} value={String(column.id)}>
                    {column.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsScheduleField>
        )}

        <SettingsWorkflowStepList steps={steps} agents={agents} onChange={setSteps} />

        <div className="flex justify-end gap-2 border-t border-border/50 pt-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            {tCommon('cancel')}
          </Button>
          <Button type="submit" disabled={!isValid || saving}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
