// ==========================================================
// 傑西跑班報名 — Google Apps Script
// 首次使用:先執行 setup() 建立分頁 + 表頭 + 下拉選單
// 部署:Deploy > New deployment > Web app
//       Execute as: Me  /  Who has access: Anyone
//
// 2026-08-07 第 3 期改動:
//   報名資料改寫進「第 3 期」專用 Sheet(見 SHEET_ID),
//   第 2 期的舊 Sheet 保持原樣不再寫入。
//   ⚠️ 改成 openById 之後,這支腳本綁在哪個 Sheet 已經不重要,
//      要換期只需要改 SHEET_ID 這一行,然後重新 Deploy。
// ==========================================================

const NOTIFY_EMAIL = 'qazmnbvgamil@gmail.com'; // 報名通知信收件人(你自己)

// 第 3 期報名資料 Sheet(2026-08-07 建立)
// 第 2 期舊 Sheet = 1DBjW1KegOdqWxonDcoyDNl15SDF5yYiA4vJAvbkipcE(保留備查,不再寫入)
const SHEET_ID = '1hH5YO54sbGP16kMl6b-9sZDM7rjBjZ9ACIioOTt78Eg';

function ss_() {
  return SpreadsheetApp.openById(SHEET_ID);
}

// 報名時間戳:明確指定台北時區產生字串,不依賴任何容器設定。
// 2026-08-07 踩到的坑:Apps Script 專案時區與 Sheet 時區都設 (GMT+08:00) 台北,
// 但 appendRow 寫入 new Date() 後,顯示出來仍是 UTC-7(整整差 15 小時、日期跳前一天)。
// 與其追查是哪一層在換算,直接把時間格式化成字串寫進去 —— 環境怎麼設都不會再錯。
// 代價:欄位是文字不是日期值,但 yyyy/MM/dd HH:mm:ss 這個格式字串排序 = 時間排序,夠用。
function nowTaipei_() {
  return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
}

// 診斷用:在編輯器選這個函式執行,看「執行記錄」印出各層時區
function checkTimeZones() {
  const scriptTz = Session.getScriptTimeZone();
  const sheetTz  = ss_().getSpreadsheetTimeZone();
  Logger.log('腳本時區      : ' + scriptTz);
  Logger.log('試算表時區    : ' + sheetTz);
  Logger.log('new Date()    : ' + new Date());
  Logger.log('台北格式化    : ' + nowTaipei_());
  Logger.log('如果「台北格式化」跟你手機上的時間一致,寫入就是對的。');
}

const CLASS_MAP = {
  'taichung-tue': {
    tab: '台中週二班', label: '台中 · 週二班', location: '中興大學田徑場',
    weekly: '每週二 19:30–21:00', start: '9/22（二）',
    warmups: '9/3、9/10、9/17（週四）'   // 台中場的銜接團練一律在週四
  },
  'taipei-wed': {
    tab: '台北週三班', label: '台北 · 週三班', location: '台北田徑場',
    weekly: '每週三 19:30–21:00', start: '9/23（三）',
    warmups: '9/2、9/9、9/16（週三）'
  },
  'taichung-thu': {
    tab: '台中週四班', label: '台中 · 週四班', location: '中興大學田徑場',
    weekly: '每週四 19:30–21:00', start: '9/24（四）',
    warmups: '9/3、9/10、9/17（週四）'
  }
};

// 整期方案(會拿到 12 堂 + 銜接團練 + Premium)。C 單堂與 T 免費團練不在此列。
const FULL_TERM_PLANS = ['A', 'B', 'D', 'E', 'F'];

const PLAN_MAP = {
  A: '(A) 新生 · 團課 × 12 堂',
  B: '(B) 舊生 · 團課 × 12 堂',
  C: '(C) 初次單堂體驗課',
  D: '(D) 插班報名 × 剩餘堂數',
  E: '(E) 兩人同行 · 新生完整 12 堂',
  F: '(F) 三人同行 · 新生完整 12 堂',
  G: '(G) 個人課表 / 4 週',
  T: '(T) 9 月銜接團練 · 單場體驗(免費)'
};

// 免費方案:不需匯款,狀態不進「待匯款」,確認信也不提匯款
const FREE_PLANS = ['T'];

// 9 月第一場銜接團練(對外開放的那場)日期,依班別
// 台中場一律在週四、台北場一律在週三(9/1 與 9/3 撞本期週二班順延的課,已於 8/7 調整)
// 只放日期時間,地點交給信裡的「地點」欄(取 CLASS_MAP.location),避免同一封信講兩次
const TRIAL_SESSION = {
  'taichung-tue': '9/03（四）19:30',
  'taipei-wed':   '9/02（三）19:30',
  'taichung-thu': '9/03（四）19:30'
};

