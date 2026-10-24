import { useState, type FormEvent } from 'react';
import { ShieldCheck } from 'lucide-react';
import { api } from '@aveclesfemmes/api-client';
import { accountKey, readAccount } from './PwaLogin';
import { ownerKey } from './OfflineVault';

// Opened on the PWA origin: the separate local web portal cannot access its storage.
export function PwaDeviceAdministration() {
  const [account] = useState(readAccount);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await api.POST('/api/v1/auth/forget-device', {
        body: { login: login.trim(), password },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.response.ok) {
        if (response.response.status === 403) throw new Error('Opération réservée au Super Admin.');
        if (response.response.status === 401)
          throw new Error('Identifiant ou mot de passe Super Admin incorrect.');
        throw new Error('Appareil non révoqué. Réessayez en ligne.');
      }
      // Keep encrypted drafts. Removing an identity must never erase pending contributions.
      localStorage.setItem(ownerKey, 'administration-appareil');
      localStorage.removeItem(accountKey);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Opération impossible. Réessayez.');
    } finally {
      setPassword('');
      setBusy(false);
    }
  }
  return (
    <main className="pwa-login">
      <section className="pwa-login-card" aria-label="Administration de cet appareil PWA">
        <ShieldCheck size={32} aria-hidden="true" />
        <h1>Accès PWA de cet appareil</h1>
        {done ? (
          <>
            <p role="status">
              Appareil révoqué et compte oublié. La prochaine connexion demandera le téléphone et le
              PIN personnel. Les saisies chiffrées ont été conservées.
            </p>
            <a className="primary" href="/">
              Retour à la connexion
            </a>
          </>
        ) : (
          <>
            <p>
              {account ? `Compte mémorisé : ${account.name} (${account.login}). ` : ''}
              Le Super Admin peut autoriser une nouvelle identification par téléphone ou un
              changement de compte en oubliant ce compte sur cet appareil.
            </p>
            <p>
              Pour un PIN oublié, définissez un nouveau PIN personnel dans l’espace Super Admin,
              depuis la fiche de la membre. Ouvrez ensuite cette page sur son appareil, dans le même
              navigateur ou la même PWA installée.
            </p>
            <form onSubmit={submit}>
              <label>
                Identifiant Super Admin
                <input
                  autoComplete="username"
                  required
                  maxLength={100}
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  disabled={busy}
                />
              </label>
              <label>
                Mot de passe Super Admin
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  maxLength={128}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                />
              </label>
              {error && (
                <p role="alert" className="pwa-login-error">
                  {error}
                </p>
              )}
              <button className="primary" disabled={busy}>
                {busy ? 'Vérification…' : 'Confirmer l’oubli de cet appareil'}
              </button>
            </form>
            <a href="/">Retour à la connexion</a>
          </>
        )}
      </section>
    </main>
  );
}
