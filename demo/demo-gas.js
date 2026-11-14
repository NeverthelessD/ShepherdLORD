// 체험판: 구글 서비스(시트·드라이브·속성)를 브라우저 안에서 흉내 내요. 내용은 이 브라우저에만 저장돼요.
(function () {
  function Sheet(name) { this.name = name; this.data = []; }
  Sheet.prototype.getName = function () { return this.name; };
  Sheet.prototype.getLastRow = function () {
    for (var r = this.data.length - 1; r >= 0; r--) if (this.data[r].some(function (v) { return v !== '' && v !== null && v !== undefined; })) return r + 1;
    return 0;
  };
  Sheet.prototype.getLastColumn = function () {
    var m = 0; this.data.forEach(function (row) { for (var c = row.length - 1; c >= 0; c--) if (row[c] !== '' && row[c] !== undefined) { m = Math.max(m, c + 1); break; } });
    return m;
  };
  Sheet.prototype.getMaxRows = function () { return Math.max(1000, this.data.length); };
  Sheet.prototype.cell = function (r, c) { var row = this.data[r - 1]; return row && row[c - 1] !== undefined ? row[c - 1] : ''; };
  Sheet.prototype.put = function (r, c, v) { while (this.data.length < r) this.data.push([]); var row = this.data[r - 1]; while (row.length < c) row.push(''); row[c - 1] = v; };
  Sheet.prototype.getRange = function (a, b, c, d) {
    var sh = this;
    if (typeof a === 'string') { return new Range(sh, 1, 1, 1, 1); }
    return new Range(sh, a, b, c || 1, d || 1);
  };
  Sheet.prototype.appendRow = function (arr) { var r = this.getLastRow() + 1; for (var i = 0; i < arr.length; i++) this.put(r, i + 1, arr[i]); };
  Sheet.prototype.setFrozenRows = function () {};
  Sheet.prototype.autoResizeColumns = function () {};
  Sheet.prototype.insertRowsAfter = function () {};
  Sheet.prototype.deleteRow = function (r) { this.data.splice(r - 1, 1); };
  function Range(sh, r, c, nr, nc) { this.sh = sh; this.r = r; this.c = c; this.nr = nr; this.nc = nc; }
  Range.prototype.getValues = function () {
    var out = [];
    for (var i = 0; i < this.nr; i++) { var row = []; for (var j = 0; j < this.nc; j++) row.push(this.sh.cell(this.r + i, this.c + j)); out.push(row); }
    return out;
  };
  Range.prototype.getValue = function () { return this.sh.cell(this.r, this.c); };
  Range.prototype.setValues = function (vals) {
    if (vals.length !== this.nr || vals[0].length !== this.nc) throw new Error('setValues size mismatch ' + vals.length + 'x' + vals[0].length + ' vs ' + this.nr + 'x' + this.nc);
    for (var i = 0; i < this.nr; i++) for (var j = 0; j < this.nc; j++) this.sh.put(this.r + i, this.c + j, vals[i][j]);
    return this;
  };
  Range.prototype.setValue = function (v) { this.sh.put(this.r, this.c, v); return this; };
  Range.prototype.setNumberFormat = function () { return this; };
  Range.prototype.setFontWeight = function () { return this; };
  Range.prototype.setNote = function () { return this; };

  var KEY = 'yb_demo_state_v1';
  var saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { saved = null; }
  var sheets = saved ? saved.sheets.map(function (x) { var sh = new Sheet(x.name); sh.data = x.data; return sh; }) : [new Sheet('시트1')];
  window.__demoFresh = !saved;
  var ss = {
    getSheetByName: function (n) { return sheets.filter(function (s) { return s.name === n; })[0] || null; },
    insertSheet: function (n) { var s = new Sheet(n); sheets.push(s); return s; },
    getSheets: function () { return sheets.slice(); },
    deleteSheet: function (s) { sheets.splice(sheets.indexOf(s), 1); }
  };
  window.SpreadsheetApp = { getActiveSpreadsheet: function () { return ss; } };
  window.__sheets = sheets;

  var files = {}, nextId = saved && saved.nextId || 1;
  if (saved && saved.files) Object.keys(saved.files).forEach(function (k) { var f = saved.files[k]; files[k] = { blob: { getBytes: function () { return f.b; }, type: f.type, name: f.name }, trashed: f.trashed }; });
  function Folder(id) { this.id = id; }
  Folder.prototype.getId = function () { return this.id; };
  Folder.prototype.createFile = function (blob) {
    var id = 'file' + (nextId++);
    files[id] = { blob: blob, trashed: false };
    return { getId: function () { return id; } };
  };
  window.DriveApp = {
    createFolder: function () { return new Folder('folder1'); },
    getFolderById: function (id) { if (id !== 'folder1') throw new Error('no folder'); return new Folder(id); },
    getFileById: function (id) {
      var f = files[id]; if (!f) throw new Error('no file');
      return { getBlob: function () { return f.blob; }, setTrashed: function (t) { f.trashed = t; } };
    }
  };
  window.__files = files;

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  window.Utilities = {
    getUuid: function () { return crypto.randomUUID(); },
    formatDate: function (d, tz, fmt) {
      var s = fmt.replace('yyyy', d.getFullYear()).replace('MM', pad(d.getMonth() + 1)).replace('dd', pad(d.getDate()));
      return s.replace('HH', pad(d.getHours())).replace('mm', pad(d.getMinutes()));
    },
    base64Decode: function (s) { var bin = atob(s), out = []; for (var i = 0; i < bin.length; i++) out.push(bin.charCodeAt(i)); return out; },
    base64Encode: function (bytes) { var s = ''; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i] & 255); return btoa(s); },
    DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
    computeDigest: function (alg, str) { var h1 = 0x811c9dc5, h2 = 0x1234567, out = []; for (var i = 0; i < str.length; i++) { h1 = Math.imul(h1 ^ str.charCodeAt(i), 16777619) >>> 0; h2 = Math.imul(h2 + str.charCodeAt(i), 2654435761) >>> 0; } for (var j = 0; j < 8; j++) { out.push((h1 >>> (j * 4)) & 255, (h2 >>> (j * 4)) & 255); } return out; },
    newBlob: function (bytes, type, name) { return { getBytes: function () { return bytes; }, type: type, name: name }; }
  };
  var cache = {};
  window.CacheService = { getScriptCache: function () { return {
    get: function (k) { return cache.hasOwnProperty(k) ? cache[k] : null; },
    put: function (k, v) { cache[k] = String(v); },
    remove: function (k) { delete cache[k]; }
  }; } };
  window.__cache = cache;
  var props = saved ? saved.props : {};
  window.PropertiesService = { getScriptProperties: function () { return {
    getProperty: function (k) { return props.hasOwnProperty(k) ? props[k] : null; },
    setProperty: function (k, v) { props[k] = String(v); },
    deleteProperty: function (k) { delete props[k]; },
    getProperties: function () { return Object.assign({}, props); }
  }; } };
  window.__props = props;
  window.__demoSave = function () {
    var state = { sheets: sheets.map(function (x) { return { name: x.name, data: x.data }; }), props: props, nextId: nextId };
    try {
      var fl = {};
      Object.keys(files).forEach(function (k) { var f = files[k]; if (!f.trashed) fl[k] = { b: Array.from(f.blob.getBytes()), type: f.blob.type, name: f.blob.name, trashed: false }; });
      localStorage.setItem(KEY, JSON.stringify(Object.assign({ files: fl }, state)));
    } catch (e) {
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e2) {}
    }
  };
  window.LockService = { getScriptLock: function () { return { waitLock: function () {}, releaseLock: function () {} }; } };
  window.Logger = { log: function (m) { console.log('[Logger]', m); } };

  // google.script.run
  function runner(ok, fail) {
    return new Proxy({}, {
      get: function (t, name) {
        if (name === 'withSuccessHandler') return function (f) { return runner(f, fail); };
        if (name === 'withFailureHandler') return function (f) { return runner(ok, f); };
        return function () {
          var args = JSON.parse(JSON.stringify(Array.prototype.slice.call(arguments)));
          setTimeout(function () {
            try {
              var r = window[name].apply(null, args);
              window.__calls = (window.__calls || 0) + 1;
              if (name !== 'getVersion' && name !== 'getData' && name !== 'getPhoto') window.__demoSave();
              ok && ok(r === undefined ? null : JSON.parse(JSON.stringify(r)));
            } catch (e) { fail && fail(e instanceof Error ? e : new Error(String(e))); }
          }, 20);
        };
      }
    });
  }
  window.google = { script: { run: runner(null, null) } };
})();
