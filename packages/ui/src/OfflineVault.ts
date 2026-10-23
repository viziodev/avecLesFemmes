import type { components } from '@aveclesfemmes/api-client';
type Actor = components['schemas']['ActorView'];
export type PendingPayment = {
  id: string;
  path: string;
  body: Record<string, unknown>;
  createdAt: string;
  campaignName?: string;
  campaignType?: string;
  groupName?: string;
  memberName?: string;
  error?: string;
  authorization?: { payload: string; signature: string };
  autoBlocked?: boolean;
};
type Snapshot = { data: unknown; savedAt: string };
type VaultData = {
  actor: Actor;
  entries: Record<string, Snapshot>;
  pending: PendingPayment[];
  syncSecret?: string;
  automaticSync?: boolean;
};
type Envelope = { version: 1; salt: string; iv: string; ciphertext: string };
type WrappedKey = { salt: string; iv: string; ciphertext: string };
type CodeEnvelope = {
  version: 2 | 3;
  code?: WrappedKey;
  online?: WrappedKey;
  recovery?: WrappedKey;
  iv: string;
  ciphertext: string;
};
async function wrap(raw: Uint8Array, secret: string): Promise<WrappedKey> {
  const salt = crypto.getRandomValues(new Uint8Array(16)),
    iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await derive(secret, salt);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, raw as BufferSource);
  return { salt: base64(salt), iv: base64(iv), ciphertext: base64(new Uint8Array(ciphertext)) };
}
async function unwrapKey(wrapped: WrappedKey, secret: string) {
  const key = await derive(secret, bytes(wrapped.salt));
  const raw = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: bytes(wrapped.iv) },
    key,
    bytes(wrapped.ciphertext),
  );
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
const encoder = new TextEncoder();
const base64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const bytes = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
const jsonBytes = (data: unknown) => encoder.encode(JSON.stringify(data));
const slot = (login: string) => `alf:pwa:vault:${encodeURIComponent(login)}`;
export const ownerKey = 'alf:pwa:vault-owner';

