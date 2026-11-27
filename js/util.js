export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const pad = (n) => String(n).padStart(2, '0');

export function todayStr(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function nowHM(d = new Date()) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function weekday(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return isNaN(d) ? '' : '日一二三四五六'[d.getDay()];
}

/** 分鐘數(可跨午夜) */
export function minutesBetween(startHM, endHM) {
  if (!startHM || !endHM) return null;
  const [sh, sm] = startHM.split(':').map(Number);
  const [eh, em] = endHM.split(':').map(Number);
  let diff = eh * 60 + em - (sh * 60 + sm);
  if (diff < 0) diff += 24 * 60;
  return diff;
}

export function fmtDuration(min) {
  if (min == null) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} 小時 ${m} 分` : `${m} 分鐘`;
}

/** 精簡版時長(用在窄欄位,避免換行):2小時10分 / 45分鐘 */
export function fmtDurationShort(min) {
  if (min == null) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}小時${m}分` : `${m}分鐘`;
}
