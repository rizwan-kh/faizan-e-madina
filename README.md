# Dawat-e-Islami Canada — Prayer Times

A simple, mobile-first static website showing the five daily prayer times and
Jummah times for the masjid at **1202 Dunsmure Rd, Hamilton, ON**. No backend,
database, or login — it runs entirely in the browser and is ready to host on
**GitHub Pages**.

## How the times work

- **Athan (start) times** are fetched automatically each day from the free
  [Aladhan API](https://aladhan.com/prayer-times-api) for Hamilton, Ontario.
  You never edit these by hand. If the API is ever unreachable, the site falls
  back to the saved times in `js/data.js`.
- **Iqamah times** are **set by the masjid** and stored in `js/data.js`. Update
  them whenever the masjid changes its schedule.

## Files

```
index.html        The page structure (rarely needs editing)
admin.html         👈 Open in a browser to edit Iqamah/Jummah times easily
css/styles.css     All styling / colors
js/data.js         Iqamah times, Jummah, address, announcements, API settings
js/app.js          App logic (no editing needed)
```

## Easiest way to update Iqamah times

1. Open **`admin.html`** in any web browser (double-click it).
2. Type the new **Iqamah** times (and Jummah times).
3. Click **Generate**, then **Copy to clipboard**.
4. Open **`js/data.js`**, replace the `config.location`, `prayerTimes`, and
   `jummahTimes` blocks with what you copied, save, and upload to GitHub.

## Editing `js/data.js` directly (alternative)

- **Iqamah times** — change the `iqamah` values in `prayerTimes`.
- **Jummah** — edit `jummahTimes`. Add or remove entries to change the number of
  services. Each has `athan` (Khutbah start) and `iqamah`.
- **Address / Directions button** — edit `config.address`. The "Get Directions"
  button links to Google Maps using this address. To use an exact map pin,
  paste a link into `config.mapsUrl`.
- **Announcements** — edit the `announcements` list. Set `active: false` to hide
  one without deleting it. If none are active, the section disappears.
- **Turn the API on/off** — `config.api.enabled` (`true`/`false`). Other API
  settings: `method` (2 = ISNA) and `school` (0 = standard Asr, 1 = Hanafi Asr).

## Notes

- The **Gregorian and Hijri dates** update automatically for Hamilton's timezone.
- The **next/upcoming prayer** is highlighted automatically with a live countdown.
- The footer notes that the site is **not managed by the masjid management**.

## Deploying to GitHub Pages

1. Push these files to a GitHub repository.
2. In the repo: **Settings → Pages → Build and deployment**.
3. Set **Source** to `Deploy from a branch`, branch `main`, folder `/ (root)`.
4. Save. Your site will be live at `https://<username>.github.io/<repo>/`.

## Testing locally

The live time API requires the page to be served over http(s), so run a simple
local server from this folder:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.
