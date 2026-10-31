import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export function Section({
  title,
  icon,
  actions,
  children,
  collapsible = false,
  defaultOpen = true,
}: {
  title: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="section">
      <header className="section-head">
        {collapsible ? (
          <button type="button" className="section-title section-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
            {icon}
            <span>{title}</span>
            <ChevronDown size={14} className={`section-chevron ${open ? 'is-open' : ''}`} />
          </button>
        ) : (
          <h3 className="section-title">
            {icon}
            <span>{title}</span>
          </h3>
        )}
        {actions && <div className="section-actions">{actions}</div>}
      </header>
      {(!collapsible || open) && <div className="section-body">{children}</div>}
    </section>
  );
}

export function Field({ label, value, hint, children }: { label: string; value?: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="field">
      <div className="field-head">
        <span className="field-label">{label}</span>
        {value !== undefined && <span className="field-value">{value}</span>}
      </div>
      {children}
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  label?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      className="slider"
      aria-label={label}
      min={min}
      max={max}
      step={step}
      value={value}
      style={{ ['--fill' as string]: `${pct}%` }}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

export interface Option<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
  hint?: string;
}

export function Segmented<T extends string>({ value, options, onChange, size = 'md' }: { value: T; options: Option<T>[]; onChange: (v: T) => void; size?: 'sm' | 'md' }) {
  return (
    <div className={`segmented segmented-${size}`} role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? 'is-active' : ''}
          onClick={() => onChange(o.value)}
          title={o.hint}
        >
          {o.icon}
          {o.label && <span>{o.label}</span>}
        </button>
      ))}
    </div>
  );
}

export function Chips<T extends string>({ value, options, onChange, columns = 3 }: { value: T; options: Option<T>[]; onChange: (v: T) => void; columns?: number }) {
  return (
    <div className="chips" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }} role="radiogroup">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={`chip ${value === o.value ? 'is-active' : ''}`} onClick={() => onChange(o.value)} title={o.hint}>
          {o.icon && <span className="chip-icon">{o.icon}</span>}
          <span className="chip-label">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; disabled?: boolean }) {
  const id = useId();
  return (
    <label className={`switch-row ${disabled ? 'is-disabled' : ''}`} htmlFor={id}>
      <span>{label}</span>
      <input id={id} type="checkbox" className="switch-input" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch" aria-hidden />
    </label>
  );
}

export function ColorInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label?: string }) {
  return (
    <label className="color-input" title={label ?? value}>
      <span className="color-dot" style={{ background: value }} />
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label ?? 'Color'} />
      <span className="color-hex">{value.toUpperCase()}</span>
    </label>
  );
}

export function Select<T extends string | number>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label?: string }) {
  return (
    <div className="select-wrap">
      <select
        className="input select"
        aria-label={label}
        value={String(value)}
        onChange={(e) => {
          const raw = e.target.value;
          const match = options.find((o) => String(o.value) === raw);
          if (match) onChange(match.value);
        }}
      >
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="select-chevron" />
    </div>
  );
}