const HEADERS = ['報名時間','姓名','LINE','Email','跑步能力','方案','方案說明','匯款金額','匯款後五碼','備註','同意條款','狀態','入群日期','首週出席','教練備註','成功信寄出'];

// 欄位位置(1-based),改 HEADERS 時這裡要一起改
const COL = { EMAIL: 4, PLAN: 6, NAME: 2, STATUS: 12, SUCCESS_MAIL: 16 };
const STATUS_PAID = '已匯款';   // 狀態改成這個值 → 自動寄出報名成功信

// ====== 執行一次:建立三個分頁 + 表頭 + 狀態下拉 ======
// ⚠️ 非破壞性:已經有報名資料的分頁不會被清掉,只補表頭與下拉。
//    (舊版這裡是 sheet.clear(),誤跑一次就會清光整期報名資料)
function setup() {
  const ss = ss_();
  Object.values(CLASS_MAP).forEach(c => {
    const existed = !!ss.getSheetByName(c.tab);
    let sheet = ss.getSheetByName(c.tab) || ss.insertSheet(c.tab);
    const hasData = existed && sheet.getLastRow() > 1;
    if (hasData) {
      Logger.log(`分頁「${c.tab}」已有 ${sheet.getLastRow() - 1} 筆資料,保留不動。`);
    }
    sheet.getRange(1, 1, 1, HEADERS.length)
      .setValues([HEADERS])
      .setFontWeight('bold')
      .setBackground('#1f3a2d')
      .setFontColor('#f1ede2');
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, HEADERS.length);

    // 狀態欄(L 欄)下拉選單。改成「已匯款」會自動寄出報名成功信(見 onStatusEdit)
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['待匯款','已匯款','已入群','正式開課','已退費','免費團練'], true)
      .build();
    sheet.getRange(2, COL.STATUS, 500, 1).setDataValidation(rule);

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

    const ss = ss_();
    const sheet = ss.getSheetByName(cls.tab);
    const planLabel = PLAN_MAP[data.plan] || data.plan || '';
    const isFree = FREE_PLANS.indexOf(data.plan) !== -1;

    sheet.appendRow([
      nowTaipei_(),
      data.name || '',
      data.line || '',
      data.email || '',
      data.running || '',
      data.plan || '',
      planLabel,
      isFree ? '免費' : (data.amount || ''),
      isFree ? '—' : (data.last5 || ''),
      data.notes || '',
      data.agree ? '是' : '否',
      isFree ? '免費團練' : '待匯款',
      '', '', ''
    ]);

    // 學員確認信(免費團練走不提匯款的版本)
    if (data.email) {
      MailApp.sendEmail({
        to: data.email,
        subject: isFree
          ? `【傑西跑班】已收到你的免費團練報名 | ${cls.label}`
          : `【傑西跑班】${cls.label} | 已收到你的報名`,
        htmlBody: isFree
          ? trialEmail(data, cls, planLabel)
          : studentEmail(data, cls, planLabel)
      });
    }

    // 你的通知信
    MailApp.sendEmail({
      to: NOTIFY_EMAIL,
      subject: isFree
        ? `🌿 免費團練報名:${cls.label} | ${data.name}`
        : `🎉 新報名:${cls.label} | ${data.name}`,
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

// ==========================================================
// 匯款確認 → 自動寄「報名成功」信
//
// 在 Sheet 把「狀態」欄改成「已匯款」就會自動寄出,不用另外做事。
// ⚠️ 這需要「可安裝觸發器」:簡單的 onEdit(e) 沒有寄信權限。
//    第一次使用請在編輯器執行一次 installTriggers()。
// ==========================================================

function installTriggers() {
  // 先清掉同名的舊觸發器,否則重複安裝會讓一次編輯寄出多封信
  let removed = 0;
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'onStatusEdit') { ScriptApp.deleteTrigger(t); removed++; }
  });
  ScriptApp.newTrigger('onStatusEdit').forSpreadsheet(SHEET_ID).onEdit().create();
  Logger.log(`✅ 觸發器已安裝(清掉 ${removed} 個舊的)。現在把狀態改成「${STATUS_PAID}」就會自動寄報名成功信。`);
}

