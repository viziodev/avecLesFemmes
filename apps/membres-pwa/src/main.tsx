import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@aveclesfemmes/ui';
import '@aveclesfemmes/ui/styles.css';
import { startPwaUpdates } from './pwa-update';
const onUpdateSafetyChange = startPwaUpdates();
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App portal="member" onUpdateSafetyChange={onUpdateSafetyChange} />
  </React.StrictMode>,
);
