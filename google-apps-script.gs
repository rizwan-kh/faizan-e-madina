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

// Which sheet tab to write (first tab by default).
function getSheet_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
}

// Save handler — receives JSON from the admin form.
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents || "{}");

    var secret = PropertiesService.getScriptProperties().getProperty("ADMIN_PASSWORD");
    if (!secret || body.password !== secret) {
      return json_({ ok: false, error: "Wrong password." });
    }

    var v = body.values || {};
    var rows = [
      ["Prayer", "Iqamah"],
      ["Fajr", str_(v.fajr)],
      ["Dhuhr", str_(v.dhuhr)],
      ["Asr", str_(v.asr)],
      ["Maghrib", str_(v.maghrib)],
      ["Isha", str_(v.isha)],
      ["Jummah Khutbah", str_(v.jummahKhutbah)],
      ["Jummah Iqamah", str_(v.jummahIqamah)]
    ];

    var anns = Array.isArray(body.announcements) ? body.announcements : [];
    anns.forEach(function (text, i) {
      var t = str_(text);
      if (t) rows.push(["Announcement " + (i + 1), t]);
    });

    var sheet = getSheet_();
    sheet.clearContents();
    var range = sheet.getRange(1, 1, rows.length, 2);
    range.setNumberFormat("@");      // store as plain text (keep "6:00 AM" as typed)
    range.setValues(rows);

    return json_({ ok: true, rows: rows.length });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

// Simple health check when opened in a browser.
function doGet() {
  return json_({ ok: true, service: "faizan-e-madina admin" });
}

function str_(x) {
  return (x === null || x === undefined) ? "" : String(x).trim();
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