function onStatusEdit(e) {
  try {
    if (!e || !e.range) return;
    const sheet = e.range.getSheet();

    // 防呆 1:只認三個班別分頁,其他分頁一律不動作
    const known = Object.values(CLASS_MAP).some(c => c.tab === sheet.getName());
    if (!known) return;

    // 防呆 2:只認狀態欄,且一次只處理單一儲存格(避免整欄貼上時爆寄)
    if (e.range.getColumn() !== COL.STATUS) return;
    if (e.range.getNumRows() !== 1 || e.range.getNumColumns() !== 1) return;

    // 防呆 3:只在「改成已匯款」時觸發
    if (String(e.value || '').trim() !== STATUS_PAID) return;

    const row = e.range.getRow();
    if (row < 2) return;   // 表頭

    // 防呆 4:已經寄過就不再寄(重點:避免狀態改來改去重複轟炸學員)
    const sentCell = sheet.getRange(row, COL.SUCCESS_MAIL);
    if (String(sentCell.getValue() || '').trim() !== '') return;

    const email = String(sheet.getRange(row, COL.EMAIL).getValue() || '').trim();
    const name  = String(sheet.getRange(row, COL.NAME).getValue() || '').trim();
    const plan  = String(sheet.getRange(row, COL.PLAN).getValue() || '').trim();

    // 防呆 5:沒有 email 就記一筆,不要靜默失敗
    if (!email) { sentCell.setValue('⚠️ 無 Email,未寄出'); return; }

    // 防呆 6:免費團練不該走這條(他們的狀態是「免費團練」,理論上進不來,再擋一次)
    if (FREE_PLANS.indexOf(plan) !== -1) { sentCell.setValue('—(免費團練不寄)'); return; }

    const clsKey = Object.keys(CLASS_MAP).find(k => CLASS_MAP[k].tab === sheet.getName());
    const cls = CLASS_MAP[clsKey];

    MailApp.sendEmail({
      to: email,
      subject: `【傑西跑班】報名成功 | ${cls.label} ${cls.start} 開課`,
      htmlBody: successEmail({ name: name, plan: plan }, cls)
    });
    sentCell.setValue(nowTaipei_());

  } catch (err) {
    // 出錯不要吞掉:寫回該列,你在 Sheet 上就看得到
    try {
      e.range.getSheet().getRange(e.range.getRow(), COL.SUCCESS_MAIL)
        .setValue('❌ 寄送失敗:' + err.message);
    } catch (e2) {}
    Logger.log('onStatusEdit 失敗:' + err.message);
  }
}

// 報名成功信(確認匯款後寄)
function successEmail(d, cls) {
  const isFullTerm = FULL_TERM_PLANS.indexOf(d.plan) !== -1;

  const fullTermRows = `
    <tr><td style="padding:6px 12px;color:#4a5d51">開課日</td><td style="padding:6px 12px"><b>${cls.start}</b> · 全期 12 堂</td></tr>
    <tr><td style="padding:6px 12px;color:#4a5d51">加碼</td><td style="padding:6px 12px">
      9 月銜接團練 3 場（${cls.warmups}）· 免費、不計入 12 堂<br>
      「慢慢進步」Premium 線上社群 · 4 個月
    </td></tr>`;

  const fullTermNext = `
  <h3 style="margin-top:24px">接下來會收到什麼</h3>
  <ol>
    <li><b>班級 LINE 群邀請</b>：交通方式、雨天備案、每週課表都在群裡。</li>
    <li><b>銜接團練通知</b>：9 月開課前有 3 場免費團練（${cls.warmups}），時間地點會另外通知。</li>
    <li><b>Premium 社群開通</b>：開課當週幫你開通，用到 2027/1/31。</li>
  </ol>
  <p style="margin-top:12px">開課前不用做任何準備，穿平常跑步的裝備來就好。</p>`;

  const singleNext = `
  <h3 style="margin-top:24px">接下來</h3>
  <p>單堂體驗的上課日期以我們私訊確認的那一天為準。當天穿平常跑步的裝備來就好，記得帶水。</p>`;

  return `
<div style="font-family:sans-serif;line-height:1.7;color:#1f3a2d;max-width:560px">
  <h2 style="color:#1f3a2d;margin-bottom:8px">嗨 ${d.name}，報名成功了 🎉</h2>
  <p>匯款已經核對完成，<b>位子確定是你的</b>。</p>
  <table style="border-collapse:collapse;margin:12px 0">
    <tr><td style="padding:6px 12px;color:#4a5d51">班級</td><td style="padding:6px 12px"><b>${cls.label}</b></td></tr>
    <tr><td style="padding:6px 12px;color:#4a5d51">地點</td><td style="padding:6px 12px">${cls.location}</td></tr>
    <tr><td style="padding:6px 12px;color:#4a5d51">時間</td><td style="padding:6px 12px">${cls.weekly}</td></tr>
    ${isFullTerm ? fullTermRows : ''}
  </table>
  ${isFullTerm ? fullTermNext : singleNext}
  <p style="margin-top:24px;color:#4a5d51;font-size:13px">有任何問題歡迎私訊：<br>
  IG @jesse.coach.26  ·  LINE @104wzemj</p>
  <p style="color:#4a5d51;font-size:12px;margin-top:20px">— Soul Chill Running Club · 傑西跑班</p>
</div>`;
}

