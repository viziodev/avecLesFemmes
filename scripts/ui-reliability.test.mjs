import { test } from 'node:test';
import assert from 'node:assert/strict';
import { confirmedAction } from '../packages/ui/src/confirmed-action.ts';

test('un refus serveur conserve la saisie et ne confirme pas le versement', async () => {
  const error = new Error('Membre bloquée');
  let closed = false;
  let notice;
  const saved = await confirmedAction(
    async () => {
      throw error;
    },
    () => {
      closed = true;
    },
    (value) => {
      notice = value;
    },
  );
  assert.equal(saved, false);
  assert.equal(closed, false);
  assert.equal(notice, error);
});

test('la confirmation attend la réponse serveur', async () => {
  let resolve;
  const pending = new Promise((done) => {
    resolve = done;
  });
  let confirmed = 0;
  const result = confirmedAction(
    () => pending,
    () => {
      confirmed++;
    },
    () => assert.fail(),
  );
  assert.equal(confirmed, 0);
  resolve({ reference: 'recu-1' });
  assert.equal(await result, true);
  assert.equal(confirmed, 1);
});
