/**
 * 영복교회 성도 돌봄 — 서버 코드 (Google Apps Script)
 * made by. Nevertheless_D
 *
 * 처음 설치할 때: 위쪽 함수 목록에서 setup 을 골라 한 번 실행하세요.
 * 접속 코드는 스프레드시트의 "설정" 탭에서 바꿀 수 있어요.
 * 이미 설치했다면: 이 파일로 바꾼 뒤 setup 을 한 번 더 실행하면 새 설정만 더해져요(기존 데이터는 그대로).
 */

var APP_NAME = '영복교회 성도 돌봄';
var SHEET_NEW = '새가족';
var SHEET_PAT = '환우';
var SHEET_SET = '설정';
var SHEET_LOG = '변경기록';
var SHEET_BULK = '일괄입력';
var SHEET_PREG = '임신';

var NEW_COLS = ['ID', '연번', '가족ID', '관계', '신앙세대주', '이름', '성별', '연생', '등록일', '인도자',
  '사진파일ID', '사진썸네일', '1강', '2강', '3강', '4강', '등록심방', '전도회', '목장연결', '목장', '신급',
  '수료식', '완료일', '수정일시', '수정코드'];
var PAT_COLS = ['ID', '이름', '성별', '연생', '병명', '병원', '상황', '상황메모', '다음진료일',
  '사진파일ID', '사진썸네일', '직분', '최근통화', '수정일시', '수정코드', '상황메모기록'];
var LOG_COLS = ['시간', '구분', '이름', '내용', '코드'];

// 사람이 고칠 수 있는 칸 (나머지는 서버가 관리)
var NEW_EDITABLE = ['관계', '신앙세대주', '이름', '성별', '연생', '등록일', '인도자', '1강', '2강', '3강', '4강',
  '등록심방', '전도회', '목장연결', '목장', '신급', '수료식'];
var PAT_EDITABLE = ['이름', '성별', '연생', '병명', '병원', '상황', '상황메모', '다음진료일', '직분', '최근통화'];
var PREG_COLS = ['ID', '이름', '연생', '아기성별', '출산예정일', '몇째', '메모', '조리원', '조리원입소', '조리원퇴소', '출산방법', '직분', '수정일시', '수정코드', '메모기록'];
var PREG_EDITABLE = ['이름', '연생', '아기성별', '출산예정일', '몇째', '메모', '조리원', '조리원입소', '조리원퇴소', '출산방법', '직분'];

var SETTING_CODE_MASTER = '마스터 코드';
var SETTING_CODE_VIEW = '새가족 보기 코드';
var SETTING_CODE_NEW = '새가족 수정 코드';
var SETTING_CODE_PAT = '환우 코드';
var SETTING_FARMS = '목장 목록';
var SETTING_FOLDER = '사진 폴더 ID';

var ROLE_LABEL = { master: '마스터 코드', newView: '새가족 보기 코드', newEdit: '새가족 수정 코드', patient: '마스터 코드', pregnancy: '마스터 코드' };

var TOKEN_DAYS = 180;      // 한 번 입력하면 이 기간 동안 로그인 유지 (쓸 때마다 다시 늘어나요)
var DEVICE_MAX_FAILS = 5;
var GLOBAL_MAX_FAILS = 30;
var LOCK_SECONDS = 600;
var TZ = 'Asia/Seoul';

/* ---------- 처음 설치 ---------- */

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet_(ss, SHEET_NEW, NEW_COLS);
  ensureSheet_(ss, SHEET_PAT, PAT_COLS);
  ensureSheet_(ss, SHEET_PREG, PREG_COLS);
  ensureSheet_(ss, SHEET_LOG, LOG_COLS);
  ensureBulkSheet_(ss);

  var set = ss.getSheetByName(SHEET_SET);
  if (!set) set = ss.insertSheet(SHEET_SET);
  set.getRange('A:C').setNumberFormat('@');
  if (set.getLastRow() === 0) {
    set.getRange(1, 1, 1, 3).setValues([['항목', '값', '설명']]).setFontWeight('bold');
    set.setFrozenRows(1);
  }
  var defaults = [
    [SETTING_CODE_MASTER, '0191', '모든 화면 보기·입력·수정'],
    [SETTING_CODE_VIEW, '7979', '새가족 정보를 볼 수 있어요'],
    [SETTING_CODE_NEW, '1004', '새가족 보기 + 등록·수정·사진'],
    [SETTING_FARMS, '', '쉼표로 나눠 적어요 (예: 은혜목장, 소망목장). 비워 두면 직접 입력해요'],
    [SETTING_FOLDER, '', '설치할 때 자동으로 채워져요. 지우지 마세요']
  ];
  defaults.forEach(function (d) {
    if (getSetting_(d[0]) === null) set.appendRow(d);
  });
  removeSetting_(SETTING_CODE_PAT); // 환우 코드는 없어졌어요(마스터 코드로만 열려요)
  set.autoResizeColumns(1, 3);

  var folderId = getSetting_(SETTING_FOLDER);
  var folderOk = false;
  if (folderId) {
    try { DriveApp.getFolderById(folderId); folderOk = true; } catch (e) { folderOk = false; }
  }
  if (!folderOk) {
    var folder = DriveApp.createFolder('영복교회 성도 돌봄 사진');
    setSetting_(SETTING_FOLDER, folder.getId());
  }

  var first = ss.getSheetByName('시트1') || ss.getSheetByName('Sheet1');
  if (first && first.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(first);
  Logger.log('설치가 끝났어요. 이제 "배포 → 새 배포"로 웹 앱을 만들어 주세요.');
}

function ensureSheet_(ss, name, cols) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
    sh.setFrozenRows(1);
  } else {
    var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    cols.forEach(function (c) {
      if (head.indexOf(c) < 0) {
        sh.getRange(1, sh.getLastColumn() + 1).setValue(c).setFontWeight('bold');
      }
    });
  }
  sh.getRange(1, 1, sh.getMaxRows(), sh.getLastColumn()).setNumberFormat('@');
  return sh;
}

/* ---------- 웹 앱 ---------- */

/* ---------- 새가족 일괄 입력 (스프레드시트 메뉴) ---------- */

var BULK_COLS = ['가족번호', '신앙세대주', '관계', '이름', '성별', '연생', '등록일', '인도자', '전도회', '목장', '신급',
  '1강', '2강', '3강', '4강', '등록심방', '수료식', '결과'];