function studentEmail(d, cls, planLabel) {
  return `
<div style="font-family:sans-serif;line-height:1.7;color:#1f3a2d;max-width:560px">
  <h2 style="color:#1f3a2d;margin-bottom:8px">嗨 ${d.name}，已經收到你的報名了 🙌</h2>
  <p>以下是你填的內容，確認一下有沒有錯：</p>
  <table style="border-collapse:collapse;margin:12px 0">
    <tr><td style="padding:6px 12px;color:#4a5d51">班級</td><td style="padding:6px 12px"><b>${cls.label}</b>(${cls.location})</td></tr>
    <tr><td style="padding:6px 12px;color:#4a5d51">方案</td><td style="padding:6px 12px">${planLabel}</td></tr>
    <tr><td style="padding:6px 12px;color:#4a5d51">匯款金額</td><td style="padding:6px 12px">NT$ ${d.amount || '—'}</td></tr>
    <tr><td style="padding:6px 12px;color:#4a5d51">後五碼</td><td style="padding:6px 12px">${d.last5 || '—'}</td></tr>
  </table>
  <h3 style="margin-top:24px">接下來</h3>
  <ol>
    <li>我們核對到你的匯款後，會在 <b>3 個工作天內</b> 寄出報名成功通知。<b>收到那封信，才是報名完成。</b></li>
    <li>報名成功後會再邀請你加入班級 LINE 群，交通方式、雨天備案、上課細節都在群裡同步。</li>
    <li>如果還沒匯款，記得完成，位子才會保留給你。</li>
  </ol>
  <p style="margin-top:24px;color:#4a5d51;font-size:13px">有任何問題歡迎私訊：<br>
  IG @jesse.coach.26  ·  LINE @104wzemj</p>
  <p style="color:#4a5d51;font-size:12px;margin-top:20px">— Soul Chill Running Club · 傑西跑班</p>
</div>`;
}

// 免費銜接團練確認信。
// 免費場次只寄這一封,收到就算報名成功(不另外寄第二封確認)。
// 集合細節與注意事項統一在活動當週的星期一另外寄。
function trialEmail(d, cls, planLabel) {
  const when = TRIAL_SESSION[d.class] || '9 月上半第一場（實際日期會再通知）';
  return `
<div style="font-family:sans-serif;line-height:1.7;color:#1f3a2d;max-width:560px">
  <h2 style="color:#1f3a2d;margin-bottom:8px">嗨 ${d.name}，報名成功 🌿</h2>
  <p>你已經成功報名 9 月開課前的<b>銜接團練</b>，免費參加。</p>
  <table style="border-collapse:collapse;margin:12px 0">
    <tr><td style="padding:6px 12px;color:#4a5d51">場次</td><td style="padding:6px 12px"><b>${when}</b></td></tr>
    <tr><td style="padding:6px 12px;color:#4a5d51">班別</td><td style="padding:6px 12px">${cls.label}</td></tr>
    <tr><td style="padding:6px 12px;color:#4a5d51">地點</td><td style="padding:6px 12px">${cls.location}</td></tr>
    <tr><td style="padding:6px 12px;color:#4a5d51">費用</td><td style="padding:6px 12px"><b>免費</b></td></tr>
  </table>
  <h3 style="margin-top:24px">課前通知</h3>
  <p>我們會在活動當週的<b>星期一（8/31）</b>再寄一封信給你，內容包含：</p>
  <ul style="margin:8px 0 0;padding-left:20px">
    <li>集合的確切位置</li>
    <li>當天需要攜帶的物品</li>
  </ul>
  <p style="margin-top:12px">如果因為天氣或其他因素需要調整時間或地點，也會在那封信裡一併告訴你。</p>
  <p style="margin-top:20px;padding:12px 14px;background:#f1ede2;border-radius:8px;font-size:13.5px">
    <b>提醒：</b>9/8 起的另外兩場團練，是留給已經報名整期課程的學員。<br>
    如果你上完這場想接著跟，再跟我們說，我們會告訴你怎麼報名整期。
  </p>
  <p style="margin-top:24px;color:#4a5d51;font-size:13px">有任何問題歡迎私訊：<br>
  IG @jesse.coach.26  ·  LINE @104wzemj</p>
  <p style="color:#4a5d51;font-size:12px;margin-top:20px">— Soul Chill Running Club · 傑西跑班</p>
</div>`;
}

function adminEmail(d, cls, planLabel) {
  const ssId = SHEET_ID;
  const isFree = FREE_PLANS.indexOf(d.plan) !== -1;
  return `
<div style="font-family:sans-serif;line-height:1.7">
  <h2>${isFree ? '🌿 免費團練報名' : '🎉 新報名'}:${cls.label}</h2>
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
