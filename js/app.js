import { esc, uid, todayStr, nowHM, weekday, minutesBetween, fmtDuration, fmtDurationShort } from './util.js';
import { load, save, roster, exportJSON, importJSON } from './store.js';
import { generateRound, suggestMatch, resting } from './scheduler.js';
import { isComplete, hasDuplicate, computeStats, flatMatches, groupEvents, orderEvents, defaultAfterId, validPoints } from './stats.js';
import { computeTitles } from './titles.js';
import { PETS, MOODS, petHTML, moodFromResults, moodFromRate, pickPetId } from './pets.js';

let db = load();
const app = document.getElementById('app');
const persist = () => save(db);
const getSession = (id) => db.sessions.find((s) => s.id === id);

let draft = null; // 新增對戰表單
let sortKey = 'wins';
let openRounds = new Set(); // 使用者手動展開過的輪
let lastRoute = '';
const scrollMemo = {}; // 從計分板返回時,回到原本的捲動位置

const EVENT_TEMPLATES = ['抽筋了,下場休息', '挑釁對手結果自己馬上失誤', '殺球打到自己的腳', '球拍飛出去了', '絆到腳跌倒', '成功擊殺隊友'];

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

function petGrid(selectedId, act) {
  return `<div class="pet-grid">${PETS.map((p) => `<button type="button" class="pet-opt ${p.id === selectedId ? 'on' : ''}" data-act="${act}" data-id="${p.id}">${petHTML(p.id, p.id === selectedId ? 3 : 2, 38, p.name)}<span>${p.name}</span></button>`).join('')}</div>`;
}

function viewNew() {
  const d = draft;
  const common = roster(db).filter((n) => !d.players.includes(n));
  return `
    <div class="top"><button class="icon-btn" data-act="home" aria-label="返回">←</button><div class="tt"><h1>新增對戰</h1></div></div>
    <div class="sec" style="margin-top:8px"><h2>參加人員</h2><span>${d.players.length} 人(至少 4 人)</span></div>
    <div class="panel">
      <div class="row">
        <input type="text" id="pname" data-f="input" placeholder="輸入名字" maxlength="10" enterkeyhint="done" value="${esc(d.input)}" style="flex:1">
        <button class="btn" data-act="add-player" style="flex:none">新增</button>
      </div>
      <div class="lbl">替這位選一隻寵物</div>
      ${petGrid(d.pet, 'pick-pet')}
      ${d.players.length ? '<div class="lbl" style="margin-top:16px">已加入(點寵物可更換)</div>' : ''}
      <div class="chips" style="${d.players.length ? '' : 'margin-top:12px'}">${d.players.map((p) => `<span class="chip on static"><span class="chip-pet" data-act="change-pet" data-n="${esc(p)}">${petHTML(d.pets[p], 2, 26, '更換寵物')}</span>${esc(p)}<span class="x" data-act="rm-player" data-n="${esc(p)}" aria-label="移除">✕</span></span>`).join('') || '<span class="muted">尚未加入任何人</span>'}</div>
    </div>
    ${common.length ? `<div class="sec"><h2>常用名單</h2><span>點一下加入</span></div><div class="chips">${common.map((p) => `<span class="chip" data-act="add-roster" data-n="${esc(p)}">＋ ${esc(p)}</span>`).join('')}</div>` : ''}
    <div style="height:24px"></div>
    <button class="btn primary block" data-act="start" ${d.players.length < 4 ? 'disabled' : ''}>開始對戰並生成第一輪</button>
    <dialog id="petDlg"><h3>換一隻寵物</h3>${petGrid(null, 'set-pet')}<div class="actions"><button class="btn" data-act="pet-cancel">取消</button></div></dialog>`;
}

