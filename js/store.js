const KEY = 'badminton-tracker:v1';

export function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && Array.isArray(d.sessions)) return d;
  } catch {}
  return { sessions: [] };
}

export function save(db) {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {}
}

/** 常用名單:依出現次數排序 */
export function roster(db) {
  const cnt = {};
  for (const s of db.sessions) for (const p of s.players) cnt[p] = (cnt[p] || 0) + 1;
  return Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]);
}

export function exportJSON(db) {
  return JSON.stringify({ app: 'badminton-tracker', version: 1, sessions: db.sessions }, null, 2);
}

/** 匯入並依 id 合併,回傳新增筆數 */
export function importJSON(text, db) {
  const d = JSON.parse(text);
  if (!d || !Array.isArray(d.sessions)) throw new Error('格式不正確');
  const have = new Set(db.sessions.map((s) => s.id));
  let n = 0;
  for (const s of d.sessions) {
    if (s && s.id && Array.isArray(s.players) && Array.isArray(s.rounds) && !have.has(s.id)) {
      db.sessions.push(s);
      n++;
    }
  }
  return n;
}
