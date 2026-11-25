import { Workflow } from 'lucide-react';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { SettingsSection } from '@/utils/settingsSections';
import SettingsWorkflowsPage from '@/features/settings/SettingsWorkflowsPage';

export default function useProjectSettingsSections(
  _project: ProjectDetail | null,
  core: SettingsSection[],
): SettingsSection[] {
  const at = core.findIndex((section) => section.slug === 'schedules') + 1;
  return [
    ...core.slice(0, at),
    {
      slug: 'workflows',
      icon: Workflow,
      resource: 'agent_schedules',
      group: 'ai-team',
      Component: SettingsWorkflowsPage,
    },
    ...core.slice(at),
  ];
}
