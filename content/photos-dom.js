// Everything that touches Google Photos' own DOM lives here, so that when Google
// changes its markup there is exactly one file to fix.
(() => {
  const NS = (window.SwipePhotos = window.SwipePhotos || {});

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Material "delete" icon path used by the trash button in the selection toolbar.
  const TRASH_ICON_PATH = 'M15 4V3H9v1H4v2h1v13c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V6h1V4h-5z';
  // Fallback for the trash button label across common locales.
  const TRASH_LABEL_RE =
    /trash|bin|delete|papierkorb|löschen|corbeille|supprimer|papelera|eliminar|cestino|elimina|prullenbak|verwijder|lixeira|excluir|papperskorg|papirkurv|roskakori|kosz|usuń|корзин|удалить|ゴミ箱|削除|휴지통|삭제|垃圾桶|回收站|删除|刪除/i;
  const DURATION_RE = /^\d{1,3}:\d{2}(?::\d{2})?$/;

  // ---------------------------------------------------------------- page state

  function accountKey() {
    const m = location.pathname.match(/^\/u\/(\d+)\//);
    return m ? m[1] : '0';
  }

  function isTrashPage() {
    return /^\/(?:u\/\d+\/)?trash(?:\/|$)/.test(location.pathname);
  }

  function isPhotoDetailPage() {
    return /\/photo\/[A-Za-z0-9_-]+/.test(location.pathname);
  }

  // ------------------------------------------------------------- scroll host

  let cachedScroller = null;

  /** The element that actually scrolls the photo grid (Google Photos uses an inner c-wiz). */
  function getScroller() {
    if (cachedScroller?.isConnected && cachedScroller.scrollHeight - cachedScroller.clientHeight > 100) {
      return cachedScroller;
    }
    const findLargest = (requireOverflowStyle) => {
      let best = null;
      let bestRange = 100;
      for (const el of document.querySelectorAll('c-wiz, div, main')) {
        if (el.clientHeight < 200) continue;
        const range = el.scrollHeight - el.clientHeight;
        if (range <= bestRange) continue;
        if (requireOverflowStyle && !/(auto|scroll)/.test(getComputedStyle(el).overflowY)) continue;
        best = el;
        bestRange = range;
      }
      return best;
    };
    const best = findLargest(true) || findLargest(false);
    cachedScroller = best;
    return best || document.scrollingElement;
  }

  function scrollTopOf(scroller) {
    return scroller === document.scrollingElement ? window.scrollY : scroller.scrollTop;
  }

  function setScrollTop(scroller, top) {
    if (scroller === document.scrollingElement) window.scrollTo({ top });
    else scroller.scrollTop = top;
  }

  function viewportTop(scroller) {
    return scroller === document.scrollingElement ? 0 : scroller.getBoundingClientRect().top;
  }

  // ------------------------------------------------------------------ tiles

  function photoIdFromHref(href) {
    const m = (href || '').match(/\/photo\/([A-Za-z0-9_-]+)/);
    return m ? m[1] : '';
  }

  function bgUrl(el) {
    if (!el) return '';
    const attr = el.getAttribute('data-latest-bg');
    if (attr) return attr;
    const m = (el.style.backgroundImage || '').match(/url\(["']?(.+?)["']?\)/);
    return m ? m[1] : '';
  }

  /** Swap the size suffix of a googleusercontent URL, keeping the query (e.g. ?authuser=1). */
  function sizedUrl(src, size) {
    const q = src.indexOf('?');
    const path = q === -1 ? src : src.slice(0, q);
    const query = q === -1 ? '' : src.slice(q);
    return `${path.split('=')[0]}=w${size}-h${size}-no${query}`;
  }

  function isVisible(el) {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function findTileFromAnchor(anchor) {
    const known = anchor.closest('div.rtIMgb');
    if (known) return known;
    let el = anchor;
    for (let i = 0; i < 6 && el; i++, el = el.parentElement) {
      if (el.querySelector('[role="checkbox"]') && (el.querySelector('[data-latest-bg]') || bgUrl(el))) return el;
    }
    return anchor.parentElement || anchor;
  }

  function detectVideo(tile, label) {
    if (/^video\b/i.test(label.trim())) return true;
    if (tile.querySelector('svg path[d="M10 16.5l6-4.5-6-4.5z"]')) return true;
    for (const el of tile.querySelectorAll('span, div')) {
      if (el.children.length) continue;
      if (DURATION_RE.test((el.textContent || '').trim())) return true;
    }
    return false;
  }

  /** Label like "Photo - Portrait - Oct 3, 2024, 5:12:33 PM" → "Oct 3, 2024, 5:12:33 PM". */
  function describeLabel(label) {
    const parts = label.split(/\s[-–]\s/).map((s) => s.trim()).filter(Boolean);
    if (parts.length <= 1) return label.trim();
    return parts[parts.length - 1];
  }

  /** All photo tiles currently rendered in the grid, in reading order. */
  function scanTiles() {
    const scroller = getScroller();
    const top0 = viewportTop(scroller);
    const st = scrollTopOf(scroller);
    const seen = new Map();

    for (const anchor of document.querySelectorAll('a[href*="/photo/"]')) {
      const id = photoIdFromHref(anchor.getAttribute('href'));
      if (!id || seen.has(id)) continue;
      const tile = findTileFromAnchor(anchor);
      if (!isVisible(tile)) continue;
      const bgEl = tile.querySelector('[data-latest-bg]') || tile.querySelector('[style*="background-image"]') || tile;
      const src = bgUrl(bgEl);
      if (!src) continue;
      const rect = tile.getBoundingClientRect();
      const label = anchor.getAttribute('aria-label') || tile.getAttribute('aria-label') || '';
      seen.set(id, {
        id,
        src,
        thumb: sizedUrl(src, 400),
        full: sizedUrl(src, 2048),
        href: anchor.href,
        label,
        when: describeLabel(label),
        isVideo: detectVideo(tile, label),
        offset: Math.round(st + rect.top - top0),
        left: Math.round(rect.left),
      });
    }
    return [...seen.values()].sort((a, b) => a.offset - b.offset || a.left - b.left);
  }

  function findTileElement(id) {
    for (const anchor of document.querySelectorAll(`a[href*="/photo/${CSS.escape(id)}"]`)) {
      if (photoIdFromHref(anchor.getAttribute('href')) !== id) continue;
      const tile = findTileFromAnchor(anchor);
      if (isVisible(tile)) return tile;
    }
    return null;
  }

  /** Rough grid height (px) occupied by `count` tiles, from the layout currently rendered. */
  function estimateHeightOf(count) {
    const tiles = scanTiles();
    if (tiles.length < 2) return 0;
    const rows = new Set(tiles.map((t) => Math.round(t.offset / 8))).size;
    const span = tiles[tiles.length - 1].offset - tiles[0].offset;
    if (rows < 2 || span <= 0) return 0;
    const rowHeight = span / (rows - 1);
    const perRow = tiles.length / rows;
    return Math.round((count / perRow) * rowHeight);
  }

  // ------------------------------------------------------------ pagination

  /** Wait for the grid to settle after a scroll (height stops changing). */
  async function waitForSettle(scroller, maxMs = 1800) {
    const start = Date.now();
    let lastH = -1;
    let stable = 0;
    while (Date.now() - start < maxMs) {
      await sleep(120);
      const h = scroller.scrollHeight;
      stable = h === lastH ? stable + 1 : 0;
      lastH = h;
      if (stable >= 2) return;
    }
  }

  /** Scroll the grid down one page so Google Photos renders more tiles. */
  async function scrollForward() {
    const scroller = getScroller();
    const before = scrollTopOf(scroller);
    setScrollTop(scroller, before + Math.max(300, scroller.clientHeight * 0.85));
    await waitForSettle(scroller);
    return scrollTopOf(scroller) > before + 5;
  }

  // -------------------------------------------------------------- selection

  function selectionCheckbox(tile) {
    return tile.querySelector('[role="checkbox"]');
  }

  function anySelected() {
    return [...document.querySelectorAll('[role="checkbox"][aria-checked="true"]')].some(isVisible);
  }

  function pressEscape() {
    const opts = { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true, cancelable: true };
    document.body.dispatchEvent(new KeyboardEvent('keydown', opts));
    document.body.dispatchEvent(new KeyboardEvent('keyup', opts));
  }

  async function clearSelection() {
    for (let i = 0; i < 3 && anySelected(); i++) {
      pressEscape();
      await sleep(250);
    }
  }

  async function setChecked(checkbox, value, timeout = 1500) {
    if ((checkbox.getAttribute('aria-checked') === 'true') === value) return true;
    checkbox.click();
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if ((checkbox.getAttribute('aria-checked') === 'true') === value) return true;
      await sleep(20);
    }
    return false;
  }

  /** Scroll until the tile for `item` is rendered; returns the tile or null. */
  async function locateTile(item) {
    let tile = findTileElement(item.id);
    if (tile) return tile;

    const scroller = getScroller();
    const vh = scroller.clientHeight || window.innerHeight;
    // Positions shift when photos above get deleted or new ones arrive, so probe around the estimate.
    const probes = [0, -0.6, 0.6, -1.2, 1.2, -2, 2, -3, 3].map((f) => item.offset - vh * 0.35 + f * vh);
    for (const target of probes) {
      setScrollTop(scroller, Math.max(0, target));
      const start = Date.now();
      while (Date.now() - start < 900) {
        await sleep(80);
        tile = findTileElement(item.id);
        if (tile) return tile;
      }
    }
    return null;
  }

  // -------------------------------------------------------------- trashing

  function findTrashButton() {
    const candidates = [...document.querySelectorAll('button, [role="button"]')].filter(isVisible);
    const byIcon = candidates.find((b) => {
      const d = b.querySelector('svg path')?.getAttribute('d') || '';
      return d.startsWith(TRASH_ICON_PATH);
    });
    if (byIcon) return byIcon;
    return candidates.find((b) => TRASH_LABEL_RE.test(b.getAttribute('aria-label') || '')) || null;
  }

  async function waitFor(fn, timeout, interval = 60) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const v = fn();
      if (v) return v;
      await sleep(interval);
    }
    return null;
  }

  async function confirmTrashDialog(trashLabel) {
    const dialog = await waitFor(
      () => [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')].find(isVisible),
      5000
    );
    if (!dialog) return false;
    const buttons = [...dialog.querySelectorAll('button')].filter(isVisible);
    const wanted = trashLabel.trim().toLowerCase();
    const btn =
      buttons.find((b) => (b.textContent || '').trim().toLowerCase() === wanted) ||
      buttons.find((b) => TRASH_LABEL_RE.test(b.textContent || '')) ||
      buttons[buttons.length - 1];
    if (!btn) return false;
    btn.click();
    return true;
  }

  /**
   * Select every item in the grid and move the selection to trash.
   * onProgress(phase, done, total) is called as work proceeds.
   * Returns { ok, selected, missing: [ids], reason? }.
   */
  async function trashItems(items, onProgress = () => {}, isCancelled = () => false) {
    if (isTrashPage()) return { ok: false, selected: 0, missing: items.map((i) => i.id), reason: 'trash-page' };

    await clearSelection();
    const sorted = [...items].sort((a, b) => a.offset - b.offset);
    const missing = [];
    let selected = 0;

    for (const item of sorted) {
      if (isCancelled()) {
        await clearSelection();
        return { ok: false, selected: 0, missing: [], reason: 'cancelled' };
      }
      const tile = await locateTile(item);
      const checkbox = tile && selectionCheckbox(tile);
      if (checkbox && (await setChecked(checkbox, true))) selected++;
      else missing.push(item.id);
      onProgress('select', selected + missing.length, sorted.length);
    }

    if (selected === 0) return { ok: false, selected, missing, reason: 'none-selected' };

    onProgress('trash', selected, sorted.length);
    const trashBtn = await waitFor(findTrashButton, 3000);
    if (!trashBtn) return { ok: false, selected, missing, reason: 'no-trash-button' };
    const label = trashBtn.getAttribute('aria-label') || '';
    trashBtn.click();

    if (!(await confirmTrashDialog(label))) return { ok: false, selected, missing, reason: 'no-confirm-dialog' };

    // Done when Google leaves selection mode (the trash button disappears with the selection toolbar).
    const finished = await waitFor(
      () => !findTrashButton() && ![...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')].some(isVisible),
      20000 + selected * 60,
      150
    );
    return { ok: !!finished, selected, missing, reason: finished ? undefined : 'timeout' };
  }

  NS.dom = {
    sleep,
    accountKey,
    isTrashPage,
    isPhotoDetailPage,
    getScroller,
    scrollTopOf,
    setScrollTop,
    scanTiles,
    estimateHeightOf,
    scrollForward,
    trashItems,
    sizedUrl,
  };
})();
