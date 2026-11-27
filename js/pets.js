// 寵物:20 隻造型 × 5 種心情。全部是內嵌 SVG(不需任何圖片檔),動畫由 CSS 控制。
import { esc } from './util.js';

export const MOODS = ['超難過', '難過', '正常', '快樂', '超快樂'];

const INK = '#3a3040'; // 輪廓/五官顏色
const st = `stroke="${INK}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"`;

/*
 * 每隻寵物:
 *   body   身體(畫在最底層)
 *   front  鼻子/嘴喙等(畫在身體上、五官下)
 *   anchor 臉的中心(兩眼連線的中點)與縮放;五官統一由 face() 依心情畫出
 *   eyeInk 眼睛顏色(熊貓的眼睛在黑色眼圈上,需要白色)
 */
export const PETS = [
  {
    id: 'cat', name: '貓咪', anchor: { x: 50, y: 54, s: 1 },
    body: `<path d="M20,44 L22,12 L44,28 Z" fill="#f4a259" ${st}/><path d="M80,44 L78,12 L56,28 Z" fill="#f4a259" ${st}/>
      <path d="M25,36 L26,20 L37,29 Z" fill="#f7b8c0"/><path d="M75,36 L74,20 L63,29 Z" fill="#f7b8c0"/>
      <ellipse cx="50" cy="58" rx="38" ry="32" fill="#f4a259" ${st}/>
      <path d="M50,30 L50,38 M41,31 L43,38 M59,31 L57,38" stroke="#d9822b" stroke-width="2.4" stroke-linecap="round" fill="none"/>
      <path d="M8,56 L24,58 M8,66 L24,63 M92,56 L76,58 M92,66 L76,63" stroke="${INK}" stroke-width="1.8" stroke-linecap="round" fill="none"/>`,
    front: `<path d="M47,58 L53,58 L50,62 Z" fill="#e0707f"/>`,
  },
  {
    id: 'dog', name: '柴犬', anchor: { x: 50, y: 52, s: 1 },
    body: `<ellipse cx="20" cy="42" rx="10" ry="18" transform="rotate(18 20 42)" fill="#b9733d" ${st}/>
      <ellipse cx="80" cy="42" rx="10" ry="18" transform="rotate(-18 80 42)" fill="#b9733d" ${st}/>
      <ellipse cx="50" cy="56" rx="35" ry="31" fill="#e8b273" ${st}/>
      <ellipse cx="50" cy="68" rx="17" ry="12" fill="#fff1dc"/>
      <circle cx="36" cy="42" r="3" fill="#fff1dc"/><circle cx="64" cy="42" r="3" fill="#fff1dc"/>`,
    front: `<ellipse cx="50" cy="59" rx="4.5" ry="3.2" fill="${INK}"/>`,
  },
  {
    id: 'rabbit', name: '兔兔', anchor: { x: 50, y: 60, s: 1 },
    body: `<ellipse cx="34" cy="22" rx="9" ry="22" fill="#fafafa" ${st}/><ellipse cx="66" cy="22" rx="9" ry="22" fill="#fafafa" ${st}/>
      <ellipse cx="34" cy="24" rx="4.5" ry="15" fill="#f9bcc8"/><ellipse cx="66" cy="24" rx="4.5" ry="15" fill="#f9bcc8"/>
      <ellipse cx="50" cy="64" rx="34" ry="29" fill="#fafafa" ${st}/>`,
    front: `<ellipse cx="50" cy="64" rx="3.5" ry="2.6" fill="#f08aa0"/>`,
  },
  {
    id: 'panda', name: '熊貓', anchor: { x: 50, y: 54, s: 1 }, eyeInk: '#ffffff',
    body: `<circle cx="22" cy="28" r="12" fill="${INK}" ${st}/><circle cx="78" cy="28" r="12" fill="${INK}" ${st}/>
      <ellipse cx="50" cy="56" rx="36" ry="32" fill="#ffffff" ${st}/>
      <ellipse cx="35" cy="54" rx="9" ry="11" transform="rotate(-22 35 54)" fill="${INK}"/>
      <ellipse cx="65" cy="54" rx="9" ry="11" transform="rotate(22 65 54)" fill="${INK}"/>`,
    front: `<ellipse cx="50" cy="62" rx="4" ry="2.8" fill="${INK}"/>`,
  },
  {
    id: 'chick', name: '小雞', anchor: { x: 50, y: 52, s: 1 },
    body: `<path d="M44,28 Q40,14 47,20 Q50,8 54,20 Q61,14 56,28 Z" fill="#ffc933" ${st}/>
      <ellipse cx="50" cy="58" rx="36" ry="33" fill="#ffd84d" ${st}/>
      <ellipse cx="17" cy="62" rx="7" ry="12" transform="rotate(15 17 62)" fill="#ffc933" ${st}/>
      <ellipse cx="83" cy="62" rx="7" ry="12" transform="rotate(-15 83 62)" fill="#ffc933" ${st}/>`,
    front: `<path d="M45,55 L55,55 L50,61 Z" fill="#ff9f43" ${st}/>`,
  },
  {
    id: 'penguin', name: '企鵝', anchor: { x: 50, y: 50, s: 1 },
    body: `<ellipse cx="14" cy="64" rx="8" ry="16" transform="rotate(18 14 64)" fill="#3d4a63" ${st}/>
      <ellipse cx="86" cy="64" rx="8" ry="16" transform="rotate(-18 86 64)" fill="#3d4a63" ${st}/>
      <ellipse cx="38" cy="93" rx="10" ry="5" fill="#ff9f43" ${st}/><ellipse cx="62" cy="93" rx="10" ry="5" fill="#ff9f43" ${st}/>
      <ellipse cx="50" cy="55" rx="35" ry="38" fill="#3d4a63" ${st}/>
      <ellipse cx="50" cy="68" rx="23" ry="24" fill="#ffffff"/>
      <path d="M26,50 Q26,36 38,38 Q50,42 62,38 Q74,36 74,50 Q74,66 50,66 Q26,66 26,50 Z" fill="#ffffff"/>`,
    front: `<path d="M45,55 L55,55 L50,61 Z" fill="#ff9f43" ${st}/>`,
  },
  {
    id: 'slime', name: '史萊姆', anchor: { x: 50, y: 60, s: 1 },
    body: `<path d="M12,80 Q8,52 28,40 Q36,18 50,24 Q64,18 72,40 Q92,52 88,80 Q86,92 70,92 L30,92 Q14,92 12,80 Z" fill="#6ec6ff" ${st}/>
      <path d="M24,52 Q26,42 34,40" stroke="#ffffff" stroke-width="4" stroke-linecap="round" fill="none" opacity=".75"/>
      <circle cx="26" cy="60" r="2" fill="#ffffff" opacity=".7"/>`,
  },
  {
    id: 'mushroom', name: '香菇', anchor: { x: 50, y: 68, s: 0.75 },
    body: `<path d="M30,52 L70,52 L68,86 Q50,96 32,86 Z" fill="#fff1d6" ${st}/>
      <path d="M8,56 Q6,10 50,10 Q94,10 92,56 Q50,64 8,56 Z" fill="#e5484d" ${st}/>
      <circle cx="28" cy="34" r="7" fill="#ffffff"/><circle cx="56" cy="24" r="6" fill="#ffffff"/>
      <circle cx="76" cy="42" r="7" fill="#ffffff"/><circle cx="46" cy="44" r="3.5" fill="#ffffff"/>`,
  },
  {
    id: 'cactus', name: '仙人掌', anchor: { x: 50, y: 50, s: 0.72 },
    body: `<rect x="12" y="34" width="14" height="26" rx="7" fill="#5bbf7a" ${st}/><rect x="20" y="52" width="16" height="12" rx="6" fill="#5bbf7a" ${st}/>
      <rect x="74" y="26" width="14" height="28" rx="7" fill="#5bbf7a" ${st}/><rect x="64" y="44" width="16" height="12" rx="6" fill="#5bbf7a" ${st}/>
      <rect x="31" y="18" width="38" height="68" rx="19" fill="#5bbf7a" ${st}/>
      <path d="M50,22 L50,32 M41,25 L41,31 M59,25 L59,31" stroke="#3f9b5d" stroke-width="2.2" stroke-linecap="round" fill="none"/>
      <circle cx="50" cy="15" r="6" fill="#ff8fb1" ${st}/><circle cx="50" cy="15" r="2" fill="#ffd23f"/>
      <rect x="25" y="78" width="50" height="8" rx="3" fill="#e79670" ${st}/>
      <path d="M28,86 L72,86 L66,98 L34,98 Z" fill="#d9825b" ${st}/>`,
  },
  {
    id: 'onigiri', name: '飯糰', anchor: { x: 50, y: 52, s: 0.85 },
    body: `<path d="M50,12 Q57,12 61,20 L88,72 Q95,88 80,90 L20,90 Q5,88 12,72 L39,20 Q43,12 50,12 Z" fill="#ffffff" ${st}/>
      <path d="M24,76 L76,76 L80,89 L20,89 Z" fill="#2f3b35"/>
      <circle cx="50" cy="29" r="4" fill="#ff7b8a"/>
      <circle cx="40" cy="64" r="1.3" fill="#d9d9d9"/><circle cx="62" cy="62" r="1.3" fill="#d9d9d9"/><circle cx="73" cy="70" r="1.3" fill="#d9d9d9"/>`,
  },
  {
    id: 'shuttle', name: '羽球', anchor: { x: 50, y: 34, s: 0.8 },
    body: `<circle cx="50" cy="72" r="19" fill="#f2d9a8" ${st}/>
      <path d="M32,62 L14,14 Q50,2 86,14 L68,62 Z" fill="#ffffff" ${st}/>
      <path d="M26,16 L36,62 M38,14 L42,62 M50,13 L50,62 M62,14 L58,62 M74,16 L64,62" stroke="#c9c9d6" stroke-width="1.6" opacity=".6" fill="none"/>
      <path d="M14,14 Q50,2 86,14" stroke="#e5484d" stroke-width="5" fill="none" stroke-linecap="round"/>`,
  },
  {
    id: 'melon', name: '西瓜', anchor: { x: 50, y: 52, s: 0.9 },
    body: `<path d="M2,30 A48,48 0 0 0 98,30 Z" fill="#4cae4f" ${st}/>
      <path d="M6,30 A44,44 0 0 0 94,30 Z" fill="#f4fbe9"/>
      <path d="M10,30 A40,40 0 0 0 90,30 Z" fill="#ff5d6c"/>
      <ellipse cx="22" cy="42" rx="2" ry="3.3" transform="rotate(-20 22 42)" fill="${INK}"/><ellipse cx="78" cy="42" rx="2" ry="3.3" transform="rotate(20 78 42)" fill="${INK}"/>
      <ellipse cx="30" cy="58" rx="2" ry="3.3" transform="rotate(-30 30 58)" fill="${INK}"/><ellipse cx="70" cy="58" rx="2" ry="3.3" transform="rotate(30 70 58)" fill="${INK}"/>`,
  },
  {
    id: 'pig', name: '小豬', anchor: { x: 50, y: 44, s: 1 },
    body: `<path d="M22,38 Q6,22 18,10 Q36,8 44,26 Z" fill="#ff9fb4" ${st}/><path d="M78,38 Q94,22 82,10 Q64,8 56,26 Z" fill="#ff9fb4" ${st}/>
      <ellipse cx="50" cy="56" rx="38" ry="32" fill="#ffb3c6" ${st}/>
      <ellipse cx="50" cy="55" rx="14" ry="9.5" fill="#ff8fab" stroke="#e86a8d" stroke-width="1.6"/>`,
    front: `<ellipse cx="44.5" cy="54" rx="2.3" ry="3.2" fill="#b83a5e"/><ellipse cx="55.5" cy="54" rx="2.3" ry="3.2" fill="#b83a5e"/>`,
  },
  {
    id: 'fox', name: '狐狸', anchor: { x: 50, y: 50, s: 1 },
    body: `<path d="M16,42 L18,8 L44,26 Z" fill="#f28c38" ${st}/><path d="M84,42 L82,8 L56,26 Z" fill="#f28c38" ${st}/>
      <path d="M22,32 L21,17 L33,26 Z" fill="${INK}"/><path d="M78,32 L79,17 L67,26 Z" fill="${INK}"/>
      <ellipse cx="50" cy="58" rx="38" ry="30" fill="#f28c38" ${st}/>
      <path d="M13,60 Q28,56 40,66 Q50,70 60,66 Q72,56 87,60 Q85,86 50,88 Q15,86 13,60 Z" fill="#ffffff"/>`,
    front: `<ellipse cx="50" cy="58" rx="4" ry="3" fill="${INK}"/>`,
  },
  {
    id: 'frog', name: '青蛙', anchor: { x: 50, y: 36, s: 1.4 },
    body: `<ellipse cx="50" cy="64" rx="39" ry="27" fill="#7ccf6b" ${st}/>
      <ellipse cx="50" cy="76" rx="24" ry="12" fill="#c9f1b9"/>
      <circle cx="31" cy="36" r="14" fill="#7ccf6b" ${st}/><circle cx="69" cy="36" r="14" fill="#7ccf6b" ${st}/>
      <circle cx="31" cy="36" r="9.5" fill="#ffffff"/><circle cx="69" cy="36" r="9.5" fill="#ffffff"/>`,
  },
  {
    id: 'boba', name: '珍奶', anchor: { x: 50, y: 54, s: 0.85 },
    body: `<path d="M60,28 L68,3" stroke="#ff7aa2" stroke-width="6" stroke-linecap="round" fill="none"/>
      <path d="M22,28 L78,28 L70,92 Q50,98 30,92 Z" fill="#f4dcc0" ${st}/>
      <ellipse cx="50" cy="27" rx="31" ry="7" fill="#eaf6ff" ${st}/>
      <circle cx="37" cy="86" r="4.6" fill="#4a3228"/><circle cx="48" cy="88" r="4.6" fill="#4a3228"/><circle cx="59" cy="86" r="4.6" fill="#4a3228"/>
      <circle cx="65" cy="79" r="4.6" fill="#4a3228"/><circle cx="42" cy="78" r="4.6" fill="#4a3228"/><circle cx="54" cy="79" r="4.6" fill="#4a3228"/>`,
  },
  {
    id: 'egg', name: '荷包蛋', anchor: { x: 50, y: 52, s: 0.8 },
    body: `<path d="M16,46 Q6,22 34,20 Q50,6 68,20 Q96,22 86,48 Q98,76 70,84 Q50,98 32,84 Q4,76 16,46 Z" fill="#ffffff" ${st}/>
      <circle cx="50" cy="52" r="25" fill="#ffc933"/>
      <ellipse cx="38" cy="38" rx="5" ry="3" transform="rotate(-30 38 38)" fill="#fff3b0"/>`,
  },
  {
    id: 'berry', name: '草莓', anchor: { x: 50, y: 52, s: 0.95 },
    body: `<path d="M50,93 Q12,70 13,44 Q14,22 34,22 Q44,22 50,28 Q56,22 66,22 Q86,22 87,44 Q88,70 50,93 Z" fill="#ff5a68" ${st}/>
      <path d="M28,26 L40,11 L50,23 L60,11 L72,26 L62,30 L50,24 L38,30 Z" fill="#4cc38a" ${st}/>
      <ellipse cx="25" cy="46" rx="1.8" ry="3" fill="#ffe27a"/><ellipse cx="75" cy="46" rx="1.8" ry="3" fill="#ffe27a"/>
      <ellipse cx="30" cy="66" rx="1.8" ry="3" fill="#ffe27a"/><ellipse cx="70" cy="66" rx="1.8" ry="3" fill="#ffe27a"/>
      <ellipse cx="42" cy="79" rx="1.8" ry="3" fill="#ffe27a"/><ellipse cx="58" cy="79" rx="1.8" ry="3" fill="#ffe27a"/>`,
  },
  {
    id: 'ghost', name: '幽靈', anchor: { x: 50, y: 46, s: 1 },
    body: `<path d="M15,92 L15,50 Q15,10 50,10 Q85,10 85,50 L85,92 Q76,83 67.5,92 Q59,83 50,92 Q41,83 32.5,92 Q24,83 15,92 Z" fill="#f4f2ff" ${st}/>
      <ellipse cx="30" cy="30" rx="6" ry="3.5" transform="rotate(-35 30 30)" fill="#ffffff"/>`,
  },
  {
    id: 'toast', name: '吐司', anchor: { x: 50, y: 56, s: 0.9 },
    body: `<path d="M20,90 L20,52 Q4,48 6,32 Q8,12 30,14 Q40,6 50,12 Q60,6 70,14 Q92,12 94,32 Q96,48 80,52 L80,90 Z" fill="#f2c98a" ${st}/>
      <path d="M20,90 L20,52 Q4,48 6,32 Q8,12 30,14 Q40,6 50,12 Q60,6 70,14 Q92,12 94,32 Q96,48 80,52 L80,90 Z" transform="translate(50 52) scale(.84) translate(-50 -52)" fill="#fde6bb"/>
      <rect x="60" y="24" width="14" height="11" rx="2" transform="rotate(-10 67 30)" fill="#ffe27a" stroke="#e0b73a" stroke-width="1.2"/>`,
  },
];

