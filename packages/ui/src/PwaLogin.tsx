import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Eye, EyeOff, KeyRound, Users } from 'lucide-react';
import { type components } from '@aveclesfemmes/api-client';
import { SecretCodePad, SecretCodeScreen } from './SecretCode';

type Actor = components['schemas']['ActorView'];
type Account = Pick<Actor, 'login' | 'name' | 'hasSecretCode' | 'phone'>;
export const accountKey = 'alf:pwa:remembered-account';
export function normalizePhone(value: string) {
  const compact = value.trim().replace(/[\s().-]/g, '');
  if (/^\d{9}$/.test(compact)) return '+221' + compact;
  return compact.startsWith('00') ? '+' + compact.slice(2) : compact;
}
export function rememberAccount(actor: Actor) {
  localStorage.setItem(
    accountKey,
    JSON.stringify({
      login: actor.login,
      name: actor.name,
      ...(actor.hasSecretCode === true ? { hasSecretCode: true } : {}),
      ...(actor.phone ? { phone: actor.phone } : {}),
    }),
  );
}
export function readAccount(): Account | null {
  try {
    const account = JSON.parse(localStorage.getItem(accountKey) || 'null');
    if (
      account &&
      typeof account.login === 'string' &&
      account.login.trim() &&
      account.login.length <= 100 &&
      typeof account.name === 'string' &&
      account.name.length <= 200
    )
      return {
        login: account.login,
        name: account.name,
        ...(account.hasSecretCode === true ? { hasSecretCode: true } : {}),
        ...(typeof account.phone === 'string' && /^\+[1-9]\d{7,14}$/.test(account.phone)
          ? { phone: account.phone }
          : {}),
      };
  } catch {
    /* Storage is optional. */
  }
  return null;
}
export function PwaLogin({
  onLogin,
  authenticate,
  reason,
}: {
  onLogin: (actor: Actor, recovery?: boolean) => void;
  authenticate?: (
    identity: string,
    secret: string,
    numeric?: boolean,
    phoneLogin?: boolean,
  ) => Promise<Actor>;
  reason?: string;
}) {
  const [account, setAccount] = useState(readAccount);
  const [phone, setPhone] = useState('');
  const [phoneStep, setPhoneStep] = useState(false);
  const [password, setPassword] = useState('');
  const [online, setOnline] = useState(navigator.onLine);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [demoPin, setDemoPin] = useState<string | null>(null);
  const submitting = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const numeric = online && (!!account || phoneStep);
  useEffect(() => {
    const network = () => {
      setOnline(navigator.onLine);
      setPassword('');
      setError('');
    };
    const storage = (event: StorageEvent) => {
      if (event.key !== accountKey) return;
      setAccount(readAccount());
      setPassword('');
      setPhoneStep(false);
      setError('');
    };
    window.addEventListener('online', network);
    window.addEventListener('offline', network);
    window.addEventListener('storage', storage);
    return () => {
      window.removeEventListener('online', network);
      window.removeEventListener('offline', network);
      window.removeEventListener('storage', storage);
    };
  }, []);
  useEffect(() => {
    input.current?.focus();
  }, [account, online, phoneStep]);
  useEffect(() => {
    let active = true;
    fetch('/api/v1/auth/demo')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && data?.isDemo === true && /^\d{4}$/.test(data.demoPin))
          setDemoPin(data.demoPin);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  function next(event: FormEvent) {
    event.preventDefault();
    const canonical = normalizePhone(phone);
    if (!/^\+[1-9]\d{7,14}$/.test(canonical)) {
      setError('Saisissez un numéro valide, par exemple 77 000 00 00 ou +221770000000.');
      return;
    }
    setPhone(canonical);
    setPassword('');
    setError('');
    setPhoneStep(true);
  }
  async function submit(event?: FormEvent, secret = password) {
    event?.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    const phoneLogin = numeric && (!account || !!account.phone);
    const identity = phoneLogin ? account?.phone || phone : account?.login || '';
    try {
      let actor: Actor;
      if (authenticate) actor = await authenticate(identity, secret, numeric, phoneLogin);
      else {
        const response = await fetch(
          numeric
            ? phoneLogin
              ? '/api/v1/auth/login/phone-pin'
              : '/api/v1/auth/login/secret-code'
            : '/api/v1/auth/login',
          {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'AvecLesFemmes' },
            body: JSON.stringify(
              numeric
                ? phoneLogin
                  ? { phone: identity, pin: secret }
                  : { login: identity, code: secret }
                : { login: identity, password: secret },
            ),
            signal: AbortSignal.timeout(10000),
          },
        );
        const data = await response.json();
        if (!response.ok)
          throw new Error(
            typeof data.message === 'string' ? data.message : 'Connexion impossible.',
          );
        actor = data;
      }
      if (actor.isSuper) throw new Error('Ce compte utilise l’espace web Super Admin.');
      actor = {
        ...actor,
        ...(actor.phone || (phoneLogin && identity) ? { phone: actor.phone || identity } : {}),
      };
      try {
        rememberAccount(actor);
      } catch {
        /* Storage is optional. */
      }
      setPassword('');
      onLogin(actor);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connexion impossible. Réessayez.');
      setPassword('');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  const assistance = (
    <p className="pwa-login-help">
      PIN oublié ou accès à rétablir ? Contactez le Super Admin.{' '}
      <a href="/?administration-appareil">Assistance Super Admin</a>
    </p>
  );
  if (numeric)
    return (
      <SecretCodeScreen
        title={account ? 'Bon retour' : 'Votre PIN'}
        name={account?.name || phone}
        subtitle={
          reason ||
          (account
            ? 'Saisissez votre PIN pour ouvrir votre espace.'
            : 'Saisissez le PIN personnel déjà associé à ce numéro.')
        }
      >
        <form onSubmit={submit}>
          <input
            type="hidden"
            name="username"
            autoComplete="username"
            value={identityForAccount(account, phone)}
          />
          <SecretCodePad
            value={password}
            onChange={(value) => {
              setPassword(value);
              setError('');
            }}
            onComplete={(value) => void submit(undefined, value)}
            disabled={busy}
          />
          {busy && <p role="status">Connexion…</p>}
          {error && (
            <p className="pwa-login-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="text-button secret-code-submit"
            disabled={busy || password.length !== 4}
          >
            Se connecter
          </button>
        </form>
        {!account && (
          <button
            className="text-button"
            disabled={busy}
            onClick={() => {
              setPhoneStep(false);
              setPassword('');
              setError('');
            }}
          >
            Corriger le numéro
          </button>
        )}
        {assistance}
      </SecretCodeScreen>
    );
  return (
    <main className="pwa-login">
      <div className="pwa-login-brand">
        <span>
          <Users size={25} aria-hidden="true" />
        </span>
        AvecLesFemmes
      </div>
      <section className="pwa-login-card" aria-label="Connexion à votre espace">
        <div className="pwa-login-symbol">
          <KeyRound size={28} aria-hidden="true" />
        </div>
        <h1>{account ? 'Bon retour' : 'Votre épargne, ensemble'}</h1>
        {account ? (
          <>
            <div className="pwa-login-account">
              <strong>{account.name}</strong>
              <p>
                Hors ligne, votre mot de passe personnel protège le coffre chiffré. Le PIN reste
                utilisé pour les connexions en ligne.
              </p>
            </div>
            <form onSubmit={submit}>
              <input type="hidden" autoComplete="username" value={account.login} />
              <label htmlFor="pwa-password">Mot de passe</label>
              <div className="pwa-login-password">
                <input
                  ref={input}
                  id="pwa-password"
                  name="password"
                  type={visible ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  maxLength={128}
                  value={password}
                  disabled={busy}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff size={21} /> : <Eye size={21} />}
                </button>
              </div>
              {error && (
                <p className="pwa-login-error" role="alert">
                  {error}
                </p>
              )}
              <button className="primary" disabled={busy}>
                {busy ? 'Ouverture…' : 'Se connecter'}
              </button>
            </form>
          </>
        ) : (
          <>
            <p>
              Entrez votre numéro de téléphone, puis votre PIN personnel. Votre téléphone sera
              mémorisé pour les prochaines connexions.
            </p>
            <form onSubmit={next}>
              <label htmlFor="pwa-phone">Numéro de téléphone</label>
              <input
                ref={input}
                id="pwa-phone"
                name="username"
                type="tel"
                inputMode="tel"
                autoComplete="username"
                required
                maxLength={25}
                placeholder="77 000 00 00"
                value={phone}
                disabled={busy || !online}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setError('');
                }}
                enterKeyHint="next"
              />
              <p className="muted">
                Sénégal : 9 chiffres. Autres pays : ajoutez l’indicatif international.
              </p>
              {error && (
                <p className="pwa-login-error" role="alert">
                  {error}
                </p>
              )}
              {!online && <p role="status">La première connexion doit se faire en ligne.</p>}
              <button className="primary" disabled={busy || !online}>
                Continuer
              </button>
            </form>
            {demoPin && (
              <details className="pwa-login-demo">
                <summary>Comptes de démonstration</summary>
                <p>Environnement de test uniquement. PIN : {demoPin}</p>
                {[
                  ['+221770000002', 'Responsable'],
                  ['+221770000003', 'Membre'],
                ].map(([number, label]) => (
                  <button
                    className="secondary"
                    key={number}
                    onClick={() => {
                      setPhone(number);
                      setError('');
                    }}
                  >
                    {label} · {number}
                  </button>
                ))}
              </details>
            )}
          </>
        )}
        {assistance}
      </section>
    </main>
  );
}
function identityForAccount(account: Account | null, phone: string) {
  return account?.phone || account?.login || phone;
}
