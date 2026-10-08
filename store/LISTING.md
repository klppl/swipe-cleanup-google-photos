# Chrome Web Store submission kit

Copy-paste answers for every field in the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole). Keep this file in sync with `manifest.json` and `PRIVACY.md` when the extension changes.

---

## 1. Package

Build the upload zip:

```sh
./scripts/package.sh        # → dist/swipe-photos-<version>.zip
```

Or push a tag `v<version>` and download the zip from the GitHub release (see `.github/workflows/release.yml`).

Bump `"version"` in `manifest.json` for every new upload; the store rejects a version it has already seen.

---

## 2. Store listing tab

**Name** (from manifest): `Swipe Photos – Swipe to clean up Google Photos`

**Summary** (from manifest, max 132 chars):
> Swipe left to trash, right to keep. Clean up your Google Photos library one photo at a time.

**Category:** Tools  _(alternative: Photos)_

**Language:** English

**Description:**

```
Thousands of photos and no time to sort them? Swipe Photos turns cleaning up your Google Photos library into a quick game: swipe left to trash, swipe right to keep.

HOW IT WORKS
• Open photos.google.com and click the Swipe button, the toolbar icon, or press Alt+Shift+S.
• Each photo appears as a big card. Swipe left (or press ←) to mark it for trash, swipe right (or →) to keep it.
• Made a mistake? Undo with Z.
• When you're done, open Review & trash, untick anything you want to keep after all, and confirm.

SAFE BY DESIGN
• Nothing is deleted until you confirm in the review screen.
• Confirmed photos go to your Google Photos Trash, where you can restore them for 60 days.
• Your trash list survives closing the tab.

PICK UP WHERE YOU LEFT OFF
• Photos you keep are remembered and skipped next time (you can turn this off).
• Tick a photo in Google Photos to start from it, or scroll to a date and start there.
• Works with several Google accounts in the same browser.

CONTROLS
• Trash: drag or two-finger swipe left, ✕ button, ← or A
• Keep: drag or two-finger swipe right, ♥ button, → or D
• Undo: ↺ button, Z, Backspace or ⌘Z
• Open in Google Photos (to play videos): ↗ button, O or ↑
• Review & trash: R or Enter
• Close: Esc

PRIVATE
Swipe Photos runs entirely in your browser. It has no servers, no analytics and no ads, and it never uploads or downloads your photos. It only runs on photos.google.com.

OPEN SOURCE
Source code, privacy policy and issue tracker: https://github.com/klppl/SwipeGooglePhoto

Swipe Photos is an independent project and is not affiliated with or endorsed by Google. Google Photos is a trademark of Google LLC.
```

**Graphic assets** (all in `store/assets/`):

| Field | File | Required |
| --- | --- | --- |
| Store icon 128×128 | `icons/icon-128.png` | yes |
| Screenshots 1280×800 (1–5) | `store/assets/screenshot-*.png` — **you must capture these, see §6** | yes, at least 1 |
| Small promo tile 440×280 | `store/assets/promo-small-440x280.png` | yes |
| Marquee promo tile 1400×560 | `store/assets/promo-marquee-1400x560.png` | optional |

**Official URL:** none (needs a verified domain; leave empty)

**Homepage URL:** `https://github.com/klppl/SwipeGooglePhoto`

**Support URL:** `https://github.com/klppl/SwipeGooglePhoto/issues`

**Mature content:** No

---

## 3. Privacy practices tab

**Single purpose description:**
```
Swipe Photos helps users review the photos in their own Google Photos library one at a time, keeping or marking each with a swipe, and moves the photos they confirm to Google Photos Trash.
```

**Permission justifications:**

`storage`
```
Saves the user's settings, swipe statistics, the IDs of photos they chose to keep (so they are not shown again) and their pending trash list, locally in the browser so they survive closing the tab. Nothing is sent off the device.
```

Host permission `https://photos.google.com/*`
```
The extension's only function is on Google Photos: the content script reads the photo grid the page already displays to build the swipe view, and, when the user confirms in the review screen, selects those photos and clicks Google Photos' own "Move to trash" button. It runs on no other site.
```

**Remote code:** `No, I am not using remote code.`
_(All JavaScript ships inside the package. No `eval`, no external scripts, no CDN.)_

**Data usage — "What user data do you plan to collect from users now or in the future?"**

Tick **Website content** only. The extension stores photo IDs, thumbnail addresses and Google's photo labels from photos.google.com locally in `chrome.storage.local`. It is never transmitted, but declaring it is the safe answer because it is data read from the page about the user's own photos. Leave every other box unticked (no PII, health, financial, authentication, personal communications, location, web history or user activity collection).

Tick all three certifications:
- [x] I do not sell or transfer user data to third parties, outside of the approved use cases
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:**
```
https://github.com/klppl/SwipeGooglePhoto/blob/main/PRIVACY.md
```
(Make sure `PRIVACY.md` is on the `main` branch and the repository is public before submitting.)

---

## 4. Distribution tab

- **Payments:** Free
- **Visibility:** Public _(or Unlisted for a soft launch)_
- **Regions:** All regions

---

## 5. Account tab (one-time)

- Pay the one-time US$5 developer registration fee.
- Verify the contact email address — submission is blocked until it is verified.
- Turn on 2-Step Verification on the Google account (required to publish).

---

## 6. Screenshots — how to capture

The store needs at least one real screenshot (1280×800 or 640×400, PNG or JPEG, no alpha needed). Use your own photos or a test account with photos you're happy to show publicly — **never** include other people's private photos or your email address.

1. Set the Chrome window so the page area is 1280×800 (DevTools → device toolbar → Responsive → 1280×800 is easiest), or capture larger and resize.
2. Suggested shots, saved as `store/assets/screenshot-1.png` …:
   1. The swipe card mid-drag with the keep/trash stamp visible.
   2. The Review & trash grid with a few photos marked.
   3. The toolbar popup open on top of Google Photos (stats + settings).
   4. The floating **Swipe** button on the normal Google Photos grid.
3. Blur or crop the Google account avatar/email in the page header.

---

## 7. Review notes (optional field "Notes for the reviewer")

```
To test: sign in to any Google account at https://photos.google.com that has a few photos, click the "Swipe" button in the bottom-right corner (or the toolbar icon). Swipe/arrow-key left and right, then open "Review & trash" and confirm; the photos move to Google Photos Trash and can be restored from there. The extension makes no network requests of its own and stores data only in chrome.storage.local. Source: https://github.com/klppl/SwipeGooglePhoto
```

---

## 8. Pre-submission checklist

- [ ] `manifest.json` version bumped since the last upload
- [ ] `./scripts/package.sh` run; extension loaded from the unzipped `dist` zip once and smoke-tested
- [ ] Repository is public and `PRIVACY.md` is on `main`
- [ ] At least one 1280×800 screenshot in `store/assets/`
- [ ] Small promo tile uploaded
- [ ] Single purpose, permission justifications, remote code and data usage answered as above
- [ ] Developer account email verified