function matchHTML(s, r, ri, m, mi) {
  const slot = s.pets ? '<span class="pet-slot" data-k=""></span>' : '';
  const sel = (team, i) => `<div class="pcell">${slot}<select data-act="pick" data-r="${ri}" data-m="${mi}" data-t="${team}" data-i="${i}" aria-label="選手">
      ${s.players.map((p) => `<option value="${esc(p)}" ${m[team][i] === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></div>`;
  const score = (side, v) => `<input class="score" type="number" inputmode="numeric" min="0" max="99" placeholder="–" aria-label="${side === 'A' ? '上' : '下'}方比分" data-act="score" data-r="${ri}" data-m="${mi}" data-side="${side}" value="${v ?? ''}">`;
  const done = isComplete(m);
  const rest = resting(s.players, m);
  const cur = currentMatch(s);
  const isCur = !!cur && cur.id === m.id;
  const live = !done && m.draft && (m.draft.seq.length || m.draft.baseA || m.draft.baseB);
  const goLabel = live ? `計分中 ${draftScore(m.draft, 'A')}:${draftScore(m.draft, 'B')}` : '▶ 計分';
  return `
    <section class="match ${hasDuplicate(m) ? 'bad' : ''} ${isCur ? 'current' : ''}" data-r="${ri}" data-m="${mi}" data-mid="${m.id}">
      <div class="m-head"><span class="m-no">第 ${mi + 1} 場</span><button class="btn small go ${live || isCur ? 'live' : ''}" data-act="open-board" data-mid="${m.id}">${goLabel}</button><span class="m-rest">${rest.length ? '休息 ' + esc(rest.join('、')) : ''}</span><button class="x" data-act="del-match" data-r="${ri}" data-m="${mi}" aria-label="刪除此場">✕</button></div>
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

/** 浮動按鈕的主要動作:還有沒打完的場次 → 計分;都打完了 → 下一輪 */
function fabMain(s) {
  const cur = currentMatch(s);
  return cur
    ? `<button class="btn primary" id="nextBtn" data-act="open-board" data-mid="${cur.id}">▶ 計分</button>`
    : '<button class="btn primary" id="nextBtn" data-act="next-round">➕ 下一輪</button>';
}

function viewPlay(s) {
  const last = s.rounds.length - 1;
  const g = groupEvents(s);
  const flat = flatMatches(s);
  return `
    <div class="top">
      <button class="icon-btn" data-act="home" aria-label="返回">←</button>
      <div class="tt"><h1>${esc(dateLabel(s))}</h1><span class="sub" id="subline">${esc(s.startTime)} 開始 · ${s.players.length} 人 · 已完成 ${doneCount(s)} 場</span></div>
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
        <div class="round-grid">${r.matches.map((m, mi) => matchHTML(s, r, ri, m, mi) + (g.by[m.id] || []).map(evRow).join('')).join('')}</div>
        ${ri === last ? `<button class="add-match" data-act="add-match" data-r="${ri}">＋ 加一場</button>` : ''}
      </details>`;
    }).join('')}
    <button class="add-match" data-act="next-round">➕ 生成下一輪</button>
    <div class="fab" role="toolbar" aria-label="操作">
      <button class="btn" data-act="open-event">🎭 事件</button>
      ${fabMain(s)}
      <button class="btn" data-act="finish">🏁 結算</button>
    </div>
    <dialog id="evDlg">
      <h3 id="evTitle" tabindex="-1">記錄特殊事件</h3>
      <div class="dlg-cols"><div>
      <div class="lbl" style="margin-top:0">相關的人(可複選,可不選)</div>
      <div class="chips" id="evPlayers">${s.players.map((p) => `<span class="chip" data-act="ev-toggle" data-n="${esc(p)}">${esc(p)}</span>`).join('')}</div>
      <div class="lbl">快速選擇</div>
      <div class="chips">${EVENT_TEMPLATES.map((t) => `<span class="chip" data-act="ev-tpl" data-t="${esc(t)}">${esc(t)}</span>`).join('')}</div>
      </div><div>
      <div class="lbl" style="margin-top:0">內容</div>
      <textarea id="evText" placeholder="發生了什麼好笑的事?"></textarea>
      <div class="lbl">插入位置</div>
      <select id="evAfter">
        <option value="">最前面(第一場之前)</option>
        ${flat.map((x) => `<option value="${x.id}">第 ${x.ri + 1} 輪 第 ${x.mi + 1} 場 之後</option>`).join('')}
      </select>
      </div></div>
      <div class="actions"><button class="btn" data-act="ev-cancel">取消</button><button class="btn primary" data-act="ev-save">記錄</button></div>
    </dialog>`;
}

const SUM_TABS = [
  { slug: 'titles', label: '稱號與事件', page: '稱號 & 特殊事件' },
  { slug: 'ranking', label: '戰績排行', page: '戰績排行' },
  { slug: 'records', label: '對戰紀錄', page: '對戰紀錄' },
];
let summaryTab = 0;
let summaryFor = null;

/** 預設排名:勝場 → 勝率 → 淨勝分 */
const rankSort = (a, b) => b.wins - a.wins || b.winRate - a.winRate || b.diff - a.diff;

function viewSummary(s) {
  if (summaryFor !== s.id) { summaryFor = s.id; summaryTab = 0; }
  const st = computeStats(s);
  const dur = s.endTime ? minutesBetween(s.startTime, s.endTime) : null;
  const tab = SUM_TABS[summaryTab];
  const body = [pageTitles, pageRanking, pageRecords][summaryTab](s, st);
  return `
    <div class="sticky-head">
      <div class="top"><button class="icon-btn" data-act="home" aria-label="回首頁">←</button><div class="tt"><h1>今日結算</h1></div></div>
      <div class="tabs" role="tablist">${SUM_TABS.map((t, i) => `<button class="tab ${i === summaryTab ? 'on' : ''}" role="tab" data-act="tab" data-i="${i}">${t.label}</button>`).join('')}</div>
    </div>
    <div id="shot" class="shot">
      <h2 class="date-h">🏸 ${esc(dateLabel(s))}</h2>
      <div class="stats">
        <div><b>${s.players.length}</b><span>人</span></div>
        <div><b>${st.matches.length}</b><span>場</span></div>
        <div><b>${dur == null ? '–' : esc(fmtDurationShort(dur))}</b><span>時長</span></div>
      </div>
      <div class="when">${esc(s.startTime)} 開始${s.endTime ? ` · ${esc(settledLabel(s))} 結算` : ''}</div>
      <div class="page-tag"><span>${esc(tab.page)}</span></div>
      ${body}
      <div class="shot-foot">🏸 羽球紀錄 · ${summaryTab + 1}/${SUM_TABS.length}</div>
    </div>
    <div class="footer-actions" style="margin-bottom:10px">
      <button class="btn primary" data-act="save-img">🖼 儲存這一頁</button>
      <button class="btn" data-act="copy">📋 複製文字</button>
    </div>
    <div class="footer-actions" style="margin-top:0">
      ${s.status === 'finished' ? '<button class="btn" data-act="reopen">繼續記錄</button>' : ''}
      <button class="btn" data-act="home">回首頁</button>
    </div>`;
}

const TCOLORS = ['#0f9d7a', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4'];
/** 把稱號平均分到兩欄(依預估高度),避免卡片被相鄰的高卡片撐出空白 */
function titleCols(titles) {
  const cols = [[], []];
  const h = [0, 0];
  titles.forEach((t, i) => {
    const k = h[0] <= h[1] ? 0 : 1;
    cols[k].push(`
      <div class="tcard" style="--c:${TCOLORS[i % TCOLORS.length]}">
        <div class="hd"><span class="ic">${t.icon}</span><span class="nm">${esc(t.name)}</span></div>
        ${t.items.map((x) => `<div class="who"><span>${esc(x.label)}</span><i>${esc(x.note)}</i></div>`).join('')}
      </div>`);
    h[k] += 1.7 + t.items.length * 1.1;
  });
  return cols.map((c) => `<div class="tcol">${c.join('')}</div>`).join('');
}

/* 第 1 頁:稱號 & 事件 */
function pageTitles(s) {
  const titles = computeTitles(s);
  const events = orderEvents(s);
  return `
    <div class="sec"><h2>今日稱號</h2><span>${titles.length} 項</span></div>
    ${titles.length ? `<div class="tlist">${titleCols(titles)}</div>` : '<div class="panel empty">還沒有完成的比賽,沒有稱號可以頒發</div>'}
    <div class="sec"><h2>今日特殊事件</h2><span>${events.length} 則</span></div>
    ${events.length ? `<div class="evlist">${events.map((e) => `<div class="e"><span class="tm">${esc(e.time)}</span><span>${evText(e)}</span></div>`).join('')}</div>` : '<div class="panel empty">今天風平浪靜,沒有特殊事件</div>'}`;
}

/* 第 2 頁:戰績排行 */
function pageRanking(s, st) {
  const moodOf = (p) => moodFromRate(p.winRate, p.games);
  const petOf = (p, size) => (s.pets && s.pets[p.name] ? petHTML(s.pets[p.name], moodOf(p), size, `${p.name}・${MOODS[moodOf(p)]}`) : '');
  const ranked = st.players.filter((p) => p.games > 0).sort(rankSort);
  const podium = ranked.length >= 3 ? [[ranked[1], 2], [ranked[0], 1], [ranked[2], 3]] : [];
  const rows = [...st.players].sort((a, b) => {
    const k = { wins: [b.wins - a.wins, b.winRate - a.winRate], games: [b.games - a.games, b.winRate - a.winRate], losses: [b.losses - a.losses], winRate: [b.winRate - a.winRate, b.games - a.games] }[sortKey];
    for (const d of [...k, b.diff - a.diff]) if (d) return d;
    return 0;
  });
  const th = (key, label) => `<th class="${sortKey === key ? 'on' : ''}" data-act="sort" data-k="${key}">${label}${sortKey === key ? ' ▾' : ''}</th>`;
  return `
    ${podium.length ? `<div class="podium">${podium.map(([p, n]) => `
      <div class="pod pod${n}">
        <div class="pod-pet">${petOf(p, n === 1 ? 68 : 54) || `<span class="pod-medal">${['', '🥇', '🥈', '🥉'][n]}</span>`}</div>
        <div class="pod-name">${esc(p.name)}</div>
        <div class="pod-stat">${p.wins} 勝 ${p.losses} 敗</div>
        <div class="pod-base"><b>${n}</b><span>${pct(p.winRate)}</span></div>
      </div>`).join('')}</div>` : ''}
    <div class="sec"><h2>完整戰績</h2><span>點標題可排序</span></div>
    <table><thead><tr><th>名字</th>${th('games', '場數')}${th('wins', '勝')}${th('losses', '敗')}${th('winRate', '勝率')}</tr></thead>
    <tbody>${rows.map((p) => `<tr><td><div class="nm-cell">${petOf(p, 34)}<span>${esc(p.name)}</span></div></td><td>${p.games}</td><td>${p.wins}</td><td>${p.losses}</td>
      <td>${p.games ? pct(p.winRate) : '–'}<div class="bar-w"><i style="width:${Math.round(p.winRate * 100)}%"></i></div></td></tr>`).join('')}</tbody></table>
    ${s.pets ? '<div class="muted" style="margin-top:8px;text-align:center;font-size:12px">寵物心情依今日勝率:80%↑ 超快樂 · 60% 快樂 · 40% 正常 · 20% 難過 · 其餘 超難過</div>' : ''}`;
}

/* 第 3 頁:對戰紀錄 */
function pageRecords(s) {
  if (!s.rounds.some((r) => r.matches.length)) return '<div class="panel empty">沒有對戰紀錄</div>';
  return s.rounds.map((r) => {
    const done = r.matches.filter(isComplete).length;
    return `
      <div class="sec"><h2>第 ${r.no} 輪</h2><span>${done} / ${r.matches.length} 場完成</span></div>
      <div class="rec-grid">${r.matches.map((m, mi) => {
        const ok = isComplete(m);
        const aw = ok && m.scoreA > m.scoreB;
        const bw = ok && m.scoreB > m.scoreA;
        const rest = resting(s.players, m);
        const team = (names, score, win) => `<div class="rec-team ${win ? 'win' : ''}"><span class="n">${esc(names.join(' ＆ '))}</span><b class="sc">${score ?? '–'}</b></div>`;
        return `
          <div class="rec ${ok ? '' : 'pending'}" data-act="open-board" data-mid="${m.id}">
            <div class="rec-head"><span>第 ${mi + 1} 場</span>${ok ? '' : '<span class="tag">未完成</span>'}${m.points && ok ? '<span class="tag seq" title="有得分順序">⏱</span>' : ''}${rest.length ? `<span class="rec-rest">休息 ${esc(rest.join('、'))}</span>` : ''}<span class="rec-go">計分 ›</span></div>
            ${team(m.teamA, m.scoreA, aw)}${team(m.teamB, m.scoreB, bw)}
          </div>`;
      }).join('')}</div>`;
  }).join('');
}

function summaryText(s) {
  const st = computeStats(s);
  const lines = [`🏸 ${dateLabel(s)} 羽球結算`, `${s.players.length} 人 · ${st.matches.length} 場`, `${s.startTime} 開始 · ${settledLabel(s)} 結算`, '', '【今日稱號】'];
  for (const t of computeTitles(s)) lines.push(`${t.icon} ${t.name}:${t.items.map((i) => `${i.label}(${i.note})`).join('、')}`);
  lines.push('', '【特殊事件】');
  const evs = orderEvents(s);
  for (const e of evs) lines.push(`・${(e.players || []).filter((p) => !e.text.includes(p)).join('、')}${e.text}`);
  if (!evs.length) lines.push('(無)');
  lines.push('', '【對戰紀錄】');
  for (const r of s.rounds) {
    lines.push(`第 ${r.no} 輪`);
    r.matches.forEach((m, i) => lines.push(`  ${i + 1}. ${m.teamA.join('＆')} ${m.scoreA ?? '–'} : ${m.scoreB ?? '–'} ${m.teamB.join('＆')}`));
  }
  lines.push('', '【今日戰績】 名字 場/勝/敗/勝率');
  [...st.players].sort((a, b) => b.wins - a.wins || b.winRate - a.winRate).forEach((p) => lines.push(`${p.name} ${p.games}/${p.wins}/${p.losses}/${p.games ? pct(p.winRate) : '–'}`));
  return lines.join('\n');
}

/* ---------- render / route ---------- */
function render() {
  const hash = location.hash || '#/';
  const m = hash.match(/^#\/s\/([^/]+)(\/summary)?$/);
  const bm = hash.match(/^#\/s\/([^/]+)\/m\/([^/]+)$/);
  const bs = bm && getSession(bm[1]);
  const bmatch = bs && findMatch(bs, bm[2]);
  if (lastRoute) scrollMemo[lastRoute] = window.scrollY;
  let html;
  if (bmatch) {
    if (!board || board.mid !== bmatch.id) loadBoard(bs, bmatch);
    html = viewBoard(bs, bmatch);
  } else if (hash === '#/new') {
    draft ||= newDraft();
    html = viewNew();
  } else if (m && getSession(m[1])) {
    const s = getSession(m[1]);
    html = m[2] ? viewSummary(s) : viewPlay(s);
  } else {
    if (hash !== '#/') { location.replace('#/'); return; }
    html = viewHome();
  }
  const y = lastRoute === hash ? window.scrollY : (lastRoute.includes('/m/') ? scrollMemo[hash] ?? 0 : 0);
  if (!bmatch && board) leaveBoard(); // 用系統返回離開時,也要把進行中的比分存起來
  app.innerHTML = html;
  document.documentElement.classList.toggle('lock', !!bmatch);
  keepAwake(!!bmatch);
  window.scrollTo(0, bmatch ? 0 : y);
  lastRoute = hash;
  if (bmatch) patchBoard();
  else if (m && !m[2]) {
    patchLive(getSession(m[1]));
    if (focusNext) {
      focusNext = false;
      const cur = currentMatch(getSession(m[1]));
      app.querySelector(`.match[data-mid="${cur && cur.id}"]`)?.scrollIntoView({ block: 'center' });
    }
  }
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
  const nb = document.getElementById('nextBtn');
  if (nb) {
    const cur = currentMatch(s);
    nb.dataset.act = cur ? 'open-board' : 'next-round';
    if (cur) nb.dataset.mid = cur.id; else delete nb.dataset.mid;
    nb.textContent = cur ? '▶ 計分' : '➕ 下一輪';
  }
  patchPets(s);
  const subline = document.getElementById('subline');
  if (subline) subline.textContent = `${s.startTime} 開始 · ${s.players.length} 人 · 已完成 ${doneCount(s)} 場`;
  const last = s.rounds[s.rounds.length - 1];
  const hint = document.getElementById('hint');
  if (hint) hint.textContent = last && !roundDone(last) ? '本輪還有場次沒填完,仍可先生成下一輪' : '';
}

/* ---------- 計分板 ---------- */
let board = null; // { sid, mid, baseA, baseB, seq, flip, wasComplete, dirty }
let boardFrom = null;
let focusNext = false; // 完成一場後回到對戰頁:把下一場捲到畫面中央
let wakeLock = null;

const draftScore = (d, side) => (side === 'A' ? d.baseA : d.baseB) + d.seq.filter((x) => x === side).length;
const boardScore = (b, side) => draftScore(b, side);

function findMatch(s, mid) {
  const f = flatMatches(s).find((x) => x.id === mid);
  return f ? f.m : null;
}

/** 開啟計分板時的起點:草稿 > 既有的得分順序 > 既有的最終比分 > 0:0 */
function loadBoard(s, m) {
  const wasComplete = isComplete(m);
  let baseA = 0, baseB = 0, seq = [];
  if (!wasComplete && m.draft) { baseA = m.draft.baseA; baseB = m.draft.baseB; seq = [...m.draft.seq]; }
  else if (validPoints(m)) seq = [...m.points];
  else if (Number.isInteger(m.scoreA) && Number.isInteger(m.scoreB)) { baseA = m.scoreA; baseB = m.scoreB; }
  board = { sid: s.id, mid: m.id, baseA, baseB, seq, flip: false, wasComplete, dirty: false };
}

/** 目前連續得分(以最後一分為準) */
function currentRun(seq) {
  const side = seq[seq.length - 1];
  let n = 0;
  for (let i = seq.length - 1; i >= 0 && seq[i] === side; i--) n++;
  return { side, n };
}

function viewBoard(s, m) {
  const side = (k) => {
    const names = k === 'A' ? m.teamA : m.teamB;
    return `<div class="b-side b-${k.toLowerCase()}" data-act="b-plus" data-side="${k}">
      <div class="b-pets" data-pets="${k}"></div>
      <div class="b-names">${esc(names.join(' ＆ '))}</div>
      <div class="b-score" data-score="${k}">0</div>
      <div class="b-streak" data-streak="${k}"></div>
      <button class="b-minus" data-act="b-minus" data-side="${k}" aria-label="扣一分">−1</button>
    </div>`;
  };
  return `<div class="board ${board.flip ? 'flip' : ''}" id="board">
    ${side('A')}
    <div class="b-mid">
      <button class="b-btn" data-act="b-back" aria-label="返回">←</button>
      <span class="b-vs">VS</span>
      <button class="b-btn" id="bUndo" data-act="b-undo" aria-label="復原上一分">↶</button>
      <button class="b-btn" data-act="b-flip" aria-label="換邊">⇄</button>
      <button class="b-btn done" id="bDone" data-act="b-done">✓ 完成</button>
    </div>
    ${side('B')}
  </div>`;
}

function patchBoard() {
  const el = document.getElementById('board');
  if (!board || !el) return;
  const s = getSession(board.sid);
  const m = findMatch(s, board.mid);
  if (!m) return;
  const run = currentRun(board.seq);
  for (const k of ['A', 'B']) {
    const names = k === 'A' ? m.teamA : m.teamB;
    const score = boardScore(board, k);
    const sc = el.querySelector(`[data-score="${k}"]`);
    if (sc.textContent !== String(score)) {
      sc.textContent = score;
      sc.classList.remove('pop'); void sc.offsetWidth; sc.classList.add('pop');
    }
    const st = el.querySelector(`[data-streak="${k}"]`);
    st.textContent = run.n >= 3 ? (run.side === k ? `🔥 連續得分 ×${run.n}` : `💧 連續失分 ×${run.n}`) : '';
    st.classList.toggle('loss', run.n >= 3 && run.side !== k);
    // 寵物:依「連續得分/失分」的動能變化(每得一分 +1、每失一分 −1)
    if (s.pets) {
      const mood = moodFromResults(board.seq.map((x) => (x === k ? 'W' : 'L')));
      const want = `${names.map((n) => s.pets[n]).join(',')}|${mood}`;
      const slot = el.querySelector(`[data-pets="${k}"]`);
      if (slot.dataset.k !== want) {
        const prev = slot.dataset.k ? +slot.dataset.k.split('|')[1] : undefined;
        slot.dataset.k = want;
        slot.innerHTML = names.map((n) => (s.pets[n] ? petHTML(s.pets[n], mood, 72, `${n}・${MOODS[mood]}`) : '')).join('');
        if (prev !== undefined && prev !== mood) {
          const cls = mood > prev ? 'fx-up' : 'fx-down';
          slot.classList.remove('fx-up', 'fx-down'); void slot.offsetWidth; slot.classList.add(cls);
        }
      }
    }
  }
  document.getElementById('bUndo').disabled = board.seq.length === 0;
  document.getElementById('bDone').disabled = boardScore(board, 'A') === boardScore(board, 'B');
}

function saveDraft() {
  if (!board || board.wasComplete) return;
  const m = findMatch(getSession(board.sid), board.mid);
  if (!m) return;
  if (!board.seq.length && !board.baseA && !board.baseB) delete m.draft;
  else m.draft = { baseA: board.baseA, baseB: board.baseB, seq: [...board.seq] };
  persist();
}

function leaveBoard() { saveDraft(); board = null; }

function afterPoint(buzz) {
  board.dirty = true;
  saveDraft();
  patchBoard();
  if (buzz) navigator.vibrate?.(12);
}

async function keepAwake(on) {
  try {
    if (on && !wakeLock) wakeLock = await navigator.wakeLock?.request('screen');
    else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch { wakeLock = null; }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && board) { wakeLock = null; keepAwake(true); } });

/* ---------- 寵物 ---------- */
const moodMemo = {}; // `${sessionId}:${name}` → 上次顯示的心情(用來判斷要不要播「變開心/變難過」特效)

/** 目前進行中的場次 = 第一場還沒登記比分的 */
function currentMatch(s) {
  const x = flatMatches(s).find((f) => !isComplete(f.m));
  return x ? x.m : null;
}

/** 每位選手目前的心情(依到目前為止的勝負) */
function liveMoods(s) {
  const out = {};
  for (const p of computeStats(s).players) out[p.name] = moodFromResults(p.results);
  return out;
}

/** 只在「最新一場尚未登記比分」的場次,於名字旁顯示寵物 */
function patchPets(s) {
  if (!s.pets) return;
  const cur = currentMatch(s);
  const moods = liveMoods(s);
  s.rounds.forEach((r, ri) => r.matches.forEach((m, mi) => {
    const el = app.querySelector(`.match[data-r="${ri}"][data-m="${mi}"]`);
    if (!el) return;
    el.querySelectorAll('.pcell').forEach((cell) => {
      const sel = cell.querySelector('select');
      const slot = cell.querySelector('.pet-slot');
      if (!sel || !slot) return;
      const name = m[sel.dataset.t][+sel.dataset.i];
      const pet = s.pets[name];
      const mood = moods[name] ?? 2;
      const want = cur && cur.id === m.id && pet ? `${pet}|${mood}` : '';
      if (slot.dataset.k === want) return;
      slot.dataset.k = want;
      slot.className = 'pet-slot';
      slot.innerHTML = want ? petHTML(pet, mood, 34, `${name}・${MOODS[mood]}`) : '';
      if (want) {
        const key = `${s.id}:${name}`;
        const prev = moodMemo[key];
        moodMemo[key] = mood;
        if (prev !== undefined && prev !== mood) {
          const cls = mood > prev ? 'fx-up' : 'fx-down';
          slot.classList.add(cls);
          setTimeout(() => slot.classList.remove(cls), 1600);
        }
      }
    });
  }));
}

/* ---------- actions ---------- */
const actions = {
  home: () => go('#/'),
  new: () => { draft = newDraft(); go('#/new'); },
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
  'add-roster': (el) => addPlayer(el.dataset.n, true),
  'rm-player': (el) => {
    draft.players = draft.players.filter((p) => p !== el.dataset.n);
    delete draft.pets[el.dataset.n];
    render();
  },
  'pick-pet': (el) => { draft.pet = el.dataset.id; render(); },
  'change-pet': (el) => { petTarget = el.dataset.n; document.getElementById('petDlg').showModal(); },
  'set-pet': (el) => { if (petTarget) draft.pets[petTarget] = el.dataset.id; petTarget = null; document.getElementById('petDlg').close(); render(); },
  'pet-cancel': () => document.getElementById('petDlg').close(),
  start: () => {
    if (draft.players.length < 4) return;
    const s = {
      id: uid(), date: todayStr(), startTime: nowHM(), endTime: null,
      players: [...draft.players], rounds: [], events: [], status: 'playing', pets: {},
    };
    for (const n of s.players) s.pets[n] = draft.pets[n] || pickPetId(Object.values(s.pets));
    db.petMap = { ...(db.petMap || {}), ...s.pets }; // 記住每個名字上次的寵物
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
    s.players.push(name);
    if (s.pets) s.pets[name] = (db.petMap || {})[name] && !Object.values(s.pets).includes(db.petMap[name]) ? db.petMap[name] : pickPetId(Object.values(s.pets));
    persist(); render(); toast(`已加入 ${name}`);
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
    document.getElementById('evTitle').focus(); // 不自動叫出鍵盤(橫式時鍵盤會蓋掉選項)
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
  'open-board': (el) => {
    boardFrom = location.hash;
    go(`#/s/${sid()}/m/${el.dataset.mid}`);
  },
  'b-plus': (el) => { board.seq.push(el.dataset.side); afterPoint(true); },
  'b-minus': (el) => {
    const k = el.dataset.side;
    const i = board.seq.lastIndexOf(k);
    if (i >= 0) board.seq.splice(i, 1);
    else if ((k === 'A' ? board.baseA : board.baseB) > 0) { if (k === 'A') board.baseA--; else board.baseB--; }
    else return;
    afterPoint(false);
  },
  'b-undo': () => { if (!board.seq.length) return; board.seq.pop(); afterPoint(false); },
  'b-flip': () => { board.flip = !board.flip; document.getElementById('board').classList.toggle('flip', board.flip); },
  'b-back': () => {
    if (board.wasComplete && board.dirty && !confirm('放棄這次的修改?')) return;
    const back = boardFrom || `#/s/${board.sid}`;
    leaveBoard();
    go(back);
  },
  'b-done': () => {
    const A = boardScore(board, 'A'), B = boardScore(board, 'B');
    if (A === B) { toast('比分相同,還不能完成'); return; }
    const m = findMatch(getSession(board.sid), board.mid);
    m.scoreA = A; m.scoreB = B;
    // 只有「從 0:0 開始用計分板記的」才有完整的得分順序
    m.points = !board.baseA && !board.baseB && board.seq.length ? [...board.seq] : null;
    delete m.draft;
    persist();
    const back = boardFrom || `#/s/${board.sid}`;
    board = null;
    focusNext = !back.endsWith('/summary');
    go(back);
    toast(`已記錄 ${A} : ${B}`);
  },
  tab: (el) => { summaryTab = +el.dataset.i; render(); window.scrollTo(0, 0); },
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
      const canvas = await window.html2canvas(node, { scale: 2, backgroundColor: bg, useCORS: true, windowWidth: 520,
        onclone: (doc) => { const st = doc.createElement('style'); st.textContent = '.pet,.pet *{animation:none!important}.shot{padding:18px 16px 10px!important}.rec-go{display:none!important}'; doc.head.appendChild(st); } });
      const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
      const file = new File([blob], `badminton-${s.date}-${SUM_TABS[summaryTab].slug}.png`, { type: 'image/png' });
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

