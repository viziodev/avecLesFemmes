import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Eye, EyeOff, KeyRound, Users } from 'lucide-react';
import { api, type components } from '@aveclesfemmes/api-client';
import { SecretCodePad, SecretCodeScreen } from './SecretCode';

type Actor = components['schemas']['ActorView'];
type Account = Pick<Actor, 'login' | 'name' | 'hasSecretCode'>;
const accountKey = 'alf:pwa:remembered-account';
export function rememberAccount(actor: Actor) {
  localStorage.setItem(
    accountKey,
    JSON.stringify({
      login: actor.login,
      name: actor.name,
      ...(actor.hasSecretCode === true ? { hasSecretCode: true } : {}),
    }),
  );
}
function readAccount(): Account | null {
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
      };
  } catch {
    /* Private browsing may disable storage. */
  }
  return null;
}

export function PwaLogin({
  onLogin,
  authenticate,
  reason,
}: {
  onLogin: (actor: Actor, recovery?: boolean) => void;
  authenticate?: (login: string, password: string, code?: boolean) => Promise<Actor>;
  reason?: string;
}) {
  const [account, setAccount] = useState(readAccount);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [reconnectDevice, setReconnectDevice] = useState(false);
  let legacyVault = false;
  try {
    const stored =
      account && localStorage.getItem(`alf:pwa:vault:${encodeURIComponent(account.login)}`);
    legacyVault = !!account?.hasSecretCode && !!stored && JSON.parse(stored).version !== 3;
  } catch {
    /* Invalid vaults must be recovered without erasing local drafts. */
  }
  const numeric =
    !!account?.hasSecretCode && !recovery && !reconnectDevice && online && !legacyVault;
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [storageMessage, setStorageMessage] = useState('');
  const [demoPassword, setDemoPassword] = useState<string | null>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const loginInput = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);
  useEffect(() => {
    if (account) passwordInput.current?.focus();
    else loginInput.current?.focus();
  }, [account]);
  useEffect(() => {
    let active = true;
    fetch('/api/v1/auth/demo')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && data?.isDemo === true && typeof data.demoPassword === 'string')
          setDemoPassword(data.demoPassword);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  async function forget() {
    if (submitting.current) return;
    if (!navigator.onLine) {
      setError('Reconnectez-vous au réseau pour révoquer cet appareil.');
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/v1/auth/forget-device', {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-Requested-With': 'AvecLesFemmes' },
      });
      if (!r.ok) throw new Error();
    } catch {
      setError('La révocation a échoué. Réessayez en ligne.');
      setBusy(false);
      return;
    }
    setBusy(false);
    try {
      localStorage.removeItem(accountKey);
      setStorageMessage('');
    } catch {
      setStorageMessage(
        'Le navigateur empêche l’effacement du compte mémorisé. Effacez les données de ce site dans ses réglages.',
      );
    }
    setAccount(null);
    setRecovery(false);
    setPassword('');
    setLogin('');
    setError('');
    setVisible(false);
  }
  async function submit(event?: FormEvent<HTMLFormElement>, secret = password) {
    event?.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      let actor: Actor;
      if (authenticate) actor = await authenticate(account?.login || login.trim(), secret, numeric);
      else {
        const response = await api.POST('/api/v1/auth/login', {
          body: { login: account?.login || login.trim(), password: secret },
        });
        if (!response.response.ok || !response.data) {
          const message = (response.error as unknown as { message?: string | string[] })?.message;
          throw new Error(
            Array.isArray(message)
              ? message.join(' · ')
              : message || 'Connexion impossible. Réessayez.',
          );
        }
        actor = response.data;
      }
      if (actor.isSuper) {
        await api.POST('/api/v1/auth/logout');
        throw new Error('Ce compte utilise l’espace web Super Admin.');
      }
      try {
        rememberAccount(actor);
      } catch {
        /* Authentication still works when device storage is unavailable. */
      }
      setPassword('');
      onLogin(actor, recovery && online);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connexion impossible. Vérifiez votre connexion.');
      if (numeric && account) setPassword('');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  if (numeric && account)
    return (
      <SecretCodeScreen
        title="Bon retour"
        name={account.name}
        subtitle={reason || 'Saisissez votre code secret pour ouvrir votre espace.'}
      >
        <form onSubmit={submit}>
          <input type="hidden" name="username" autoComplete="username" value={account.login} />
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
        <button
          className="text-button"
          disabled={busy}
          onClick={() => {
            setReconnectDevice(true);
            setPassword('');
            setError('');
          }}
        >
          Reconnecter cet appareil avec le mot de passe initial
        </button>
        <button
          className="text-button"
          disabled={busy}
          onClick={() => {
            setRecovery(true);
            setPassword('');
            setError('');
          }}
        >
          Code secret oublié ?
        </button>
        <button className="text-button secret-change-account" disabled={busy} onClick={forget}>
          Changer de compte / oublier cet appareil
        </button>
        {storageMessage && <p role="status">{storageMessage}</p>}
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
        <h1>
          {recovery
            ? 'Retrouver mon code secret'
            : account
              ? 'Bon retour'
              : 'Votre épargne, ensemble'}
        </h1>
        {account ? (
          <div className="pwa-login-account">
            <strong>{account.name}</strong>
            <span>{account.login}</span>
            <p>
              {recovery
                ? 'Saisissez votre mot de passe initial pour choisir un nouveau code secret. Cette étape nécessite une connexion.'
                : !online
                  ? 'Hors ligne, saisissez votre mot de passe initial pour ouvrir les données chiffrées de cet appareil.'
                  : 'Saisissez votre mot de passe initial pour autoriser cet appareil.'}
            </p>
          </div>
        ) : (
          <p>
            Connectez-vous avec votre identifiant et votre mot de passe. Cet appareil retiendra
            votre identifiant.
          </p>
        )}
        {legacyVault && (
          <p role="status">
            Une connexion avec votre mot de passe initial est nécessaire pour sécuriser les données
            hors ligne existantes. Vos saisies sont conservées.
          </p>
        )}
        {reason && <p role="status">{reason}</p>}
        <form onSubmit={submit}>
          {account ? (
            <input type="hidden" name="username" autoComplete="username" value={account.login} />
          ) : (
            <label>
              Identifiant
              <input
                ref={loginInput}
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                maxLength={100}
                value={login}
                disabled={busy}
                enterKeyHint="next"
                onChange={(e) => setLogin(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    passwordInput.current?.focus();
                  }
                }}
              />
            </label>
          )}
          <label htmlFor="pwa-password">Mot de passe</label>
          <div className="pwa-login-password">
            <input
              ref={passwordInput}
              id="pwa-password"
              name="password"
              type={visible ? 'text' : 'password'}
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              maxLength={128}
              value={password}
              disabled={busy}
              enterKeyHint="go"
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby={error ? 'pwa-login-error' : undefined}
            />
            <button
              type="button"
              className="icon-button"
              aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              aria-pressed={visible}
              onClick={() => {
                setVisible(!visible);
                passwordInput.current?.focus();
              }}
            >
              {visible ? <EyeOff size={21} /> : <Eye size={21} />}
            </button>
          </div>
          {error && (
            <p className="pwa-login-error" id="pwa-login-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy ? 'Connexion…' : recovery ? 'Réinitialiser mon code' : 'Se connecter'}
          </button>
        </form>
        {account && (
          <button className="text-button" disabled={busy} onClick={forget}>
            Changer de compte / oublier cet appareil
          </button>
        )}
        {storageMessage && <p role="status">{storageMessage}</p>}
        <p className="pwa-login-help">
          {account
            ? 'Votre mot de passe n’est jamais mémorisé.'
            : 'Sur un appareil partagé, oubliez le compte à la prochaine connexion.'}{' '}
          Besoin d’aide ? Contactez votre responsable de groupement.
        </p>
        {!account && demoPassword && (
          <details className="pwa-login-demo">
            <summary>Comptes de démonstration</summary>
            <p>Environnement de test uniquement.</p>
            {[
              ['admin.ndeye', 'Responsable'],
              ['membre.awa', 'Membre'],
            ].map(([value, label]) => (
              <button
                type="button"
                className="secondary"
                key={value}
                onClick={() => {
                  setLogin(value);
                  setPassword(demoPassword);
                  passwordInput.current?.focus();
                }}
              >
                {label} · {value}
              </button>
            ))}
          </details>
        )}
      </section>
    </main>
  );
}
