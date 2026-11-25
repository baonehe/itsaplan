import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function LockedLabel({
  label,
  hint,
  className,
}: {
  label: string;
  hint: string;
  className?: string;
}) {
  return (
    <span
      title={hint}
      className={cn(
        'inline-flex w-fit items-center gap-1 text-xs font-medium text-warning',
        className,
      )}
    >
      <Lock className="size-3.5" />
      {label}
    </span>
  );
}
