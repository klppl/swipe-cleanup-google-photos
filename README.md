# Swipe Photos

Tinder-style cleanup for Google Photos: **swipe left to trash, right to keep.**

## Install

**Chrome Web Store:** _coming soon_

### Developer mode

1. Open `chrome://extensions` and switch on **Developer mode** (top right).
2. Click **Load unpacked** and pick this repository folder.
3. Open [photos.google.com](https://photos.google.com) and click the **Swipe** button (bottom right), the toolbar icon, or press **Alt+Shift+S**.

## How it works

- **Choosing where to start:** tick a photo in Google Photos and then open Swipe to start from that photo. If you scrolled the grid to some date, it starts at the first photo on screen. If the grid is at the top, it continues after the last photo you kept, with a **Start from top** button in case you want to begin again.
- Photos you swipe left go on a **trash list**. Nothing is deleted until you open **Review & trash** and confirm.
- In review, tap any photo to keep it after all. Confirming selects the photos in Google Photos and moves them to **Trash**, where you can restore them for 60 days.
- Photos you keep are remembered (per Google account) and skipped next time. You can turn this off in the popup.
- Your trash list survives closing the tab.

| Action | Mouse / trackpad | Keyboard |
| --- | --- | --- |
| Trash | drag or two-finger swipe left, ✕ button | `←` / `A` |
| Keep | drag or two-finger swipe right, ♥ button | `→` / `D` |
| Undo | ↺ button | `Z` / `Backspace` / `⌘Z` |
| Open in Google Photos (play videos) | ↗ button | `O` / `↑` |
| Review & trash | bottom button | `R` / `Enter` |
| Close | ✕ top right | `Esc` |

## Project layout

```
manifest.json
background.js           keyboard shortcut → active tab
content/photos-dom.js   all Google Photos DOM access (scan grid, scroll, select, trash)
content/swipe-ui.js     the swipe app: state, persistence, overlay UI (shadow DOM)
content/content.js      bootstrap: floating button, messages, auto-start
content/swipe.css       overlay + launcher styles
popup/                  toolbar popup: start, stats, settings
```

If Google changes its markup, `content/photos-dom.js` is the only file that should need fixing.

## Privacy

Everything stays in your browser: no servers, no analytics, no ads. The extension only runs on photos.google.com and stores its data in `chrome.storage.local`. See [PRIVACY.md](PRIVACY.md).

## Releasing to the Chrome Web Store

1. Bump `"version"` in `manifest.json` and add an entry to [CHANGELOG.md](CHANGELOG.md).
2. Build the upload zip with `./scripts/package.sh` (writes `dist/swipe-photos-<version>.zip`), or push a tag `v<version>` and GitHub Actions attaches the zip to a release.
3. Upload it in the [Developer Dashboard](https://chrome.google.com/webstore/devconsole). Every listing field, permission justification and privacy answer is in [store/LISTING.md](store/LISTING.md).

Promo tiles are rendered from `store/assets/promo.html` with `node scripts/render-promo.mjs` (needs Playwright).

## License

[MIT](LICENSE). Swipe Photos is not affiliated with or endorsed by Google. Google Photos is a trademark of Google LLC.
