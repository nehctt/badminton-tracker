// 只依據「最終比分」計算,不需要得分順序。
import { pairKey } from './scheduler.js';

export function isComplete(m) {
  const ok = (v) => Number.isInteger(v) && v >= 0;
  const names = [...m.teamA, ...m.teamB];
  return (
    ok(m.scoreA) && ok(m.scoreB) && m.scoreA !== m.scoreB &&
    names.length === 4 && names.every(Boolean) && new Set(names).size === 4
  );
}

/** 連續得分達幾分,才算「對手的一波流」,被打斷時會記一次「止血」 */
export const STOP_RUN = 4;

/** 比分順序是否有效(記分板產生的 points,且和最終比分吻合) */
export function validPoints(m) {
  return Array.isArray(m.points) && Number.isInteger(m.scoreA) && Number.isInteger(m.scoreB) &&
    m.points.length === m.scoreA + m.scoreB &&
    m.points.filter((x) => x === 'A').length === m.scoreA;
}

/** 由得分順序(['A','B',...])算出:最大領先、最長連續得分、打斷連續得分次數 */
export function analyzePoints(points) {
  let a = 0, b = 0, leadA = 0, leadB = 0, run = 0, runSide = null, maxRunA = 0, maxRunB = 0;
  const ended = { A: 0, B: 0 };
  for (const p of points) {
    if (p === runSide) run++;
    else {
      if (runSide && run >= STOP_RUN) ended[p]++;
      runSide = p; run = 1;
    }
    if (p === 'A') { a++; maxRunA = Math.max(maxRunA, run); } else { b++; maxRunB = Math.max(maxRunB, run); }
    leadA = Math.max(leadA, a - b);
    leadB = Math.max(leadB, b - a);
  }
  return { a, b, leadA, leadB, maxRunA, maxRunB, ended };
}

export function hasDuplicate(m) {
  const names = [...m.teamA, ...m.teamB].filter(Boolean);
  return new Set(names).size !== names.length;
}

const blank = (name) => ({
  name, games: 0, wins: 0, losses: 0, pf: 0, pa: 0,
  curWin: 0, curLose: 0, maxWin: 0, maxLose: 0,
  enders: 0, rests: 0, closeGames: 0, closeWins: 0, closeLosses: 0,
  results: [], margins: [], partners: new Set(),
  seqMatches: 0, maxPtRun: 0, maxPtLose: 0, stopRuns: 0, bestComeback: 0, blownLead: 0, wireWins: 0,
});

