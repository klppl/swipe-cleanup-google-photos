const PHOTOS_URL = 'https://photos.google.com/';
const DEMO_URL = chrome.runtime.getURL('demo/demo.html');
const DEFAULT_SETTINGS = { skipKept: true, showFab: true };
const $ = (id) => document.getElementById(id);

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function isPhotosTab(tab) {
  return !!tab?.url && (tab.url.startsWith(PHOTOS_URL) || tab.url.startsWith(DEMO_URL));
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

$('tryDemo').addEventListener('click', async () => {
  await chrome.tabs.create({ url: DEMO_URL });
  window.close();
});

$('skipKept').addEventListener('change', (e) => saveSetting('skipKept', e.target.checked));
$('showFab').addEventListener('change', (e) => saveSetting('showFab', e.target.checked));

// Safari's extension popup ignores confirm(), so destructive links ask for a second click instead.
function confirmClick(id, prompt, action) {
  const btn = $(id);
  const label = btn.textContent;
  let armed = null;
  btn.addEventListener('click', async () => {
    if (!armed) {
      btn.textContent = prompt;
      btn.classList.add('armed');
      armed = setTimeout(() => {
        armed = null;
        btn.textContent = label;
        btn.classList.remove('armed');
      }, 4000);
      return;
    }
    clearTimeout(armed);
    armed = null;
    btn.classList.remove('armed');
    await action();
    btn.textContent = 'Done';
    setTimeout(() => (btn.textContent = label), 1500);
    render();
  });
}

confirmClick('resetKept', 'Click again to forget', async () => {
  const all = await chrome.storage.local.get(null);
  await chrome.storage.local.remove(Object.keys(all).filter((k) => k.startsWith('kept:')));
});

confirmClick('resetStats', 'Click again to reset', () => chrome.storage.local.remove('stats'));

confirmClick('resetAll', 'Click again to reset all', async () => {
  await chrome.storage.local.clear();
  // An open swipe session keeps its own copy in memory; reloading the tab drops it.
  const tab = await activeTab();
  if (isPhotosTab(tab)) await chrome.tabs.reload(tab.id);
});

render();
