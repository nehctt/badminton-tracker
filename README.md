# 🏸 羽球紀錄

純靜態網頁(Vanilla JS,無需建置),可直接部署在 GitHub Pages。資料存在瀏覽器 `localStorage`,可匯出/匯入 JSON 備份。

## 功能
- 新增對戰:日期、參加人員、開始時間
- 自動生成一輪雙打循環:隊友交替、多於 4 人時平均休息;可手動換人、加減場次
- 只輸入最終比分;隨時可一鍵生成下一輪
- 寵物夥伴:新增人員時為每人選一隻(12 種,含動物與擬物化的香菇、仙人掌、飯糰、羽球、西瓜…),對戰頁在進行中的那一場顯示,心情隨勝負變化(5 種狀態、各有小動畫);結算時依勝率給狀態
- 隨時記錄特殊事件
- 結算(會記錄結算時間):今日稱號(30 種)/ 今日特殊事件 / 今日戰績(場數、勝、敗、勝率),可儲存成圖片或複製成文字

## 本機開發
```bash
python3 -m http.server 8000   # 開啟 http://localhost:8000 (ES modules 不能用 file:// 開)
npm test                      # 排程與統計的單元測試
```

## 第三方
`js/vendor/html2canvas.min.js`(MIT)用於把結算畫面轉成圖片,已內含於 repo,不需連外網。

## 部署
Settings → Pages → Source 選 `Deploy from a branch`,Branch 選 `main` / `(root)`。
