import test from 'node:test';
import assert from 'node:assert/strict';
import { generateRound, roundSize, resting, buildContext, pairKey } from '../js/scheduler.js';

const names = (n) => 'ABCDEFGHIJKL'.slice(0, n).split('');

test('roundSize', () => {
  assert.equal(roundSize(3), 0);
  assert.equal(roundSize(4), 3);
  assert.equal(roundSize(5), 5);
  assert.equal(roundSize(6), 3);
  assert.equal(roundSize(8), 2);
});

test('4 人:一輪三場,三種搭檔組合各一次', () => {
  const p = names(4);
  const r = generateRound(p, []);
  assert.equal(r.matches.length, 3);
  const keys = new Set();
  for (const m of r.matches) {
    keys.add(pairKey(...m.teamA));
    keys.add(pairKey(...m.teamB));
  }
  assert.equal(keys.size, 6); // 每個人搭過 3 個不同隊友
});

for (const n of [5, 6, 7, 8, 9, 10]) {
  test(`${n} 人:每場 4 個不同的人,多輪後場數差距 ≤ 1`, () => {
    const p = names(n);
    const rounds = [];
    for (let i = 0; i < 4; i++) rounds.push(generateRound(p, rounds));
    for (const r of rounds)
      for (const m of r.matches) {
        assert.equal(new Set([...m.teamA, ...m.teamB]).size, 4);
        assert.equal(resting(p, m).length, n - 4);
      }
    const g = Object.values(buildContext(p, rounds).games);
    assert.ok(Math.max(...g) - Math.min(...g) <= 1, `games ${g}`);
  });
}

test('5 人:一輪內每人恰好休息一次', () => {
  const p = names(5);
  const r = generateRound(p, []);
  const rest = {};
  for (const m of r.matches) for (const x of resting(p, m)) rest[x] = (rest[x] || 0) + 1;
  assert.deepEqual(Object.values(rest), [1, 1, 1, 1, 1]);
});

test('6 人:隊友重複次數低', () => {
  const p = names(6);
  const rounds = [];
  for (let i = 0; i < 2; i++) rounds.push(generateRound(p, rounds));
  const ctx = buildContext(p, rounds);
  assert.ok(Math.max(...Object.values(ctx.partner)) <= 2);
});
