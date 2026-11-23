import test from 'node:test';
import assert from 'node:assert/strict';
import { computeStats, isComplete, groupEvents, orderEvents, defaultAfterId } from '../js/stats.js';
import { computeTitles, TITLES } from '../js/titles.js';

const m = (A, B, a, b) => ({ id: Math.random(), teamA: A, teamB: B, scoreA: a, scoreB: b });
const session = (matches, players = ['A', 'B', 'C', 'D', 'E']) => ({
  players, events: [{ id: 1, players: ['E'], text: '抽筋了' }],
  rounds: [{ no: 1, matches }],
});

test('isComplete 驗證', () => {
  assert.ok(isComplete(m(['A', 'B'], ['C', 'D'], 21, 10)));
  assert.ok(!isComplete(m(['A', 'B'], ['C', 'D'], 21, 21)));
  assert.ok(!isComplete(m(['A', 'B'], ['C', 'D'], null, 21)));
  assert.ok(!isComplete(m(['A', 'A'], ['C', 'D'], 21, 5)));
});

const S = session([
  m(['A', 'B'], ['C', 'D'], 21, 10), // A,B 勝 (D/C 敗)
  m(['A', 'C'], ['B', 'E'], 21, 19), // A,C 勝
  m(['A', 'D'], ['C', 'E'], 15, 21), // C,E 勝, A 連勝終結
  m(['B', 'E'], ['A', 'D'], 21, 12), // B,E 勝
]);

test('computeStats 勝敗與連勝', () => {
  const st = computeStats(S);
  const p = Object.fromEntries(st.players.map((x) => [x.name, x]));
  assert.equal(p.A.games, 4);
  assert.equal(p.A.wins, 2);
  assert.equal(p.A.maxWin, 2);
  assert.equal(p.A.maxLose, 2);
  assert.equal(p.C.enders, 1);
  assert.equal(p.E.enders, 1); // C,E 打斷 A 的 2 連勝
  assert.equal(p.D.rests, 1);
});

test('稱號:MVP / 連勝終結者 / 大屠殺', () => {
  const t = Object.fromEntries(computeTitles(S).map((x) => [x.id, x]));
  assert.ok(t.mvp.items.length >= 1);
  assert.ok(t.ender.items.some((i) => i.label === 'E'));
  assert.equal(t.massacre.items[0].note.startsWith('21:10'), true);
  assert.ok(t.eventKing.items.some((i) => i.label === 'E'));
});

test('沒有完成的場次 → 沒有稱號', () => {
  assert.deepEqual(computeTitles(session([m(['A', 'B'], ['C', 'D'], null, null)])), []);
});

test('至少 30 個稱號,且 id 不重複', () => {
  assert.ok(TITLES.length >= 30);
  assert.equal(new Set(TITLES.map((t) => t.id)).size, TITLES.length);
});

test('開門紅 / 壓軸王 / 過山車', () => {
  const t = Object.fromEntries(computeTitles(S).map((x) => [x.id, x]));
  assert.ok(t.opener.items[0].label.includes('A'));
  assert.ok(t.closer.items[0].label.includes('B'));
  assert.ok(t.rollercoaster.items.length >= 1);
});

test('事件時間軸:插在指定場次之後、舊資料放最後、預設在已完成的最後一場之後', () => {
  const a = m(['A', 'B'], ['C', 'D'], 21, 10); a.id = 'm1';
  const b = m(['A', 'C'], ['B', 'D'], 21, 19); b.id = 'm2';
  const c = m(['A', 'D'], ['B', 'C'], null, null); c.id = 'm3';
  const ss = { players: ['A', 'B', 'C', 'D'], rounds: [{ no: 1, matches: [a, b, c] }], events: [
    { id: 'e1', text: 'x', afterMatchId: 'm2' }, { id: 'e2', text: 'y', afterMatchId: null },
    { id: 'e3', text: 'old' }, { id: 'e4', text: 'gone', afterMatchId: 'zzz' }, { id: 'e5', text: 'z', afterMatchId: 'm1' } ] };
  assert.deepEqual(orderEvents(ss).map((e) => e.id), ['e2', 'e5', 'e1', 'e3', 'e4']);
  assert.equal(groupEvents(ss).by.m3.length, 2);
  assert.equal(defaultAfterId(ss), 'm2'); // 已完成的最後一場
  c.scoreA = 21; c.scoreB = 1;
  assert.equal(defaultAfterId(ss), 'm3');
  a.scoreA = a.scoreB = b.scoreA = b.scoreB = c.scoreA = c.scoreB = null;
  assert.equal(defaultAfterId(ss), null); // 都沒完成 → 最前面
});
