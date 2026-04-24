// ==========================================================
// 2026 Q2 跑班報名 — Google Apps Script
// 首次使用:先執行 setup() 建立分頁 + 表頭 + 下拉選單
// 部署:Deploy > New deployment > Web app
//       Execute as: Me  /  Who has access: Anyone
// ==========================================================

const NOTIFY_EMAIL = 'qazmnbvgamil@gmail.com'; // 報名通知信收件人(你自己)

const CLASS_MAP = {
  'taichung-tue': { tab: '台中週二班', label: '台中 · 週二班', location: '中興大學田徑場' },
  'taipei-wed':   { tab: '台北週三班', label: '台北 · 週三班', location: '台北田徑場' },
  'taichung-thu': { tab: '台中週四班', label: '台中 · 週四班', location: '中興大學田徑場' }
};

const PLAN_MAP = {
  A: '(A) 新生 · 團課 × 12 堂',
  B: '(B) 舊生 · 團課 × 12 堂',
  C: '(C) 初次單堂體驗課',
  D: '(D) 插班報名 × 剩餘堂數',
  E: '(E) 兩人同行 · 新生完整 12 堂',
  F: '(F) 三人同行 · 新生完整 12 堂',
  G: '(G) 個人課表 / 4 週'
};

const HEADERS = ['報名時間','姓名','LINE','Email','跑步能力','方案','方案說明','匯款金額','匯款後五碼','備註','同意條款','狀態','入群日期','首週出席','教練備註'];

// ====== 執行一次:建立三個分頁 + 表頭 + 狀態下拉 ======
function setup() {
  const ss = SpreadsheetApp.getActive();
  Object.values(CLASS_MAP).forEach(c => {
    let sheet = ss.getSheetByName(c.tab) || ss.insertSheet(c.tab);
    sheet.clear();
    sheet.getRange(1, 1, 1, HEADERS.length)
      .setValues([HEADERS])
      .setFontWeight('bold')
      .setBackground('#1f3a2d')
      .setFontColor('#f1ede2');
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, HEADERS.length);

    // 狀態欄(L 欄)下拉選單
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['待匯款','已匯款','已入群','正式開課','已退費'], true)
      .build();
    sheet.getRange(2, 12, 500, 1).setDataValidation(rule);

    // 首週出席欄(N 欄)下拉
    const attRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['出席','未出席','—'], true)
      .build();
    sheet.getRange(2, 14, 500, 1).setDataValidation(attRule);
  });

  // 刪除預設的空白分頁
  const def = ss.getSheetByName('工作表1') || ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1) ss.deleteSheet(def);
}

// ====== 表單 POST 進入點 ======
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const cls = CLASS_MAP[data.class];
    if (!cls) throw new Error('未知班別:' + data.class);

    const ss = SpreadsheetApp.getActive();
    const sheet = ss.getSheetByName(cls.tab);
    const planLabel = PLAN_MAP[data.plan] || data.plan || '';

    sheet.appendRow([
      new Date(),
      data.name || '',
      data.line || '',
      data.email || '',
      data.running || '',
      data.plan || '',
      planLabel,
      data.amount || '',
      data.last5 || '',
      data.notes || '',
      data.agree ? '是' : '否',
      '待匯款',
      '', '', ''
    ]);

    // 學員確認信
    if (data.email) {
      MailApp.sendEmail({
        to: data.email,
        subject: `【傑西跑班】${cls.label} | 已收到你的報名`,
        htmlBody: studentEmail(data, cls, planLabel)
      });
    }

    // 你的通知信
    MailApp.sendEmail({
      to: NOTIFY_EMAIL,
      subject: `🎉 新報名:${cls.label} | ${data.name}`,
      htmlBody: adminEmail(data, cls, planLabel)
    });

    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  return ContentService.createTextOutput('Soul Chill 跑班報名 API is live.');
}

function studentEmail(d, cls, planLabel) {
  return `
<div style="font-family:sans-serif;line-height:1.7;color:#1f3a2d;max-width:560px">
  <h2 style="color:#1f3a2d;margin-bottom:8px">嗨 ${d.name},感謝你的報名 🙌</h2>
  <p>我們已經收到你的報名資訊,以下是確認內容:</p>
  <table style="border-collapse:collapse;margin:12px 0">
    <tr><td style="padding:6px 12px;color:#4a5d51">班級</td><td style="padding:6px 12px"><b>${cls.label}</b>(${cls.location})</td></tr>
    <tr><td style="padding:6px 12px;color:#4a5d51">方案</td><td style="padding:6px 12px">${planLabel}</td></tr>
    <tr><td style="padding:6px 12px;color:#4a5d51">匯款金額</td><td style="padding:6px 12px">NT$ ${d.amount || '—'}</td></tr>
    <tr><td style="padding:6px 12px;color:#4a5d51">後五碼</td><td style="padding:6px 12px">${d.last5 || '—'}</td></tr>
  </table>
  <h3 style="margin-top:24px">下一步</h3>
  <ol>
    <li>我們會在 <b>2 個工作天內</b> 聯繫你,確認匯款、入班與 LINE 群組邀請。</li>
    <li>入群後會同步交通方式、雨天備案、上課地點等細節。</li>
    <li>如匯款尚未完成,請盡快於 3 日內處理,以確保報名有效。</li>
  </ol>
  <p style="margin-top:24px;color:#4a5d51;font-size:13px">有任何問題歡迎私訊:<br>
  IG @jesse.coach.26  ·  LINE @104wzemj</p>
  <p style="color:#4a5d51;font-size:12px;margin-top:20px">— Soul Chill Running Club · 傑西跑班</p>
</div>`;
}

function adminEmail(d, cls, planLabel) {
  const ssId = SpreadsheetApp.getActive().getId();
  return `
<div style="font-family:sans-serif;line-height:1.7">
  <h2>🎉 新報名:${cls.label}</h2>
  <table style="border-collapse:collapse">
    <tr><td style="padding:4px 10px;color:#666">姓名</td><td style="padding:4px 10px"><b>${d.name}</b></td></tr>
    <tr><td style="padding:4px 10px;color:#666">Email</td><td style="padding:4px 10px">${d.email}</td></tr>
    <tr><td style="padding:4px 10px;color:#666">LINE</td><td style="padding:4px 10px">${d.line || '—'}</td></tr>
    <tr><td style="padding:4px 10px;color:#666">方案</td><td style="padding:4px 10px">${planLabel}</td></tr>
    <tr><td style="padding:4px 10px;color:#666">金額 / 後五碼</td><td style="padding:4px 10px">NT$ ${d.amount || '—'} / ${d.last5 || '—'}</td></tr>
    <tr><td style="padding:4px 10px;color:#666">跑步能力</td><td style="padding:4px 10px">${d.running || '—'}</td></tr>
    <tr><td style="padding:4px 10px;color:#666">備註</td><td style="padding:4px 10px">${d.notes || '—'}</td></tr>
  </table>
  <p style="margin-top:16px"><a href="https://docs.google.com/spreadsheets/d/${ssId}/edit">→ 打開 Sheet 查看</a></p>
</div>`;
}