var BULK_NOTES = {
  '가족번호': '같은 가족은 같은 숫자(1, 2, 3…)를 적어요. 혼자 등록하는 사람은 비워 두세요.',
  '신앙세대주': '가족 중 신앙세대주 한 명에게 O 를 적어요. 비워 두면 그 가족의 첫 줄이 신앙세대주가 돼요.',
  '관계': '본인, 남편, 아내, 아들, 딸, 아버지, 어머니, 형제자매, 기타',
  '이름': '꼭 적어야 해요.',
  '성별': '남 또는 여',
  '연생': '1978 처럼 네 자리',
  '등록일': '2026-10-13 처럼 적어요. 비워 두면 오늘 날짜가 들어가요.',
  '전도회': '4여전도회 처럼 적거나 숫자 4만 적어도 돼요(성별을 보고 붙여요).',
  '목장': '연결된 목장 이름. 비워 두면 미연결이에요.',
  '신급': '학습, 세례, 입교, 없음 중 하나',
  '1강': '들었으면 날짜나 O 를 적어요. O 는 등록일로 기록돼요. (2강·3강·4강·등록심방·수료식도 같아요)',
  '결과': '가져오기를 누르면 문제가 있는 줄에만 이유가 적혀요. 잘 들어간 줄은 이 탭에서 지워져요.'
};

function ensureBulkSheet_(ss) {
  var sh = ss.getSheetByName(SHEET_BULK);
  if (sh) return sh;
  sh = ss.insertSheet(SHEET_BULK);
  sh.getRange(1, 1, 1, BULK_COLS.length).setValues([BULK_COLS]).setFontWeight('bold');
  BULK_COLS.forEach(function (c, i) { if (BULK_NOTES[c]) sh.getRange(1, i + 1).setNote(BULK_NOTES[c]); });
  sh.setFrozenRows(1);
  sh.getRange(1, 1, sh.getMaxRows(), BULK_COLS.length).setNumberFormat('@');
  return sh;
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('성도 돌봄')
    .addItem('새가족 일괄입력 가져오기', 'importBulk')
    .addItem('일괄입력 탭 다시 만들기', 'makeBulkSheet')
    .addToUi();
}

function makeBulkSheet() {
  var sh = ensureBulkSheet_(SpreadsheetApp.getActiveSpreadsheet());
  SpreadsheetApp.getActiveSpreadsheet().setActiveSheet(sh);
}

function bulkDate_(v, fallback) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  var s = String(v === null || v === undefined ? '' : v).trim();
  if (!s) return '';
  if (/^[oO○◯0vV✓✔]$/.test(s) || s === '완료' || s === '참석') return fallback;
  var m = /^(\d{4})[-.\/ ]\s*(\d{1,2})[-.\/ ]\s*(\d{1,2})\.?$/.exec(s);
  if (!m) return null;
  return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
}

// 스프레드시트 메뉴 "성도 돌봄 → 새가족 일괄입력 가져오기"에서 실행해요
function importBulk() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  migrate_();
  var bulk = ensureBulkSheet_(ss);
  var res = importBulkRows_(bulk);
  try { SpreadsheetApp.getUi().alert(res.message); } catch (e) { Logger.log(res.message); }
  return res;
}

function importBulkRows_(bulk) {
  var last = bulk.getLastRow();
  if (last < 2) return { added: 0, failed: 0, message: '일괄입력 탭에 적힌 사람이 없어요. 2번째 줄부터 적어 주세요.' };
  var head = bulk.getRange(1, 1, 1, bulk.getLastColumn()).getValues()[0].map(String);
  if (head.indexOf('이름') < 0) return { added: 0, failed: 0, message: '일괄입력 탭 첫 줄의 제목이 바뀌었어요. 메뉴의 "일괄입력 탭 다시 만들기"를 써 주세요.' };
  var resultCol = head.indexOf('결과') >= 0 ? head.indexOf('결과') + 1 : head.length + 1;
  var vals = bulk.getRange(2, 1, last - 1, Math.max(head.length, BULK_COLS.length)).getValues();
  var items = [];
  vals.forEach(function (row, i) {
    var v = {};
    head.forEach(function (h, c) { if (h) v[h] = row[c]; });
    var any = BULK_COLS.some(function (c) { return c !== '결과' && String(v[c] === undefined ? '' : v[c]).trim() !== ''; });
    if (any) items.push({ r: i + 2, v: v });
  });
  var res = bulkProcess_(items, false, '일괄입력', '스프레드시트');
  Object.keys(res.errors).forEach(function (r) { bulk.getRange(Number(r), resultCol).setValue(res.errors[r]); });
  res.done.slice().sort(function (a, b) { return b - a; }).forEach(function (r) { bulk.deleteRow(r); });
  var failed = Object.keys(res.errors).length;
  var msg = res.done.length + '명을 새가족 명단에 넣었어요.' + (failed ? '\n' + failed + '줄은 넣지 못했어요. 일괄입력 탭의 "결과" 칸에서 이유를 보고 고친 뒤 다시 가져와 주세요.' : '');
  return { added: res.done.length, failed: failed, message: msg };
}

// 앱에서 엑셀 파일을 올려 한 번에 등록해요. dryRun 이면 저장하지 않고 확인 결과만 돌려줘요.
function bulkRegister(token, rows, dryRun) {
  var roles = auth_(token);
  need_(roles, 'newEdit');
  if (!Array.isArray(rows) || !rows.length) throw new Error('파일에서 사람을 찾지 못했어요.');
  if (rows.length > 500) throw new Error('한 번에 500줄까지 올릴 수 있어요. 파일을 나눠서 올려 주세요.');
  var items = rows.map(function (o, i) {
    var v = {};
    BULK_COLS.forEach(function (c) { if (o && o[c] !== undefined && o[c] !== null) v[c] = String(o[c]).slice(0, 200); });
    return { r: Number(o && o._row) || i + 2, v: v };
  });
  var res = bulkProcess_(items, !!dryRun, ROLE_LABEL[by_(roles, 'newEdit')], ROLE_LABEL[by_(roles, 'newEdit')]);
  var nameOf = {};
  items.forEach(function (it) { nameOf[it.r] = String(it.v['이름'] || '').trim(); });
  return {
    ok: true,
    dryRun: !!dryRun,
    people: res.done.length,
    families: res.famCount,
    errors: Object.keys(res.errors).map(function (r) { return { row: Number(r), name: nameOf[r] || '', msg: res.errors[r] }; })
      .sort(function (a, b) { return a.row - b.row; })
  };
}

