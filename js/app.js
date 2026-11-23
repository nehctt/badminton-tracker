import { esc, uid, todayStr, nowHM, weekday, minutesBetween, fmtDuration } from './util.js';
import { load, save, roster, exportJSON, importJSON } from './store.js';
import { generateRound, suggestMatch, resting } from './scheduler.js';
import { isComplete, hasDuplicate, computeStats } from './stats.js';
import { computeTitles } from './titles.js';

let db = load();
const app = document.getElementById('app');
const persist = () => save(db);
const getSession = (id) => db.sessions.find((s) => s.id === id);

let draft = null; // 新增對戰表單
let sortKey = 'wins';
let openRounds = new Set(); // 使用者手動展開過的輪
let lastRoute = '';

const EVENT_TEMPLATES = ['抽筋了,下場休息', '挑釁對手結果自己馬上失誤', '發球直接下網', '殺球打到自己的腳', '球拍飛出去了', '接球接到飛出場外', '用盡全力卻揮空拍', '大喊「我來!」然後沒接到'];

/* ---------- helpers ---------- */
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 1800);
}
const go = (hash) => { location.hash = hash; };
const dateLabel = (s) => `${s.date.replace(/-/g, '/')}(${weekday(s.date)})`;
const doneCount = (s) => s.rounds.reduce((n, r) => n + r.matches.filter(isComplete).length, 0);
const pct = (n) => Math.round(n * 100) + '%';

