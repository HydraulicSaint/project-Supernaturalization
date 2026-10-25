import test from 'node:test';
import assert from 'node:assert/strict';
import { advance, defaultProfile, eligible, frame, phases, selectPoi, validateProfile } from '../lib/atlas/director';
import type { Director } from '../lib/atlas/director';
import { publicEvents, simulatedEvents } from '../lib/atlas/observations';

test('director completes both descents and increments visit only after withdrawal', () => {
  let state: Director = { phase: 'OVERVIEW', visit: 0 };
  for (const phase of phases) {
    assert.equal(state.phase, phase);
    assert.equal(state.visit, 0);
    assert.ok(eligible(defaultProfile, frame(state, defaultProfile).center));
    state = advance(state);
  }
  assert.deepEqual(state, { phase: 'OVERVIEW', visit: 1 });
  assert.ok(frame({ phase: 'DESCENT_2', visit: 0 }, defaultProfile).zoom > frame({ phase: 'DESCENT_1', visit: 0 }, defaultProfile).zoom);
});
test('profile validates geographic limits and exclusion rules', () => {
  assert.equal(validateProfile(defaultProfile), true);
  assert.equal(validateProfile(null), false);
  assert.equal(validateProfile({ ...defaultProfile, bounds: [0, 0, 1, 1] }), false);
  assert.equal(validateProfile({ ...defaultProfile, seed: NaN }), false);
  assert.equal(validateProfile({ ...defaultProfile, exclusions: [defaultProfile.bounds] }), false);
  assert.equal(eligible(defaultProfile, [-107.71, 37.56]), false);
  assert.equal(eligible(defaultProfile, [0, 0]), false);
});
test('selection is repeatable and covers all curated POIs', () => {
  assert.deepEqual(selectPoi(defaultProfile, 9), selectPoi(defaultProfile, 9));
  assert.equal(new Set([0, 1, 2].map(n => selectPoi(defaultProfile, n).name)).size, 3);
});
test('public adapter filters location, confidence and private observations; strips extra fields', () => {
  assert.equal(publicEvents(simulatedEvents, defaultProfile).length, 3);
  assert.equal(publicEvents(simulatedEvents, defaultProfile, 0.9).length, 0);
  const enriched = { ...simulatedEvents[0], operatorNotes: 'PRIVATE', token: 'SECRET' };
  assert.equal('operatorNotes' in publicEvents([enriched], defaultProfile)[0], false);
  assert.equal('token' in publicEvents([enriched], defaultProfile)[0], false);
  assert.equal(publicEvents([{ ...enriched, center: [0, 0] }], defaultProfile).length, 0);
  assert.equal(publicEvents([{ ...enriched, visibility: 'private' } as never], defaultProfile).length, 0);
});
