// 今日稱號:每個稱號 = 一個純函式,回傳 [{label, note}] 或空陣列。
import { computeStats } from './stats.js';

const f1 = (n) => (Math.round(n * 10) / 10).toFixed(1);
const pct = (n) => Math.round(n * 100) + '%';
const pairLabel = (pr) => `${pr.names[0]} ＆ ${pr.names[1]}`;

/** 取出「最大」者(可並列)。keys 為由主到次的比較依據(越大越好)。 */
function best(list, keys) {
  if (!list.length) return [];
  const cmp = (a, b) => {
    for (const k of keys) {
      const d = k(a) - k(b);
      if (Math.abs(d) > 1e-9) return d;
    }
    return 0;
  };
  let top = list[0];
  for (const x of list) if (cmp(x, top) > 0) top = x;
  return list.filter((x) => cmp(x, top) === 0);
}

/** 全員並列(三人以上)就沒有意義,視為沒有得主 */
function bestUnlessAllTie(list, keys) {
  const w = best(list, keys);
  return w.length === list.length && list.length > 2 ? [] : w;
}

const players = (arr, note) => arr.map((p) => ({ label: p.name, note: note(p) }));

export const TITLES = [
  {
    id: 'mvp', icon: '🏆', name: 'MVP', desc: '勝場最多(平手比勝率、再比淨勝分)',
    calc: ({ act }) => players(best(act.filter((p) => p.wins > 0), [(p) => p.wins, (p) => p.winRate, (p) => p.diff]), (p) => `${p.wins} 勝`),
  },
  {
    id: 'perfect', icon: '👑', name: '完美無缺', desc: '至少 3 場、一場都沒輸',
    calc: ({ act }) => players(act.filter((p) => p.games >= 3 && p.losses === 0), (p) => `${p.games} 戰全勝`),
  },
  {
    id: 'bestPair', icon: '🤝', name: '最佳拍檔', desc: '搭檔勝場最多的組合(至少 2 勝)',
    calc: ({ st }) => best(st.pairs.filter((x) => x.wins >= 2), [(x) => x.wins, (x) => x.winRate])
      .map((x) => ({ label: pairLabel(x), note: `一起贏 ${x.wins} 場` })),
  },
  {
    id: 'streak', icon: '🔥', name: '連勝王', desc: '最長連勝(至少 2 連勝)',
    calc: ({ act }) => players(best(act.filter((p) => p.maxWin >= 2), [(p) => p.maxWin]), (p) => `${p.maxWin} 連勝`),
  },
  {
    id: 'ender', icon: '⚔️', name: '連勝終結者', desc: '打斷對手連勝(對手至少 2 連勝)次數最多',
    calc: ({ act }) => players(best(act.filter((p) => p.enders > 0), [(p) => p.enders]), (p) => `終結 ${p.enders} 次連勝`),
  },
  {
    id: 'loseStreak', icon: '🪫', name: '連敗王', desc: '最長連敗(至少 2 連敗)',
    calc: ({ act }) => players(best(act.filter((p) => p.maxLose >= 2), [(p) => p.maxLose]), (p) => `${p.maxLose} 連敗`),
  },
  {
    id: 'mostLoss', icon: '🥀', name: '苦主', desc: '敗場最多(至少 2 敗)',
    calc: ({ act }) => players(best(act.filter((p) => p.losses >= 2), [(p) => p.losses, (p) => -p.winRate]), (p) => `${p.losses} 敗`),
  },
  {
    id: 'winless', icon: '🐢', name: '今天不是我的日子', desc: '至少 3 場、一場都沒贏',
    calc: ({ act }) => players(act.filter((p) => p.games >= 3 && p.wins === 0), (p) => `${p.games} 戰 0 勝`),
  },
  {
    id: 'worstPair', icon: '💀', name: '難兄難弟', desc: '搭檔敗場最多的組合(至少 2 敗)',
    calc: ({ st }) => best(st.pairs.filter((x) => x.losses >= 2), [(x) => x.losses, (x) => -x.winRate])
      .map((x) => ({ label: pairLabel(x), note: `一起輸 ${x.losses} 場` })),
  },
  {
    id: 'firepower', icon: '💥', name: '火力王', desc: '場均得分最高(至少 2 場)',
    calc: ({ act }) => players(best(act.filter((p) => p.games >= 2), [(p) => p.avgPf]), (p) => `場均 ${f1(p.avgPf)} 分`),
  },
  {
    id: 'wall', icon: '🧱', name: '鐵壁', desc: '場均失分最少(至少 2 場)',
    calc: ({ act }) => players(best(act.filter((p) => p.games >= 2), [(p) => -p.avgPa]), (p) => `場均失 ${f1(p.avgPa)} 分`),
  },
  {
    id: 'diffKing', icon: '📈', name: '淨勝分王', desc: '總得分減總失分最高',
    calc: ({ act }) => players(best(act.filter((p) => p.diff > 0), [(p) => p.diff]), (p) => `淨勝 ${p.diff} 分`),
  },
  {
    id: 'diffDebt', icon: '💸', name: '分差負債王', desc: '總得分減總失分最低',
    calc: ({ act }) => players(best(act.filter((p) => p.diff < 0), [(p) => -p.diff]), (p) => `負 ${-p.diff} 分`),
  },
  {
    id: 'heart', icon: '😰', name: '心臟最大顆', desc: '打過最多場分差 ≤ 2 的膠著戰(至少 2 場)',
    calc: ({ act }) => players(best(act.filter((p) => p.closeGames >= 2), [(p) => p.closeGames]), (p) => `${p.closeGames} 場膠著戰`),
  },
  {
    id: 'clutch', icon: '🧊', name: '關鍵先生', desc: '分差 ≤ 2 的險勝最多',
    calc: ({ act }) => players(best(act.filter((p) => p.closeWins > 0), [(p) => p.closeWins]), (p) => `險勝 ${p.closeWins} 場`),
  },
  {
    id: 'almost', icon: '😭', name: '與勝利擦身而過', desc: '分差 ≤ 2 的惜敗最多',
    calc: ({ act }) => players(best(act.filter((p) => p.closeLosses > 0), [(p) => p.closeLosses]), (p) => `惜敗 ${p.closeLosses} 場`),
  },
  {
    id: 'massacre', icon: '🔪', name: '大屠殺', desc: '單場最大分差勝利(分差至少 8)',
    calc: ({ st }) => best(st.matches.filter((m) => m.margin >= 8), [(m) => m.margin])
      .map((m) => ({ label: m.winners.join(' ＆ '), note: `${m.wScore}:${m.lScore} 擊敗 ${m.losers.join(' ＆ ')}` })),
  },
  {
    id: 'massacred', icon: '🫠', name: '被屠殺', desc: '單場最大分差落敗(分差至少 8)',
    calc: ({ st }) => best(st.matches.filter((m) => m.margin >= 8), [(m) => m.margin])
      .map((m) => ({ label: m.losers.join(' ＆ '), note: `${m.lScore}:${m.wScore} 慘敗` })),
  },
  {
    id: 'marathon', icon: '⏱️', name: '馬拉松選手', desc: '總得分最高的一場拉鋸戰(總分至少 40)',
    calc: ({ st }) => best(st.matches.filter((m) => m.total >= 40), [(m) => m.total])
      .map((m) => ({ label: `${m.teamA.join('＆')} vs ${m.teamB.join('＆')}`, note: `${m.scoreA}:${m.scoreB},共 ${m.total} 分` })),
  },
  {
    id: 'worker', icon: '🏃', name: '勞模', desc: '上場次數最多',
    calc: ({ act }) => players(bestUnlessAllTie(act, [(p) => p.games]), (p) => `${p.games} 場`),
  },
  {
    id: 'bench', icon: '🪑', name: '板凳之王', desc: '休息次數最多',
    calc: ({ act }) => players(bestUnlessAllTie(act.filter((p) => p.rests > 0), [(p) => p.rests]), (p) => `休息 ${p.rests} 場`),
  },
  {
    id: 'social', icon: '🦋', name: '社交蝴蝶', desc: '搭過最多不同的搭檔(至少 3 位)',
    calc: ({ act }) => players(bestUnlessAllTie(act.filter((p) => p.partners.size >= 3), [(p) => p.partners.size]), (p) => `搭過 ${p.partners.size} 位`),
  },
  {
    id: 'lateBloomer', icon: '🌅', name: '大器晚成', desc: '後半段勝率明顯比前半段高(至少 4 場)',
    calc: ({ act }) => {
      const d = (p) => halfDelta(p);
      return players(best(act.filter((p) => p.games >= 4 && d(p) >= 0.34), [d]), (p) => `${pct(halves(p)[0])} → ${pct(halves(p)[1])}`);
    },
  },
  {
    id: 'fade', icon: '🐍', name: '虎頭蛇尾', desc: '後半段勝率明顯比前半段低(至少 4 場)',
    calc: ({ act }) => {
      const d = (p) => -halfDelta(p);
      return players(best(act.filter((p) => p.games >= 4 && d(p) >= 0.34), [d]), (p) => `${pct(halves(p)[0])} → ${pct(halves(p)[1])}`);
    },
  },
  {
    id: 'zen', icon: '☯️', name: '佛系選手', desc: '至少 4 場、勝率剛好 50%',
    calc: ({ act }) => players(act.filter((p) => p.games >= 4 && p.wins * 2 === p.games), (p) => `${p.wins} 勝 ${p.losses} 敗`),
  },
  {
    id: 'eventKing', icon: '🎪', name: '搞笑擔當', desc: '被記錄特殊事件最多',
    calc: ({ session, st }) => {
      const cnt = {};
      for (const e of session.events || []) for (const n of e.players || []) cnt[n] = (cnt[n] || 0) + 1;
      const list = Object.entries(cnt).map(([name, n]) => ({ name, n }));
      const everyone = st.players.length;
      const w = best(list, [(x) => x.n]);
      if (w.length === everyone && everyone > 2) return [];
      return w.map((x) => ({ label: x.name, note: `${x.n} 則事件` }));
    },
  },
  {
    id: 'rollercoaster', icon: '🎢', name: '過山車', desc: '最大勝分與最大敗分落差最大(至少 3 場,贏過也輸過)',
    calc: ({ act }) => {
      const swing = (p) => Math.max(...p.margins) - Math.min(...p.margins);
      return players(best(act.filter((p) => p.games >= 3 && p.wins && p.losses), [swing]),
        (p) => `最大贏 ${Math.max(...p.margins)} 分 / 最大輸 ${-Math.min(...p.margins)} 分`);
    },
  },
  {
    id: 'steady', icon: '🗿', name: '穩如泰山', desc: '每場分差最穩定(至少 3 場)',
    calc: ({ act }) => {
      const sd = (p) => {
        const mean = p.margins.reduce((a, b) => a + b, 0) / p.margins.length;
        return Math.sqrt(p.margins.reduce((a, b) => a + (b - mean) ** 2, 0) / p.margins.length);
      };
      return players(bestUnlessAllTie(act.filter((p) => p.games >= 3), [(p) => -sd(p)]), (p) => `分差波動 ${f1(sd(p))}`);
    },
  },
  {
    id: 'opener', icon: '🎊', name: '開門紅', desc: '拿下今天第一場比賽(至少打滿 3 場)',
    calc: ({ st }) => {
      const m = st.matches[0];
      return st.matches.length >= 3 ? [{ label: m.winners.join(' ＆ '), note: `${m.wScore}:${m.lScore} 拿下開幕戰` }] : [];
    },
  },
  {
    id: 'closer', icon: '🎬', name: '壓軸王', desc: '拿下今天最後一場比賽(至少打滿 3 場)',
    calc: ({ st }) => {
      const m = st.matches[st.matches.length - 1];
      return st.matches.length >= 3 ? [{ label: m.winners.join(' ＆ '), note: `${m.wScore}:${m.lScore} 收下壓軸戰` }] : [];
    },
  },
];

function halves(p) {
  const mid = Math.floor(p.results.length / 2);
  const rate = (arr) => (arr.length ? arr.filter((r) => r === 'W').length / arr.length : 0);
  return [rate(p.results.slice(0, mid)), rate(p.results.slice(mid))];
}
const halfDelta = (p) => { const [a, b] = halves(p); return b - a; };

export function computeTitles(session) {
  const st = computeStats(session);
  const act = st.players.filter((p) => p.games > 0);
  const ctx = { session, st, act };
  const MAX = 3; // 並列太多時只列前幾名,避免結算頁過長
  const cap = (items) => (items.length > MAX ? [...items.slice(0, MAX), { label: `…另有 ${items.length - MAX} 組並列`, note: '' }] : items);
  return TITLES.map((t) => ({ id: t.id, icon: t.icon, name: t.name, desc: t.desc, items: act.length ? cap(t.calc(ctx)) : [] })).filter((t) => t.items.length);
}