function download(name, text, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- views ---------- */
function viewHome() {
  const list = [...db.sessions].sort((a, b) => (b.date + b.startTime).localeCompare(a.date + a.startTime));
  return `
    <div class="hero"><div class="emoji">🏸</div><h1>羽球紀錄</h1><div class="muted">輪流對戰 · 比分 · 今日稱號</div></div>
    <button class="btn primary block" data-act="new">＋ 新增對戰</button>
    <div style="height:20px"></div>
    ${list.length ? '<h3 style="margin-bottom:10px;font-size:15px;color:var(--sub)">歷史紀錄</h3>' : ''}
    ${list.map((s) => `
      <div class="list-item" data-act="open" data-id="${s.id}">
        <div class="main">
          <div class="t">${esc(dateLabel(s))} <span class="badge ${s.status === 'playing' ? 'live' : ''}">${s.status === 'playing' ? '進行中' : '已結算'}</span></div>
          <div class="muted">${s.players.length} 人 · ${doneCount(s)} 場 · ${esc(s.players.slice(0, 4).join('、'))}${s.players.length > 4 ? '…' : ''}</div>
        </div>
        <button class="icon-btn" data-act="del-session" data-id="${s.id}" aria-label="刪除">🗑</button>
      </div>`).join('')}
    ${list.length ? '' : '<div class="empty">還沒有紀錄,按上面的按鈕開始吧</div>'}
    <div class="footer-actions">
      <button class="btn small" data-act="export">匯出備份</button>
      <button class="btn small" data-act="import">匯入備份</button>
    </div>
    <p class="muted" style="text-align:center;margin-top:16px">資料只存在這支手機的瀏覽器,記得偶爾匯出備份</p>`;
}

function viewNew() {
  const d = draft;
  const common = roster(db).filter((n) => !d.players.includes(n));
  return `
    <div class="top"><button class="icon-btn" data-act="home" aria-label="返回">←</button><h1>新增對戰</h1></div>
    <div class="card">
      <div class="row">
        <label class="field"><span>日期</span><input type="date" data-f="date" value="${esc(d.date)}"></label>
        <label class="field"><span>開始時間</span><input type="time" data-f="start" value="${esc(d.start)}"></label>
      </div>
      <div class="field" style="margin-bottom:0"><span>參加人員(${d.players.length} 人,至少 4 人)</span>
        <div class="row" style="margin-bottom:10px">
          <input type="text" id="pname" data-f="input" placeholder="輸入名字後按新增" maxlength="10" enterkeyhint="done" value="${esc(d.input)}" style="flex:1">
          <button class="btn" data-act="add-player" style="flex:none;min-height:46px">新增</button>
        </div>
        <div class="chips">${d.players.map((p) => `<span class="chip on" data-act="rm-player" data-n="${esc(p)}">${esc(p)}<span class="x">✕</span></span>`).join('') || '<span class="muted">尚未加入任何人</span>'}</div>
      </div>
    </div>
    ${common.length ? `<div class="card"><h2>常用名單</h2><div class="chips">${common.map((p) => `<span class="chip" data-act="add-roster" data-n="${esc(p)}">＋ ${esc(p)}</span>`).join('')}</div></div>` : ''}
    <button class="btn primary block" data-act="start" ${d.players.length < 4 ? 'disabled' : ''}>開始對戰並生成第一輪</button>`;
}

function matchHTML(s, r, ri, m, mi, editable) {
  const sel = (team, i) => `<select data-act="pick" data-r="${ri}" data-m="${mi}" data-t="${team}" data-i="${i}" ${editable ? '' : 'disabled'}>
      ${s.players.map((p) => `<option value="${esc(p)}" ${m[team][i] === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select>`;
  const score = (side, v) => `<input class="score" type="number" inputmode="numeric" min="0" max="99" placeholder="–" data-act="score" data-r="${ri}" data-m="${mi}" data-side="${side}" value="${v ?? ''}">`;
  const done = isComplete(m);
  const rest = resting(s.players, m);
  return `
    <div class="match ${hasDuplicate(m) ? 'bad' : ''}" data-r="${ri}" data-m="${mi}">
      <div class="match-head"><span>第 ${mi + 1} 場</span><button class="del" data-act="del-match" data-r="${ri}" data-m="${mi}" aria-label="刪除此場">✕</button></div>
      <div class="team ${done && m.scoreA > m.scoreB ? 'win' : ''}" data-side="A"><div class="pl">${sel('teamA', 0)}${sel('teamA', 1)}</div>${score('A', m.scoreA)}</div>
      <div class="vs">VS</div>
      <div class="team ${done && m.scoreB > m.scoreA ? 'win' : ''}" data-side="B"><div class="pl">${sel('teamB', 0)}${sel('teamB', 1)}</div>${score('B', m.scoreB)}</div>
      ${hasDuplicate(m) ? '<div class="warn">同一場有重複的人,請調整</div>' : ''}
      ${rest.length ? `<div class="rest">😮‍💨 休息:${esc(rest.join('、'))}</div>` : ''}
    </div>`;
}

function roundDone(r) { return r.matches.length > 0 && r.matches.every(isComplete); }

function viewPlay(s) {
  const last = s.rounds.length - 1;
  const eventsHTML = (s.events || []).length
    ? s.events.map((e) => {
        const missing = (e.players || []).filter((p) => !e.text.includes(p));
        return `<div class="ev"><span class="tm">${esc(e.time)}</span><span class="tx">${missing.length ? `<b>${esc(missing.join('、'))}</b> ` : ''}${esc(e.text)}</span><button class="del" data-act="del-event" data-id="${e.id}" aria-label="刪除">✕</button></div>`;
      }).join('')
    : '<div class="muted">還沒有事件,有好笑的就記下來 😆</div>';
  return `
    <div class="top">
      <button class="icon-btn" data-act="home" aria-label="返回">←</button>
      <h1>${esc(dateLabel(s))}<span class="sub">${esc(s.startTime)} 開始 · ${s.players.length} 人 · 已完成 ${doneCount(s)} 場</span></h1>
      <details class="menu"><summary class="icon-btn" aria-label="選單">⋯</summary>
        <div class="pop">
          <button data-act="add-member">＋ 新增成員</button>
          <button data-act="export-one">匯出此場</button>
          <button data-act="del-session" data-id="${s.id}" style="color:var(--danger)">刪除此紀錄</button>
        </div></details>
    </div>
    ${s.rounds.map((r, ri) => {
      const open = ri === last || openRounds.has(r.id);
      return `<details class="round" data-rid="${r.id}" ${open ? 'open' : ''}>
        <summary><span>第 ${r.no} 輪</span><span class="prog" data-prog="${ri}">${r.matches.filter(isComplete).length}/${r.matches.length} 場完成 ${roundDone(r) ? '✓' : ''}</span></summary>
        ${r.matches.map((m, mi) => matchHTML(s, r, ri, m, mi, true)).join('')}
        ${ri === last ? `<button class="add-match" data-act="add-match" data-r="${ri}">＋ 加一場</button>` : ''}
      </details>`;
    }).join('')}
    <div class="card"><h2>🎭 特殊事件</h2>${eventsHTML}</div>
    <div class="bar"><div class="in">
      <div class="hint" id="hint"></div>
      <div class="btns">
        <button class="btn" data-act="open-event">＋ 事件</button>
        <button class="btn primary next" id="nextBtn" data-act="next-round">生成下一輪</button>
        <button class="btn" data-act="finish">結算</button>
      </div></div></div>
    <dialog id="evDlg">
      <h3>記錄特殊事件</h3>
      <div class="muted" style="margin-bottom:6px">相關的人(可複選,可不選)</div>
      <div class="chips" id="evPlayers">${s.players.map((p) => `<span class="chip" data-act="ev-toggle" data-n="${esc(p)}">${esc(p)}</span>`).join('')}</div>
      <div class="muted" style="margin:12px 0 6px">快速選擇</div>
      <div class="chips">${EVENT_TEMPLATES.map((t) => `<span class="chip" data-act="ev-tpl" data-t="${esc(t)}">${esc(t)}</span>`).join('')}</div>
      <textarea id="evText" placeholder="發生了什麼好笑的事?" style="margin-top:12px"></textarea>
      <div class="actions"><button class="btn" data-act="ev-cancel">取消</button><button class="btn primary" data-act="ev-save">記錄</button></div>
    </dialog>`;
}

function viewSummary(s) {
  const st = computeStats(s);
  const titles = computeTitles(s);
  const dur = s.endTime ? minutesBetween(s.startTime, s.endTime) : null;
  const rows = [...st.players].filter((p) => p.games > 0 || true).sort((a, b) => {
    const k = { wins: [b.wins - a.wins, b.winRate - a.winRate], games: [b.games - a.games, b.winRate - a.winRate], losses: [b.losses - a.losses], winRate: [b.winRate - a.winRate, b.games - a.games] }[sortKey];
    for (const d of [...k, b.diff - a.diff]) if (d) return d;
    return 0;
  });
  const th = (key, label) => `<th class="${sortKey === key ? 'on' : ''}" data-act="sort" data-k="${key}">${label}${sortKey === key ? '▾' : ''}</th>`;
  return `
    <div class="top"><button class="icon-btn" data-act="home" aria-label="回首頁">←</button><h1>今日結算</h1></div>
    <div class="summary-hero">
      <h1>🏸 ${esc(dateLabel(s))}</h1>
      <div class="stat-row">
        <div><b>${s.players.length}</b><span>人</span></div>
        <div><b>${st.matches.length}</b><span>場</span></div>
        <div><b>${dur == null ? '–' : Math.round(dur / 6) / 10 + 'h'}</b><span>${esc(s.startTime)}${s.endTime ? '–' + esc(s.endTime) : ''}</span></div>
      </div>
    </div>
    <div class="card"><h2>🏅 今日稱號</h2>
      ${titles.length ? titles.map((t) => `
        <div class="title-card"><div class="ic">${t.icon}</div><div style="min-width:0">
          <div class="nm">${esc(t.name)}</div><div class="ds">${esc(t.desc)}</div>
          ${t.items.map((i) => `<div class="who">${esc(i.label)} <i>${esc(i.note)}</i></div>`).join('')}
        </div></div>`).join('') : '<div class="empty">還沒有完成的比賽,沒有稱號可以頒發</div>'}
    </div>
    <div class="card"><h2>🎭 今日特殊事件</h2>
      ${(s.events || []).length ? s.events.map((e) => {
        const missing = (e.players || []).filter((p) => !e.text.includes(p));
        return `<div class="ev"><span class="tm">${esc(e.time)}</span><span class="tx">${missing.length ? `<b>${esc(missing.join('、'))}</b> ` : ''}${esc(e.text)}</span></div>`;
      }).join('') : '<div class="empty">今天風平浪靜,沒有特殊事件</div>'}
    </div>
    <div class="card"><h2>📊 今日戰績</h2>
      <table><thead><tr><th>名字</th>${th('games', '場數')}${th('wins', '勝')}${th('losses', '敗')}${th('winRate', '勝率')}</tr></thead>
      <tbody>${rows.map((p) => `<tr><td>${esc(p.name)}</td><td>${p.games}</td><td>${p.wins}</td><td>${p.losses}</td>
        <td>${p.games ? pct(p.winRate) : '–'}<div class="bar-w"><i style="width:${Math.round(p.winRate * 100)}%"></i></div></td></tr>`).join('')}</tbody></table>
    </div>
    <div class="footer-actions" style="margin-bottom:16px">
      <button class="btn" data-act="copy">📋 複製結算文字</button>
      ${s.status === 'finished' ? '<button class="btn" data-act="reopen">繼續記錄</button>' : ''}
    </div>
    <button class="btn primary block" data-act="home">回首頁</button>`;
}

function summaryText(s) {
  const st = computeStats(s);
  const lines = [`🏸 ${dateLabel(s)} 羽球結算`, `${s.players.length} 人 · ${st.matches.length} 場`, '', '【今日稱號】'];
  for (const t of computeTitles(s)) lines.push(`${t.icon} ${t.name}:${t.items.map((i) => `${i.label}(${i.note})`).join('、')}`);
  lines.push('', '【特殊事件】');
  for (const e of s.events || []) lines.push(`・${(e.players || []).filter((p) => !e.text.includes(p)).join('、')}${e.text}`);
  if (!(s.events || []).length) lines.push('(無)');
  lines.push('', '【今日戰績】 名字 場/勝/敗/勝率');
  [...st.players].sort((a, b) => b.wins - a.wins || b.winRate - a.winRate).forEach((p) => lines.push(`${p.name} ${p.games}/${p.wins}/${p.losses}/${p.games ? pct(p.winRate) : '–'}`));
  return lines.join('\n');
}

/* ---------- render / route ---------- */
function render() {
  const hash = location.hash || '#/';
  const m = hash.match(/^#\/s\/([^/]+)(\/summary)?$/);
  let html;
  if (hash === '#/new') {
    draft ||= { date: todayStr(), start: nowHM(), players: [], input: '' };
    html = viewNew();
  } else if (m && getSession(m[1])) {
    const s = getSession(m[1]);
    html = m[2] ? viewSummary(s) : viewPlay(s);
  } else {
    if (hash !== '#/') { location.replace('#/'); return; }
    html = viewHome();
  }
  const y = lastRoute === hash ? window.scrollY : 0;
  app.innerHTML = html;
  window.scrollTo(0, y);
  lastRoute = hash;
  if (m && !m[2]) patchLive(getSession(m[1]));
}

/** 輸入比分時只更新樣式與按鈕狀態,不重繪(避免鍵盤收起) */
function patchLive(s) {
  s.rounds.forEach((r, ri) => {
    r.matches.forEach((m, mi) => {
      const el = app.querySelector(`.match[data-r="${ri}"][data-m="${mi}"]`);
      if (!el) return;
      const done = isComplete(m);
      el.querySelector('.team[data-side="A"]').classList.toggle('win', done && m.scoreA > m.scoreB);
      el.querySelector('.team[data-side="B"]').classList.toggle('win', done && m.scoreB > m.scoreA);
    });
    const p = app.querySelector(`[data-prog="${ri}"]`);
    if (p) p.textContent = `${r.matches.filter(isComplete).length}/${r.matches.length} 場完成 ${roundDone(r) ? '✓' : ''}`;
  });
  const last = s.rounds[s.rounds.length - 1];
  const ok = !last || roundDone(last);
  const btn = document.getElementById('nextBtn');
  if (btn) btn.disabled = !ok;
  const hint = document.getElementById('hint');
  if (hint) hint.textContent = ok ? '' : '填完本輪所有比分後,即可生成下一輪';
}

/* ---------- actions ---------- */
const actions = {
  home: () => go('#/'),
  new: () => { draft = { date: todayStr(), start: nowHM(), players: [], input: '' }; go('#/new'); },
  open: (el) => { const s = getSession(el.dataset.id); go(`#/s/${s.id}${s.status === 'finished' ? '/summary' : ''}`); },
  'del-session': (el, e) => {
    e.stopPropagation();
    if (!confirm('確定刪除這筆紀錄?無法復原。')) return;
    db.sessions = db.sessions.filter((s) => s.id !== el.dataset.id);
    persist(); go('#/'); render();
  },
  export: () => { download(`badminton-${todayStr()}.json`, exportJSON(db)); },
  'export-one': () => {
    const s = getSession(sid());
    download(`badminton-${s.date}.json`, exportJSON({ sessions: [s] }));
  },
  import: () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'application/json,.json';
    inp.onchange = async () => {
      try {
        const n = importJSON(await inp.files[0].text(), db);
        persist(); render(); toast(`已匯入 ${n} 筆`);
      } catch (err) { alert('匯入失敗:' + err.message); }
    };
    inp.click();
  },

  // 新增表單
  'add-player': () => addPlayer(draft.input),
  'add-roster': (el) => addPlayer(el.dataset.n),
  'rm-player': (el) => { draft.players = draft.players.filter((p) => p !== el.dataset.n); render(); },
  start: () => {
    if (draft.players.length < 4) return;
    const s = {
      id: uid(), date: draft.date || todayStr(), startTime: draft.start || nowHM(), endTime: null,
      players: [...draft.players], rounds: [], events: [], status: 'playing',
    };
    s.rounds.push(generateRound(s.players, s.rounds));
    db.sessions.push(s);
    persist(); draft = null; go(`#/s/${s.id}`);
  },

  // 對戰
  pick: null, // 由 change 事件處理
  'next-round': () => {
    const s = getSession(sid());
    const last = s.rounds[s.rounds.length - 1];
    if (last && !roundDone(last)) return;
    s.rounds.push(generateRound(s.players, s.rounds));
    persist(); render(); window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    toast(`已生成第 ${s.rounds.length} 輪`);
  },
  'add-match': (el) => {
    const s = getSession(sid());
    s.rounds[+el.dataset.r].matches.push(suggestMatch(s.players, s.rounds));
    persist(); render();
  },
  'del-match': (el) => {
    const s = getSession(sid());
    const r = s.rounds[+el.dataset.r];
    const m = r.matches[+el.dataset.m];
    if ((m.scoreA != null || m.scoreB != null) && !confirm('這場已有比分,確定刪除?')) return;
    r.matches.splice(+el.dataset.m, 1);
    persist(); render();
  },
  'add-member': () => {
    document.querySelector('.menu')?.removeAttribute('open');
    const name = (prompt('新成員名字') || '').trim();
    const s = getSession(sid());
    if (!name) return;
    if (s.players.includes(name)) return toast('名字已存在');
    s.players.push(name); persist(); render(); toast(`已加入 ${name}`);
  },
  finish: () => {
    const s = getSession(sid());
    const open = s.rounds.reduce((n, r) => n + r.matches.filter((m) => !isComplete(m)).length, 0);
    if (open && !confirm(`還有 ${open} 場沒填完整比分,這些場次不會計入。確定結算?`)) return;
    s.status = 'finished'; s.endTime = nowHM();
    persist(); go(`#/s/${s.id}/summary`);
  },

  // 事件
  'open-event': () => {
    document.querySelectorAll('#evPlayers .chip').forEach((c) => c.classList.remove('on'));
    document.getElementById('evText').value = '';
    document.getElementById('evDlg').showModal();
  },
  'ev-toggle': (el) => el.classList.toggle('on'),
  'ev-tpl': (el) => { const t = document.getElementById('evText'); t.value = el.dataset.t; t.focus(); },
  'ev-cancel': () => document.getElementById('evDlg').close(),
  'ev-save': () => {
    const text = document.getElementById('evText').value.trim();
    if (!text) return toast('請輸入事件內容');
    const players = [...document.querySelectorAll('#evPlayers .chip.on')].map((c) => c.dataset.n);
    const s = getSession(sid());
    (s.events ||= []).push({ id: uid(), time: nowHM(), text, players });
    persist(); document.getElementById('evDlg').close(); render(); toast('已記錄 😆');
  },
  'del-event': (el) => {
    const s = getSession(sid());
    s.events = s.events.filter((e) => e.id !== el.dataset.id);
    persist(); render();
  },

  // 結算
  sort: (el) => { sortKey = el.dataset.k; render(); },
  copy: async () => {
    const text = summaryText(getSession(sid()));
    try { await navigator.clipboard.writeText(text); toast('已複製,可貼到群組'); }
    catch { prompt('請手動複製:', text); }
  },
  reopen: () => { const s = getSession(sid()); s.status = 'playing'; s.endTime = null; persist(); go(`#/s/${s.id}`); },
};

const sid = () => (location.hash.match(/^#\/s\/([^/]+)/) || [])[1];

function addPlayer(raw) {
  const name = (raw || '').trim();
  if (!name) return;
  if (draft.players.includes(name)) { toast('名字重複了'); return; }
  draft.players.push(name);
  draft.input = '';
  render();
  document.getElementById('pname')?.focus();
}

/* ---------- events ---------- */
app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.tagName === 'SELECT' || el.tagName === 'INPUT') return;
  actions[el.dataset.act]?.(el, e);
});

