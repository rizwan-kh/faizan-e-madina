/**
 * ============================================================
 *  PRAYER TIMES DATA — Edit this file to update times
 * ============================================================
 *
 *  HOW TO UPDATE PRAYER TIMES:
 *  1. Open this file in any text editor (Notepad, TextEdit, VS Code)
 *  2. Change the time strings below for each prayer
 *  3. Save the file and re-upload it to GitHub
 *
 *  Time format: "H:MM AM" or "H:MM PM"  (12-hour clock)
 *
 *  HOW TO UPDATE JUMMAH TIMES:
 *  - Add or remove entries from the jummahTimes array
 *  - Each entry is { label: "First Jummah", time: "1:30 PM" }
 *
 *  HOW TO UPDATE ANNOUNCEMENTS:
 *  - Edit the announcements array below
 *  - Set active: false to hide an announcement without deleting it
 * ============================================================
 */

// -----------------------------------------------------------
//  LOCATION
// -----------------------------------------------------------
const config = {
  organizationName: "Faizan-E-Madina",
  location: "Hamilton, Ontario",
  // Redirect button in the footer points to the official Dawat-e-Islami site.
  websiteUrl: "https://www.dawateislami.net",

  // ---- Masjid address (shown on the page + used for the Directions button) ----
  address: "1202 Dunsmure Rd, Hamilton, ON L8H 1L4",

  // Optional: paste an exact Google Maps link here to override the address-based
  // directions link (e.g. a Google Maps place/share URL). Leave "" to auto-build
  // a directions link from the address above.
  mapsUrl: "",

  // ---- Automatic prayer START times (Athan) ----
  // Start times are fetched live from the free Aladhan API for the
  // location below. Iqamah times are NOT from the API — they are
  // masjid-specific and set manually further down this file.
  api: {
    enabled: true,          // set false to use only the fixed times below
    city: "Hamilton",
    state: "Ontario",
    country: "Canada",
    method: 2,              // 2 = ISNA (common for North America)
    school: 1,              // 0 = Shafi/standard Asr, 1 = Hanafi Asr
  },
};

// -----------------------------------------------------------
//  DAILY PRAYER TIMES
//  Each prayer has two times:
//    iqamah = when the congregation prayer starts  👈 MASJID-SPECIFIC, edit these
//    athan  = when the prayer time begins (Adhan)
//
//  IQAMAH is set by the masjid — update it here whenever it changes.
//  ATHAN is fetched automatically from the Aladhan API (see config.api).
//  The athan values below are only a FALLBACK used if the API is
//  unreachable, so they don't need to be perfectly accurate.
//
//  Two ways to set an iqamah:
//    • Fixed time:  iqamah: "6:00 AM"
//    • Auto (offset from that day's athan):  iqamah: { offsetFromAthan: 4 }
//      → always N minutes after the start time, so it adjusts every day
//        on its own. Used for Maghrib, which shifts with sunset daily.
//
//  TIP: open admin.html in your browser to edit the Iqamah times
//       and copy the result back into this file.
// -----------------------------------------------------------
const prayerTimes = {
  fajr:    { athan: "5:12 AM",  iqamah: "6:00 AM" },
  dhuhr:   { athan: "1:25 PM",  iqamah: "2:00 PM" },
  asr:     { athan: "5:18 PM",  iqamah: "6:45 PM" },
  // Maghrib iqamah = 4 minutes after the Maghrib start time.
  // As sunset gets earlier each day, this shifts earlier automatically.
  maghrib: { athan: "8:15 PM",  iqamah: { offsetFromAthan: 4 } },
  isha:    { athan: "9:42 PM",  iqamah: "10:05 PM" },
};

// -----------------------------------------------------------
//  SUN TIMES (informational — shown as Sunrise & Sunset)
//  Sunrise marks the end of Fajr time; Maghrib begins at Sunset.
//  These auto-update from the API; the values here are only a
//  fallback used if the API is unreachable.
// -----------------------------------------------------------
const sunTimes = {
  sunrise: "6:33 AM",
  sunset:  "8:15 PM",
};

// Display names for each prayer (shown on the cards)
const prayerNames = {
  fajr:    "Fajr",
  dhuhr:   "Dhuhr",
  asr:     "Asr",
  maghrib: "Maghrib",
  isha:    "Isha",
};

// -----------------------------------------------------------
//  JUMMAH (FRIDAY) PRAYER TIMES
//  Add or remove objects to change the number of Jummah services.
//    athan  = Khutbah (sermon) start time
//    iqamah = congregation prayer start time
// -----------------------------------------------------------
const jummahTimes = [
  { label: "Jummah", athan: "1:30 PM", iqamah: "2:05 PM" },
];

// -----------------------------------------------------------
//  ANNOUNCEMENTS
//  Set active: false to temporarily hide without deleting
// -----------------------------------------------------------
const announcements = [
  {
    active: true,
    icon: "📢",
    title: "Jummah Reminder",
    body: "Jummah Khutbah begins promptly at 1:30 PM. Please arrive early — doors open 30 minutes beforehand.",
  },
  {
    active: true,
    icon: "🌙",
    title: "Islamic Event",
    body: "Join us for our weekly Ijtema (Islamic lecture) every Sunday from 6PM till 8PM. All are welcome.",
  },
  {
    active: false,   // hidden — set to true to show
    icon: "⭐",
    title: "Ramadan Schedule",
    body: "Special Ramadan prayer times and Tarawih schedule will be posted one week before Ramadan.",
  },
];
