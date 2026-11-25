import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ProjectAgent } from '@/lib/api/endpoints/agents';
import type { AgentWorkflowStep, AgentWorkflowStepKind } from '@/lib/api/endpoints/agentWorkflows';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SettingsScheduleField } from '../schedules/SettingsScheduleField';
import { SettingsWorkflowStepButton as StepButton } from './SettingsWorkflowStepButton';

export function SettingsWorkflowStepFields({
  index,
  count,
  step,
  agents,
  onChange,
  onMove,
  onRemove,
}: {
  index: number;
  count: number;
  step: AgentWorkflowStep;
  agents: ProjectAgent[];
  onChange: (step: AgentWorkflowStep) => void;
  onMove: (offset: -1 | 1) => void;
  onRemove: () => void;
}) {
  const t = useTranslations('settings.workflows');
  const id = `workflow-step-${index}`;
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <span className="me-auto text-sm font-medium">
          {t('stepNumber', { number: index + 1 })}
        </span>
        <StepButton label={t('moveUp')} disabled={index === 0} onClick={() => onMove(-1)}>
          <ArrowUp className="size-4" />
        </StepButton>
        <StepButton label={t('moveDown')} disabled={index === count - 1} onClick={() => onMove(1)}>
          <ArrowDown className="size-4" />
        </StepButton>
        <StepButton label={t('removeStep')} disabled={count === 1} onClick={onRemove}>
          <Trash2 className="size-4" />
        </StepButton>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_8rem]">
        <SettingsScheduleField htmlFor={`${id}-name`} label={t('stepName')}>
          <Input
            id={`${id}-name`}
            required
            maxLength={120}
            value={step.name}
            placeholder={t('stepNamePlaceholder')}
            onChange={(event) => onChange({ ...step, name: event.target.value })}
          />
        </SettingsScheduleField>
        <SettingsScheduleField htmlFor={`${id}-agent`} label={t('agent')}>
          <Select
            value={step.agentId > 0 ? String(step.agentId) : ''}
            onValueChange={(value) => onChange({ ...step, agentId: Number(value) })}
          >
            <SelectTrigger id={`${id}-agent`} className="w-full" aria-required="true">
              <SelectValue placeholder={t('selectAgent')} />
            </SelectTrigger>
            <SelectContent>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={String(agent.id)}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsScheduleField>
        <SettingsScheduleField htmlFor={`${id}-kind`} label={t('kind')}>
          <Select
            value={step.kind}
            onValueChange={(value) => onChange({ ...step, kind: value as AgentWorkflowStepKind })}
          >
            <SelectTrigger id={`${id}-kind`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="work">{t('kinds.work')}</SelectItem>
              <SelectItem value="review">{t('kinds.review')}</SelectItem>
            </SelectContent>
          </Select>
        </SettingsScheduleField>
      </div>
      <SettingsScheduleField htmlFor={`${id}-prompt`} label={t('stepPrompt')}>
        <Textarea
          id={`${id}-prompt`}
          maxLength={20_000}
          value={step.prompt}
          placeholder={t('stepPromptPlaceholder')}
          onChange={(event) => onChange({ ...step, prompt: event.target.value })}
          className="min-h-20 resize-y"
        />
        {step.kind === 'review' && (
          <p className="text-xs text-muted-foreground">{t('reviewHint')}</p>
        )}
      </SettingsScheduleField>
    </div>
  );
}
