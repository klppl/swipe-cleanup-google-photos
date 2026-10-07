const PHOTOS_URL = 'https://photos.google.com/';
const DEFAULT_SETTINGS = { skipKept: true, showFab: true };
const $ = (id) => document.getElementById(id);

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function isPhotosTab(tab) {
  return !!tab?.url?.startsWith(PHOTOS_URL);
}

async function render() {
  const { settings, stats } = await chrome.storage.local.get(['settings', 'stats']);
  const s = { ...DEFAULT_SETTINGS, ...settings };
  $('skipKept').checked = s.skipKept;
  $('showFab').checked = s.showFab;

  const st = { reviewed: 0, kept: 0, trashed: 0, ...stats };
  $('statReviewed').textContent = st.reviewed.toLocaleString();
  $('statKept').textContent = st.kept.toLocaleString();
  $('statTrashed').textContent = st.trashed.toLocaleString();

  const tab = await activeTab();
  if (!isPhotosTab(tab)) {
    $('startLabel').textContent = 'Open Google Photos';
    $('hint').textContent = 'Swipe Photos works on photos.google.com.';
  }

  const commands = await chrome.commands.getAll();
  $('shortcut').textContent = commands.find((c) => c.name === 'toggle-swipe')?.shortcut || '';
}

async function saveSetting(key, value) {
  const { settings } = await chrome.storage.local.get('settings');
  await chrome.storage.local.set({ settings: { ...DEFAULT_SETTINGS, ...settings, [key]: value } });
}

$('start').addEventListener('click', async () => {
  const tab = await activeTab();
  if (!isPhotosTab(tab)) {
    await chrome.storage.local.set({ autostartAt: Date.now() });
    await chrome.tabs.create({ url: PHOTOS_URL });
    window.close();
    return;
  }
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'swipe:open' });
  } catch {
    // The tab was opened before the extension was installed/updated.
    await chrome.storage.local.set({ autostartAt: Date.now() });
    await chrome.tabs.reload(tab.id);
  }
  window.close();
});

$('skipKept').addEventListener('change', (e) => saveSetting('skipKept', e.target.checked));
$('showFab').addEventListener('change', (e) => saveSetting('showFab', e.target.checked));

$('resetKept').addEventListener('click', async () => {
  if (!confirm('Forget every photo you marked as “keep”? They will show up again next time you swipe.')) return;
  const all = await chrome.storage.local.get(null);
  await chrome.storage.local.remove(Object.keys(all).filter((k) => k.startsWith('kept:')));
  render();
});

$('resetStats').addEventListener('click', async () => {
  if (!confirm('Reset your reviewed / kept / trashed counters?')) return;
  await chrome.storage.local.remove('stats');
  render();
});

render();
