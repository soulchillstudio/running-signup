# 跑班報名頁 · 視覺強化 Brief v2

## 一、任務目標

把目前已經上線的報名頁升級——讓「**Soul Chill × SSE 雙品牌合作 / 雙教練課程**」的識別感，從 **Hero 區塊就開始**，而不是像現在要滑到第 5 個 section 才發現。

這一版是「對外招生」要用的視覺強度，對內版已經上線沒問題。

---

## 二、已完成且必須保留（**請勿重做**）

以下都已上線並正常運作，你的改動**不能破壞**這些邏輯：

- ✅ 三個班級 Tab 切換（taichung-tue / taipei-wed / taichung-thu）
- ✅ 七個方案 A–G 的 radio 選擇 + 自動帶入金額邏輯
- ✅ 匯款備註欄同步方案名稱
- ✅ 表單送出到 Google Apps Script（`API_URL` 常數）
- ✅ 送出後成功 / 失敗訊息處理
- ✅ 所有文案（Hero / Part 1 減法主張 / 三階段 / FAQ / 補課退費 / 運動風險公告）
- ✅ 手機版 RWD 斷點（640px）

HTML 的 `<script>` 區塊**一個字都不要動**（包含 CLASS_MAP、PLAN_MAP、switchClass、handleSubmit 等）。

---

## 三、要做的改動

### 1. Hero 區塊：加入雙品牌識別
現在的 Hero 只有傑西的照片和標題。要變成一眼看到「這是兩個品牌聯名的課程」。

**你可以考慮的方向**（自己評估哪個最好，不限於以下）：
- (A) Hero 頂部加一條 **Soul Chill × SSE** 的 horizontal lockup（兩個品牌並排）
- (B) Hero 右側的大圖改成**兩位教練**（可以 split / overlap / 合照）
- (C) Hero 標題下方加一個 meta row：**「COACHES · 廖歆迪 × 傑西」**（小字 + 雙頭像）
- (D) Hero 副標從現在的 `Soul Chill Studio × SSE 訓練漫談` 升級成更明顯的視覺處理

### 2. 在 Part 3（教練）出現之前，加入「教練預告」的視覺錨點
現在使用者要滑過 **Hero → Part 1 Goal → Part 2 三階段 → 上課日期** 四個 section 才看到教練。

希望在前段就有一個**輕量預告**：讓使用者知道「這堂課有兩位來自不同專業的教練」，但完整介紹仍保留在 Part 3。

**你可以考慮的方向**：
- 在 Hero 和 Part 1 之間加一個極簡的 banner：`COACH 01 廖歆迪 / 減法訓練` × `COACH 02 傑西 / Soul Chill`
- 或者把這個預告放在「上課日期」的結尾 / Coaches section 的前面

---

## 四、兩位教練的定位（供設計參考）

- **廖歆迪教練**（COACH 01）：《減法訓練》作者、SSE 訓練漫談主持人、動作設計與結構顧問（**負責設計身體怎麼被啟動**）
- **傑西教練**（COACH 02）：Soul Chill Studio 主理人、台中 / 台北現場教練（**負責把動作帶進跑動中**）

兩個人是**互補關係**（設計 + 落地），不是並排同台教課的雙主講。這個關係要在視覺上感覺到。

---

## 五、視覺風格限制

- **保留目前的設計語言**：linen 米色底、森林綠主色、草綠 accent、暖黃點綴
- **字體**：Syncopate（Display）+ Style Script（Script）+ Noto Sans TC（正文）
- **廖教練品牌色**：暫時用 Soul Chill 森林綠處理，SSE 品牌色未來再補

---

## 六、現有素材（資料夾 `assets/` 內）

| 檔案 | 用途 |
|------|------|
| `soulcill-running-logo.png` | Soul Chill 主 logo（彩色版，已用於 Nav）|
| `soul-chill-text-logo.png` | Soul Chill 純文字 logo（淺色版，已用於 Footer）|
| `SSE.jpg` | 廖教練形象照（已用於 Coach 01）|
| `coach-jessie.jpg` | 傑西形象照（已用於 Coach 02 + Hero）|
| `team-taipei.jpg`、其他跑班照 | Gallery 使用 |

---

## 七、附上資料

- `index.html` — 當前完整網頁（含所有 inline CSS + JS），請以此為基礎
- `reference/合作邀請函.md` — 完整敘事背景（計畫動機、驗證方式、階段分工）

---

## 八、輸出要求

**請直接輸出完整的單一 HTML 檔案**，含你所有的修改。不要拆段說明、不要只給 diff。我會存檔覆蓋使用。

**絕對不能動的區塊**：
- `<script>` 標籤內所有 JS（CLASS_MAP / PLAN_MAP / switchClass / handleSubmit / API_URL）
- 表單的 `name` 屬性（name / email / plan / amount 等）
- `id="form-class-input"` 這類程式化的 id
- `data-class`、`data-class-content` 這類屬性
- 方案 radio 的 `value="A"` 到 `value="G"`

**可以大改的區塊**：
- CSS 配置（新增 class 隨意）
- Hero / Coaches 的 HTML 結構
- 新增 section（只要不干擾現有 id / data-class 邏輯）
- 照片的擺放、logo 的呈現、排版細節
