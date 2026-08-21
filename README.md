# Faizan-E-Madina — Prayer Times

A mobile-first prayer-times board for the masjid at **1202 Dunsmure Rd, Hamilton, ON**,
with a cinematic time-of-day design (the sky shifts through the day with each prayer
period). No backend, database, or login — it runs entirely in the browser and is
hosted on **GitHub Pages**.

**Live site:** https://rizwan-kh.github.io/faizan-e-madina/

## How the times work

- **Athan (start) times** are fetched automatically each day from the free
  [Aladhan API](https://aladhan.com/prayer-times-api) for Hamilton, Ontario.
  You never edit these by hand. If the API is ever unreachable, the site falls
  back to the saved times in `js/data.js`.
- **Iqamah times** are **set by the masjid** and stored in `js/data.js`. Update
  them whenever the masjid changes its schedule.
- **Maghrib Iqamah** is special: it's stored as an *offset* (minutes after the
  Maghrib start time), so it shifts automatically with sunset — no daily edits.
- The **next prayer** stays highlighted until **15 minutes after its Iqamah**, so
  the board doesn't jump ahead while the congregation is still praying.
- **Sunrise** and **Sunset** are shown for reference (also from the API).

## Files

```
index.html        Page structure — cinematic hero + prayer rows (rarely edited)
admin.html         👈 Open in a browser to edit Iqamah / Jummah times easily
css/styles.css     All styling, colors, and the time-of-day sky palettes
js/data.js         Iqamah times, Jummah, address, announcements, API settings
js/app.js          App logic — clock, live times, countdown (no editing needed)
```

## Easiest way to update Iqamah times

1. Open **`admin.html`** in any web browser (double-click it).
2. Type the new **Iqamah** times (and Jummah times). Maghrib is entered as a
   number of minutes after its start time.
3. Click **Generate**, then **Copy to clipboard**.
4. Open **`js/data.js`**, replace the `config.location`, `prayerTimes`, and
   `jummahTimes` blocks with what you copied, save, and push to GitHub.

## Editing `js/data.js` directly (alternative)

- **Iqamah times** — change the `iqamah` values in `prayerTimes`. A fixed time is
  a string like `"6:00 AM"`; an auto offset is `{ offsetFromAthan: 4 }` (used for
  Maghrib = 4 minutes after its start).
- **Jummah** — edit `jummahTimes`. Add or remove entries to change the number of
  services. Each has `athan` (Khutbah start) and `iqamah`.
- **Address / Directions button** — edit `config.address`. The **Directions**
  button links to Google Maps using this address. To use an exact map pin, paste
  a link into `config.mapsUrl`.
- **Announcements** — edit the `announcements` list. Set `active: false` to hide
  one without deleting it. If none are active, the section disappears.
- **Turn the API on/off** — `config.api.enabled` (`true`/`false`). Other API
  settings: `method` (2 = ISNA) and `school` (0 = standard Asr, 1 = Hanafi Asr).

## Notes

- The **live clock**, **Gregorian**, and **Hijri** dates all use Hamilton's timezone.
- The **sky and accent color** change with the current prayer period
  (Fajr → Dhuhr → Asr → Maghrib → Isha), re-checked every 30 seconds.
- The footer links to the official **Dawat-e-Islami** website and notes that this
  site is **not managed by the masjid management**.

## Publishing changes

This repo is already deployed to GitHub Pages from the `main` branch (root).
To update the live site, just commit and push to `main`:

```bash
git add -A && git commit -m "Update prayer times" && git push
```

The site rebuilds automatically within a minute or two.

## Testing locally

The live time API requires the page to be served over http(s), so run a simple
local server from this folder:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.