function bulkProcess_(items, dryRun, codeLabel, logCode) {
  function get(it, c) { var x = it.v[c]; return x === undefined || x === null ? '' : x; }
  function str(it, c) { var x = get(it, c); return x instanceof Date ? Utilities.formatDate(x, TZ, 'yyyy-MM-dd') : String(x).trim(); }

  var existing = readRows_(SHEET_NEW).map(function (r) { return r['이름'] + '|' + r['연생']; });
  var seen = {};
  var groups = {}, order = [], errors = {};
  items.forEach(function (it) {
    var r = it.r;
    var name = str(it, '이름');
    if (!name) { if (str(it, '결과') === '') errors[r] = '이름이 비어 있어요.'; return; }
    var p = { _row: r, '이름': name.slice(0, 40) };
    var gender = str(it, '성별').replace(/^남자$|^남성$|^M$/i, '남').replace(/^여자$|^여성$|^F$/i, '여');
    if (gender && gender !== '남' && gender !== '여') { errors[r] = '성별은 남 또는 여로 적어 주세요.'; return; }
    p['성별'] = gender;
    var birth = str(it, '연생').replace(/\s/g, '').replace(/년생?$/, '');
    if (/^\d{4}[-.\/]/.test(birth)) birth = birth.slice(0, 4);
    if (/^\d{2}$/.test(birth)) birth = (Number(birth) > Number(today_().slice(2, 4)) ? '19' : '20') + birth;
    if (birth && !/^\d{4}$/.test(birth)) { errors[r] = '연생은 1978 처럼 네 자리로 적어 주세요.'; return; }
    p['연생'] = birth;
    var reg = bulkDate_(get(it, '등록일'), '');
    if (reg === null) { errors[r] = '등록일은 2026-10-13 처럼 적어 주세요.'; return; }
    p['등록일'] = reg || today_();
    p._regBlank = !reg;
    var bad = '';
    ['1강', '2강', '3강', '4강', '등록심방', '수료식'].forEach(function (k) {
      var d = bulkDate_(get(it, k), p['등록일']);
      if (d === null) bad = k; else p[k] = d;
    });
    if (bad) { errors[r] = bad + ' 칸은 날짜(2026-10-20)나 O 로 적어 주세요.'; return; }
    var mission = str(it, '전도회').replace(/\s/g, '');
    if (/^\d{1,2}$/.test(mission)) {
      if (!gender) { errors[r] = '전도회를 숫자만 적었다면 성별도 적어 주세요.'; return; }
      mission = mission + gender + '전도회';
    }
    var mm = /^(\d{1,2})(남|여)전도회$/.exec(mission);
    if (mission && (!mm || (mm[2] === '남' && +mm[1] > 10) || (mm[2] === '여' && +mm[1] > 15) || +mm[1] < 1)) { errors[r] = '전도회는 1~10남전도회, 1~15여전도회 중에서 적어 주세요.'; return; }
    p['전도회'] = mission;
    var farm = str(it, '목장');
    p['목장'] = farm.slice(0, 40);
    p['목장연결'] = farm ? 'Y' : 'N';
    var grade = str(it, '신급');
    if (grade && ['학습', '세례', '입교', '없음'].indexOf(grade) < 0) { errors[r] = '신급은 학습, 세례, 입교, 없음 중 하나로 적어 주세요.'; return; }
    p['신급'] = grade;
    p['관계'] = str(it, '관계').slice(0, 20);
    p['인도자'] = str(it, '인도자').slice(0, 40);
    p._head = /^[oO○◯vV✓✔]$|^예$|^Y$/i.test(str(it, '신앙세대주'));
    var key2 = p['이름'] + '|' + p['연생'];
    if (existing.indexOf(key2) >= 0) { errors[r] = '이미 새가족 명단에 같은 이름·연생이 있어요.'; return; }
    if (seen[key2]) { errors[r] = '파일 안에 같은 이름·연생이 두 번 있어요 (' + seen[key2] + '번째 줄).'; return; }
    seen[key2] = r;
    var key = str(it, '가족번호');
    key = key ? 'F' + key : 'S' + r;
    if (!groups[key]) { groups[key] = []; order.push(key); }
    groups[key].push(p);
  });

  // 가족 안에서 신앙세대주가 둘 이상이면 그 가족 전체를 보류해요
  order.forEach(function (k) {
    var heads = groups[k].filter(function (p) { return p._head; }).length;
    if (heads > 1) groups[k].forEach(function (p) { errors[p._row] = '한 가족에 신앙세대주가 두 명 이상이에요. 한 명만 O 로 적어 주세요.'; });
  });

  var done = [], famCount = 0;
  if (dryRun) {
    order.forEach(function (k) {
      var ms = groups[k].filter(function (p) { return !errors[p._row]; });
      if (!ms.length) return;
      ms.forEach(function (p) { done.push(p._row); });
      famCount++;
    });
    return { done: done, errors: errors, famCount: famCount };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sh = sheet_(SHEET_NEW);
    var maxNo = readRows_(SHEET_NEW).reduce(function (m, r) { return Math.max(m, Number(r['연번']) || 0); }, 0);
    order.forEach(function (k) {
      var ms = groups[k].filter(function (p) { return !errors[p._row]; });
      if (!ms.length) return;
      var hi = ms.findIndex(function (p) { return p._head; });
      if (hi < 0) hi = 0;
      var ids = ms.map(function () { return newId_('N'); });
      ms.forEach(function (p, i) {
        var o = {};
        Object.keys(p).forEach(function (key) { if (key.charAt(0) !== '_') o[key] = safe_(p[key], 200); });
        o['ID'] = ids[i];
        o['연번'] = String(++maxNo);
        o['가족ID'] = ids[hi];
        o['신앙세대주'] = i === hi ? 'Y' : 'N';
        if (!o['관계'] && ms.length === 1) o['관계'] = '본인';
        if (i !== hi && !o['인도자']) o['인도자'] = safe_(ms[hi]['인도자'] || '', 40);
        if (i !== hi && p._regBlank) o['등록일'] = ms[hi]['등록일'];
        o['수정일시'] = now_();
        o['수정코드'] = codeLabel;
        appendObj_(sh, o);
        done.push(p._row);
      });
      famCount++;
    });
    if (done.length) {
      appendObj_(sheet_(SHEET_LOG), { '시간': now_(), '구분': '새가족', '이름': '일괄입력', '내용': done.length + '명(' + famCount + '가정) 한 번에 등록', '코드': logCode });
      bumpVersion_();
    }
  } finally {
    lock.releaseLock();
  }
  return { done: done, errors: errors, famCount: famCount };
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle(APP_NAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

/* ---------- 설정 ---------- */

function settingsSheet_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SET);
}

function getSetting_(name) {
  var sh = settingsSheet_();
  if (!sh || sh.getLastRow() < 2) return null;
  var vals = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][0]).trim() === name) return String(vals[i][1]).trim();
  }
  return null;
}

