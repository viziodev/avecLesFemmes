/** Keep activation and reload separate: another tab may activate the worker. */
export function createUpdateGate(options: {
  available: () => boolean;
  activate: () => void;
  reload: () => void;
  notify: () => void;
}) {
  let safe = false;
  let waiting = false;
  let changed = false;
  let activating = false;
  let reloaded = false;
  function flush() {
    if (!safe || !options.available() || reloaded) return;
    if (changed) {
      reloaded = true;
      options.reload();
    } else if (waiting && !activating) {
      activating = true;
      options.activate();
    }
  }
  return {
    setSafe(value: boolean) {
      safe = value;
      if (waiting || changed) options.notify();
      flush();
    },
    waiting() {
      waiting = true;
      options.notify();
      flush();
    },
    changed() {
      changed = true;
      options.notify();
      flush();
    },
    flush,
  };
}

export function startPwaUpdates() {
  let registration: ServiceWorkerRegistration | undefined;
  let checking = false;
  const serviceWorker = navigator.serviceWorker;
  const gate = createUpdateGate({
    available: () => navigator.onLine && document.visibilityState === 'visible',
    activate: () => registration?.waiting?.postMessage({ type: 'SKIP_WAITING' }),
    reload: () => window.location.reload(),
    notify: () => window.dispatchEvent(new Event('pwa-update')),
  });
  if (!serviceWorker || !import.meta.env.PROD) return gate.setSafe;

  // A first installation must not reload the page. Other tabs also defer reloads.
  let controlled = !!serviceWorker.controller;
  serviceWorker.addEventListener('controllerchange', () => {
    if (controlled) gate.changed();
    controlled = true;
  });
  async function check() {
    gate.flush();
    if (!registration || checking || !navigator.onLine || document.visibilityState !== 'visible')
      return;
    checking = true;
    try {
      await registration.update();
      if (registration.waiting) gate.waiting();
    } catch {
      // Offline or transient server error: keep the current application usable.
    } finally {
      checking = false;
    }
  }
  void serviceWorker
    .register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: 'none' })
    .then((value) => {
      registration = value;
      if (value.waiting) gate.waiting();
      value.addEventListener('updatefound', () => {
        const worker = value.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && value.waiting) gate.waiting();
        });
      });
      void check();
    })
    .catch(() => {
      // Registration can fail offline on the first visit; retry at next launch.
    });
  window.addEventListener('online', check);
  window.addEventListener('focus', check);
  document.addEventListener('visibilitychange', check);
  window.setInterval(check, 5 * 60 * 1000);
  return gate.setSafe;
}