const PET_MAP = Object.fromEntries(PETS.map((p) => [p.id, p]));
export const petName = (id) => (PET_MAP[id] || PETS[0]).name;

/** 挑一隻還沒被用掉的寵物;12 隻都用過就輪流重複 */
export function pickPetId(used = []) {
  const free = PETS.find((p) => !used.includes(p.id));
  return (free || PETS[used.length % PETS.length]).id;
}

/* ---------- 心情 ---------- */

/** 對戰中:從「正常」開始,贏一場 +1、輸一場 −1,停在 0~4 */
export function moodFromResults(results) {
  return results.reduce((m, r) => Math.max(0, Math.min(4, m + (r === 'W' ? 1 : -1))), 2);
}

/** 結算:依今日勝率分五段(沒打過 = 正常) */
export function moodFromRate(winRate, games) {
  if (!games) return 2;
  if (winRate >= 0.8) return 4;
  if (winRate >= 0.6) return 3;
  if (winRate >= 0.4) return 2;
  if (winRate >= 0.2) return 1;
  return 0;
}

/* ---------- 五官(統一畫法,位置由 anchor 決定) ---------- */

const STAR = 'M0,-6 L1.7,-1.7 L6,0 L1.7,1.7 L0,6 L-1.7,1.7 L-6,0 L-1.7,-1.7 Z';
const HEART = 'M0,4 C-8,-2 -4,-8 0,-3 C4,-8 8,-2 0,4 Z';
const at = (x, y, inner, rot = 0) => `<g transform="translate(${x} ${y}) rotate(${rot})">${inner}</g>`;