// 환우 상황 이름이 바뀌었어요: 통원 치료 → 통원치료, 회복 중 → 가료
function renamePatientStatus_() {
  var sh = sheet_(SHEET_PAT);
  if (!sh || sh.getLastRow() < 2) return;
  var c = headers_(sh).indexOf('상황') + 1;
  if (!c) return;
  var range = sh.getRange(2, c, sh.getLastRow() - 1, 1);
  var map = { '통원 치료': '통원치료', '회복 중': '가료' };
  var vals = range.getValues().map(function (r) { var v = String(r[0]); return [map[v] || v]; });
  range.setValues(vals);
}

function removeSetting_(name) {
  var sh = settingsSheet_();
  if (!sh || sh.getLastRow() < 2) return;
  var vals = sh.getRange(1, 1, sh.getLastRow(), 1).getValues();
  for (var i = vals.length - 1; i >= 1; i--) {
    if (String(vals[i][0]).trim() === name) sh.deleteRow(i + 1);
  }
}

function setSetting_(name, value) {
  var sh = settingsSheet_();
  var vals = sh.getRange(1, 1, sh.getLastRow(), 1).getValues();
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][0]).trim() === name) {
      sh.getRange(i + 1, 2).setValue(String(value));
      return;
    }
  }
  sh.appendRow([name, String(value), '']);
}

/* ---------- 접속 코드 ---------- */

function roleForCode_(code) {
  if (!code || code.length < 4) return null;
  var map = [[SETTING_CODE_MASTER, 'master'], [SETTING_CODE_NEW, 'newEdit'], [SETTING_CODE_VIEW, 'newView']];
  for (var i = 0; i < map.length; i++) {
    var v = getSetting_(map[i][0]);
    if (codeEquals_(v, code)) return map[i][1];
  }
  return null;
}

// 시트가 0191 같은 코드를 숫자 191로 바꿔 저장해도 맞게 비교해요
function codeEquals_(stored, code) {
  if (!stored || !code) return false;
  if (stored === code) return true;
  return /^\d+$/.test(stored) && /^\d+$/.test(code) && stored.length < code.length &&
    new Array(code.length - stored.length + 1).join('0') + stored === code;
}

// 마스터 코드로 들어온 사람은 기록에 "마스터 코드"로 남겨요
function by_(roles, role) { return roles.indexOf('master') >= 0 ? 'master' : role; }

function login(code, deviceId, existingToken) {
  code = String(code || '').replace(/\s/g, '');
  deviceId = String(deviceId || 'none').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64) || 'none';
  var cache = CacheService.getScriptCache();
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (cache.get('lock_all') || cache.get('lock_' + deviceId)) {
      return { ok: false, locked: true, msg: '잠시 입력이 잠겼어요. 10분 뒤에 다시 해 주세요.' };
    }
    var role = roleForCode_(code);
    if (!role) {
      var n = Number(cache.get('fail_' + deviceId) || 0) + 1;
      cache.put('fail_' + deviceId, String(n), LOCK_SECONDS);
      var all = Number(cache.get('fail_all') || 0) + 1;
      cache.put('fail_all', String(all), LOCK_SECONDS);
      if (all >= GLOBAL_MAX_FAILS) cache.put('lock_all', '1', LOCK_SECONDS);
      if (n >= DEVICE_MAX_FAILS) {
        cache.put('lock_' + deviceId, '1', LOCK_SECONDS);
        return { ok: false, locked: true, msg: '5번 틀려서 10분 동안 입력이 잠겼어요.' };
      }
      return { ok: false, msg: '코드가 맞지 않아요. (' + (DEVICE_MAX_FAILS - n) + '번 남음)' };
    }
    cache.remove('fail_' + deviceId);
    var sess = existingToken ? readToken_(existingToken) : null;
    var token = sess && sess.codes ? existingToken : newToken_();
    var codes = sess && sess.codes ? sess.codes : {};
    codes[role] = codeHash_(token, code);
    writeToken_(token, codes);
    cleanupTokens_();
    return { ok: true, token: token, roles: rolesFromCodes_(token, codes), added: role };
  } finally {
    lock.releaseLock();
  }
}

function logout(token) {
  if (token) PropertiesService.getScriptProperties().deleteProperty('t_' + String(token).replace(/[^a-f0-9]/g, ''));
  return true;
}

function newToken_() {
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').toLowerCase();
}

function readToken_(token) {
  token = String(token || '').replace(/[^a-f0-9]/g, '');
  if (token.length < 32) return null;
  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty('t_' + token);
  if (!raw) return null;
  try {
    var s = JSON.parse(raw);
    if (!s.exp || s.exp < Date.now()) { props.deleteProperty('t_' + token); return null; }
    return s;
  } catch (e) { return null; }
}

// 로그인 정보: 어떤 코드로 들어왔는지(코드는 그대로 두지 않고 암호처럼 바꿔서) + 만료일
function writeToken_(token, codes) {
  var s = { codes: codes, exp: Date.now() + TOKEN_DAYS * 86400000 };
  PropertiesService.getScriptProperties().setProperty('t_' + token, JSON.stringify(s));
}

function codeHash_(token, code) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'yb|' + token + '|' + code, Utilities.Charset.UTF_8);
  return Utilities.base64Encode(bytes);
}

var CODE_SETTING_OF = { master: SETTING_CODE_MASTER, newEdit: SETTING_CODE_NEW, newView: SETTING_CODE_VIEW };

// 설정 탭의 코드가 바뀌면, 예전 코드로 들어온 기기는 그 권한을 잃어요
function codeStillValid_(token, role, hash) {
  var v = getSetting_(CODE_SETTING_OF[role]);
  if (!v) return false;
  var cands = [v];
  if (/^\d+$/.test(v)) for (var n = v.length + 1; n <= 8; n++) cands.push(new Array(n - v.length + 1).join('0') + v);
  return cands.some(function (c) { return c.length >= 4 && codeHash_(token, c) === hash; });
}

function rolesFromCodes_(token, codes) {
  var roles = [];
  function add(r) { if (roles.indexOf(r) < 0) roles.push(r); }
  Object.keys(codes || {}).forEach(function (role) {
    if (!CODE_SETTING_OF[role] || !codeStillValid_(token, role, codes[role])) return;
    if (role === 'master') ['master', 'newEdit', 'patient', 'pregnancy'].forEach(add);
    else add(role);
  });
  return roles;
}

