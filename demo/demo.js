// Demo library: a stand-in photo grid with the same structure Swipe Photos drives on Google Photos
// (tiles with /photo/ links and checkboxes, a selection toolbar with a trash button, a confirm dialog),
// so the real content scripts can be tried without a Google account. Nothing here leaves this page.
(() => {
  const PHOTO_COUNT = 72;
  const TRASH_KEY = 'swipeDemo:trashed';
  const $ = (id) => document.getElementById(id);

  // ------------------------------------------------------------------ data

  const photos = [];
  {
    // Newest first, a few photos per day, walking back from a fixed date so the library looks the same every time.
    const day = new Date(2026, 9, 24, 17, 12, 33);
    let left = 0;
    for (let i = 1; i <= PHOTO_COUNT; i++) {
      if (left === 0) {
        day.setDate(day.getDate() - (i === 1 ? 0 : 1 + (i % 3)));
        left = 4 + ((i * 5) % 9);
      }
      left--;
      const taken = new Date(day.getTime() - (left * 37 + i) * 60000);
      const n = String(i).padStart(3, '0');
      photos.push({
        id: `demo${n}`,
        src: new URL(`photos/${n}.svg`, location.href).href,
        taken,
        day: taken.toDateString(),
      });
    }
  }

  const fmtDay = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const fmtFull = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'medium' });

  function loadTrashed() {
    try {
      return new Set(JSON.parse(localStorage.getItem(TRASH_KEY) || '[]'));
    } catch {
      return new Set();
    }
  }

  function saveTrashed() {
    try {
      localStorage.setItem(TRASH_KEY, JSON.stringify([...trashed]));
    } catch {
      // Private window or blocked storage: the demo still works, it just forgets on reload.
    }
  }

  const trashed = loadTrashed();
  const selected = new Set();

  // ------------------------------------------------------------------ grid

  function tileHtml(p) {
    const label = `Photo - ${fmtFull.format(p.taken)}`;
    return `
      <div class="rtIMgb tile" data-id="${p.id}">
        <a class="tile-link" href="#/photo/${p.id}" aria-label="${label}">
          <div class="thumb" data-latest-bg="${p.src}" style="background-image: url('${p.src}')"></div>
        </a>
        <div class="check" role="checkbox" aria-checked="false" aria-label="Select photo" tabindex="0">
          <svg viewBox="0 0 24 24"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
        </div>
      </div>`;
  }

  function renderGrid() {
    const groups = new Map();
    for (const p of photos) {
      if (trashed.has(p.id)) continue;
      if (!groups.has(p.day)) groups.set(p.day, []);
      groups.get(p.day).push(p);
    }
    $('grid').innerHTML = groups.size
      ? [...groups.values()]
          .map((list) => `<section class="day"><h3>${fmtDay.format(list[0].taken)}</h3><div class="tiles">${list.map(tileHtml).join('')}</div></section>`)
          .join('')
      : '<p class="empty">Every demo photo is in the trash. Use <b>Reset demo</b> to bring them back.</p>';
    $('trashCount').textContent = trashed.size;
  }

  // ------------------------------------------------------------- selection

  function setChecked(tile, on) {
    const id = tile.dataset.id;
    if (on) selected.add(id);
    else selected.delete(id);
    tile.classList.toggle('is-selected', on);
    tile.querySelector('[role="checkbox"]').setAttribute('aria-checked', String(on));
    updateSelectionBar();
  }

  function clearSelection() {
    for (const tile of document.querySelectorAll('.tile.is-selected')) setChecked(tile, false);
    selected.clear();
    updateSelectionBar();
  }

  function updateSelectionBar() {
    $('selectionBar').hidden = selected.size === 0;
    document.body.classList.toggle('selecting', selected.size > 0);
    $('selectedCount').textContent = `${selected.size} selected`;
  }

  $('grid').addEventListener('click', (e) => {
    const tile = e.target.closest('.tile');
    if (!tile) return;
    const check = e.target.closest('[role="checkbox"]');
    // Like Google Photos: once something is selected, clicking a photo toggles it instead of opening it.
    if (check || selected.size) {
      e.preventDefault();
      setChecked(tile, !selected.has(tile.dataset.id));
    }
  });

  $('grid').addEventListener('keydown', (e) => {
    const check = e.target.closest('[role="checkbox"]');
    if (check && (e.key === ' ' || e.key === 'Enter')) {
      e.preventDefault();
      check.click();
    }
  });

  $('clearSelection').addEventListener('click', clearSelection);

  // ----------------------------------------------------------------- trash

  $('trashSelected').addEventListener('click', () => {
    const n = selected.size;
    $('dialogText').textContent = `${n} ${n === 1 ? 'item' : 'items'} will move to the demo trash. You can restore them from Trash on this page.`;
    $('dialog').hidden = false;
    $('dialogConfirm').focus();
  });

  $('dialogCancel').addEventListener('click', () => ($('dialog').hidden = true));

  $('dialogConfirm').addEventListener('click', () => {
    const n = selected.size;
    for (const id of selected) trashed.add(id);
    saveTrashed();
    $('dialog').hidden = true;
    selected.clear();
    updateSelectionBar();
    renderGrid();
    toast(`${n} ${n === 1 ? 'item' : 'items'} moved to trash`);
  });

  function renderTrash() {
    const list = photos.filter((p) => trashed.has(p.id));
    $('trashGrid').innerHTML = list.length
      ? list
          .map((p) => `<button class="trash-tile" data-id="${p.id}" title="Restore" style="background-image: url('${p.src}')"><span>Restore</span></button>`)
          .join('')
      : '<p class="empty">The demo trash is empty.</p>';
  }

  $('showTrash').addEventListener('click', () => {
    renderTrash();
    $('trashPanel').hidden = false;
  });
  $('closeTrash').addEventListener('click', () => ($('trashPanel').hidden = true));
  $('trashGrid').addEventListener('click', (e) => {
    const tile = e.target.closest('.trash-tile');
    if (!tile) return;
    trashed.delete(tile.dataset.id);
    saveTrashed();
    renderTrash();
    renderGrid();
  });
  $('restoreAll').addEventListener('click', () => {
    trashed.clear();
    saveTrashed();
    renderTrash();
    renderGrid();
  });

  // Restores every photo and forgets what Swipe Photos remembered about the demo (never your real data).
  $('reset').addEventListener('click', async () => {
    trashed.clear();
    saveTrashed();
    try {
      await chrome.storage.local.remove(['marked:demo', 'kept:demo', 'resume:demo', 'stats:demo']);
    } catch {
      // Opened outside the extension: nothing stored to clear.
    }
    location.hash = '';
    location.reload();
  });

  // ---------------------------------------------------------------- viewer

  function syncViewer() {
    const m = location.hash.match(/^#\/photo\/([A-Za-z0-9_-]+)/);
    const photo = m && photos.find((p) => p.id === m[1]);
    $('viewer').hidden = !photo;
    $('viewerFrame').innerHTML = photo ? `<img src="${photo.src}" alt="${fmtFull.format(photo.taken)}">` : '';
  }

  function closeViewer() {
    history.replaceState(null, '', location.pathname);
    syncViewer();
  }

  window.addEventListener('hashchange', syncViewer);
  $('viewerClose').addEventListener('click', closeViewer);
  $('viewer').addEventListener('click', (e) => {
    if (e.target === $('viewer')) closeViewer();
  });

  // Escape closes the topmost thing, then clears the selection (Swipe Photos relies on that last part).
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('dialog').hidden) $('dialog').hidden = true;
    else if (!$('viewer').hidden) closeViewer();
    else if (!$('trashPanel').hidden) $('trashPanel').hidden = true;
    else clearSelection();
  });

  // ------------------------------------------------------------------ misc

  let toastTimer = null;
  function toast(text) {
    $('toast').textContent = text;
    $('toast').hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ($('toast').hidden = true), 2600);
  }

  renderGrid();
  syncViewer();
})();
