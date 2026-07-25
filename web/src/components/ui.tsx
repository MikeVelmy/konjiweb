import { useEffect, useState, type ReactNode } from 'react';

export function Screen({
  children,
  flush,
}: {
  children: ReactNode;
  flush?: boolean;
}) {
  return <div className={flush ? 'screen screen--flush' : 'screen'}>{children}</div>;
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty">
      <p className="title" style={{ fontSize: '1.15rem' }}>
        {title}
      </p>
      <p className="sub" style={{ marginInline: 'auto' }}>
        {body}
      </p>
    </div>
  );
}

export function Button({
  children,
  variant = 'primary',
  ...rest
}: {
  children: ReactNode;
  variant?: 'primary' | 'ghost' | 'amber';
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = variant === 'primary' ? 'btn' : `btn btn--${variant}`;
  return (
    <button type="button" className={cls} {...rest}>
      {children}
    </button>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string; disabled?: boolean }[];
  value: T | null;
  onChange: (next: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={opt.value === value}
          disabled={opt.disabled}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Replaces the native build's Alert. Auto-dismisses, and sits above the tab bar
 * so it never covers the primary action.
 */
export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, 3600);
    return () => clearTimeout(t);
  }, [message, onDone]);

  if (!message) return null;
  return (
    <div className="toast" role="status" aria-live="polite">
      {message}
    </div>
  );
}

export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  return {
    message,
    show: setMessage,
    clear: () => setMessage(null),
  };
}

export function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