function face(mood, a, eyeInk) {
  const e = eyeInk || INK;
  const hi = e === INK ? '#ffffff' : INK; // 眼睛高光
  const L = -13, R = 13;
  const dot = (x, r = 3.6, y = 0) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${e}"/><circle cx="${x + r * 0.35}" cy="${y - r * 0.38}" r="${r * 0.33}" fill="${hi}"/>`;
  const line = (d, w = 2.2, color = e) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const mouthLine = (d) => line(d, 2.2, INK);
  const open = (w, depth, tongue) => `<path d="M${-w},7 Q0,${7 + depth} ${w},7 Z" fill="#7a2230" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>${tongue ? `<ellipse cx="0" cy="${7 + depth * 0.6}" rx="${w * 0.45}" ry="${w * 0.27}" fill="#ff8fa3"/>` : ''}`;
  let g = '';
  switch (mood) {
    case 0: // 超難過:閉眼嚎啕大哭、眉毛垮下、烏雲線、淚水瀑布
      g += line(`M${L - 4},-3.5 L${L + 3.5},0 L${L - 4},3.5 M${R + 4},-3.5 L${R - 3.5},0 L${R + 4},3.5`, 2.6);
      g += line(`M${L - 5},-6.5 L${L + 5},-12 M${R + 5},-6.5 L${R - 5},-12`, 2.2);
      g += line('M-9,-18 v7 M0,-20 v9 M9,-18 v7', 2.2, '#6b7fd7');
      g += `<path d="M${L},4 L${L - 1},30 M${R},4 L${R + 1},30" stroke="#8fd0ff" stroke-width="4.5" stroke-linecap="round" opacity=".75"/>`;
      g += `<ellipse class="tear" cx="${L}" cy="6" rx="2.6" ry="3.8" fill="#5ab4ff"/><ellipse class="tear t2" cx="${R}" cy="6" rx="2.6" ry="3.8" fill="#5ab4ff"/>`;
      g += `<path d="M-9,18 Q0,2 9,18 Z" fill="#7a2230" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><ellipse cx="0" cy="16" rx="4" ry="2" fill="#c8506a"/>`;
      break;
    case 1: // 難過:低垂的眼睛、八字眉、顫抖的嘴、冒汗
      g += `<g>${dot(L, 3.6, 1.5)}${dot(R, 3.6, 1.5)}</g>`;
      g += line(`M${L - 5},-6.5 L${L + 5},-11 M${R + 5},-6.5 L${R - 5},-11`, 2.2);
      g += mouthLine('M-7,14 Q-3.5,9.5 0,13 Q3.5,9.5 7,14');
      g += `<ellipse class="tear slow" cx="${L - 1}" cy="6" rx="2.1" ry="3.2" fill="#5ab4ff"/>`;
      break;
    case 2: // 正常:圓眼會眨眼、小小微笑
      g += `<g class="blink">${dot(L)}${dot(R)}</g>`;
      g += mouthLine('M-4,10 Q0,12.5 4,10');
      break;
    case 3: // 快樂:閃亮大眼、張嘴笑、腮紅
      g += `<g class="blink"><circle cx="${L}" cy="0" r="5.2" fill="${e}"/><circle cx="${L + 1.8}" cy="-2" r="2" fill="${hi}"/><circle cx="${L - 1.6}" cy="1.8" r="1" fill="${hi}"/>`;
      g += `<circle cx="${R}" cy="0" r="5.2" fill="${e}"/><circle cx="${R + 1.8}" cy="-2" r="2" fill="${hi}"/><circle cx="${R - 1.6}" cy="1.8" r="1" fill="${hi}"/></g>`;
      g += `<circle cx="-21" cy="8" r="4.6" fill="#ff7893" opacity=".75"/><circle cx="21" cy="8" r="4.6" fill="#ff7893" opacity=".75"/>`;
      g += open(8, 15, true);
      break;
    default: // 超快樂:星星眼、大嘴吐舌、超紅腮紅
      for (const x of [L, R]) g += at(x, 0, `<path class="eyestar" d="${STAR}" transform="scale(1.7)" fill="#ffd23f" stroke="${INK}" stroke-width="0.9" stroke-linejoin="round"/>`);
      g += `<circle cx="-22" cy="9" r="5.6" fill="#ff5f84" opacity=".85"/><circle cx="22" cy="9" r="5.6" fill="#ff5f84" opacity=".85"/>`;
      g += open(12, 26, true);
  }
  return `<g transform="translate(${a.x} ${a.y}) scale(${a.s})">${g}</g>`;
}

