# 🏸 羽球紀錄

純靜態網頁(Vanilla JS,無需建置),可直接部署在 GitHub Pages。資料存在瀏覽器 `localStorage`,可匯出/匯入 JSON 備份。

## 功能
- 新增對戰:日期、參加人員、開始時間
- 自動生成一輪雙打循環:隊友交替、多於 4 人時平均休息;可手動換人、加減場次
- 只輸入最終比分;打完一輪後一鍵生成下一輪
- 隨時記錄特殊事件
- 結算:今日稱號 / 今日特殊事件 / 今日戰績(場數、勝、敗、勝率),可複製成文字貼到群組

## 本機開發
```bash
python3 -m http.server 8000   # 開啟 http://localhost:8000 (ES modules 不能用 file:// 開)
npm test                      # 排程與統計的單元測試
```

## 部署
Settings → Pages → Source 選 `Deploy from a branch`,Branch 選 `main` / `(root)`。
