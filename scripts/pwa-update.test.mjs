import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createUpdateGate } from '../apps/membres-pwa/src/pwa-update.ts';
function fixture() {
  const calls = [];
  let available = true;
  const gate = createUpdateGate({
    available: () => available,
    activate: () => calls.push('activate'),
    reload: () => calls.push('reload'),
    notify: () => {},
  });
  return {
    gate,
    calls,
    available: (value) => {
      available = value;
    },
  };
}
test('une mise à jour attend la fin de saisie et de la requête puis recharge une fois', () => {
  const { gate, calls } = fixture();
  gate.waiting();
  gate.flush();
  assert.deepEqual(calls, []);
  gate.setSafe(true);
  gate.flush();
  assert.deepEqual(calls, ['activate']);
  gate.changed();
  gate.changed();
  assert.deepEqual(calls, ['activate', 'reload']);
});
test('une activation dans un autre onglet ne coupe pas une opération en cours', () => {
  const { gate, calls } = fixture();
  gate.changed();
  gate.flush();
  assert.deepEqual(calls, []);
  gate.setSafe(true);
  assert.deepEqual(calls, ['reload']);
});
test('hors ligne ou en arrière-plan, activation et rechargement restent différés', () => {
  const { gate, calls, available } = fixture();
  available(false);
  gate.setSafe(true);
  gate.waiting();
  assert.deepEqual(calls, []);
  available(true);
  gate.flush();
  available(false);
  gate.changed();
  assert.deepEqual(calls, ['activate']);
  available(true);
  gate.flush();
  assert.deepEqual(calls, ['activate', 'reload']);
});
test('une nouvelle saisie entre activation et prise de contrôle diffère le rechargement', () => {
  const { gate, calls } = fixture();
  gate.setSafe(true);
  gate.waiting();
  gate.setSafe(false);
  gate.changed();
  assert.deepEqual(calls, ['activate']);
  gate.setSafe(true);
  assert.deepEqual(calls, ['activate', 'reload']);
});
