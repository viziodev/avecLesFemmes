import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@aveclesfemmes/ui';
import '@aveclesfemmes/ui/styles.css';
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App portal="super" />
  </React.StrictMode>,
);
