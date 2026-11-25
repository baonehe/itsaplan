import { Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

export function ToolLockedNotice({
  integration,
  className,
}: {
  integration: string;
  className?: string;
}) {
  const t = useTranslations('teams.tools');
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-lg bg-muted/50 px-3 py-2.5',
        className,
      )}
    >
      <Lock className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">
          {t('lockedIntegration', { integration })}
        </p>
        <p className="text-xs text-muted-foreground">{t('lockedIntegrationHint')}</p>
      </div>
    </div>
  );
}
