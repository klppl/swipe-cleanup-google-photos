# Privacy Policy — Swipe Photos

_Last updated: 8 October 2026_

Swipe Photos ("the extension") is an open-source Chrome extension that helps you sort the photos in your Google Photos library by swiping. This policy explains what data the extension handles and what happens to it.

**Short version: everything stays in your browser. The extension has no servers, sends nothing to the developer or anyone else, and contains no analytics, tracking or ads.**

## What the extension accesses

The extension only runs on `https://photos.google.com/*`. While you use it there, it reads the photo grid that Google Photos has already shown in your tab:

- photo identifiers and links (`/photo/…` URLs),
- the thumbnail image addresses Google Photos uses for those photos,
- the accessible label Google Photos gives each photo (usually its type and date),
- the account number in the page address (`/u/0/`, `/u/1/`, …) so that data for different Google accounts in the same browser stays separate.

It does **not** read your Google account name, email address, password, cookies or any page other than Google Photos. It does not download or upload your photos. Images you see in the swipe view are loaded straight from Google's servers, exactly as Google Photos itself loads them.

## What the extension stores

The following is saved with Chrome's `storage.local` API, **on your computer only**:

| Data | Why |
| --- | --- |
| Your settings (skip kept photos, show the Swipe button) | To remember your choices |
| Counters of photos reviewed, kept and trashed | To show your stats in the popup |
| Identifiers of photos you swiped right ("keep") | So the same photo isn't shown again |
| Your pending trash list (photo id, thumbnail address, label, position) | So the list survives closing the tab until you confirm or clear it |
| The last photo you kept and where it is in the grid | So you can continue where you left off |
| A timestamp used to auto-start swiping after the extension opens a Google Photos tab | Removed right after use |

This data is never transmitted anywhere. It is not synced to your Google account by the extension.

## What the extension does on your behalf

When you open **Review & trash** and confirm, the extension selects those photos in the Google Photos page and clicks Google Photos' own **Move to trash** button, the same as if you did it by hand. Photos go to your Google Photos Trash, where Google keeps them for 60 days so you can restore them. Nothing is deleted without that confirmation.

## Sharing and selling

The developer receives no data from the extension, so there is nothing to share or sell. The extension's use of data:

- is limited to providing its single purpose (reviewing and trashing photos in Google Photos),
- is not transferred to third parties,
- is not used for advertising, credit-worthiness or lending purposes,
- is not read by humans.

## Permissions

| Permission | Use |
| --- | --- |
| `storage` | Save the data listed above locally. |
| Access to `https://photos.google.com/*` | Show the swipe view on Google Photos and trash the photos you confirm. |

## Deleting your data

- **Forget kept photos** and **Reset stats** in the extension popup clear those items.
- Removing the extension from `chrome://extensions` deletes everything it stored.

## Children

The extension is not directed at children and collects no personal information from anyone.

## Changes

Changes to this policy are published in this file in the project repository, with the date above updated. The full history is visible in the repository's commit log.

## Contact

Questions or concerns: open an issue at <https://github.com/klppl/swipe-cleanup-google-photos/issues>.

Swipe Photos is an independent project and is not affiliated with, endorsed by or sponsored by Google LLC. Google Photos is a trademark of Google LLC.
