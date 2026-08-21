/**
 * ============================================================
 *  Faizan-E-Madina — Admin save endpoint (Google Apps Script)
 * ============================================================
 *
 *  This lets the admin form (admin.html) write prayer times,
 *  Jummah times, and announcements into your Google Sheet.
 *
 *  ----------  ONE-TIME SETUP  ----------
 *  1. Open your times Google Sheet.
 *  2. Extensions → Apps Script. Delete any sample code and paste
 *     this whole file in.
 *  3. Set your admin password:
 *       Project Settings (gear icon) → Script properties →
 *       Add property:  name = ADMIN_PASSWORD   value = <your password>
 *     (Pick a password used only for this. Don't reuse an important one.)
 *  4. Deploy → New deployment → type "Web app".
 *       - Description: admin save
 *       - Execute as:  Me
 *       - Who has access:  Anyone
 *     Click Deploy, authorise when prompted, and COPY the Web app URL
 *     (it ends in /exec).
 *  5. Paste that /exec URL into config.adminApiUrl in js/data.js, commit/push.
 *
 *  Re-deploy (Deploy → Manage deployments → edit → Deploy) if you ever
 *  change this code.
 * ============================================================
 */

// The fixed time labels, in display order, mapped to the form field names.
var TIME_FIELDS = [
  ["Fajr", "fajr"],
  ["Dhuhr", "dhuhr"],
  ["Asr", "asr"],
  ["Maghrib", "maghrib"],
  ["Isha", "isha"],
  ["Jummah Khutbah", "jummahKhutbah"],
  ["Jummah Iqamah", "jummahIqamah"]
];

// Which sheet tab to write (first tab by default).
function getSheet_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
}

// Read the sheet into { values:{field:val}, announcements:[...] }.
function readSheet_() {
  var sheet = getSheet_();
  var data = sheet.getDataRange().getValues();
  var byLabel = {};
  var anns = [];
  data.forEach(function (r) {
    var label = str_(r[0]).toLowerCase();
    var val = str_(r[1]);
    if (!label || !val) return;
    if (label.indexOf("announce") === 0 || label.indexOf("notice") === 0 || label.indexOf("message") === 0) {
      anns.push(val);
    } else {
      byLabel[label] = val;
    }
  });
  var values = {};
  TIME_FIELDS.forEach(function (f) {
    values[f[1]] = byLabel[f[0].toLowerCase()] || "";
  });
  return { values: values, announcements: anns };
}

// Save handler — receives JSON from the admin form.
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    // Serialise concurrent saves so two admins can't interleave writes.
    lock.waitLock(20000);

    var body = JSON.parse(e.postData.contents || "{}");

    var secret = PropertiesService.getScriptProperties().getProperty("ADMIN_PASSWORD");
    if (!secret || body.password !== secret) {
      return json_({ ok: false, error: "Wrong password." });
    }

    var v = body.values || {};
    // Start from what's already in the sheet, so a blank field never wipes an
    // existing time — only non-empty submitted values overwrite.
    var current = readSheet_();
    var merged = {};
    TIME_FIELDS.forEach(function (f) {
      var incoming = str_(v[f[1]]);
      merged[f[1]] = incoming || current.values[f[1]] || "";
    });

    var rows = [["Prayer", "Iqamah"]];
    TIME_FIELDS.forEach(function (f) {
      rows.push([f[0], merged[f[1]]]);
    });

    // Announcements: replace with the submitted set (client sends the full,
    // non-empty list). If none submitted, keep the existing ones.
    var anns = Array.isArray(body.announcements)
      ? body.announcements.map(str_).filter(function (t) { return t; })
      : [];
    if (!anns.length) anns = current.announcements;
    anns.forEach(function (text, i) {
      rows.push(["Announcement " + (i + 1), text]);
    });

    var sheet = getSheet_();
    sheet.clearContents();
    var range = sheet.getRange(1, 1, rows.length, 2);
    range.setNumberFormat("@");      // store as plain text (keep "6:00 AM" as typed)
    range.setValues(rows);

    return json_({ ok: true, rows: rows.length });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

// Returns current sheet values so the admin form can prefill from the
// authoritative source (not the ~5-minute-cached published CSV).
function doGet() {
  try {
    var s = readSheet_();
    return json_({ ok: true, service: "faizan-e-madina admin", values: s.values, announcements: s.announcements });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function str_(x) {
  return (x === null || x === undefined) ? "" : String(x).trim();
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
