// 雙打對戰排程:隊友交替、休息平均。
import { uid } from './util.js';

const SEP = '\u0001';
export const pairKey = (a, b) => (a < b ? a + SEP + b : b + SEP + a);
const gcd = (a, b) => (b ? gcd(b, a % b) : a);

/** 一輪要排幾場:讓每個人在一輪內上場/休息次數相同(上限 6 場) */
export function roundSize(n) {
  if (n < 4) return 0;
  if (n === 4) return 3; // 3 種組合各打一次
  return Math.min(6, n / gcd(n, 4));
}

export function newContext(players) {
  const ctx = { games: {}, last: {}, partner: {}, opp: {}, seq: 0 };
  for (const p of players) {
    ctx.games[p] = 0;
    ctx.last[p] = -1;
  }
  return ctx;
}

export function applyMatch(ctx, m) {
  const all = [...m.teamA, ...m.teamB];
  for (const p of all) {
    if (!(p in ctx.games)) {
      ctx.games[p] = 0;
      ctx.last[p] = -1;
    }
    ctx.games[p]++;
    ctx.last[p] = ctx.seq;
  }
  const k1 = pairKey(m.teamA[0], m.teamA[1]);
  const k2 = pairKey(m.teamB[0], m.teamB[1]);
  ctx.partner[k1] = (ctx.partner[k1] || 0) + 1;
  ctx.partner[k2] = (ctx.partner[k2] || 0) + 1;
  for (const a of m.teamA)
    for (const b of m.teamB) {
      const k = pairKey(a, b);
      ctx.opp[k] = (ctx.opp[k] || 0) + 1;
    }
  ctx.seq++;
}

export function buildContext(players, rounds) {
  const ctx = newContext(players);
  for (const r of rounds) for (const m of r.matches) if (m.teamA.length === 2 && m.teamB.length === 2) applyMatch(ctx, m);
  return ctx;
}

function splitCost(ctx, [a, b], [c, d]) {
  const P = (x, y) => ctx.partner[pairKey(x, y)] || 0;
  const O = (x, y) => ctx.opp[pairKey(x, y)] || 0;
  return (
    (P(a, b) + P(c, d)) * 40 +
    (O(a, c) + O(a, d) + O(b, c) + O(b, d)) * 10
  );
}

/** 從所有人中挑出下一場(4 人 + 分隊) */
export function pickMatch(players, ctx, rng = Math.random) {
  const n = players.length;
  let best = null;
  for (let i = 0; i < n - 3; i++)
    for (let j = i + 1; j < n - 2; j++)
      for (let k = j + 1; k < n - 1; k++)
        for (let l = k + 1; l < n; l++) {
          const g = [players[i], players[j], players[k], players[l]];
          let base = 0;
          for (const p of g) base += ctx.games[p] * 1000 + ctx.last[p] * 10;
          const splits = [
            [[g[0], g[1]], [g[2], g[3]]],
            [[g[0], g[2]], [g[1], g[3]]],
            [[g[0], g[3]], [g[1], g[2]]],
          ];
          for (const [A, B] of splits) {
            const cost = base + splitCost(ctx, A, B) + rng() * 0.5;
            if (!best || cost < best.cost) best = { cost, A, B };
          }
        }
  return makeMatch(best.A, best.B);
}

export function makeMatch(teamA = [], teamB = []) {
  return { id: uid(), teamA: [...teamA], teamB: [...teamB], scoreA: null, scoreB: null };
}

/** 生成下一輪(會參考先前所有已排出的場次) */
export function generateRound(players, rounds, rng = Math.random) {
  if (players.length < 4) throw new Error('至少需要 4 位參加者');
  const ctx = buildContext(players, rounds);
  const matches = [];
  const count = roundSize(players.length);
  for (let i = 0; i < count; i++) {
    const m = pickMatch(players, ctx, rng);
    applyMatch(ctx, m);
    matches.push(m);
  }
  return { id: uid(), no: rounds.length + 1, matches };
}

/** 單獨建議一場(手動新增場次時用) */
export function suggestMatch(players, rounds, rng = Math.random) {
  return pickMatch(players, buildContext(players, rounds), rng);
}

export function resting(players, m) {
  const on = new Set([...m.teamA, ...m.teamB]);
  return players.filter((p) => !on.has(p));
}
