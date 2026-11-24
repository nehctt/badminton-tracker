import test from 'node:test';
import assert from 'node:assert/strict';
import { PETS, MOODS, petHTML, moodFromResults, moodFromRate, pickPetId } from '../js/pets.js';

test('12 隻寵物、id 不重複、5 種心情', () => {
  assert.equal(PETS.length, 12);
  assert.equal(new Set(PETS.map((p) => p.id)).size, 12);
  assert.deepEqual(MOODS, ['超難過', '難過', '正常', '快樂', '超快樂']);
});

test('每隻寵物 × 每種心情都能產生 SVG,且帶有對應的心情 class', () => {
  for (const p of PETS)
    for (let m = 0; m < 5; m++) {
      const html = petHTML(p.id, m, 32, p.name);
      assert.ok(html.includes(`pet m${m}`) && html.includes('<svg') && html.includes('</svg>'), `${p.id}/${m}`);
    }
});

test('petHTML 會跳脫標題文字', () => {
  assert.ok(!petHTML('cat', 2, 20, '<b>"x"</b>').includes('<b>'));
});

test('對戰中心情:從正常開始,贏+1、輸−1,停在 0~4', () => {
  assert.equal(moodFromResults([]), 2);
  assert.equal(moodFromResults(['W']), 3);
  assert.equal(moodFromResults(['W', 'W', 'W', 'W', 'W']), 4);
  assert.equal(moodFromResults(['L', 'L', 'L']), 0);
  assert.equal(moodFromResults(['L', 'L', 'L', 'L', 'W']), 1); // 連輸到谷底後,贏一場只回升一格
  assert.equal(moodFromResults(['W', 'L']), 2);
});

test('結算心情:依勝率分五段', () => {
  assert.equal(moodFromRate(0, 0), 2); // 沒打過
  assert.deepEqual([1, 0.8, 0.79, 0.6, 0.5, 0.4, 0.39, 0.2, 0.19, 0].map((r) => moodFromRate(r, 5)), [4, 4, 3, 3, 2, 2, 1, 1, 0, 0]);
});

test('pickPetId:挑還沒用的;全用過就輪流', () => {
  assert.equal(pickPetId([]), PETS[0].id);
  assert.equal(pickPetId([PETS[0].id]), PETS[1].id);
  assert.ok(PETS.some((p) => p.id === pickPetId(PETS.map((x) => x.id))));
});
