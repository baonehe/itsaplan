import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ProjectAgent } from '@/lib/api/endpoints/agents';
import type { AgentWorkflowStep } from '@/lib/api/endpoints/agentWorkflows';
import { Button } from '@/components/ui/button';
import { newWorkflowStep, stepsInOrder } from '../../utils/workflowSteps';
import { SettingsWorkflowStepFields } from './SettingsWorkflowStepFields';

const MAX_STEPS = 10;

export function SettingsWorkflowStepList({
  steps,
  agents,
  onChange,
}: {
  steps: AgentWorkflowStep[];
  agents: ProjectAgent[];
  onChange: (steps: AgentWorkflowStep[]) => void;
}) {
  const t = useTranslations('settings.workflows');

  function move(index: number, offset: -1 | 1) {
    const next = [...steps];
    const [moved] = next.splice(index, 1);
    next.splice(index + offset, 0, moved!);
    onChange(next);
  }

  return (
    <div className="space-y-3 border-t border-border/50 pt-4">
      <p className="text-sm font-medium">{t('steps')}</p>
      {steps.map((step, index) => (
        <SettingsWorkflowStepFields
          key={index}
          index={index}
          count={steps.length}
          step={step}
          agents={agents}
          onChange={(next) => onChange(steps.map((one, at) => (at === index ? next : one)))}
          onMove={(offset) => move(index, offset)}
          onRemove={() => onChange(steps.filter((_, at) => at !== index))}
        />
      ))}
      {!stepsInOrder(steps) && <p className="text-xs text-destructive">{t('stepOrderHint')}</p>}
      {steps.length < MAX_STEPS && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...steps, newWorkflowStep(agents)])}
        >
          <Plus className="size-3.5" />
          {t('addStep')}
        </Button>
      )}
    </div>
  );
}
