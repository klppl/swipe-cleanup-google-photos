// Entry point: floating launcher button, popup/shortcut messages and auto-start.
(() => {
  const NS = window.SwipePhotos;
  if (NS.booted) return;
  NS.booted = true;

  const { dom } = NS;
  const app = new NS.SwipeApp();
  NS.app = app;

  // ---------------------------------------------------------- floating button

  let fabHost = null;
  let fabBadge = null;
  let showFab = true;

  async function mountFab() {
    const css = await NS.loadCss();
    fabHost = document.createElement('div');
    fabHost.id = 'swipe-photos-fab';
    fabHost.style.cssText = 'all: initial; position: fixed; z-index: 2147483000;';
    const root = fabHost.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>${css}</style>
      <button class="sp-fab" title="Start swiping (Alt+Shift+S) — tick a photo first to start from it">
        <span class="sp-fab-icon"><svg viewBox="0 0 24 24"><path d="M12 21.3l-1.4-1.3C5.4 15.4 2 12.3 2 8.5 2 5.4 4.4 3 7.5 3c1.7 0 3.4.8 4.5 2.1C13.1 3.8 14.8 3 16.5 3 19.6 3 22 5.4 22 8.5c0 3.8-3.4 6.9-8.6 11.5L12 21.3z"/></svg></span>
        Swipe
        <span class="sp-fab-badge" hidden></span>
      </button>
    `;
    root.querySelector('.sp-fab').addEventListener('click', () => app.open());
    fabBadge = root.querySelector('.sp-fab-badge');
    document.documentElement.appendChild(fabHost);
  }

  function setBadge(count) {
    if (!fabBadge) return;
    fabBadge.hidden = !count;
    fabBadge.textContent = count > 999 ? '999+' : String(count);
  }

  /** Show the launcher only where swiping makes sense (a grid of photos). */
  function updateFab() {
    if (!fabHost) return;
    const wanted = showFab && !app.isOpen && !dom.isTrashPage() && !dom.isPhotoDetailPage();
    fabHost.style.display = wanted ? 'block' : 'none';
  }

  async function refreshBadge() {
    const key = `marked:${dom.accountKey()}`;
    const data = await chrome.storage.local.get(key);
    setBadge((data[key] || []).length);
  }

  // Fired on open/close and whenever the trash list changes.
  app.onChange((count) => {
    setBadge(count);
    updateFab();
  });

  // ---------------------------------------------------------- messages

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'swipe:toggle') {
      app.toggle();
      sendResponse({ ok: true });
    } else if (msg?.type === 'swipe:open') {
      app.open();
      sendResponse({ ok: true });
    } else if (msg?.type === 'swipe:status') {
      sendResponse({ ok: true, open: app.isOpen, trash: dom.isTrashPage(), detail: dom.isPhotoDetailPage() });
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.settings) {
      showFab = changes.settings.newValue?.showFab !== false;
      updateFab();
    }
    if (changes[`marked:${dom.accountKey()}`] && !app.isOpen) refreshBadge();
  });

  // ---------------------------------------------------------- boot

  async function boot() {
    const { settings, autostartAt } = await chrome.storage.local.get(['settings', 'autostartAt']);
    showFab = settings?.showFab !== false;
    await mountFab();
    updateFab();
    refreshBadge();

    // Google Photos is a single-page app: watch for route changes.
    let lastPath = location.pathname;
    setInterval(() => {
      if (location.pathname !== lastPath) {
        lastPath = location.pathname;
        updateFab();
        refreshBadge();
      }
      if (fabHost && !fabHost.isConnected) document.documentElement.appendChild(fabHost);
    }, 700);

    // Opened from the popup/shortcut on a tab that wasn't ready yet.
    if (autostartAt && Date.now() - autostartAt < 30000) {
      await chrome.storage.local.remove('autostartAt');
      await waitForGrid();
      await app.open();
    }
  }

  async function waitForGrid(timeout = 15000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (dom.scanTiles().length) return true;
      await dom.sleep(300);
    }
    return false;
  }

  boot();
})();