let petTarget = null;
const newDraft = () => ({ players: [], pets: {}, pet: pickPetId([]), input: '' });

function addPlayer(raw, fromRoster = false) {
  const name = (raw || '').trim();
  if (!name) return;
  if (draft.players.includes(name)) { toast('名字重複了'); return; }
  const used = Object.values(draft.pets);
  const remembered = (db.petMap || {})[name];
  draft.players.push(name);
  // 常用名單:沿用上次的寵物(沒被占用的話);手動輸入:用目前選的
  draft.pets[name] = fromRoster && remembered && !used.includes(remembered) ? remembered : draft.pet;
  draft.pet = pickPetId(Object.values(draft.pets)); // 自動換下一隻還沒用過的
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
    if (m.points && !validPoints(m)) m.points = null; // 手動改比分 → 得分順序不再可信
    delete m.draft;
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

let lastY = 0;
window.addEventListener('scroll', () => {
  const fab = document.querySelector('.fab');
  if (!fab) return;
  const y = window.scrollY;
  const nearBottom = window.innerHeight + y >= document.body.scrollHeight - 160;
  if (y > lastY + 6 && y > 80 && !nearBottom) fab.classList.add('hide');
  else if (y < lastY - 6 || nearBottom || y <= 80) fab.classList.remove('hide');
  lastY = y;
}, { passive: true });

window.addEventListener('hashchange', render);
render();
