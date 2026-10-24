import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api, type components } from '@aveclesfemmes/api-client';
import type { Middleware } from 'openapi-fetch';
import { PwaLogin, rememberAccount } from './PwaLogin';
import { SecretCodePad, SecretCodeScreen } from './SecretCode';
import { Dialog } from './Dialog';
import { confirmedPayment, usePwaFeedback } from './PwaFeedback';
import { forgetLegacyDeviceSecret } from './DeviceSecrets';
import { OfflineVault, ownerKey, paymentPath, type PendingPayment } from './OfflineVault';
type Actor = components['schemas']['ActorView'];
type Confirmation = { secret: string; numeric: boolean };
const encodeSecret = (secret: string) =>
  'utf8:' + btoa(String.fromCharCode(...new TextEncoder().encode(secret)));
const idleMs = 5 * 60 * 1000;
const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Opération impossible.');
const SecurityContext = createContext<{
  offlineDrafts: boolean;
  offline: boolean;
  busy: boolean;
  lock: () => void;
} | null>(null);
export const usePwaSecurity = () => useContext(SecurityContext);

export function PwaSecurity({ children }: { children: ReactNode }) {
  const feedback = usePwaFeedback();
  const [unlocked, setUnlocked] = useState(false);
  const [accessStep, setAccessStep] = useState<{ actor: Actor; kind: 'setup' | 'unlock' } | null>(
    null,
  );
  const [code, setCode] = useState(''),
    [firstCode, setFirstCode] = useState('');
  const [accessError, setAccessError] = useState(''),
    [accessBusy, setAccessBusy] = useState(false);
  const accessInFlight = useRef(false),
    initialPassword = useRef(''),
    authenticatedByCode = useRef(false);

  const open = useRef(false);
  const vault = useRef<OfflineVault | null>(null);
  const actorRef = useRef<Actor | null>(null);
  const [warning, setWarning] = useState('');
  const [vaultSetup, setVaultSetup] = useState(false);
  const [vaultPassword, setVaultPassword] = useState('');
  const [vaultError, setVaultError] = useState('');
  const [vaultBusy, setVaultBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [offline, setOffline] = useState(!navigator.onLine);
  const down = useRef(!navigator.onLine);
  const [pending, setPending] = useState<PendingPayment[]>([]);
  const [showPending, setShowPending] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const syncInFlight = useRef(false);
  const [automaticSync, setAutomaticSync] = useState(true);
  const automatic = useRef(true);
  const autoRunning = useRef(false);
  const retryAfter = useRef(0);
  const receiptOpen = useRef(false);
  receiptOpen.current = feedback.receiptOpen;
  const autoWake = useRef<() => void>(() => {});
  const [prompt, setPrompt] = useState<{
    label: string;
    numeric: boolean;
    answer: (confirmation: Confirmation | null) => void;
  } | null>(null);
  const promptRef = useRef<typeof prompt>(null);
  const [password, setPassword] = useState('');
  const lastActivity = useRef(Date.now());
  const lastHeartbeat = useRef(0);
  const sessionGeneration = useRef(0);
  const tabOwner = useRef(crypto.randomUUID());
  const live = useRef(true);
  function network(value: boolean) {
    down.current = value;
    setOffline(value);
    window.dispatchEvent(new CustomEvent('alf:network', { detail: { offline: value } }));
  }
  function lock(message = 'Saisissez votre mot de passe pour ouvrir votre espace.') {
    const wasOpen = open.current;
    initialPassword.current = '';
    authenticatedByCode.current = false;
    setAccessStep(null);
    setCode('');
    setFirstCode('');
    setAccessError('');
    setAccessBusy(false);
    setVaultSetup(false);
    setVaultPassword('');
    setVaultError('');
    setVaultBusy(false);
    accessInFlight.current = false;
    feedback.clear();
    document.documentElement.dataset.pwaLocked = 'true';
    if ((wasOpen || actorRef.current) && navigator.onLine)
      void fetch('/api/v1/auth/lock', {
        method: 'POST',
        credentials: 'include',
        keepalive: true,
        headers: { 'X-Requested-With': 'AvecLesFemmes', 'X-PWA-Actor': actorRef.current?.id || '' },
      }).catch(() => {});
    sessionGeneration.current++;
    open.current = false;
    vault.current?.close();
    vault.current = null;
    promptRef.current?.answer(null);
    promptRef.current = null;
    setPassword('');
    setPrompt(null);
    setShowPending(false);
    setPending([]);
    setUnlocked(false);
    setSyncing(false);
    setReason(
      actorRef.current?.hasSecretCode ? message.replace(/mot de passe/g, 'code secret') : message,
    );
  }
  function ask(label: string): Promise<Confirmation | null> {
    if (!open.current || promptRef.current) return Promise.resolve(null);
    return new Promise((answer) => {
      const request = {
        label,
        answer,
        numeric: !!actorRef.current?.hasSecretCode && !down.current && navigator.onLine,
      };
      promptRef.current = request;
      setPassword('');
      setPrompt(request);
    });
  }
  function answer(value: string | null) {
    const request = promptRef.current;
    request?.answer(value === null ? null : { secret: value, numeric: request.numeric });
    promptRef.current = null;
    setPassword('');
    setPrompt(null);
  }
  async function authenticate(login: string, secret: string, numeric = false, phoneLogin = false) {
    authenticatedByCode.current = numeric;
    if (!numeric) initialPassword.current = secret;
    const generation = sessionGeneration.current;
    let actor: Actor;
    let online = navigator.onLine;
    if (online) {
      let response: Response;
      try {
        response = await fetch(
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
                  ? { phone: login, pin: secret }
                  : { login, code: secret }
                : { login, password: secret },
            ),
            signal: AbortSignal.timeout(10000),
          },
        );
      } catch {
        online = false;
        response = json({});
      }
      if (online) {
        const data = await response.json();
        if (!response.ok)
          throw new Error(typeof data.message === 'string' ? data.message : 'Connexion refusée.');
        if (generation !== sessionGeneration.current)
          throw new Error('Connexion interrompue. Réessayez.');
        actor = { ...data, ...(phoneLogin && !data.phone ? { phone: login } : {}) };
        if (actor.isSuper) throw new Error('Ce compte utilise l’espace web Super Admin.');
        actorRef.current = actor;
        try {
          const serverKey = response.headers.get('X-ALF-Vault-Key');
          const prepared = serverKey
            ? await OfflineVault.openOnline(
                actor.login,
                serverKey,
                actor,
                initialPassword.current || undefined,
              )
            : !actor.hasSecretCode && !numeric
              ? await OfflineVault.open(actor.login, secret, actor)
              : await OfflineVault.openCode(actor.login, secret);
          await forgetLegacyDeviceSecret(actor.login).catch(() => {});
          if (generation !== sessionGeneration.current) {
            prepared.close();
            throw new Error('Connexion interrompue. Réessayez.');
          }
          await prepared.prepareSync(response.headers.get('X-ALF-Sync-Key'));
          vault.current = prepared;
          await prepared.persist();
          setWarning('');
        } catch (e) {
          if (generation !== sessionGeneration.current) throw e;
          vault.current?.close();
          vault.current = null;
          setWarning(
            `Mode hors ligne indisponible : ${errorText(e)} Les données précédentes restent conservées.`,
          );
        }
        if (generation !== sessionGeneration.current)
          throw new Error('Connexion interrompue. Réessayez.');
        network(false);
        return actor;
      }
    }
    const cached = numeric
      ? await OfflineVault.openCode(login, secret)
      : await OfflineVault.open(login, secret);
    if (generation !== sessionGeneration.current) {
      cached.close();
      throw new Error('Connexion interrompue. Réessayez.');
    }
    if (cached.data.actor.isSuper) {
      cached.close();
      throw new Error('Espace membre requis.');
    }
    vault.current = cached;
    network(true);
    setWarning(
      'Accès hors ligne : les droits et les données seront revérifiés au retour du réseau.',
    );
    return cached.data.actor;
  }
  function entered(actor: Actor, recovery = false) {
    if (!down.current && (recovery || actor.hasSecretCode === false)) {
      setAccessStep({ actor, kind: 'setup' });
      setCode('');
      setFirstCode('');
      setAccessError('');
      return;
    }
    if (!down.current && actor.hasSecretCode === true && !authenticatedByCode.current) {
      setAccessStep({ actor, kind: 'unlock' });
      setCode('');
      setAccessError('');
      return;
    }
    initialPassword.current = '';
    setAccessStep(null);
    try {
      rememberAccount(actor);
    } catch {
      /* Identity storage is optional. */
    }

    if (document.visibilityState !== 'visible') {
      lock('Saisissez votre mot de passe à la réouverture.');
      return;
    }
    sessionGeneration.current++;
    actorRef.current = actor;
    delete document.documentElement.dataset.pwaLocked;
    open.current = true;
    lastActivity.current = Date.now();
    lastHeartbeat.current = Date.now();
    try {
      localStorage.setItem(ownerKey, tabOwner.current);
    } catch {
      /* Online use remains possible. */
    }
    automatic.current = vault.current?.data.automaticSync !== false;
    setAutomaticSync(automatic.current);
    setPending([...(vault.current?.data.pending || [])]);
    setUnlocked(true);
    queueMicrotask(() => autoWake.current());
    setReason('');
  }
  async function prepareOffline() {
    if (vaultBusy || !actorRef.current || !open.current) return;
    const actor = actorRef.current,
      generation = sessionGeneration.current;
    setVaultBusy(true);
    setVaultError('');
    try {
      const response = await fetch('/api/v1/auth/vault/password', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'AvecLesFemmes',
          'X-PWA-Actor': actor.id,
        },
        body: JSON.stringify({ password: vaultPassword }),
        signal: AbortSignal.timeout(10000),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          typeof data.message === 'string' ? data.message : 'Mot de passe personnel refusé.',
        );
      if (generation !== sessionGeneration.current || !open.current) return;
      const key = response.headers.get('X-ALF-Vault-Key');
      if (!key) throw new Error('Clé du coffre indisponible. Réessayez.');
      const previous =
        vault.current || (await OfflineVault.open(actor.login, vaultPassword, actor));
      const prepared = await previous.withOnlineKey(key, vaultPassword);
      if (generation !== sessionGeneration.current || !open.current) {
        prepared.close();
        return;
      }
      vault.current = prepared;
      await prepared.prepareSync(response.headers.get('X-ALF-Sync-Key'));
      setPending([...prepared.data.pending]);
      setWarning('');
      setVaultSetup(false);
      feedback.notify('Accès hors ligne activé avec votre mot de passe personnel.', 'success');
    } catch (error) {
      if (generation === sessionGeneration.current) setVaultError(errorText(error));
    } finally {
      setVaultPassword('');
      if (generation === sessionGeneration.current) setVaultBusy(false);
    }
  }
  async function completeAccess(value: string) {
    if (!accessStep || accessInFlight.current) return;
    if (accessStep.kind === 'setup' && !firstCode) {
      setFirstCode(value);
      setCode('');
      setAccessError('');
      return;
    }
    if (accessStep.kind === 'setup' && value !== firstCode) {
      setCode('');
      setAccessError('Les deux codes sont différents. Saisissez à nouveau le code choisi.');
      return;
    }
    accessInFlight.current = true;
    setAccessBusy(true);
    setAccessError('');
    const generation = sessionGeneration.current;
    try {
      let actor: Actor;
      if (accessStep.kind === 'unlock')
        actor = await authenticate(accessStep.actor.login, value, true);
      else {
        const response = await fetch('/api/v1/auth/secret-code', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'AvecLesFemmes',
            'X-PWA-Actor': accessStep.actor.id,
          },
          body: JSON.stringify({ password: initialPassword.current, code: value }),
          signal: AbortSignal.timeout(10000),
        });
        const data = await response.json();
        if (!response.ok || data.id !== accessStep.actor.id)
          throw new Error(
            typeof data.message === 'string'
              ? data.message
              : 'Configuration du code refusée. Reconnectez-vous.',
          );
        if (generation !== sessionGeneration.current) return;
        actor = data;
        try {
          const current =
            vault.current || (await OfflineVault.open(actor.login, initialPassword.current, actor));
          current.data.actor = actor;
          const serverKey = response.headers.get('X-ALF-Vault-Key');
          if (!serverKey) throw new Error('Clé de synchronisation indisponible.');
          vault.current = await current.withOnlineKey(serverKey, initialPassword.current);
          await vault.current.prepareSync(response.headers.get('X-ALF-Sync-Key'));
          await forgetLegacyDeviceSecret(actor.login).catch(() => {});
          setWarning('');
        } catch (e) {
          vault.current?.close();
          vault.current = null;
          setWarning(
            `Code enregistré. Mode hors ligne indisponible : ${errorText(e)} Les données précédentes ont été conservées.`,
          );
        }
        authenticatedByCode.current = true;
      }
      if (generation !== sessionGeneration.current) {
        vault.current?.close();
        vault.current = null;
        return;
      }
      setCode('');
      setFirstCode('');
      entered(actor);
    } catch (e) {
      if (generation === sessionGeneration.current) {
        setCode('');
        setAccessError(errorText(e));
      }
    } finally {
      if (generation === sessionGeneration.current || open.current) {
        accessInFlight.current = false;
        setAccessBusy(false);
      }
    }
  }
  async function reconnect(manual = false) {
    if (!open.current || !navigator.onLine) return;
    const generation = sessionGeneration.current;
    try {
      const result = await fetch('/api/v1/health/ready', {
        credentials: 'include',
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      });
      if (result.ok && open.current && generation === sessionGeneration.current) {
        network(false);
        await synchronizeAutomatically();
        if (!automatic.current && open.current && generation === sessionGeneration.current)
          window.dispatchEvent(new Event('alf:refresh'));
        if (manual)
          feedback.notify(
            'Connexion rétablie. Les saisies autorisées sont synchronisées automatiquement ; les refus restent à vérifier.',
            'success',
          );
      } else if (manual && open.current && generation === sessionGeneration.current)
        feedback.notify(
          'Le service reste indisponible. Les saisies en attente sont conservées.',
          'info',
        );
    } catch {
      if (manual && open.current && generation === sessionGeneration.current)
        feedback.notify('Connexion impossible. Les saisies en attente sont conservées.', 'info');
      /* Keep the offline state and encrypted pending payments. */
    }
  }
  const cachedResponse = (request: Request) => {
    const entry = vault.current?.read(request.url);
    if (!entry)
      return json(
        {
          message:
            'Ces données ne sont pas disponibles hors ligne. Consultez cet écran en ligne pour le préparer.',
        },
        503,
      );
    return json(entry.data, 200, { 'X-ALF-Offline': '1', 'X-ALF-Saved-At': entry.savedAt });
  };
  async function queue(request: Request) {
    if (!vault.current?.hasOfflineAccess)
      return json(
        { message: 'Le stockage chiffré est indisponible. Reconnectez-vous pour enregistrer.' },
        503,
      );
    const current = vault.current;
    const generation = sessionGeneration.current;
    try {
      const proof = request.headers.get('X-Confirm-Password') || '';
      const numeric = request.headers.get('X-Confirm-Secret-Code');
      if (numeric || !proof.startsWith('utf8:'))
        throw new Error(
          'Connexion interrompue. Passez en mode hors ligne puis confirmez la saisie avec votre mot de passe initial. Vérifiez son état avant de réessayer.',
        );
      const secret =
        numeric ||
        new TextDecoder().decode(
          Uint8Array.from(atob(proof.slice(5)), (char) => char.charCodeAt(0)),
        );
      await current.verify(secret);
      if (!open.current || current !== vault.current || generation !== sessionGeneration.current)
        throw new Error('Espace verrouillé. Saisie non confirmée.');
      const entry = await current.queue(
        new URL(request.url).pathname,
        await request.clone().json(),
      );
      if (current === vault.current && generation === sessionGeneration.current) {
        setPending([...current.data.pending]);
        autoWake.current();
      }
      return json(
        {
          message: `Saisie conservée sur cet appareil, en attente de synchronisation (${entry.id.slice(0, 8)}). Elle n’est pas encore comptabilisée.`,
          pending: true,
        },
        409,
      );
    } catch (e) {
      return json({ message: errorText(e) }, 503);
    }
  }
  useLayoutEffect(() => {
    live.current = true;
    const originals = new Map<string, Request>();
    const generations = new Map<string, number>();
    const middleware: Middleware = {
      async onRequest({ request, id }) {
        const path = new URL(request.url).pathname;
        if (path === '/api/v1/auth/logout') {
          if (down.current || !navigator.onLine) {
            lock();
            return json({ ok: true });
          }
          return;
        }
        if (path.startsWith('/api/v1/auth/') && path !== '/api/v1/auth/me') return;
        if (path === '/api/v1/appearance') return;
        if (!open.current)
          return json({ message: 'Espace verrouillé. Saisissez votre mot de passe.' }, 401);
        if (actorRef.current) request.headers.set('X-PWA-Actor', actorRef.current.id);
        if (request.method === 'GET') {
          if (down.current || !navigator.onLine) {
            if (path === '/api/v1/auth/me' && vault.current) return json(vault.current.data.actor);
            return cachedResponse(request);
          }
          generations.set(id, sessionGeneration.current);
          return;
        }
        const sensitive = !path.endsWith('/shortcuts') && !path.endsWith('/resolve-member-qr');
        if (sensitive) {
          const startedOffline = down.current || !navigator.onLine;
          const confirmation = await ask(
            paymentPath(path)
              ? 'Confirmer le versement ou l’encaissement'
              : 'Confirmer cette opération sensible',
          );
          if (!confirmation || !open.current)
            return json({ message: 'Confirmation annulée. Aucune opération envoyée.' }, 409);
          if (down.current || !navigator.onLine) {
            if (!paymentPath(path))
              return json({ message: 'Cette opération sensible nécessite une connexion.' }, 503);
          }
          if (confirmation.numeric)
            request.headers.set('X-Confirm-Secret-Code', confirmation.secret);
          else request.headers.set('X-Confirm-Password', encodeSecret(confirmation.secret));
          if (startedOffline && paymentPath(path)) return queue(request);
        }
        if (down.current || !navigator.onLine)
          return paymentPath(path)
            ? queue(request)
            : json({ message: 'Ce réglage nécessite une connexion.' }, 503);
        generations.set(id, sessionGeneration.current);
        if (paymentPath(path)) originals.set(id, request.clone());
      },
      async onResponse({ request, response, id }) {
        const original = originals.get(id);
        originals.delete(id);
        const generation = generations.get(id);
        generations.delete(id);
        if (generation !== undefined && generation !== sessionGeneration.current)
          return json({ message: 'Requête de la session précédente ignorée.' }, 409);
        const path = new URL(request.url).pathname;
        if (path === '/api/v1/auth/logout') {
          lock();
          return response;
        }
        if (
          response.status === 401 &&
          path !== '/api/v1/auth/login' &&
          path !== '/api/v1/appearance'
        ) {
          lock('Votre session a expiré. Saisissez votre mot de passe.');
          return response;
        }
        if (
          !open.current ||
          path.startsWith('/api/v1/auth/') ||
          path === '/api/v1/appearance' ||
          response.headers.get('X-ALF-Offline')
        )
          return;
        if (response.status >= 500 && vault.current) {
          if (original) {
            network(true);
            return queue(original);
          }
          if (request.method === 'GET' && vault.current.read(request.url)) {
            network(true);
            return cachedResponse(request);
          }
        }
        if (response.ok && request.method === 'GET' && vault.current) {
          try {
            await vault.current.remember(request.url, await response.clone().json());
          } catch {
            if (live.current)
              setWarning(
                'Certaines données n’ont pas pu être préparées hors ligne. Vérifiez l’espace disponible sur cet appareil.',
              );
          }
        }
      },
      async onError({ request, id }) {
        const original = originals.get(id);
        originals.delete(id);
        const generation = generations.get(id);
        generations.delete(id);
        if (generation !== undefined && generation !== sessionGeneration.current)
          return json({ message: 'Session précédente verrouillée.' }, 409);
        if (!open.current) return json({ message: 'Espace verrouillé.' }, 401);
        network(true);
        if (actorRef.current) request.headers.set('X-PWA-Actor', actorRef.current.id);
        if (request.method === 'GET') {
          if (new URL(request.url).pathname === '/api/v1/auth/me' && vault.current)
            return json(vault.current.data.actor);
          return cachedResponse(request);
        }
        // The same idempotency key protects a response lost after server commit.
        if (original && paymentPath(new URL(request.url).pathname)) return queue(original);
        return json(
          {
            message:
              'Connexion interrompue. L’opération n’a pas été confirmée ; vérifiez son état avant de réessayer.',
          },
          503,
        );
      },
    };
    api.use(middleware);
    return () => {
      live.current = false;
      api.eject(middleware);
      vault.current?.close();
      promptRef.current?.answer(null);
    };
  }, []);
  useEffect(() => {
    const human = () => {
      if (!open.current) return;
      const now = Date.now();
      if (now - lastActivity.current >= idleMs) {
        lock('Votre espace est verrouillé après 5 minutes d’inactivité.');
        return;
      }
      lastActivity.current = now;
      if (now - lastHeartbeat.current > 30000 && navigator.onLine && !down.current) {
        lastHeartbeat.current = now;
        void fetch('/api/v1/auth/activity', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'X-Requested-With': 'AvecLesFemmes',
            'X-PWA-Actor': actorRef.current?.id || '',
          },
        })
          .then((r) => {
            if (r.status === 401) lock('Session expirée. Saisissez votre mot de passe.');
          })
          .catch(() => network(true));
      }
    };
    const hidden = () => {
      if (document.visibilityState === 'hidden')
        lock('Saisissez votre mot de passe à la réouverture.');
    };
    const pagehide = () => lock('Saisissez votre mot de passe à la réouverture.');
    const online = () => {
      if (open.current) void reconnect();
    };
    const offline = () => network(true);
    const storage = (e: StorageEvent) => {
      if (e.key === ownerKey && e.newValue !== tabOwner.current && open.current)
        lock('Votre espace a été ouvert dans un autre onglet.');
    };
    const probe = setInterval(() => {
      if (down.current) void reconnect();
      else autoWake.current();
    }, 30000);
    const timer = setInterval(() => {
      if (open.current && Date.now() - lastActivity.current >= idleMs)
        lock('Votre espace est verrouillé après 5 minutes d’inactivité.');
      else autoWake.current();
    }, 1000);
    for (const event of ['pointerdown', 'keydown', 'touchstart', 'scroll'])
      window.addEventListener(event, human, { passive: true });
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', pagehide);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    window.addEventListener('storage', storage);
    return () => {
      clearInterval(timer);
      clearInterval(probe);
      for (const event of ['pointerdown', 'keydown', 'touchstart', 'scroll'])
        window.removeEventListener(event, human);
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('pagehide', pagehide);
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
      window.removeEventListener('storage', storage);
    };
  }, []);
  async function discard(entry: PendingPayment) {
    if (syncInFlight.current || !vault.current) return;
    const current = vault.current;
    const generation = sessionGeneration.current;
    syncInFlight.current = true;
    const confirmation = await ask(
      `Abandonner uniquement la saisie locale de ${entry.body.amount} FCFA du ${entry.body.paidOn}. Aucun versement déjà enregistré ne sera supprimé. Vérifiez l’historique si un envoi avait commencé.`,
    );
    if (!confirmation || !open.current) {
      syncInFlight.current = false;
      return;
    }
    const { secret, numeric } = confirmation;
    try {
      if (numeric) {
        const r = await fetch('/api/v1/auth/login/secret-code', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'AvecLesFemmes' },
          body: JSON.stringify({ login: current.login, code: secret }),
        });
        if (!r.ok || (await r.json()).id !== current.data.actor.id)
          throw new Error('Code secret incorrect ou compte indisponible.');
      } else await current.verify(secret);
      if (!open.current || generation !== sessionGeneration.current) return;
      await current.discard(entry.id);
      setPending([...current.data.pending]);
      const message =
        'Saisie locale abandonnée. Aucun versement enregistré sur le serveur n’a été supprimé.';
      setWarning(message);
      feedback.notify(message, 'info');
    } catch (e) {
      if (open.current) {
        entry.error = errorText(e);
        feedback.notify(errorText(e), 'error');
        setPending([...current.data.pending]);
      }
    } finally {
      syncInFlight.current = false;
    }
  }
  async function synchronize(entry: PendingPayment) {
    if (syncInFlight.current || !navigator.onLine || !vault.current) return;
    const currentVault = vault.current;
    const generation = sessionGeneration.current;
    syncInFlight.current = true;
    const confirmation = await ask(
      `Synchroniser ${entry.campaignName || 'la campagne'} · ${entry.memberName || 'membre'} · ${entry.body.amount} FCFA du ${entry.body.paidOn}`,
    );
    if (!confirmation || !open.current) {
      syncInFlight.current = false;
      return;
    }
    const { secret, numeric } = confirmation;
    setSyncing(true);
    try {
      // Revalidate account, password and current permissions before each replay.
      const auth = await fetch(numeric ? '/api/v1/auth/login/secret-code' : '/api/v1/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'AvecLesFemmes' },
        body: JSON.stringify(
          numeric
            ? { login: currentVault.login, code: secret }
            : { login: currentVault.login, password: secret },
        ),
        signal: AbortSignal.timeout(10000),
      });
      const actor = await auth.json();
      if (!auth.ok || actor.id !== currentVault.data.actor.id)
        throw new Error('Synchronisation refusée. Vérifiez votre mot de passe et votre compte.');
      if (!open.current || sessionGeneration.current !== generation) return;
      const response = await fetch(entry.path, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'AvecLesFemmes',
          ...(numeric
            ? { 'X-Confirm-Secret-Code': secret }
            : { 'X-Confirm-Password': encodeSecret(secret) }),
          'X-PWA-Actor': currentVault.data.actor.id,
        },
        body: JSON.stringify(entry.body),
        signal: AbortSignal.timeout(15000),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          typeof data.message === 'string' ? data.message : 'Le serveur a refusé cette saisie.',
        );
      confirmedPayment(data);
      if (!open.current || sessionGeneration.current !== generation) return;
      await currentVault.synced(entry.id);
      network(false);
      setPending([...currentVault.data.pending]);
      setWarning(`Saisie synchronisée. Référence : ${data.reference}.`);
      setShowPending(false);
      feedback.notify('Saisie synchronisée et versement enregistré.', 'success');
      feedback.showReceipt({
        contribution: data,
        campaign: entry.campaignName || 'Campagne',
        member: entry.memberName,
        type: entry.campaignType || '',
        group: entry.groupName,
        personal: entry.path.endsWith('/self'),
      });
      window.dispatchEvent(new Event('alf:refresh'));
    } catch (e) {
      if (open.current && sessionGeneration.current === generation) {
        entry.error = errorText(e);
        feedback.notify(errorText(e), 'error');
        setPending([...currentVault.data.pending]);
        try {
          await currentVault.persist();
        } catch {
          setWarning('La saisie reste en attente. Stockage temporairement indisponible.');
        }
      }
    } finally {
      syncInFlight.current = false;
      setSyncing(false);
    }
  }
  async function synchronizeAutomatically() {
    const current = vault.current;
    if (
      !open.current ||
      !current ||
      !automatic.current ||
      autoRunning.current ||
      syncInFlight.current ||
      !navigator.onLine ||
      document.visibilityState !== 'visible' ||
      promptRef.current ||
      receiptOpen.current ||
      document.querySelector('[role="dialog"]') ||
      Date.now() < retryAfter.current
    )
      return;
    const entries = current.data.pending.filter((p) => p.authorization && !p.autoBlocked);
    if (!entries.length) {
      if (!down.current && open.current) window.dispatchEvent(new Event('alf:refresh'));
      return;
    }
    const generation = sessionGeneration.current;
    const valid = () =>
      open.current &&
      current === vault.current &&
      generation === sessionGeneration.current &&
      document.visibilityState === 'visible';
    autoRunning.current = true;
    syncInFlight.current = true;
    setSyncing(true);
    let saved = 0,
      refused = 0;
    try {
      for (const entry of entries) {
        if (
          !valid() ||
          !automatic.current ||
          !navigator.onLine ||
          promptRef.current ||
          document.querySelector('[role="dialog"]')
        )
          break;
        try {
          if (entry.authorization!.payload !== JSON.stringify(entry.body)) {
            entry.autoBlocked = true;
            throw new Error('La saisie a changé depuis sa confirmation. Vérifiez-la manuellement.');
          }
          const response = await fetch('/api/v1/auth/offline-replay', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'X-Requested-With': 'AvecLesFemmes',
              'X-PWA-Actor': current.data.actor.id,
            },
            body: JSON.stringify({
              login: current.login,
              path: entry.path,
              ...entry.authorization,
            }),
            signal: AbortSignal.timeout(15000),
          });
          if (!valid()) break;
          if (response.status >= 500 || response.status === 429) {
            retryAfter.current = Date.now() + 30000;
            network(true);
            throw new Error(
              'Connexion ou service indisponible. La saisie sera réessayée automatiquement.',
            );
          }
          const data = await response.json();
          if (!response.ok) {
            entry.autoBlocked = true;
            throw new Error(
              typeof data.message === 'string'
                ? data.message
                : 'Saisie refusée. Vérifiez-la manuellement.',
            );
          }
          confirmedPayment(data);
          await current.synced(entry.id);
          saved++;
        } catch (error) {
          if (!valid()) break;
          entry.error = errorText(error);
          if (!entry.autoBlocked) {
            retryAfter.current = Date.now() + 30000;
            network(true);
          } else refused++;
          await current.persist();
          if (!entry.autoBlocked) break;
        }
      }
      if (valid()) {
        setPending([...current.data.pending]);
        if (saved || refused) {
          const message = `${saved} saisie(s) synchronisée(s) automatiquement.${refused ? ` ${refused} saisie(s) restent à vérifier.` : ''}`;
          setWarning(message);
          feedback.notify(message, refused ? 'info' : 'success');
        }
        if (!down.current) {
          // Offline replays do not mint a general session or silently bypass the PIN.
          const session = await fetch('/api/v1/auth/me', {
            credentials: 'include',
            cache: 'no-store',
            signal: AbortSignal.timeout(5000),
          });
          if (valid() && session.status === 401)
            lock(
              `${saved} saisie(s) synchronisée(s), ${current.data.pending.length} en attente. Déverrouillez votre espace pour actualiser les données.`,
            );
          else if (valid() && session.ok) window.dispatchEvent(new Event('alf:refresh'));
          else if (valid()) network(true);
        }
      }
    } catch {
      if (valid()) {
        network(true);
        setWarning(
          'Les saisies non acquittées restent conservées ; l’actualisation sera réessayée au retour du service.',
        );
      }
    } finally {
      autoRunning.current = false;
      syncInFlight.current = false;
      if (live.current) setSyncing(false);
    }
  }
  autoWake.current = () => {
    if (
      open.current &&
      !down.current &&
      navigator.onLine &&
      vault.current?.data.pending.some((p) => p.authorization && !p.autoBlocked)
    )
      void synchronizeAutomatically();
  };
  async function changeSyncMode(enabled: boolean) {
    if (syncInFlight.current || !vault.current) return;
    const before = automatic.current;
    automatic.current = enabled;
    setAutomaticSync(enabled);
    try {
      await vault.current.setAutomaticSync(enabled);
      feedback.notify(
        enabled
          ? 'Synchronisation automatique activée pour les saisies autorisées.'
          : 'Synchronisation manuelle activée.',
        'info',
      );
      if (enabled) autoWake.current();
    } catch (error) {
      automatic.current = before;
      setAutomaticSync(before);
      feedback.notify(errorText(error), 'error');
    }
  }
  return (
    <SecurityContext.Provider
      value={{
        offlineDrafts: !!vault.current?.hasOfflineAccess,
        offline,
        busy: !!prompt || syncing || vaultSetup || feedback.receiptOpen,
        lock: () => lock(),
      }}
    >
      {unlocked ? (
        <>
          <section
            className="pwa-connection-state"
            aria-label="État de connexion et synchronisation"
          >
            {offline && (
              <p role="status">
                Hors connexion · dernières données synchronisées. Les saisies restent en attente et
                ne modifient aucun solde.
              </p>
            )}
            {offline && (
              <button
                className="secondary"
                disabled={!navigator.onLine}
                onClick={() => void reconnect(true)}
              >
                Réessayer la connexion
              </button>
            )}
            {warning && <p role="status">{warning}</p>}
            {!offline && !vault.current?.hasOfflineAccess && (
              <div>
                <p>
                  Le PIN ouvre votre espace. Pour protéger aussi l’accès hors ligne, activez le
                  coffre avec votre mot de passe personnel.
                </p>
                <button
                  className="secondary"
                  onClick={() => {
                    setVaultPassword('');
                    setVaultError('');
                    setVaultSetup(true);
                  }}
                >
                  Activer l’accès hors ligne
                </button>
              </div>
            )}
            {pending.length > 0 && (
              <button className="secondary" disabled={syncing} onClick={() => setShowPending(true)}>
                {pending.length} saisie(s) en attente · Synchronisation
              </button>
            )}
          </section>
          {children}
        </>
      ) : accessStep ? (
        <SecretCodeScreen
          title={
            accessStep.kind === 'unlock'
              ? 'Déverrouiller avec mon code secret'
              : firstCode
                ? 'Confirmez votre code secret'
                : 'Choisissez votre code secret'
          }
          name={accessStep.actor.name}
          subtitle={
            accessStep.kind === 'unlock'
              ? 'Saisissez les quatre chiffres de votre code.'
              : 'Ce code sera demandé à chaque ouverture et pour vos opérations sensibles.'
          }
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (code.length === 4) void completeAccess(code);
            }}
          >
            <SecretCodePad
              value={code}
              onChange={(v) => {
                setCode(v);
                setAccessError('');
              }}
              onComplete={(v) => void completeAccess(v)}
              disabled={accessBusy}
            />
            {accessBusy && <p role="status">Vérification…</p>}
            {accessError && (
              <p role="alert" className="pwa-login-error">
                {accessError}
              </p>
            )}
            <button
              className="text-button secret-code-submit"
              disabled={accessBusy || code.length !== 4}
            >
              Valider le code
            </button>
          </form>
          {firstCode && (
            <button
              className="text-button"
              disabled={accessBusy}
              onClick={() => {
                setFirstCode('');
                setCode('');
                setAccessError('');
              }}
            >
              Modifier le code choisi
            </button>
          )}
          <button
            className="text-button"
            disabled={accessBusy}
            onClick={() =>
              lock('Code oublié ou appareil à reconnecter ? Contactez le Super Admin.')
            }
          >
            Revenir à la connexion
          </button>
        </SecretCodeScreen>
      ) : (
        <PwaLogin onLogin={entered} authenticate={authenticate} reason={reason} />
      )}
      {unlocked && showPending && (
        <Dialog title="Saisies en attente" onClose={() => setShowPending(false)} busy={syncing}>
          <p>
            Chaque saisie est chiffrée. Les saisies autorisées lors de leur confirmation hors ligne
            sont synchronisées au retour de la connexion, dans votre espace ouvert. Les autres
            restent à confirmer manuellement.
          </p>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={automaticSync}
              disabled={syncing}
              onChange={(e) => void changeSyncMode(e.target.checked)}
            />
            Synchronisation automatique au retour de la connexion
          </label>
          {syncing && <p role="status">Synchronisation en cours…</p>}
          {pending.map((entry) => (
            <article className="pending-payment" key={entry.id}>
              <strong>
                {String(entry.body.amount)} FCFA · {String(entry.body.paidOn)}
              </strong>
              <p>
                {entry.campaignName} · {entry.memberName} ·{' '}
                {entry.path.endsWith('/self') ? 'Mon versement' : 'Encaissement membre'} · Référence
                locale {entry.id.slice(0, 8)}
              </p>
              {!entry.authorization && <p>Confirmation manuelle requise pour cette saisie.</p>}
              {entry.error && (
                <p role="alert">
                  {entry.error} La saisie est conservée ; sa date et son montant ne sont pas
                  modifiés.
                </p>
              )}
              <button
                className="primary"
                disabled={offline || syncing}
                onClick={() => void synchronize(entry)}
              >
                Synchroniser cette saisie
              </button>
              <button
                type="button"
                className="secondary"
                disabled={syncing}
                onClick={() => void discard(entry)}
              >
                Abandonner cette saisie locale
              </button>
            </article>
          ))}
          {!pending.length && <p>Aucune saisie en attente.</p>}
        </Dialog>
      )}
      {unlocked && vaultSetup && (
        <Dialog
          title="Préparer le mode hors ligne"
          busy={vaultBusy}
          onClose={() => {
            setVaultSetup(false);
            setVaultPassword('');
          }}
        >
          <p>
            Votre mot de passe personnel chiffre l’accès hors ligne. Il n’est pas mémorisé. Les
            prochaines connexions en ligne restent par PIN.
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void prepareOffline();
            }}
          >
            <label className="field">
              Mot de passe personnel
              <input
                autoFocus
                type="password"
                autoComplete="current-password"
                minLength={12}
                maxLength={128}
                required
                value={vaultPassword}
                disabled={vaultBusy}
                onChange={(event) => setVaultPassword(event.target.value)}
              />
            </label>
            {vaultError && <p role="alert">{vaultError}</p>}
            <button className="primary" disabled={vaultBusy}>
              {vaultBusy ? 'Activation…' : 'Activer le coffre'}
            </button>
          </form>
        </Dialog>
      )}
      {prompt && (
        <Dialog
          title={
            prompt.numeric ? 'Confirmer avec mon code secret' : 'Confirmer avec mon mot de passe'
          }
          subtitle={prompt.label}
          onClose={() => answer(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              answer(password);
            }}
          >
            {prompt.numeric ? (
              <SecretCodePad
                value={password}
                onChange={setPassword}
                onComplete={(value) => answer(value)}
                label="Code secret de confirmation"
              />
            ) : (
              <label className="field">
                Mot de passe de confirmation
                <input
                  autoFocus
                  type="password"
                  autoComplete="current-password"
                  required
                  maxLength={128}
                  enterKeyHint="go"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
            )}
            <button
              className={prompt.numeric ? 'text-button secret-code-submit' : 'primary'}
              disabled={!!prompt.numeric && password.length !== 4}
            >
              Confirmer l’opération
            </button>
            <button type="button" className="secondary" onClick={() => answer(null)}>
              Annuler
            </button>
          </form>
        </Dialog>
      )}
    </SecurityContext.Provider>
  );
}
