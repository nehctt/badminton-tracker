import { esc, uid, todayStr, nowHM, weekday, minutesBetween, fmtDuration } from './util.js';
import { load, save, roster, exportJSON, importJSON } from './store.js';
import { generateRound, suggestMatch, resting } from './scheduler.js';
import { isComplete, hasDuplicate, computeStats, flatMatches, groupEvents, orderEvents, defaultAfterId } from './stats.js';
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
function settledLabel(s) {
  if (s.endedAt) {
    const d = new Date(s.endedAt);
    return `${todayStr(d).replace(/-/g, '/')} ${nowHM(d)}`;
  }
  return s.endTime ? `${s.date.replace(/-/g, '/')} ${s.endTime}` : '';
}
const pct = (n) => Math.round(n * 100) + '%';

function download(name, text, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- views ---------- */
const evText = (e) => {
  const missing = (e.players || []).filter((p) => !e.text.includes(p));
  return `${missing.length ? `<b>${esc(missing.join('、'))}</b> ` : ''}${esc(e.text)}`;
};

function viewHome() {
  const list = [...db.sessions].sort((a, b) => (b.date + b.startTime).localeCompare(a.date + a.startTime));
  return `
    <div class="home-head"><h1>🏸 羽球紀錄</h1></div>
    <button class="btn primary block" data-act="new">＋ 新增對戰</button>
    ${list.length ? `<div class="sec"><h2>歷史紀錄</h2><span>${list.length} 筆</span></div>` : ''}
    ${list.map((s) => `
      <div class="list-item" data-act="open" data-id="${s.id}">
        <div class="main">
          <div class="t">${esc(dateLabel(s))} <span class="tag ${s.status === 'playing' ? 'live' : ''}">${s.status === 'playing' ? '進行中' : '已結算'}</span></div>
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
    <div class="top"><button class="icon-btn" data-act="home" aria-label="返回">←</button><div class="tt"><h1>新增對戰</h1></div></div>
    <div class="panel" style="margin-top:8px">
      <div class="row">
        <label class="field"><span>日期</span><input type="date" data-f="date" value="${esc(d.date)}"></label>
        <label class="field"><span>開始時間</span><input type="time" data-f="start" value="${esc(d.start)}"></label>
      </div>
    </div>
    <div class="sec"><h2>參加人員</h2><span>${d.players.length} 人(至少 4 人)</span></div>
    <div class="panel">
      <div class="row" style="margin-bottom:12px">
        <input type="text" id="pname" data-f="input" placeholder="輸入名字" maxlength="10" enterkeyhint="done" value="${esc(d.input)}" style="flex:1">
        <button class="btn" data-act="add-player" style="flex:none">新增</button>
      </div>
      <div class="chips">${d.players.map((p) => `<span class="chip on" data-act="rm-player" data-n="${esc(p)}">${esc(p)} ✕</span>`).join('') || '<span class="muted">尚未加入任何人</span>'}</div>
    </div>
    ${common.length ? `<div class="sec"><h2>常用名單</h2><span>點一下加入</span></div><div class="chips">${common.map((p) => `<span class="chip" data-act="add-roster" data-n="${esc(p)}">＋ ${esc(p)}</span>`).join('')}</div>` : ''}
    <div style="height:24px"></div>
    <button class="btn primary block" data-act="start" ${d.players.length < 4 ? 'disabled' : ''}>開始對戰並生成第一輪</button>`;
}

function matchHTML(s, r, ri, m, mi) {
  const sel = (team, i) => `<select data-act="pick" data-r="${ri}" data-m="${mi}" data-t="${team}" data-i="${i}" aria-label="選手">
      ${s.players.map((p) => `<option value="${esc(p)}" ${m[team][i] === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select>`;
  const score = (side, v) => `<input class="score" type="number" inputmode="numeric" min="0" max="99" placeholder="–" aria-label="${side === 'A' ? '上' : '下'}方比分" data-act="score" data-r="${ri}" data-m="${mi}" data-side="${side}" value="${v ?? ''}">`;
  const done = isComplete(m);
  const rest = resting(s.players, m);
  return `
    <section class="match ${hasDuplicate(m) ? 'bad' : ''}" data-r="${ri}" data-m="${mi}">
      <div class="m-head"><span class="m-no">第 ${mi + 1} 場</span><span class="m-rest">${rest.length ? '休息 ' + esc(rest.join('、')) : ''}</span><button class="x" data-act="del-match" data-r="${ri}" data-m="${mi}" aria-label="刪除此場">✕</button></div>
      <div class="team ${done && m.scoreA > m.scoreB ? 'win' : ''}" data-side="A"><div class="pls">${sel('teamA', 0)}${sel('teamA', 1)}</div>${score('A', m.scoreA)}</div>
      <div class="vs"><span>VS</span></div>
      <div class="team ${done && m.scoreB > m.scoreA ? 'win' : ''}" data-side="B"><div class="pls">${sel('teamB', 0)}${sel('teamB', 1)}</div>${score('B', m.scoreB)}</div>
      ${hasDuplicate(m) ? '<div class="warn">同一場有重複的人,請調整</div>' : ''}
    </section>`;
}

function roundDone(r) { return r.matches.length > 0 && r.matches.every(isComplete); }

const evRow = (e) => `
  <div class="evt"><span class="ic">🎭</span><div class="main"><div class="tx">${evText(e)}</div><span class="tm">${esc(e.time)}</span></div>
  <button class="x" data-act="del-event" data-id="${e.id}" aria-label="刪除事件">✕</button></div>`;

function viewPlay(s) {
  const last = s.rounds.length - 1;
  const g = groupEvents(s);
  const flat = flatMatches(s);
  return `
    <div class="top">
      <button class="icon-btn" data-act="home" aria-label="返回">←</button>
      <div class="tt"><h1>${esc(dateLabel(s))}</h1><span class="sub">${esc(s.startTime)} 開始 · ${s.players.length} 人 · 已完成 ${doneCount(s)} 場</span></div>
      <details class="menu"><summary class="icon-btn" aria-label="選單">⋯</summary>
        <div class="pop">
          <button data-act="add-member">＋ 新增成員</button>
          <button data-act="export-one">匯出此場</button>
          <button data-act="del-session" data-id="${s.id}" style="color:var(--danger)">刪除此紀錄</button>
        </div></details>
    </div>
    ${g.head.map(evRow).join('')}
    ${s.rounds.map((r, ri) => {
      const open = ri === last || !roundDone(r) || openRounds.has(r.id);
      return `<details class="round" data-rid="${r.id}" ${open ? 'open' : ''}>
        <summary><b>第 ${r.no} 輪</b><span class="prog" data-prog="${ri}"></span></summary>
        ${r.matches.map((m, mi) => matchHTML(s, r, ri, m, mi) + (g.by[m.id] || []).map(evRow).join('')).join('')}
        ${ri === last ? `<button class="add-match" data-act="add-match" data-r="${ri}">＋ 加一場</button>` : ''}
      </details>`;
    }).join('')}
    <div class="bar"><div class="in">
      <div class="hint" id="hint"></div>
      <div class="btns">
        <button class="btn" data-act="open-event">＋ 事件</button>
        <button class="btn primary next" id="nextBtn" data-act="next-round">生成下一輪</button>
        <button class="btn" data-act="finish">結算</button>
      </div></div></div>
    <dialog id="evDlg">
      <h3>記錄特殊事件</h3>
      <div class="lbl" style="margin-top:0">相關的人(可複選,可不選)</div>
      <div class="chips" id="evPlayers">${s.players.map((p) => `<span class="chip" data-act="ev-toggle" data-n="${esc(p)}">${esc(p)}</span>`).join('')}</div>
      <div class="lbl">快速選擇</div>
      <div class="chips">${EVENT_TEMPLATES.map((t) => `<span class="chip" data-act="ev-tpl" data-t="${esc(t)}">${esc(t)}</span>`).join('')}</div>
      <div class="lbl">內容</div>
      <textarea id="evText" placeholder="發生了什麼好笑的事?"></textarea>
      <div class="lbl">插入位置</div>
      <select id="evAfter">
        <option value="">最前面(第一場之前)</option>
        ${flat.map((x) => `<option value="${x.id}">第 ${x.ri + 1} 輪 第 ${x.mi + 1} 場 之後</option>`).join('')}
      </select>
      <div class="actions"><button class="btn" data-act="ev-cancel">取消</button><button class="btn primary" data-act="ev-save">記錄</button></div>
    </dialog>`;
}

function viewSummary(s) {
  const st = computeStats(s);
  const titles = computeTitles(s);
  const events = orderEvents(s);
  const dur = s.endTime ? minutesBetween(s.startTime, s.endTime) : null;
  const rows = [...st.players].sort((a, b) => {
    const k = { wins: [b.wins - a.wins, b.winRate - a.winRate], games: [b.games - a.games, b.winRate - a.winRate], losses: [b.losses - a.losses], winRate: [b.winRate - a.winRate, b.games - a.games] }[sortKey];
    for (const d of [...k, b.diff - a.diff]) if (d) return d;
    return 0;
  });
  const th = (key, label) => `<th class="${sortKey === key ? 'on' : ''}" data-act="sort" data-k="${key}">${label}${sortKey === key ? ' ▾' : ''}</th>`;
  return `
    <div class="top"><button class="icon-btn" data-act="home" aria-label="回首頁">←</button><div class="tt"><h1>今日結算</h1></div></div>
    <div id="shot" class="shot">
      <h2 class="date-h">🏸 ${esc(dateLabel(s))}</h2>
      <div class="stats">
        <div><b>${s.players.length}</b><span>人</span></div>
        <div><b>${st.matches.length}</b><span>場</span></div>
        <div><b>${dur == null ? '–' : esc(fmtDuration(dur))}</b><span>時長</span></div>
      </div>
      <div class="when">${esc(s.startTime)} 開始${s.endTime ? ` · ${esc(settledLabel(s))} 結算` : ''}</div>

      <div class="sec"><h2>今日稱號</h2><span>${titles.length} 項</span></div>
      ${titles.length ? `<div class="tlist">${titles.map((t) => `
        <div class="tcard"><div class="ic">${t.icon}</div><div class="bd">
          <div class="nm">${esc(t.name)}</div>
          ${t.items.map((i) => `<div class="who"><span>${esc(i.label)}</span><i>${esc(i.note)}</i></div>`).join('')}
        </div></div>`).join('')}</div>` : '<div class="panel empty">還沒有完成的比賽,沒有稱號可以頒發</div>'}

      <div class="sec"><h2>今日特殊事件</h2><span>${events.length} 則</span></div>
      ${events.length ? `<div class="evlist">${events.map((e) => `<div class="e"><span class="tm">${esc(e.time)}</span><span>${evText(e)}</span></div>`).join('')}</div>` : '<div class="panel empty">今天風平浪靜,沒有特殊事件</div>'}

      <div class="sec"><h2>今日戰績</h2><span>點標題可排序</span></div>
      <table><thead><tr><th>名字</th>${th('games', '場數')}${th('wins', '勝')}${th('losses', '敗')}${th('winRate', '勝率')}</tr></thead>
      <tbody>${rows.map((p) => `<tr><td>${esc(p.name)}</td><td>${p.games}</td><td>${p.wins}</td><td>${p.losses}</td>
        <td>${p.games ? pct(p.winRate) : '–'}<div class="bar-w"><i style="width:${Math.round(p.winRate * 100)}%"></i></div></td></tr>`).join('')}</tbody></table>
      <div class="shot-foot">🏸 羽球紀錄</div>
    </div>
    <div class="footer-actions" style="margin-bottom:10px">
      <button class="btn primary" data-act="save-img">🖼 儲存成圖片</button>
      <button class="btn" data-act="copy">📋 複製文字</button>
    </div>
    <div class="footer-actions" style="margin-top:0">
      ${s.status === 'finished' ? '<button class="btn" data-act="reopen">繼續記錄</button>' : ''}
      <button class="btn" data-act="home">回首頁</button>
    </div>`;
}

function summaryText(s) {
  const st = computeStats(s);
  const lines = [`🏸 ${dateLabel(s)} 羽球結算`, `${s.players.length} 人 · ${st.matches.length} 場`, `${s.startTime} 開始 · ${settledLabel(s)} 結算`, '', '【今日稱號】'];
  for (const t of computeTitles(s)) lines.push(`${t.icon} ${t.name}:${t.items.map((i) => `${i.label}(${i.note})`).join('、')}`);
  lines.push('', '【特殊事件】');
  const evs = orderEvents(s);
  for (const e of evs) lines.push(`・${(e.players || []).filter((p) => !e.text.includes(p)).join('、')}${e.text}`);
  if (!evs.length) lines.push('(無)');
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
    if (p) {
      p.textContent = roundDone(r) ? `${r.matches.length} 場全部完成 ✓` : `${r.matches.filter(isComplete).length} / ${r.matches.length} 場完成`;
      p.classList.toggle('done', roundDone(r));
    }
  });
  const last = s.rounds[s.rounds.length - 1];
  const hint = document.getElementById('hint');
  if (hint) hint.textContent = last && !roundDone(last) ? '本輪還有場次沒填完,仍可先生成下一輪' : '';
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
    const flat = flatMatches(s);
    const idx = flat.findIndex((x) => x.id === m.id);
    const prevId = idx > 0 ? flat[idx - 1].id : null;
    for (const e of s.events || []) if (e.afterMatchId === m.id) e.afterMatchId = prevId; // 事件留在原地
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
    s.status = 'finished'; s.endTime = nowHM(); s.endedAt = new Date().toISOString();
    persist(); go(`#/s/${s.id}/summary`);
  },

  // 事件
  'open-event': () => {
    document.querySelectorAll('#evPlayers .chip').forEach((c) => c.classList.remove('on'));
    document.getElementById('evText').value = '';
    document.getElementById('evAfter').value = defaultAfterId(getSession(sid())) ?? '';
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
    (s.events ||= []).push({ id: uid(), time: nowHM(), text, players, afterMatchId: document.getElementById('evAfter').value || null });
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
  'save-img': async (el) => {
    const s = getSession(sid());
    el.disabled = true; const label = el.textContent; el.textContent = '產生中…';
    try {
      if (!window.html2canvas) await loadScript('js/vendor/html2canvas.min.js');
      const node = document.getElementById('shot');
      const bg = getComputedStyle(document.body).backgroundColor;
      const canvas = await window.html2canvas(node, { scale: 2, backgroundColor: bg, useCORS: true, windowWidth: 520 });
      const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
      const file = new File([blob], `badminton-${s.date}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: '羽球結算' }); return; }
        catch (err) { if (err.name === 'AbortError') return; }
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      toast('圖片已儲存');
    } catch (err) { alert('產生圖片失敗:' + err.message); }
    finally { el.disabled = false; el.textContent = label; }
  },
  reopen: () => { const s = getSession(sid()); s.status = 'playing'; s.endTime = null; s.endedAt = null; persist(); go(`#/s/${s.id}`); },
};

function loadScript(src) {
  return new Promise((ok, fail) => {
    const t = document.createElement('script');
    t.src = src; t.onload = ok; t.onerror = () => fail(new Error('無法載入 ' + src));
    document.head.appendChild(t);
  });
}

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