/* ---------- 全身特效(畫在身體底下 / 上面) ---------- */

const burst = (list, cls) => list.map(([x, y, d, color, shape, size = 1]) =>
  at(x, y, `<path class="${cls}" d="${shape}" transform="scale(${size})" fill="${color}" style="animation-delay:${d}s"/>`)).join('');

function effects(mood) {
  let before = '', after = '';
  if (mood === 0) {
    before = `<ellipse cx="50" cy="97" rx="36" ry="4.5" fill="#8fd0ff" opacity=".5"/>`;
    after = `<g class="cloud"><ellipse cx="50" cy="-4" rx="30" ry="9" fill="#7d8aa3"/><circle cx="33" cy="-9" r="9.5" fill="#7d8aa3"/><circle cx="51" cy="-14" r="12" fill="#8a97b0"/><circle cx="68" cy="-8" r="9" fill="#7d8aa3"/></g>`
      + [[36, 0.0], [50, 0.3], [64, 0.6], [43, 0.45], [57, 0.15]].map(([x, d]) => `<path class="rain" d="M${x},3 l-1.5,7" stroke="#6fb8ff" stroke-width="2.2" stroke-linecap="round" style="animation-delay:${d}s"/>`).join('');
  } else if (mood === 1) {
    after = `<path d="M80,30 Q84,38 80,41 Q76,38 80,30 Z" fill="#8fd0ff" stroke="#5ab4ff" stroke-width="1"/>`
      + [[78, 62, 0, 2.4], [84, 54, 0.8, 3.2], [91, 44, 1.6, 4]].map(([x, y, d, r]) => `<circle class="puff" cx="${x}" cy="${y}" r="${r}" fill="#ffffff" stroke="#b8c4d6" stroke-width="1" style="animation-delay:${d}s"/>`).join('');
  } else if (mood === 3) {
    after = burst([[88, 34, 0, '#ff6f91', HEART, 1.1], [12, 44, 0.9, '#ff9ab0', HEART, 0.9]], 'float')
      + at(90, 62, `<text class="float" font-size="15" font-weight="700" fill="#5b8def" text-anchor="middle" style="animation-delay:.5s">♪</text>`);
  } else if (mood === 4) {
    before = `<circle class="aura" cx="50" cy="55" r="58" fill="#ffe27a"/>`;
    const conf = [[14, 'ff5f84'], [29, '5b8def'], [43, 'ffd23f'], [57, '4cc38a'], [71, 'ff9f43'], [86, 'b57bff'], [22, 'ffd23f'], [78, 'ff5f84']]
      .map(([x, c], i) => `<rect class="confetti" x="${x}" y="-8" width="5" height="8" fill="#${c}" style="animation-delay:${(i * 0.19).toFixed(2)}s"/>`).join('');
    after = conf
      + burst([[8, 18, 0, '#ffd23f', STAR, 1.3], [93, 22, 0.4, '#ffd23f', STAR, 1.5], [88, 80, 0.8, '#ffd23f', STAR, 1.2], [10, 74, 0.2, '#ffd23f', STAR, 1.3], [96, 52, 0.6, '#fff', STAR, 0.9], [4, 48, 1, '#fff', STAR, 0.9]], 'spark')
      + burst([[84, 38, 0, '#ff5f84', HEART, 1.3], [16, 36, 0.6, '#ff7893', HEART, 1.2], [50, 8, 1.1, '#ff9ab0', HEART, 1]], 'float');
  }
  return { before, after };
}

/** 一隻寵物(內嵌 SVG)。size 為像素;title 供無障礙/提示。 */
export function petHTML(id, mood, size = 32, title = '') {
  const p = PET_MAP[id] || PETS[0];
  const m = Math.max(0, Math.min(4, mood | 0));
  const t = esc(title);
  const fx = effects(m);
  return `<span class="pet m${m}" style="width:${size}px;height:${size}px" role="img" aria-label="${t}" title="${t}"><svg viewBox="0 0 100 100" aria-hidden="true">${fx.before}${p.body}${p.front || ''}${face(m, p.anchor, p.eyeInk)}${fx.after}</svg></span>`;
}
