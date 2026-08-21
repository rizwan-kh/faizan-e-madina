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
//  Static content from config
// -----------------------------------------------------------
function renderStatic() {
  document.getElementById("orgName").textContent = config.organizationName;
  document.getElementById("location").textContent = config.location;

  // Full address + Google Maps directions button
  const addrEl = document.getElementById("address");
  const dirBtn = document.getElementById("directionsBtn");
  if (config.address) {
    addrEl.textContent = config.address;
    dirBtn.href = config.mapsUrl
      ? config.mapsUrl
      : "https://www.google.com/maps/dir/?api=1&destination=" +
        encodeURIComponent(config.address);
  } else {
    addrEl.style.display = "none";
    dirBtn.style.display = "none";
  }

  const link = document.getElementById("footerLink");
  link.href = config.websiteUrl;
}

// -----------------------------------------------------------
//  Dates (Gregorian + Hijri)
// -----------------------------------------------------------
function renderDate() {
  const now = new Date();
  const TZ = "America/Toronto"; // show the masjid's local date

  const gregorian = now.toLocaleDateString("en-US", {
    timeZone: TZ,
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  document.getElementById("gregorianDate").textContent = gregorian;

  // Hijri date via the built-in Islamic calendar (no library needed)
  try {
    let hijri = new Intl.DateTimeFormat("en-US-u-ca-islamic-umalqura", {
      timeZone: TZ,
      day: "numeric", month: "long", year: "numeric",
    }).format(now);
    if (!/AH$/.test(hijri)) hijri += " AH";
    document.getElementById("hijriDate").textContent = hijri;
  } catch (e) {
    document.getElementById("hijriDate").textContent = "";
  }
}

// -----------------------------------------------------------
//  Daily prayer cards
// -----------------------------------------------------------
const CARD_ORDER = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

function renderPrayerCards() {
  const grid = document.getElementById("prayerGrid");
  grid.innerHTML = "";
  CARD_ORDER.forEach((key) => {
    const p = prayerTimes[key];
    const card = document.createElement("div");
    card.className = "prayer-card";
    card.dataset.prayer = key;
    card.innerHTML = `
      <span class="p-name">${prayerNames[key]}</span>
      <div class="p-times">
        <div class="p-time-col">
          <span class="p-time-label">Begins</span>
          <span class="p-time">${p.athan}</span>
        </div>
        <div class="p-time-col">
          <span class="p-time-label">Iqamah</span>
          <span class="p-time p-iqamah">${resolveIqamah(p)}</span>
        </div>
      </div>
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
  document.getElementById("nextName").textContent = `${active.name} — ${active.athan}`;

  let sub;
  if (inProgress) {
    if (labelEl) labelEl.textContent = "Current Prayer";
    if (active.iqamahMin !== null && nowMin < active.iqamahMin) {
      const d = active.iqamahMin - nowMin;
      sub = `Iqamah at ${active.iqamahStr}` + (d <= 60 ? ` · ${d}m` : "");
    } else {
      sub = "In progress";
    }
  } else {
    if (labelEl) labelEl.textContent = "Next Prayer";
    let mins = active.athanMin - nowMin;
    if (isTomorrow) mins = 1440 - nowMin + active.athanMin;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    sub = h > 0 ? `${h}h ${m}m remaining` : `${m}m remaining`;
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

  // Highlight the active card
  document.querySelectorAll(".prayer-card").forEach((card) => {
    const isActive = card.dataset.prayer === active.key;
    card.classList.toggle("is-next", isActive);
    let badge = card.querySelector(".badge-next");
    if (isActive) {
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "badge-next";
        card.querySelector(".p-name").appendChild(badge);
      }
      badge.textContent = inProgress ? "Now" : "Next";
    } else if (badge) {
      badge.remove();
    }
  });
}

// -----------------------------------------------------------
//  Jummah
// -----------------------------------------------------------
function renderJummah() {
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
        <p class="a-title">${a.title}</p>
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

  // Try to load live Athan (start) times before first render.
  if (config.api && config.api.enabled) {
    setTimesSource("Loading today's prayer start times…");
    try {
      await fetchAthanTimes();
      setTimesSource("Prayer start times auto-updated daily for " + config.location + ". Iqamah times set by the masjid.");
    } catch (e) {
      setTimesSource("Showing saved prayer times (couldn't reach the live time service).");
    }
  }

  renderPrayerCards();
  renderSunTimes();
  renderJummah();
  renderAnnouncements();
  updateNextPrayer();

  // Refresh the countdown every 30 seconds
  setInterval(updateNextPrayer, 30 * 1000);
}

document.addEventListener("DOMContentLoaded", init);
