/* ============================================================
   App logic — renders the page from data.js
   No editing needed here to update prayer times.
   Change values in js/data.js instead.
   ============================================================ */

// -----------------------------------------------------------
//  Helpers
// -----------------------------------------------------------

// Parse "5:12 AM" into minutes-since-midnight (0..1439)
function timeToMinutes(str) {
  const m = str.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const period = m[3].toUpperCase();
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return h * 60 + min;
}

// Convert minutes-since-midnight back into "H:MM AM/PM"
function minutesTo12Hour(total) {
  total = ((total % 1440) + 1440) % 1440; // wrap into 0..1439
  const h24 = Math.floor(total / 60);
  const m = total % 60;
  return to12Hour(`${String(h24).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
}

// Resolve a prayer's iqamah into a display string.
// Supports a fixed string ("6:00 AM") or { offsetFromAthan: N }.
function resolveIqamah(p) {
  const iq = p.iqamah;
  if (iq && typeof iq === "object" && typeof iq.offsetFromAthan === "number") {
    const base = timeToMinutes(p.athan);
    if (base === null) return "";
    return minutesTo12Hour(base + iq.offsetFromAthan);
  }
  return iq;
}

// Convert 24-hour "HH:MM" (from the API) into "H:MM AM/PM"
function to12Hour(hhmm) {
  const clean = String(hhmm).trim().split(" ")[0]; // strip any "(EDT)" suffix
  const [hStr, mStr] = clean.split(":");
  let h = parseInt(hStr, 10);
  const m = mStr;
  const period = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${period}`;
}

// Current time in the masjid's timezone, as minutes-since-midnight
function masjidNowMinutes() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Toronto",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const o = {};
  parts.forEach((p) => (o[p.type] = p.value));
  let h = parseInt(o.hour, 10);
  if (h === 24) h = 0; // some environments emit "24" at midnight
  return h * 60 + parseInt(o.minute, 10);
}

// Today's date in the masjid's timezone, formatted DD-MM-YYYY for the API
function masjidDateForApi() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const o = {};
  parts.forEach((p) => (o[p.type] = p.value));
  return `${o.day}-${o.month}-${o.year}`;
}

