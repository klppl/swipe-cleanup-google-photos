# Changelog

## Unreleased

- Safari on macOS: an Xcode project in `safari/` wraps the extension.
- Removed the Alt+Shift+S keyboard shortcut. Start from the Swipe button on Google Photos or the toolbar popup.
- **Reset everything** in the popup clears the trash list, kept photos, stats and settings.
- Popup reset links ask for a second click instead of a dialog, so they work in Safari.
- Trashing finds photos more reliably when the grid draws slowly, and logs its progress to the console.

## 1.0.0

First public release.

- Swipe view on Google Photos: left to mark for trash, right to keep, with undo.
- Review screen before anything is trashed; photos go to Google Photos Trash (restorable for 60 days).
- Kept photos are remembered per Google account and skipped next time.
- Toolbar popup with stats and settings; keyboard shortcut Alt+Shift+S.
