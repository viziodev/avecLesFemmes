import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@aveclesfemmes/ui';
import '@aveclesfemmes/ui/styles.css';
import { registerSW } from 'virtual:pwa-register';
const update = registerSW({
  onNeedRefresh() {
    window.dispatchEvent(new Event('pwa-update'));
  },
});
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App portal="member" onUpdate={() => update(true)} />
  </React.StrictMode>,
);