export function computeStats(session) {
  const players = {};
  for (const p of session.players) players[p] = blank(p);
  const get = (p) => (players[p] ||= blank(p));
  const pairs = {};
  const matches = [];

  for (const round of session.rounds) {
    for (const m of round.matches) {
      if (!isComplete(m)) continue;
      const aWin = m.scoreA > m.scoreB;
      const winners = aWin ? m.teamA : m.teamB;
      const losers = aWin ? m.teamB : m.teamA;
      const wScore = aWin ? m.scoreA : m.scoreB;
      const lScore = aWin ? m.scoreB : m.scoreA;
      const margin = wScore - lScore;
      const close = margin <= 2;

      for (const l of losers) if (get(l).curWin >= 2) for (const w of winners) get(w).enders++;

      const record = (name, won, pf, pa) => {
        const p = get(name);
        p.games++;
        p.pf += pf;
        p.pa += pa;
        p.results.push(won ? 'W' : 'L');
        p.margins.push(won ? margin : -margin);
        if (won) {
          p.wins++; p.curWin++; p.curLose = 0;
          p.maxWin = Math.max(p.maxWin, p.curWin);
        } else {
          p.losses++; p.curLose++; p.curWin = 0;
          p.maxLose = Math.max(p.maxLose, p.curLose);
        }
        if (close) { p.closeGames++; won ? p.closeWins++ : p.closeLosses++; }
      };
      winners.forEach((n) => record(n, true, wScore, lScore));
      losers.forEach((n) => record(n, false, lScore, wScore));

      if (validPoints(m)) {
        const an = analyzePoints(m.points);
        for (const [side, team] of [['A', m.teamA], ['B', m.teamB]]) {
          const won = (side === 'A') === aWin;
          const myLead = side === 'A' ? an.leadA : an.leadB;
          const theirLead = side === 'A' ? an.leadB : an.leadA;
          for (const n of team) {
            const p = get(n);
            p.seqMatches++;
            p.maxPtRun = Math.max(p.maxPtRun, side === 'A' ? an.maxRunA : an.maxRunB);
            p.maxPtLose = Math.max(p.maxPtLose, side === 'A' ? an.maxRunB : an.maxRunA);
            p.stopRuns += an.ended[side];
            if (won) {
              p.bestComeback = Math.max(p.bestComeback, theirLead); // 落後最多時差多少分,最後還是贏了
              if (theirLead <= 0) p.wireWins++; // 從頭領先到尾
            } else {
              p.blownLead = Math.max(p.blownLead, myLead); // 曾經領先這麼多,最後卻輸了
            }
          }
        }
      }

      const on = new Set([...m.teamA, ...m.teamB]);
      for (const name of Object.keys(players)) if (!on.has(name)) players[name].rests++;

      for (const [team, won, pf, pa] of [[winners, true, wScore, lScore], [losers, false, lScore, wScore]]) {
        const k = pairKey(team[0], team[1]);
        const pr = (pairs[k] ||= { names: [team[0], team[1]], games: 0, wins: 0, losses: 0, pf: 0, pa: 0 });
        pr.games++; pr.pf += pf; pr.pa += pa;
        won ? pr.wins++ : pr.losses++;
        get(team[0]).partners.add(team[1]);
        get(team[1]).partners.add(team[0]);
      }
      matches.push({ teamA: m.teamA, teamB: m.teamB, scoreA: m.scoreA, scoreB: m.scoreB, winners, losers, wScore, lScore, margin, total: wScore + lScore });
    }
  }

  const list = Object.values(players).map((p) => ({
    ...p,
    winRate: p.games ? p.wins / p.games : 0,
    diff: p.pf - p.pa,
    avgPf: p.games ? p.pf / p.games : 0,
    avgPa: p.games ? p.pa / p.games : 0,
  }));
  for (const pr of Object.values(pairs)) pr.winRate = pr.games ? pr.wins / pr.games : 0;
  return { players: list, pairs: Object.values(pairs), matches };
}

/* ---------- 事件時間軸 ---------- */

/** 依序攤平所有場次 */
export function flatMatches(session) {
  const out = [];
  session.rounds.forEach((r, ri) => r.matches.forEach((m, mi) => out.push({ id: m.id, ri, mi, m })));
  return out;
}

/**
 * 事件的位置 = 插在某一場「之後」(afterMatchId)。
 * null = 第一場之前;舊資料(undefined)或對應場次已被刪除 → 放到最後一場之後。
 * 回傳 { head: [], by: { [matchId]: [] } }
 */
export function groupEvents(session) {
  const flat = flatMatches(session);
  const ids = new Set(flat.map((x) => x.id));
  const lastId = flat.length ? flat[flat.length - 1].id : null;
  const head = [];
  const by = {};
  for (const e of session.events || []) {
    if (e.afterMatchId === null || (!flat.length)) head.push(e);
    else if (e.afterMatchId && ids.has(e.afterMatchId)) (by[e.afterMatchId] ||= []).push(e);
    else (by[lastId] ||= []).push(e);
  }
  return { head, by };
}

/** 依對戰順序排好的事件清單 */
export function orderEvents(session) {
  const { head, by } = groupEvents(session);
  return [...head, ...flatMatches(session).flatMap((x) => by[x.id] || [])];
}

/** 新事件預設插入點:已完成(有比分)的最後一場之後;還沒有任何完成的場次 → 第一場之前(null) */
export function defaultAfterId(session) {
  const done = flatMatches(session).filter((x) => isComplete(x.m));
  return done.length ? done[done.length - 1].id : null;
}