// -----------------------------------------------------------
//  Fetch live START (Athan) times from the Aladhan API.
//  On success, overwrites the athan fields in prayerTimes.
//  Iqamah times are never touched — they stay masjid-specific.
//  Returns true if live times were applied, false on fallback.
// -----------------------------------------------------------
async function fetchAthanTimes() {
  if (!config.api || !config.api.enabled) return false;
  const a = config.api;
  const url =
    `https://api.aladhan.com/v1/timingsByCity/${masjidDateForApi()}` +
    `?city=${encodeURIComponent(a.city)}` +
    `&state=${encodeURIComponent(a.state || "")}` +
    `&country=${encodeURIComponent(a.country)}` +
    `&method=${a.method}&school=${a.school || 0}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("API responded " + res.status);
  const json = await res.json();
  const t = json && json.data && json.data.timings;
  if (!t) throw new Error("Unexpected API response");

  const map = {
    fajr: "Fajr", dhuhr: "Dhuhr", asr: "Asr", maghrib: "Maghrib", isha: "Isha",
  };
  Object.keys(map).forEach((key) => {
    const raw = t[map[key]];
    if (raw && prayerTimes[key]) prayerTimes[key].athan = to12Hour(raw);
  });

  // Informational sun times
  if (t.Sunrise) sunTimes.sunrise = to12Hour(t.Sunrise);
  if (t.Sunset) sunTimes.sunset = to12Hour(t.Sunset);

  return true;
}

// -----------------------------------------------------------
//  Admin-editable Iqamah times from a published Google Sheet.
//  The sheet is a simple two-column list: label, value. Example:
//    Fajr            6:00 AM
//    Dhuhr           2:00 PM
//    Asr             6:45 PM
//    Maghrib         +4          (minutes after the Maghrib start)
//    Isha            10:05 PM
//    Jummah Khutbah  1:30 PM
//    Jummah Iqamah   2:05 PM
//  Unknown/blank rows (e.g. a header row) are ignored.
//  Overrides only Iqamah/Jummah — never the API-driven Athan times.
// -----------------------------------------------------------

// Escape text coming from the (shared, editable) sheet before inserting as HTML
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

// Minimal CSV parser (handles quoted fields and commas within quotes)
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c === "\r") { /* ignore */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// Normalise a sheet time to the board's 12-hour format.
// Accepts "6:00 AM" (as-is), "06:00"/"18:45" (24-hour → 12-hour).
function toClock12(v) {
  // Strip seconds if a spreadsheet exports them (06:00:00 → 06:00)
  let val = v.trim().replace(/(\d{1,2}:\d{2}):\d{2}/, "$1");
  if (/[ap]\.?m\.?/i.test(val)) {                       // already 12h
    val = val.toUpperCase().replace(/\s+/g, " ");
    return val.replace(/^(\d{1,2})\s*(AM|PM)$/, "$1:00 $2"); // "6 PM" → "6:00 PM"
  }
  if (/^\d{1,2}:\d{2}$/.test(val)) return to12Hour(val);                        // 24h → 12h
  return val;
}

// Turn a sheet value into an iqamah: a clock time string, or an offset object.
// A value with a colon (or AM/PM) is a fixed time; a bare number is an offset.
function iqamahFromCell(v) {
  const val = v.trim();
  if (val.includes(":") || /[ap]\.?m\.?/i.test(val)) return toClock12(val);
  const m = val.match(/^\+?\s*(\d{1,3})$/);              // bare number → offset (minutes)
  if (m) return { offsetFromAthan: parseInt(m[1], 10) };
  return val;
}

async function fetchSheetTimes() {
  if (!config.sheetCsvUrl) return false;
  const res = await fetch(config.sheetCsvUrl, { cache: "no-store" });
  if (!res.ok) throw new Error("Sheet responded " + res.status);
  const rows = parseCSV(await res.text());

  let applied = false;
  const jummah = { athan: null, iqamah: null };
  const sheetAnns = [];

  rows.forEach((r) => {
    const key = (r[0] || "").trim().toLowerCase();
    const val = (r[1] || "").trim();
    if (!key || !val) return;

    if (key.startsWith("fajr")) { prayerTimes.fajr.iqamah = iqamahFromCell(val); applied = true; }
    else if (key.startsWith("dhuhr") || key.startsWith("zuhr") || key.startsWith("duhr")) { prayerTimes.dhuhr.iqamah = iqamahFromCell(val); applied = true; }
    else if (key.startsWith("asr")) { prayerTimes.asr.iqamah = iqamahFromCell(val); applied = true; }
    else if (key.startsWith("maghrib")) { prayerTimes.maghrib.iqamah = iqamahFromCell(val); applied = true; }
    else if (key.startsWith("isha")) { prayerTimes.isha.iqamah = iqamahFromCell(val); applied = true; }
    else if (key.includes("khutbah")) { jummah.athan = val; applied = true; }
    else if (key.includes("jumm") || key.includes("jumu")) { jummah.iqamah = val; applied = true; }
    else if (key.startsWith("announce") || key.startsWith("notice") || key.startsWith("message")) { sheetAnns.push(val); applied = true; }
  });

  // Update the (first) Jummah entry if the sheet provided values
  if ((jummah.athan || jummah.iqamah) && jummahTimes[0]) {
    if (jummah.athan) jummahTimes[0].athan = toClock12(jummah.athan);
    if (jummah.iqamah) jummahTimes[0].iqamah = toClock12(jummah.iqamah);
  }

  // If the sheet has any announcement rows, they replace the built-in ones.
  if (sheetAnns.length) {
    announcements.splice(0, announcements.length, ...sheetAnns.map((text) => ({
      active: true, icon: "📢", title: "", body: escapeHtml(text),
    })));
  }

  return applied;
}

// -----------------------------------------------------------
//  Static content from config
// -----------------------------------------------------------
function renderStatic() {
  // Show the full address as the location line (with Directions beside it)
  document.getElementById("location").textContent = config.address || config.location;

  const dirBtn = document.getElementById("directionsBtn");
  if (config.address || config.mapsUrl) {
    dirBtn.href = config.mapsUrl
      ? config.mapsUrl
      : "https://www.google.com/maps/dir/?api=1&destination=" +
        encodeURIComponent(config.address);
  } else {
    dirBtn.style.display = "none";
  }

  const link = document.getElementById("footerLink");
  if (link) link.href = config.websiteUrl;
}

// -----------------------------------------------------------
//  Five Pillars — tap to toggle the tooltip (hover handles desktop)
// -----------------------------------------------------------
function wirePillars() {
  const pillars = [...document.querySelectorAll(".pillar")];
  if (!pillars.length) return;
  pillars.forEach((p) => {
    p.addEventListener("click", (e) => {
      e.stopPropagation();
      const wasOpen = p.classList.contains("open");
      pillars.forEach((o) => { o.classList.remove("open"); o.setAttribute("aria-expanded", "false"); });
      if (!wasOpen) { p.classList.add("open"); p.setAttribute("aria-expanded", "true"); }
    });
  });
  // Tap anywhere else closes any open tooltip
  document.addEventListener("click", () => {
    pillars.forEach((o) => { o.classList.remove("open"); o.setAttribute("aria-expanded", "false"); });
  });
}

// -----------------------------------------------------------
//  Live clock (updates every second, masjid timezone)
// -----------------------------------------------------------
function startClock() {
  const clockEl = document.getElementById("liveClock");
  const secEl = document.getElementById("clockSec");
  if (!clockEl) return;

  function tick() {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Toronto",
      hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true,
    }).formatToParts(new Date());
    const o = {};
    parts.forEach((p) => (o[p.type] = p.value));
    clockEl.textContent = `${o.hour}:${o.minute}`;
    if (secEl) secEl.textContent = o.dayPeriod; // AM / PM
  }
  tick();
  setInterval(tick, 1000);
}

// -----------------------------------------------------------
//  Dates (Gregorian + Hijri)
// -----------------------------------------------------------
// The Islamic day begins at Maghrib (sunset), not midnight. After Maghrib the
// Hijri date should already be the next day, so return a Date advanced by one
// day once the masjid's local time has passed the Maghrib start time.
function islamicDate() {
  const now = new Date();
  const maghrib = timeToMinutes(prayerTimes.maghrib.athan);
  if (maghrib !== null && masjidNowMinutes() >= maghrib) {
    return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
  return now;
}

function renderDate() {
  const now = new Date();
  const TZ = "America/Toronto"; // show the masjid's local date

  // Gregorian follows the civil day (changes at midnight).
  const gregorian = now.toLocaleDateString("en-US", {
    timeZone: TZ,
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  document.getElementById("gregorianDate").textContent = gregorian;

  // Hijri follows the Islamic day (changes at Maghrib) via the built-in
  // Islamic calendar, with full traditional month names.
  try {
    const parts = new Intl.DateTimeFormat("en-US-u-ca-islamic-umalqura", {
      timeZone: TZ, day: "numeric", month: "numeric", year: "numeric",
    }).formatToParts(islamicDate());
    const o = {};
    parts.forEach((p) => (o[p.type] = p.value));
    const name = HIJRI_MONTHS[parseInt(o.month, 10) - 1] || "";
    document.getElementById("hijriDate").textContent =
      `${o.day} ${name} ${o.year} AH`;
  } catch (e) {
    document.getElementById("hijriDate").textContent = "";
  }
}

// Full Islamic month names (1 = Muharram … 12 = Dhu al-Hijjah)
const HIJRI_MONTHS = [
  "Muharram", "Safar", "Rabiʻ al-Awwal", "Rabiʻ al-Thani",
  "Jumada al-Ula", "Jumada al-Akhirah", "Rajab", "Shaʻban",
  "Ramadan", "Shawwal", "Dhu al-Qaʻdah", "Dhu al-Hijjah",
];

// -----------------------------------------------------------
//  Moon phase — shape reflects the Hijri day of the month
// -----------------------------------------------------------
// Build the SVG path for the illuminated part of the moon disc.
// f = illuminated fraction (0 new … 1 full); waxing = lit side on the right.
function moonLitPath(cx, cy, R, f, waxing) {
  f = Math.max(0, Math.min(1, f));
  const rTerm = R * (1 - 2 * f);          // terminator ellipse x-radius (signed)
  const outer = waxing ? 1 : 0;
  const inner = rTerm > 0 ? outer : 1 - outer;
  const top = `${cx} ${cy - R}`;
  const bot = `${cx} ${cy + R}`;
  return `M ${top} A ${R} ${R} 0 0 ${outer} ${bot} ` +
         `A ${Math.abs(rTerm).toFixed(2)} ${R} 0 0 ${inner} ${top} Z`;
}

function renderMoon() {
  const lit = document.getElementById("moonLit");
  if (!lit) return;

  // Hijri day of month (1..29/30) — follows the Islamic day (rolls at Maghrib)
  let day = 15;
  try {
    day = parseInt(new Intl.DateTimeFormat("en-US-u-ca-islamic-umalqura", {
      timeZone: "America/Toronto", day: "numeric",
    }).format(islamicDate()), 10) || 15;
  } catch (e) {}

  const SYNODIC = 29.53;
  const age = day;                         // Hijri date ≈ age of the visible moon
  const f = (1 - Math.cos((2 * Math.PI * age) / SYNODIC)) / 2;
  const waxing = (age % SYNODIC) < SYNODIC / 2;

  // Must match the <circle> in index.html
  lit.setAttribute("d", moonLitPath(918, 30, 13, f, waxing));
}

// -----------------------------------------------------------
//  Daily prayer cards
// -----------------------------------------------------------
const CARD_ORDER = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

// Is today Friday in the masjid's timezone? (Jummah replaces Dhuhr.)
function isJummahDay() {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Toronto", weekday: "short",
  }).format(new Date()) === "Fri";
}

function renderPrayerCards() {
  const grid = document.getElementById("prayerGrid");
  grid.innerHTML = "";
  const friday = isJummahDay();
  CARD_ORDER.forEach((key) => {
    const p = prayerTimes[key];
    let name = prayerNames[key];
    let iqamah = resolveIqamah(p);
    let beginsLabel = "begins";
    let begins = p.athan;

    // On Friday the Dhuhr slot shows Jummah (Khutbah + Jummah Iqamah).
    if (key === "dhuhr" && friday && jummahTimes[0]) {
      name = jummahTimes[0].label || "Jummah";
      iqamah = jummahTimes[0].iqamah;
      beginsLabel = "khutbah";
      begins = jummahTimes[0].athan;
    }

    const card = document.createElement("div");
    card.className = "prayer-card";
    card.dataset.prayer = key;
    card.innerHTML = `
      <span class="p-name">${name}</span>
      <span class="p-iqamah">${iqamah}</span>
      <span class="p-begins">${beginsLabel} ${begins}</span>
    `;
    grid.appendChild(card);
  });
}

// -----------------------------------------------------------
//  Sunrise / Sunset (informational)
// -----------------------------------------------------------
function renderSunTimes() {
  const sr = document.getElementById("sunriseTime");
  const ss = document.getElementById("sunsetTime");
  if (sr) sr.textContent = sunTimes.sunrise;
  if (ss) ss.textContent = sunTimes.sunset;
}

// -----------------------------------------------------------
//  Next / current prayer highlight + countdown
// -----------------------------------------------------------
// Keep highlighting a prayer until this many minutes after its Iqamah,
// so the banner doesn't jump to the next prayer while people are still
// praying the current one.
const HOLD_AFTER_IQAMAH_MIN = 15;

function updateNextPrayer() {
  const nowMin = masjidNowMinutes();

  // Build ordered list with athan + iqamah minute values.
  const list = CARD_ORDER.map((key) => {
    const athanMin = timeToMinutes(prayerTimes[key].athan);
    const iqamahStr = resolveIqamah(prayerTimes[key]);
    const iqamahMin = timeToMinutes(iqamahStr);
    return {
      key,
      name: prayerNames[key],
      athan: prayerTimes[key].athan,
      iqamahStr,
      athanMin,
      iqamahMin,
      // We stop showing this prayer only 15 min after its Iqamah.
      holdEnd: (iqamahMin !== null ? iqamahMin : athanMin) + HOLD_AFTER_IQAMAH_MIN,
    };
  }).filter((p) => p.athanMin !== null);

  // The active prayer is the earliest one we haven't finished holding yet.
  let active = list.find((p) => nowMin < p.holdEnd);
  let isTomorrow = false;
  if (!active) {
    active = list[0]; // all of today's prayers done → tomorrow's Fajr
    isTomorrow = true;
  }

  // Are we currently in the "just happened / praying now" window?
  const inProgress = !isTomorrow && nowMin >= active.athanMin;

  const labelEl = document.querySelector(".next-label");
  // On Friday, the Dhuhr slot is Jummah — show that name in the hero too.
  const displayName = (active.key === "dhuhr" && isJummahDay() && jummahTimes[0])
    ? (jummahTimes[0].label || "Jummah")
    : active.name;
  document.getElementById("nextName").textContent = displayName;

  let sub;
  if (inProgress) {
    if (labelEl) labelEl.textContent = "Jama'ah Now";
    if (active.iqamahMin !== null && nowMin < active.iqamahMin) {
      const d = active.iqamahMin - nowMin;
      sub = `Iqamah at ${active.iqamahStr} · in ${d} min`;
    } else {
      sub = `Iqamah ${active.iqamahStr} · in progress`;
    }
  } else {
    if (labelEl) labelEl.textContent = "Next Jama'ah";
    let mins = active.athanMin - nowMin;
    if (isTomorrow) mins = 1440 - nowMin + active.athanMin;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    sub = h > 0 ? `in ${h} hr ${m} min` : `in ${m} min`;
  }
  document.getElementById("nextRemaining").textContent = sub;

  // Ambient time-of-day theme
  document.body.dataset.period = isTomorrow ? "isha" : active.key;

  // Countdown progress bar (fills from the previous anchor to the next event)
  let start, end;
  if (inProgress) {
    start = active.athanMin;
    end = active.iqamahMin !== null ? active.iqamahMin : active.holdEnd;
  } else {
    const idx = list.indexOf(active);
    end = active.athanMin + (isTomorrow ? 1440 : 0);
    if (isTomorrow) {
      start = list[list.length - 1].athanMin; // today's Isha
    } else if (idx > 0) {
      start = list[idx - 1].athanMin;
    } else {
      start = list[list.length - 1].athanMin - 1440; // yesterday's Isha
    }
  }
  let progress = end > start ? (nowMin - start) / (end - start) : 0;
  progress = Math.max(0, Math.min(1, progress));
  const bar = document.getElementById("nextProgressBar");
  if (bar) bar.style.width = (progress * 100).toFixed(1) + "%";

  // Highlight the active prayer (accent color via CSS, no badge)
  document.querySelectorAll(".prayer-card").forEach((card) => {
    card.classList.toggle("is-next", card.dataset.prayer === active.key);
  });
}

// -----------------------------------------------------------
//  Jummah
// -----------------------------------------------------------
function renderJummah() {
  // On Friday, Jummah already shows in the prayer strip (in place of Dhuhr),
  // so hide the separate section to avoid duplication.
  const section = document.querySelector("section.jummah");
  if (section) section.style.display = isJummahDay() ? "none" : "";

  const grid = document.getElementById("jummahGrid");
  grid.innerHTML = "";
  jummahTimes.forEach((j) => {
    const card = document.createElement("div");
    card.className = "jummah-card";
    card.innerHTML = `
      <span class="j-label">${j.label}</span>
      <div class="j-times">
        <div class="j-time-col">
          <span class="j-time-label">Khutbah</span>
          <span class="j-time">${j.athan}</span>
        </div>
        <div class="j-time-col">
          <span class="j-time-label">Iqamah</span>
          <span class="j-time j-iqamah">${j.iqamah}</span>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

// -----------------------------------------------------------
//  Announcements (hidden entirely if none active)
// -----------------------------------------------------------
function renderAnnouncements() {
  const section = document.getElementById("announcementsSection");
  const listEl = document.getElementById("announcementsList");
  listEl.innerHTML = "";

  const active = announcements.filter((a) => a.active);
  if (active.length === 0) {
    section.style.display = "none";
    return;
  }

  active.forEach((a) => {
    const item = document.createElement("div");
    item.className = "announcement";
    item.innerHTML = `
      <span class="a-icon" aria-hidden="true">${a.icon || "•"}</span>
      <div>
        ${a.title ? `<p class="a-title">${a.title}</p>` : ""}
        <p class="a-body">${a.body}</p>
      </div>
    `;
    listEl.appendChild(item);
  });
}

// -----------------------------------------------------------
//  Init
// -----------------------------------------------------------
function setTimesSource(msg) {
  const el = document.getElementById("timesSource");
  if (el) el.textContent = msg;
}

async function init() {
  renderStatic();
  renderDate();
  renderMoon();
  startClock();
  wirePillars();

  // Load live Athan (start) times and admin-edited Iqamah times (Google
  // Sheet) in parallel before the first render. Each falls back on its own.
  setTimesSource("Loading today's prayer times…");
  let apiOk = false, apiTried = false;
  const jobs = [];
  if (config.api && config.api.enabled) {
    apiTried = true;
    jobs.push(fetchAthanTimes().then(() => { apiOk = true; }).catch(() => {}));
  }
  if (config.sheetCsvUrl) {
    jobs.push(fetchSheetTimes().catch(() => {}));
  }
  await Promise.all(jobs);

  if (apiOk) {
    setTimesSource("Prayer start times auto-update daily for " + config.location + ". Iqamah times set by the masjid.");
  } else if (apiTried) {
    setTimesSource("Showing saved prayer times (couldn't reach the live time service).");
  } else {
    setTimesSource("Iqamah times set by the masjid.");
  }

  renderPrayerCards();
  renderSunTimes();
  renderJummah();
  renderAnnouncements();
  updateNextPrayer();

  // Now that the real Maghrib/sunset time is loaded, re-render the date and
  // moon so the Maghrib rollover uses the accurate time.
  renderDate();
  renderMoon();

  // Refresh every 30 seconds: countdown, plus date & moon so a display left
  // running rolls the Hijri date over at Maghrib (and Gregorian at midnight).
  setInterval(() => {
    updateNextPrayer();
    renderDate();
    renderMoon();
  }, 30 * 1000);
}

document.addEventListener("DOMContentLoaded", init);
