'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useShell } from '@/context/shellContext';
import { useSettingsSectionText } from '@/hooks/useSectionLabels';
import { useAgentDirectory } from '@/hooks/useProjectAgents';
import SectionPageView from '@/components/common/page/SectionPageView';
import RequirePermission from '@/components/common/permissions/RequirePermission';
import { SettingsResourceProvider } from './context/settingsPermission';
import { SettingsHeaderAddButton } from './components/crud/SettingsHeaderAddButton';
import { SettingsWorkflows } from './components/workflows/SettingsWorkflows';

export default function SettingsWorkflowsPage() {
  const t = useTranslations('settings.workflows');
  const sectionText = useSettingsSectionText()('workflows');
  const { project } = useShell();
  const [addNew, setAddNew] = useState(false);
  const agents = useAgentDirectory().data ?? [];
  if (!project) return null;
  return (
    <SectionPageView
      title={sectionText.label}
      description={sectionText.description}
      wide
      actions={
        agents.length > 0 ? (
          <SettingsHeaderAddButton
            resource="agent_schedules"
            label={t('newTitle')}
            onClick={() => setAddNew(true)}
          />
        ) : null
      }
    >
      <SettingsResourceProvider resource="agent_schedules">
        <RequirePermission resource="agent_schedules" action="read">
          <SettingsWorkflows
            project={project}
            requestNew={addNew}
            onNewHandled={() => setAddNew(false)}
          />
        </RequirePermission>
      </SettingsResourceProvider>
    </SectionPageView>
  );
}
