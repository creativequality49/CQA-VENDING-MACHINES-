import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'quiet';

export function Button({ variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const styles: Record<Variant, string> = {
    primary: 'bg-ink text-paper hover:bg-[#2b3746]',
    secondary: 'border-[1.5px] border-ink bg-card text-ink hover:bg-paper',
    quiet: 'text-slate underline-offset-4 hover:text-ink hover:underline',
  };
  return (
    <button
      {...props}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
    />
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-3 py-10 text-slate">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-rule border-t-ink motion-reduce:animate-none" />
      {label}…
    </div>
  );
}

export function ErrorNote({ children, onRetry }: { children: ReactNode; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border-[1.5px] border-signal bg-card px-4 py-3 text-signal">
      <span>{children}</span>
      {onRetry && <Button variant="secondary" onClick={onRetry} className="min-h-9 py-1.5 text-sm">Try again</Button>}
    </div>
  );
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string | null; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block font-semibold">{label}</span>
      {hint && <span className="mt-0.5 block text-sm text-slate">{hint}</span>}
      <span className="mt-2 block">{children}</span>
      {error && <span className="mt-1.5 block text-sm font-medium text-signal">{error}</span>}
    </label>
  );
}

export function UrgencyTag({ urgency }: { urgency: string | null }) {
  if (urgency === 'emergency') return <span className="rounded bg-signal px-2 py-0.5 text-sm font-bold text-white">Emergency</span>;
  if (urgency === 'urgent') return <span className="rounded border-[1.5px] border-ink px-2 py-0.5 text-sm font-bold">Urgent</span>;
  return null;
}
