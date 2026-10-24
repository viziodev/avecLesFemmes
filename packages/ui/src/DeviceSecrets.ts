// Legacy storage cleanup only. Offline vaults no longer have a four-digit-code wrapper.
export async function forgetLegacyDeviceSecret(login: string) {
  localStorage.removeItem(`alf:pwa:code-attempts:${encodeURIComponent(login)}`);
  if (!indexedDB.databases) return;
  if (!(await indexedDB.databases()).some((db) => db.name === 'alf-device-secrets')) return;
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open('alf-device-secrets', 1);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  try {
    if (!db.objectStoreNames.contains('keys')) return;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('keys', 'readwrite');
      tx.objectStore('keys').delete(login);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
