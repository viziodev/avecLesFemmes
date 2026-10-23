import { useId, useRef, useEffect, type ReactNode } from 'react';
import { Delete, Users } from 'lucide-react';

export function SecretCodePad({
  value,
  onChange,
  onComplete,
  disabled,
  label = 'Code secret',
  autoFocus = true,
}: {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  label?: string;
  autoFocus?: boolean;
}) {
  const id = useId(),
    input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) input.current?.focus();
  }, [autoFocus]);
  function update(next: string) {
    if (disabled) return;
    next = next.replace(/\D/g, '').slice(0, 4);
    if (next === value) return;
    onChange(next);
    if (next.length === 4 && onComplete) void onComplete(next);
  }
  return (
    <div className="secret-code-pad">
      <label className="secret-code-label" htmlFor={id}>
        {label}
      </label>
      <div className="secret-code-entry">
        <input
          ref={input}
          id={id}
          className="secret-code-input"
          type="password"
          inputMode="none"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={4}
          pattern="[0-9]{4}"
          required
          disabled={disabled}
          value={value}
          onChange={(event) => update(event.target.value)}
          aria-describedby={id + '-help'}
          enterKeyHint="go"
        />
        <div className="secret-code-dots" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={i < value.length ? 'filled' : ''} />
          ))}
        </div>
      </div>
      <p className="sr-only" id={id + '-help'}>
        Quatre chiffres. Utilisez le pavé numérique ou votre clavier. La validation se fait après le
        quatrième chiffre.
      </p>
      <div className="secret-code-keypad" aria-label="Pavé numérique">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'delete'].map((key, i) =>
          key ? (
            <button
              key={key}
              type="button"
              className="secret-code-key"
              disabled={disabled || (key === 'delete' && !value)}
              aria-label={key === 'delete' ? 'Effacer le dernier chiffre' : key}
              onClick={() => update(key === 'delete' ? value.slice(0, -1) : value + key)}
            >
              {key === 'delete' ? <Delete size={27} aria-hidden="true" /> : key}
            </button>
          ) : (
            <span key={'empty-' + i} aria-hidden="true" />
          ),
        )}
      </div>
    </div>
  );
}
export function SecretCodeScreen({
  title,
  name,
  subtitle,
  children,
}: {
  title: string;
  name?: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <main className="pwa-secret-screen">
      <div className="secret-brand">
        <span>
          <Users size={40} aria-hidden="true" />
        </span>
        <strong>AvecLesFemmes</strong>
      </div>
      <section aria-label={title} className="secret-code-content">
        <h1>{title}</h1>
        {name && <strong className="secret-account-name">{name}</strong>}
        {subtitle && <p className="secret-subtitle">{subtitle}</p>}
        {children}
      </section>
    </main>
  );
}
