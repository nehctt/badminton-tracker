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

export function hasDuplicate(m) {
  const names = [...m.teamA, ...m.teamB].filter(Boolean);
  return new Set(names).size !== names.length;
}

const blank = (name) => ({
  name, games: 0, wins: 0, losses: 0, pf: 0, pa: 0,
  curWin: 0, curLose: 0, maxWin: 0, maxLose: 0,
  enders: 0, rests: 0, closeGames: 0, closeWins: 0, closeLosses: 0,
  results: [], margins: [], partners: new Set(),
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