export function paymentPath(path: string) {
  return /^\/api\/v1\/groupements\/[^/]+\/campaigns\/[^/]+\/contributions(?:\/self)?$/.test(path);
}
export function cacheKey(url: string) {
  const u = new URL(url, location.origin);
  for (const [key, value] of [...u.searchParams])
    if (
      value === '' ||
      (key === 'scope' && value === 'group') ||
      (key === 'page' && value === '1') ||
      (key === 'limit' && value === '25')
    )
      u.searchParams.delete(key);
  u.searchParams.sort();
  return u.pathname + u.search;
}
async function derive(password: string, salt: Uint8Array) {
  const source = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: 310000, hash: 'SHA-256' },
    source,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export class OfflineVault {
  private tail: Promise<void> = Promise.resolve();
  private active = true;
  private constructor(
    readonly login: string,
    private key: CryptoKey,
    private salt: Uint8Array,
    readonly data: VaultData,
    private codeEnvelope?: Pick<CodeEnvelope, 'online' | 'recovery'>,
  ) {}
  static async open(login: string, password: string, actor?: Actor) {
    if (password.length < 12)
      throw new Error(
        'Mot de passe hors ligne incorrect : utilisez votre mot de passe initial d’au moins douze caractères.',
      );
    const raw = localStorage.getItem(slot(login));
    if (raw) {
      try {
        const envelope = JSON.parse(raw) as Envelope;
        if ([2, 3].includes((envelope as { version: number }).version)) {
          const codeEnvelope = envelope as unknown as CodeEnvelope;
          if (!codeEnvelope.recovery) throw new Error();
          const key = await unwrapKey(codeEnvelope.recovery, password);
          const clear = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: bytes(codeEnvelope.iv) },
            key,
            bytes(codeEnvelope.ciphertext),
          );
          const data = JSON.parse(new TextDecoder().decode(clear)) as VaultData;
          if (data.actor.login !== login || (actor && data.actor.id !== actor.id))
            throw new Error();
          if (actor) data.actor = actor;
          const opened = new OfflineVault(login, key, new Uint8Array(), data, {
            recovery: codeEnvelope.recovery,
            online: codeEnvelope.version === 3 ? codeEnvelope.online : undefined,
          });
          // Remove the legacy PIN wrapper on the first successful password unlock.
          if (codeEnvelope.version === 2) await opened.persist();
          return opened;
        }
        if (envelope.version !== 1) throw new Error();
        const salt = bytes(envelope.salt);
        const key = await derive(password, salt);
        const clear = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: bytes(envelope.iv) },
          key,
          bytes(envelope.ciphertext),
        );
        const data = JSON.parse(new TextDecoder().decode(clear)) as VaultData;
        if (
          !data.actor ||
          data.actor.login !== login ||
          (actor && actor.id !== data.actor.id) ||
          !Array.isArray(data.pending) ||
          !data.entries
        )
          throw new Error();
        if (actor) data.actor = actor;
        return new OfflineVault(login, key, salt, data);
      } catch {
        throw new Error(
          actor
            ? 'Le coffre hors ligne utilise un autre mot de passe ou est endommagé. Les données locales ont été conservées ; contactez votre responsable avant de les effacer.'
            : 'Mot de passe hors ligne incorrect ou données locales indisponibles.',
        );
      }
    }
    if (!actor)
      throw new Error(
        'Une première connexion en ligne est nécessaire pour préparer le mode hors ligne.',
      );
    const salt = crypto.getRandomValues(new Uint8Array(16));
    return new OfflineVault(login, await derive(password, salt), salt, {
      actor,
      entries: {},
      pending: [],
    });
  }
  static async openCode(
    _login: string,
    _code: string,
    _actor?: Actor,
    _recoveryPassword?: string,
  ): Promise<OfflineVault> {
    throw new Error(
      'Hors ligne, utilisez votre mot de passe initial. Le code secret nécessite une connexion et un appareil autorisé.',
    );
  }
  static async openOnline(
    login: string,
    serverKey: string,
    actor: Actor,
    recoveryPassword?: string,
  ) {
    if (!/^[a-f0-9]{64}$/.test(serverKey))
      throw new Error(
        'Clé de synchronisation indisponible. Reconnectez cet appareil avec votre mot de passe initial.',
      );
    const raw = localStorage.getItem(slot(login));
    if (raw) {
      const envelope = JSON.parse(raw) as CodeEnvelope;
      if (envelope.version === 3 && envelope.online) {
        try {
          const key = await unwrapKey(envelope.online, serverKey);
          const clear = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: bytes(envelope.iv) },
            key,
            bytes(envelope.ciphertext),
          );
          const data = JSON.parse(new TextDecoder().decode(clear)) as VaultData;
          if (data.actor.login !== login || data.actor.id !== actor.id) throw new Error();
          data.actor = actor;
          return new OfflineVault(login, key, new Uint8Array(), data, {
            online: envelope.online,
            recovery: envelope.recovery,
          });
        } catch {
          // Device rotation requires the original password, never a destructive reset.
        }
      }
    }
    if (!recoveryPassword)
      throw new Error(
        'Reconnectez-vous avec votre mot de passe initial pour sécuriser le coffre existant. Aucune saisie locale n’a été effacée.',
      );
    const previous = await OfflineVault.open(login, recoveryPassword, actor);
    return previous.withOnlineKey(serverKey, recoveryPassword);
  }
  async withOnlineKey(serverKey: string, recoveryPassword: string) {
    if (!/^[a-f0-9]{64}$/.test(serverKey) || recoveryPassword.length < 12)
      throw new Error(
        'Un mot de passe initial d’au moins douze caractères est nécessaire pour préparer le mode hors ligne.',
      );
    const raw = crypto.getRandomValues(new Uint8Array(32));
    const online = await wrap(raw, serverKey);
    const recovery = await wrap(raw, recoveryPassword);
    const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
    const next = new OfflineVault(this.login, key, new Uint8Array(), this.data, {
      online,
      recovery,
    });
    await next.persist();
    this.close();
    return next;
  }
  close() {
    this.active = false;
  }
  async persist() {
    const operation = this.tail
      .catch(() => {})
      .then(async () => {
        if (!this.active) throw new Error('Espace verrouillé. Déverrouillez avant de continuer.');
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const clear = jsonBytes(this.data);
        if (clear.length > 3000000)
          throw new Error('Stockage hors ligne plein. Synchronisez les saisies en attente.');
        const encrypted = new Uint8Array(
          await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, this.key, clear),
        );
        // Avoid spreading a large ciphertext onto the JavaScript call stack.
        let binary = '';
        for (let start = 0; start < encrypted.length; start += 8192)
          binary += String.fromCharCode(...encrypted.subarray(start, start + 8192));
        if (!this.active) throw new Error('Espace verrouillé.');
        localStorage.setItem(
          slot(this.login),
          JSON.stringify(
            this.codeEnvelope
              ? ({
                  version: 3,
                  online: this.codeEnvelope.online,
                  recovery: this.codeEnvelope.recovery,
                  iv: base64(iv),
                  ciphertext: btoa(binary),
                } satisfies CodeEnvelope)
              : ({
                  version: 1,
                  salt: base64(this.salt),
                  iv: base64(iv),
                  ciphertext: btoa(binary),
                } satisfies Envelope),
          ),
        );
      });
    this.tail = operation;
    return operation;
  }
  async remember(url: string, data: unknown) {
    const key = cacheKey(url);
    if (jsonBytes(data).length > 200000) return;
    delete this.data.entries[key];
    this.data.entries[key] = { data, savedAt: new Date().toISOString() };
    while (
      Object.keys(this.data.entries).length > 1 &&
      (Object.keys(this.data.entries).length > 60 || jsonBytes(this.data).length > 2500000)
    )
      delete this.data.entries[Object.keys(this.data.entries)[0]];
    await this.persist();
  }
  read(url: string) {
    return this.data.entries[cacheKey(url)];
  }
  async queue(path: string, body: Record<string, unknown>) {
    if (
      !paymentPath(path) ||
      !Number.isSafeInteger(body.amount) ||
      Number(body.amount) <= 0 ||
      typeof body.idempotencyKey !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(String(body.paidOn))
    )
      throw new Error(
        'Cette saisie ne peut pas être conservée hors ligne : montant, date et référence sont requis.',
      );
    const existing = this.data.pending.find((p) => p.id === body.idempotencyKey);
    if (existing) {
      if (JSON.stringify(existing.body) !== JSON.stringify(body))
        throw new Error(
          'Cette référence protège déjà une autre saisie. Fermez le formulaire et commencez une nouvelle saisie.',
        );
      return existing;
    }
    if (
      path.endsWith('/self') &&
      this.data.pending.some((p) => p.path === path && p.body.paidOn === body.paidOn)
    )
      throw new Error('Un versement personnel est déjà en attente pour cette séance ou ce tour.');
    if (this.data.pending.length >= 100)
      throw new Error('Cent saisies sont en attente. Synchronisez-les avant de continuer.');
    const records = Object.values(this.data.entries).flatMap((entry) => {
      const data = entry.data as { items?: Array<Record<string, unknown>> };
      return Array.isArray(data?.items) ? data.items : [];
    });
    const campaignId = path.split('/')[6];
    const campaignRecord = records.find((r) => r.id === campaignId);
    const groupRecord = records.find((r) => r.id === path.split('/')[4]);
    const campaignName = String(
      records.find((r) => r.id === campaignId)?.name || `Campagne ${campaignId.slice(0, 8)}`,
    );
    const memberName = path.endsWith('/self')
      ? this.data.actor.name
      : String(
          records.find((r) => r.id === body.participationId)?.name ||
            `Participation ${String(body.participationId).slice(0, 8)}`,
        );
    const entry: PendingPayment = {
      id: body.idempotencyKey,
      path,
      body,
      createdAt: new Date().toISOString(),
      authorization: await this.authorize(body, path),
      campaignName,
      campaignType: String(campaignRecord?.type_name || ''),
      groupName: groupRecord?.name ? String(groupRecord.name) : undefined,
      memberName,
    };
    this.data.pending.push(entry);
    try {
      await this.persist();
    } catch (error) {
      this.data.pending = this.data.pending.filter((p) => p.id !== entry.id);
      throw error;
    }
    return entry;
  }
  async prepareSync(secret: string | null) {
    if (secret && /^[a-f0-9]{64}$/.test(secret)) {
      this.data.syncSecret = secret;
      await this.persist();
    }
  }
  async setAutomaticSync(enabled: boolean) {
    const before = this.data.automaticSync;
    this.data.automaticSync = enabled;
    try {
      await this.persist();
    } catch (error) {
      this.data.automaticSync = before;
      throw error;
    }
  }
  private async authorize(body: Record<string, unknown>, path: string) {
    if (!this.data.syncSecret || this.data.automaticSync === false) return undefined;
    const raw = Uint8Array.from(this.data.syncSecret.match(/.{2}/g)!, (v) => parseInt(v, 16));
    const key = await crypto.subtle.importKey(
      'raw',
      raw,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const payload = JSON.stringify(body);
    const message = JSON.stringify(['alf:offline:v1', this.login, path, payload]);
    const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
    const signature = Array.from(new Uint8Array(signed), (v) =>
      v.toString(16).padStart(2, '0'),
    ).join('');
    return { payload, signature };
  }
  async verify(password: string) {
    await this.tail;
    const other = await OfflineVault.open(this.login, password);
    other.close();
  }
  async discard(id: string) {
    const previous = this.data.pending;
    this.data.pending = previous.filter((p) => p.id !== id);
    try {
      await this.persist();
    } catch (error) {
      this.data.pending = previous;
      throw error;
    }
  }
  async synced(id: string) {
    const previous = this.data.pending;
    const entries = this.data.entries;
    this.data.pending = this.data.pending.filter((p) => p.id !== id);
    // Never present old balances as updated after a synchronization.
    this.data.entries = {};
    try {
      await this.persist();
    } catch (e) {
      this.data.pending = previous;
      this.data.entries = entries;
      throw e;
    }
  }
}
