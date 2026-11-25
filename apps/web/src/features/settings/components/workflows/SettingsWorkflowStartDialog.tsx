import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { AgentWorkflow } from '@/lib/api/endpoints/agentWorkflows';
import Modal from '@/components/common/overlay/Modal';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { SettingsScheduleField } from '../schedules/SettingsScheduleField';

export function SettingsWorkflowStartDialog({
  projectKey,
  workflow,
  starting,
  onStart,
  onClose,
}: {
  projectKey: string;
  workflow: AgentWorkflow;
  starting: boolean;
  onStart: (input: string) => Promise<void>;
  onClose: () => void;
}) {
  const t = useTranslations('settings.workflows');
  const tCommon = useTranslations('common');
  const [input, setInput] = useState('');
  return (
    <Modal
      title={t('runTitle', { name: workflow.name })}
      description={t('runDescription')}
      scope={projectKey}
      onClose={onClose}
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void onStart(input.trim());
        }}
      >
        <SettingsScheduleField htmlFor="workflow-input" label={t('input')}>
          <Textarea
            id="workflow-input"
            autoFocus
            maxLength={20_000}
            value={input}
            placeholder={t('inputPlaceholder')}
            onChange={(event) => setInput(event.target.value)}
            className="min-h-32 resize-y"
          />
        </SettingsScheduleField>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={starting}>
            {tCommon('cancel')}
          </Button>
          <Button type="submit" disabled={starting}>
            {starting ? t('starting') : t('start')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