app.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.act === 'score') {
    const s = getSession(sid());
    const m = s.rounds[+el.dataset.r].matches[+el.dataset.m];
    const v = el.value === '' ? null : Math.max(0, Math.min(99, parseInt(el.value, 10)));
    m[el.dataset.side === 'A' ? 'scoreA' : 'scoreB'] = Number.isNaN(v) ? null : v;
    persist(); patchLive(s);
  } else if (el.dataset.f && draft) {
    draft[el.dataset.f] = el.value;
  }
});

app.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'pname') { e.preventDefault(); addPlayer(draft.input); }
});

app.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.act !== 'pick') return;
  const s = getSession(sid());
  const m = s.rounds[+el.dataset.r].matches[+el.dataset.m];
  const t = el.dataset.t, i = +el.dataset.i, old = m[t][i], val = el.value;
  // 選到同場已在的人 → 兩人互換位置
  for (const tt of ['teamA', 'teamB'])
    for (let k = 0; k < 2; k++) if (m[tt][k] === val && !(tt === t && k === i)) m[tt][k] = old;
  m[t][i] = val;
  persist(); render();
});

app.addEventListener('toggle', (e) => {
  const rid = e.target.dataset?.rid;
  if (!rid) return;
  e.target.open ? openRounds.add(rid) : openRounds.delete(rid);
}, true);

window.addEventListener('hashchange', render);
render();