function cleanupTokens_() {
  var props = PropertiesService.getScriptProperties();
  var all = props.getProperties();
  var now = Date.now();
  Object.keys(all).forEach(function (k) {
    if (k.indexOf('t_') !== 0) return;
    try { if (JSON.parse(all[k]).exp < now) props.deleteProperty(k); } catch (e) { props.deleteProperty(k); }
  });
}

function auth_(token) {
  var s = readToken_(token);
  if (!s) throw new Error('NEED_CODE');
  migrate_();
  var clean = String(token).replace(/[^a-f0-9]/g, '');
  if (!s.codes) {
    // 예전 방식(12시간) 로그인: 만료될 때까지만 그대로 써요
    if (!s.roles) throw new Error('NEED_CODE');
    if (s.roles.indexOf('master') >= 0) return ['master', 'newEdit', 'patient', 'pregnancy'];
    return s.roles.filter(function (r) { return r === 'newView' || r === 'newEdit'; });
  }
  var roles = rolesFromCodes_(clean, s.codes);
  var props = PropertiesService.getScriptProperties();
  if (!roles.length) { props.deleteProperty('t_' + clean); throw new Error('NEED_CODE'); }
  // 쓸 때마다 로그인 유지 기간을 다시 늘려요 (열흘에 한 번 정도만 저장)
  if (s.exp - Date.now() < (TOKEN_DAYS - 10) * 86400000) {
    s.exp = Date.now() + TOKEN_DAYS * 86400000;
    props.setProperty('t_' + clean, JSON.stringify(s));
  }
  return roles;
}

// 새 버전에서 늘어난 칸(수료식, 완료일 등)을 시트에 자동으로 더해요
var SCHEMA = '8';
function migrate_() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('schema') === SCHEMA) return;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet_(ss, SHEET_NEW, NEW_COLS);
  ensureSheet_(ss, SHEET_PAT, PAT_COLS);
  ensureSheet_(ss, SHEET_PREG, PREG_COLS);
  ensureSheet_(ss, SHEET_LOG, LOG_COLS);
  ensureBulkSheet_(ss);
  removeSetting_(SETTING_CODE_PAT);
  renamePatientStatus_();
  props.setProperty('schema', SCHEMA);
}

function canViewNew_(roles) { return roles.indexOf('newView') >= 0 || roles.indexOf('newEdit') >= 0; }
function need_(roles, role) {
  if (role === 'newView' ? !canViewNew_(roles) : roles.indexOf(role) < 0) throw new Error('NO_PERMISSION');
}
function editorLabel_(roles, role) { return ROLE_LABEL[role] || ''; }

/* ---------- 시트 읽기·쓰기 ---------- */

function sheet_(name) { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name); }

function cellToString_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  if (v === null || v === undefined) return '';
  return String(v);
}

function readRows_(name) {
  var sh = sheet_(name);
  if (!sh || sh.getLastRow() < 2) return [];
  var vals = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  var head = vals[0].map(String);
  var out = [];
  for (var r = 1; r < vals.length; r++) {
    var o = {};
    for (var c = 0; c < head.length; c++) o[head[c]] = cellToString_(vals[r][c]);
    if (o['ID']) out.push(o);
  }
  return out;
}

function headers_(sh) {
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
}

function findRow_(sh, id) {
  if (sh.getLastRow() < 2) return -1;
  var head = headers_(sh);
  var col = head.indexOf('ID') + 1;
  var ids = sh.getRange(2, col, sh.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return -1;
}

function safe_(v, max) {
  var s = String(v === null || v === undefined ? '' : v).slice(0, max || 500);
  if (/^[=+@]/.test(s)) s = "'" + s;
  return s;
}

function writeRow_(sh, row, obj) {
  var head = headers_(sh);
  var range = sh.getRange(row, 1, 1, head.length);
  var cur = range.getValues()[0];
  var arr = head.map(function (h, i) {
    return Object.prototype.hasOwnProperty.call(obj, h) ? obj[h] : cur[i];
  });
  range.setNumberFormat('@').setValues([arr]);
}

function appendObj_(sh, obj) {
  var row = Math.max(sh.getLastRow(), 1) + 1;
  if (row > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 20);
  writeRow_(sh, row, obj);
  return row;
}

function now_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'); }
function today_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }

function bumpVersion_() {
  PropertiesService.getScriptProperties().setProperty('ver', String(Date.now()));
}

function log_(kind, name, text, role) {
  var sh = sheet_(SHEET_LOG);
  appendObj_(sh, { '시간': now_(), '구분': kind, '이름': safe_(name, 50), '내용': safe_(text, 200), '코드': ROLE_LABEL[role] || '' });
}

function newId_(prefix) {
  return prefix + Utilities.getUuid().replace(/-/g, '').slice(0, 10);
}

/* ---------- 데이터 보내기 ---------- */

function getVersion(token) {
  auth_(token);
  return PropertiesService.getScriptProperties().getProperty('ver') || '0';
}

function getData(token) {
  var roles = auth_(token);
  var out = {
    roles: roles,
    today: today_(),
    version: PropertiesService.getScriptProperties().getProperty('ver') || '0',
    farms: (getSetting_(SETTING_FARMS) || '').split(',').map(function (s) { return s.trim(); }).filter(String),
    newcomers: null,
    patients: null,
    pregnancies: null,
    log: []
  };
  var viewNew = canViewNew_(roles);
  var viewPat = roles.indexOf('patient') >= 0;
  if (viewNew) out.newcomers = readRows_(SHEET_NEW).map(stripNew_);
  if (viewPat) out.patients = readRows_(SHEET_PAT).map(stripPat_);
  var viewPreg = roles.indexOf('pregnancy') >= 0;
  if (viewPreg) out.pregnancies = readRows_(SHEET_PREG);
  var logs = readLogRows_();
  out.log = logs.filter(function (l) {
    return (l['구분'] === '새가족' && viewNew) || (l['구분'] === '환우' && viewPat) || (l['구분'] === '임신' && viewPreg);
  }).slice(-20).reverse();
  return out;
}

function readLogRows_() {
  var sh = sheet_(SHEET_LOG);
  if (!sh || sh.getLastRow() < 2) return [];
  var start = Math.max(2, sh.getLastRow() - 199);
  var vals = sh.getRange(start, 1, sh.getLastRow() - start + 1, LOG_COLS.length).getValues();
  return vals.map(function (r) {
    var o = {};
    LOG_COLS.forEach(function (h, i) { o[h] = cellToString_(r[i]); });
    return o;
  });
}

function stripNew_(o) {
  var r = {};
  NEW_COLS.forEach(function (k) { if (k !== '사진파일ID') r[k] = o[k] || ''; });
  r.hasPhoto = !!o['사진파일ID'];
  return r;
}

