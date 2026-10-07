// Relays the keyboard shortcut to the active Google Photos tab.

const PHOTOS_URL = 'https://photos.google.com/';

async function toggleOnTab(tab) {
  if (!tab?.id || !tab.url?.startsWith(PHOTOS_URL)) {
    await chrome.storage.local.set({ autostartAt: Date.now() });
    await chrome.tabs.create({ url: PHOTOS_URL });
    return;
  }
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'swipe:toggle' });
  } catch {
    // Content script not injected yet (tab was open before install) — reload and auto-start.
    await chrome.storage.local.set({ autostartAt: Date.now() });
    await chrome.tabs.reload(tab.id);
  }
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-swipe') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await toggleOnTab(tab);
});