function stripPat_(o) {
  var r = {};
  PAT_COLS.forEach(function (k) { if (k !== '사진파일ID') r[k] = o[k] || ''; });
  r.hasPhoto = !!o['사진파일ID'];
  return r;
}

/* ---------- 새가족 ---------- */

function pickNew_(p) {
  var o = {};
  NEW_EDITABLE.forEach(function (k) { if (p && Object.prototype.hasOwnProperty.call(p, k)) o[k] = safe_(p[k], k === '이름' ? 40 : 200); });
  return o;
}

function registerNewcomers(token, payload) {
  var roles = auth_(token);
  need_(roles, 'newEdit');
  var members = (payload && payload.members) || [];
  if (!members.length || members.length > 20) throw new Error('가족 구성원을 확인해 주세요.');
  members.forEach(function (m) { if (!String(m['이름'] || '').trim()) throw new Error('이름을 모두 적어 주세요.'); });

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = sheet_(SHEET_NEW);
    var rows = readRows_(SHEET_NEW);
    var maxNo = rows.reduce(function (m, r) { return Math.max(m, Number(r['연번']) || 0); }, 0);
    var familyId = payload.familyId ? String(payload.familyId) : '';
    var existingFamily = familyId && rows.some(function (r) { return r['가족ID'] === familyId; });
    if (familyId && !existingFamily) familyId = '';

    var ids = members.map(function () { return newId_('N'); });
    var headIndex = -1;
    if (!existingFamily) {
      headIndex = members.findIndex(function (m) { return m['신앙세대주'] === 'Y'; });
      if (headIndex < 0) headIndex = 0;
      familyId = ids[headIndex];
    }
    var common = payload.common || {};
    var names = [];
    members.forEach(function (m, i) {
      var o = pickNew_(m);
      o['ID'] = ids[i];
      o['연번'] = String(maxNo + i + 1);
      o['가족ID'] = familyId;
      o['신앙세대주'] = (i === headIndex) ? 'Y' : 'N';
      if (!o['등록일']) o['등록일'] = safe_(common['등록일'] || today_(), 20);
      if (!o['인도자'] && common['인도자']) o['인도자'] = safe_(common['인도자'], 40);
      if (!o['관계']) o['관계'] = members.length === 1 && !existingFamily ? '본인' : '';
      o['수정일시'] = now_();
      o['수정코드'] = ROLE_LABEL[by_(roles, 'newEdit')];
      appendObj_(sh, o);
      names.push(o['이름']);
    });
    log_('새가족', names[0], existingFamily ? '가족 추가: ' + names.join(', ') : (members.length > 1 ? '가족 ' + members.length + '명 등록' : '새가족 등록'), by_(roles, 'newEdit'));
    bumpVersion_();
    return { ok: true, ids: ids, familyId: familyId };
  } finally {
    lock.releaseLock();
  }
}

function updateNewcomer(token, id, changes) {
  var roles = auth_(token);
  need_(roles, 'newEdit');
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = sheet_(SHEET_NEW);
    var row = findRow_(sh, id);
    if (row < 0) throw new Error('이 사람을 찾을 수 없어요. 새로고침해 주세요.');
    var o = pickNew_(changes);
    if (o['이름'] !== undefined && !o['이름'].trim()) throw new Error('이름을 적어 주세요.');
    var rows = readRows_(SHEET_NEW);
    var me = rows.filter(function (r) { return r['ID'] === String(id); })[0];
    if (o['신앙세대주'] === 'Y' && me['신앙세대주'] !== 'Y') {
      rows.forEach(function (r) {
        if (r['가족ID'] === me['가족ID'] && r['ID'] !== me['ID'] && r['신앙세대주'] === 'Y') {
          writeRow_(sh, findRow_(sh, r['ID']), { '신앙세대주': 'N' });
        }
      });
    } else if (o['신앙세대주'] === 'N' && me['신앙세대주'] === 'Y') {
      delete o['신앙세대주'];
    }
    o['수정일시'] = now_();
    o['수정코드'] = ROLE_LABEL[by_(roles, 'newEdit')];
    writeRow_(sh, row, o);
    log_('새가족', o['이름'] || me['이름'], describeNewChange_(me, o), by_(roles, 'newEdit'));
    bumpVersion_();
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function describeNewChange_(before, after) {
  var parts = [];
  ['1강', '2강', '3강', '4강'].forEach(function (k) {
    if (after[k] !== undefined && after[k] && !before[k]) parts.push('새가족교육 ' + k + ' 완료');
  });
  if (after['등록심방'] && !before['등록심방']) parts.push('등록심방 완료');
  if (after['목장'] !== undefined && after['목장'] && after['목장'] !== before['목장']) parts.push('목장 연결 · ' + after['목장']);
  if (after['신급'] !== undefined && after['신급'] !== before['신급']) parts.push('신급 ' + after['신급']);
  if (after['신앙세대주'] === 'Y' && before['신앙세대주'] !== 'Y') parts.push('신앙세대주로 지정');
  if (after['수료식'] && !before['수료식']) parts.push('수료식 참석');
  return parts.length ? parts.join(', ') : '정보 수정';
}

// 가족 전체를 "전체 완료" 명단으로 옮기거나(done=true) 다시 진행 중으로 되돌려요(done=false)
function completeFamily(token, familyId, done) {
  var roles = auth_(token);
  need_(roles, 'newEdit');
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = sheet_(SHEET_NEW);
    var members = readRows_(SHEET_NEW).filter(function (r) { return (r['가족ID'] || r['ID']) === String(familyId); });
    if (!members.length) throw new Error('이 가정을 찾을 수 없어요. 새로고침해 주세요.');
    var value = done ? today_() : '';
    members.forEach(function (m) {
      writeRow_(sh, findRow_(sh, m['ID']), { '완료일': value, '수정일시': now_(), '수정코드': ROLE_LABEL[by_(roles, 'newEdit')] });
    });
    var head = members.filter(function (m) { return m['신앙세대주'] === 'Y'; })[0] || members[0];
    log_('새가족', head['이름'], done ? (members.length > 1 ? '가족 ' + members.length + '명 전체 완료' : '전체 완료') : '완료 취소 · 진행 중으로', by_(roles, 'newEdit'));
    bumpVersion_();
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function deleteNewcomer(token, id) {
  var roles = auth_(token);
  need_(roles, 'newEdit');
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = sheet_(SHEET_NEW);
    var rows = readRows_(SHEET_NEW);
    var me = rows.filter(function (r) { return r['ID'] === String(id); })[0];
    if (!me) throw new Error('이미 지워졌어요.');
    var rest = rows.filter(function (r) { return r['가족ID'] === me['가족ID'] && r['ID'] !== me['ID']; });
    if (me['신앙세대주'] === 'Y' && rest.length) {
      var heir = rest[0];
      writeRow_(sh, findRow_(sh, heir['ID']), { '신앙세대주': 'Y' });
      if (me['가족ID'] === me['ID']) {
        rest.forEach(function (r) { writeRow_(sh, findRow_(sh, r['ID']), { '가족ID': heir['ID'] }); });
      }
    }
    trashPhoto_(sh, findRow_(sh, id));
    sh.deleteRow(findRow_(sh, id));
    log_('새가족', me['이름'], '명단에서 삭제', by_(roles, 'newEdit'));
    bumpVersion_();
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

/* ---------- 환우 ---------- */

function savePatient(token, id, data) {
  var roles = auth_(token);
  need_(roles, 'patient');
  var o = {};
  PAT_EDITABLE.forEach(function (k) { if (data && Object.prototype.hasOwnProperty.call(data, k)) o[k] = safe_(data[k], k === '상황메모' ? 1000 : 200); });
  if (o['이름'] !== undefined && !o['이름'].trim()) throw new Error('이름을 적어 주세요.');
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = sheet_(SHEET_PAT);
    o['수정일시'] = now_();
    o['수정코드'] = ROLE_LABEL[by_(roles, 'patient')];
    var row = id ? findRow_(sh, id) : -1;
    if (id && row < 0) throw new Error('이 환우를 찾을 수 없어요. 새로고침해 주세요.');
    if (row < 0) {
      if (!o['이름']) throw new Error('이름을 적어 주세요.');
      id = newId_('P');
      o['ID'] = id;
      startMemo_(o, '상황메모', '상황메모기록');
      appendObj_(sh, o);
      log_('환우', o['이름'], '환우 등록', by_(roles, 'patient'));
    } else {
      var before = readRows_(SHEET_PAT).filter(function (r) { return r['ID'] === String(id); })[0];
      delete o['상황메모']; // 메모는 saveMemo 로만 바꿔요 (기록이 지워지지 않게)
      writeRow_(sh, row, o);
      var msg = [];
      if (o['상황'] && o['상황'] !== before['상황']) msg.push('상황 ' + o['상황']);
      if (o['다음진료일'] && o['다음진료일'] !== before['다음진료일']) msg.push('다음 진료일 ' + o['다음진료일']);
      if (o['최근통화'] && o['최근통화'] !== before['최근통화']) msg.push('통화 ' + o['최근통화']);
      log_('환우', o['이름'] || before['이름'], msg.join(', ') || '정보 수정', by_(roles, 'patient'));
    }
    bumpVersion_();
    return { ok: true, id: id };
  } finally {
    lock.releaseLock();
  }
}

function deletePatient(token, id) {
  var roles = auth_(token);
  need_(roles, 'patient');
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = sheet_(SHEET_PAT);
    var row = findRow_(sh, id);
    if (row < 0) throw new Error('이미 지워졌어요.');
    var name = readRows_(SHEET_PAT).filter(function (r) { return r['ID'] === String(id); })[0]['이름'];
    trashPhoto_(sh, row);
    sh.deleteRow(row);
    log_('환우', name, '명단에서 삭제', by_(roles, 'patient'));
    bumpVersion_();
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

/* ---------- 임신 ---------- */

function savePregnancy(token, id, data) {
  var roles = auth_(token);
  need_(roles, 'pregnancy');
  var o = {};
  PREG_EDITABLE.forEach(function (k) { if (data && Object.prototype.hasOwnProperty.call(data, k)) o[k] = safe_(data[k], k === '메모' ? 1000 : 100); });
  if (o['이름'] !== undefined && !o['이름'].trim()) throw new Error('이름을 적어 주세요.');
  if (o['아기성별'] && ['아들', '딸', '미정'].indexOf(o['아기성별']) < 0) throw new Error('아기 성별을 다시 골라 주세요.');
  if (o['출산방법'] && ['자연분만', '제왕절개', '미정'].indexOf(o['출산방법']) < 0) throw new Error('출산 방법을 다시 골라 주세요.');
  if (o['조리원입소'] && o['조리원퇴소'] && o['조리원퇴소'] < o['조리원입소']) throw new Error('조리원 퇴소일이 입소일보다 빨라요.');
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = sheet_(SHEET_PREG);
    o['수정일시'] = now_();
    o['수정코드'] = ROLE_LABEL[by_(roles, 'pregnancy')];
    var row = id ? findRow_(sh, id) : -1;
    if (id && row < 0) throw new Error('이 정보를 찾을 수 없어요. 새로고침해 주세요.');
    if (row < 0) {
      if (!o['이름']) throw new Error('이름을 적어 주세요.');
      id = newId_('B');
      o['ID'] = id;
      startMemo_(o, '메모', '메모기록');
      appendObj_(sh, o);
      log_('임신', o['이름'], '임신 등록' + (o['출산예정일'] ? ' · 예정일 ' + o['출산예정일'] : ''), by_(roles, 'pregnancy'));
    } else {
      var before = readRows_(SHEET_PREG).filter(function (r) { return r['ID'] === String(id); })[0];
      delete o['메모'];
      writeRow_(sh, row, o);
      var msg = [];
      if (o['출산예정일'] && o['출산예정일'] !== before['출산예정일']) msg.push('예정일 ' + o['출산예정일']);
      if (o['아기성별'] && o['아기성별'] !== before['아기성별']) msg.push('아기 ' + o['아기성별']);
      if ((o['조리원입소'] && o['조리원입소'] !== before['조리원입소']) || (o['조리원'] && o['조리원'] !== before['조리원'])) msg.push('조리원 일정 ' + (o['조리원입소'] || before['조리원입소'] || ''));
      log_('임신', o['이름'] || before['이름'], msg.join(', ') || '정보 수정', by_(roles, 'pregnancy'));
    }
    bumpVersion_();
    return { ok: true, id: id };
  } finally {
    lock.releaseLock();
  }
}

function deletePregnancy(token, id) {
  var roles = auth_(token);
  need_(roles, 'pregnancy');
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = sheet_(SHEET_PREG);
    var row = findRow_(sh, id);
    if (row < 0) throw new Error('이미 지워졌어요.');
    var name = readRows_(SHEET_PREG).filter(function (r) { return r['ID'] === String(id); })[0]['이름'];
    sh.deleteRow(row);
    log_('임신', name, '명단에서 삭제', by_(roles, 'pregnancy'));
    bumpVersion_();
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

/* ---------- 사진 ---------- */

function photoFolder_() {
  var id = getSetting_(SETTING_FOLDER);
  if (!id) throw new Error('사진 폴더가 없어요. setup 을 다시 실행해 주세요.');
  return DriveApp.getFolderById(id);
}

function trashPhoto_(sh, row) {
  if (row < 0) return;
  var head = headers_(sh);
  var c = head.indexOf('사진파일ID') + 1;
  if (!c) return;
  var fid = String(sh.getRange(row, c).getValue() || '');
  if (fid) { try { DriveApp.getFileById(fid).setTrashed(true); } catch (e) { } }
}

function decodeImage_(dataUrl, maxLen) {
  var m = /^data:image\/jpeg;base64,([A-Za-z0-9+\/=]+)$/.exec(String(dataUrl || ''));
  if (!m || m[1].length > maxLen) throw new Error('사진을 읽을 수 없어요. 다른 사진으로 해 주세요.');
  return m[1];
}

function uploadPhoto(token, kind, id, fullDataUrl, thumbDataUrl) {
  var roles = auth_(token);
  need_(roles, kind === 'patient' ? 'patient' : 'newEdit');
  var full = decodeImage_(fullDataUrl, 3000000);
  var thumb = decodeImage_(thumbDataUrl, 45000);
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = sheet_(kind === 'patient' ? SHEET_PAT : SHEET_NEW);
    var row = findRow_(sh, id);
    if (row < 0) throw new Error('먼저 저장한 뒤에 사진을 올려 주세요.');
    trashPhoto_(sh, row);
    var blob = Utilities.newBlob(Utilities.base64Decode(full), 'image/jpeg', (kind === 'patient' ? '환우_' : '새가족_') + id + '.jpg');
    var file = photoFolder_().createFile(blob);
    writeRow_(sh, row, { '사진파일ID': file.getId(), '사진썸네일': 'data:image/jpeg;base64,' + thumb });
    var name = (kind === 'patient' ? readRows_(SHEET_PAT) : readRows_(SHEET_NEW)).filter(function (r) { return r['ID'] === String(id); })[0]['이름'];
    log_(kind === 'patient' ? '환우' : '새가족', name, '사진 등록', by_(roles, kind === 'patient' ? 'patient' : 'newEdit'));
    bumpVersion_();
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function getPhoto(token, kind, id) {
  var roles = auth_(token);
  need_(roles, kind === 'patient' ? 'patient' : 'newView');
  var sh = sheet_(kind === 'patient' ? SHEET_PAT : SHEET_NEW);
  var row = findRow_(sh, id);
  if (row < 0) return null;
  var c = headers_(sh).indexOf('사진파일ID') + 1;
  var fid = String(sh.getRange(row, c).getValue() || '');
  if (!fid) return null;
  try {
    var blob = DriveApp.getFileById(fid).getBlob();
    return 'data:image/jpeg;base64,' + Utilities.base64Encode(blob.getBytes());
  } catch (e) { return null; }
}

/* ---------- 메모 기록 (환우 상황 메모 · 임신 메모) ----------
   '상황메모기록' / '메모기록' 칸에 [{id, d:날짜, t:내용, e:고친 날짜}] (오래된 것 → 최신).
   '상황메모' / '메모' 칸에는 늘 최신 메모 내용을 같이 둬요(시트에서 보기 쉽게). */

var MEMO_KIND = {
  pat: { sheet: SHEET_PAT, memo: '상황메모', hist: '상황메모기록', role: 'patient', label: '환우', what: '상황 메모' },
  preg: { sheet: SHEET_PREG, memo: '메모', hist: '메모기록', role: 'pregnancy', label: '임신', what: '메모' }
};

function memoList_(row, memoKey, histKey) {
  var list = [];
  try { list = JSON.parse(row[histKey] || '[]'); } catch (e) { list = []; }
  if (!Array.isArray(list)) list = [];
  if (!list.length && String(row[memoKey] || '').trim()) list = [{ id: 'm0', d: '', t: String(row[memoKey]) }];
  return list;
}

function startMemo_(o, memoKey, histKey) {
  var t = String(o[memoKey] || '').trim();
  o[memoKey] = t ? safe_(t, 1000) : '';
  o[histKey] = t ? JSON.stringify([{ id: newId_('m'), d: today_(), t: t.slice(0, 1000) }]) : '';
}

// op: { add: '내용' } | { edit: 기록id, text: '내용' } | { del: 기록id }
function saveMemo(token, kind, id, op) {
  var K = MEMO_KIND[kind];
  if (!K) throw new Error('잘못된 요청이에요.');
  var roles = auth_(token);
  need_(roles, K.role);
  op = op || {};
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = sheet_(K.sheet);
    var row = findRow_(sh, id);
    if (row < 0) throw new Error('찾을 수 없어요. 새로고침해 주세요.');
    var cur = readRows_(K.sheet).filter(function (r) { return r['ID'] === String(id); })[0];
    var list = memoList_(cur, K.memo, K.hist);
    var msg;
    if (op.add !== undefined) {
      var t = String(op.add || '').trim().slice(0, 1000);
      if (!t) throw new Error('메모 내용을 적어 주세요.');
      list.push({ id: newId_('m'), d: today_(), t: t });
      msg = K.what + ' 추가';
    } else {
      var idx = -1;
      list.forEach(function (m, i) { if (m.id === String(op.edit || op.del)) idx = i; });
      if (idx < 0) throw new Error('그 메모를 찾을 수 없어요. 새로고침해 주세요.');
      if (op.del !== undefined) {
        list.splice(idx, 1);
        msg = K.what + ' 하나 지움';
      } else {
        var t2 = String(op.text || '').trim().slice(0, 1000);
        if (!t2) throw new Error('메모 내용을 적어 주세요. 지우려면 "이 메모 지우기"를 눌러요.');
        list[idx].t = t2;
        list[idx].e = today_();
        msg = K.what + ' 고침';
      }
    }
    var json = JSON.stringify(list);
    if (json.length > 45000) throw new Error('메모 기록이 너무 많아요. 오래된 메모를 몇 개 지운 뒤 다시 해 주세요.');
    var o = {};
    o[K.hist] = list.length ? json : '';
    o[K.memo] = list.length ? safe_(list[list.length - 1].t, 1000) : '';
    o['수정일시'] = now_();
    o['수정코드'] = ROLE_LABEL[by_(roles, K.role)];
    writeRow_(sh, row, o);
    log_(K.label, cur['이름'], msg, by_(roles, K.role));
    bumpVersion_();
    return { ok: true, list: list, memo: o[K.memo] };
  } finally {
    lock.releaseLock();
  }
}
