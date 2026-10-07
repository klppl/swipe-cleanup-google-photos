// The swipe experience: state, persistence and the overlay UI (rendered in a shadow root).
(() => {
  const NS = window.SwipePhotos;
  const { dom } = NS;

  const SWIPE_THRESHOLD = 110; // px of drag needed to commit
  const FLICK_VELOCITY = 0.55; // px/ms — a quick flick commits even if short
  const DECK_SIZE = 3; // cards rendered in the stack
  const PRELOAD_AHEAD = 5; // full-size images preloaded ahead of the current card
  const QUEUE_LOW_WATER = 15; // fetch more when fewer than this remain
  const QUEUE_TARGET = 40;
  const MAX_KEPT_IDS = 200000;
  const MILESTONES = [25, 50, 100, 250, 500, 1000, 2000, 5000];

  const DEFAULT_SETTINGS = { skipKept: true, showFab: true };
  const DEFAULT_STATS = { reviewed: 0, kept: 0, trashed: 0 };

  // ------------------------------------------------------------------ helpers

  const icon = {
    close: '<svg viewBox="0 0 24 24"><path d="M18.3 5.7a1 1 0 0 0-1.4 0L12 10.6 7.1 5.7a1 1 0 1 0-1.4 1.4l4.9 4.9-4.9 4.9a1 1 0 1 0 1.4 1.4l4.9-4.9 4.9 4.9a1 1 0 0 0 1.4-1.4L13.4 12l4.9-4.9a1 1 0 0 0 0-1.4z"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M9 3a1 1 0 0 0-1 1v1H4.5a1 1 0 1 0 0 2H5v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7h.5a1 1 0 1 0 0-2H16V4a1 1 0 0 0-1-1H9zm1 2h4v0H10zm-1 5a1 1 0 0 1 2 0v7a1 1 0 1 1-2 0v-7zm4 0a1 1 0 1 1 2 0v7a1 1 0 1 1-2 0v-7z"/></svg>',
    heart: '<svg viewBox="0 0 24 24"><path d="M12 21.3l-1.4-1.3C5.4 15.4 2 12.3 2 8.5 2 5.4 4.4 3 7.5 3c1.7 0 3.4.8 4.5 2.1C13.1 3.8 14.8 3 16.5 3 19.6 3 22 5.4 22 8.5c0 3.8-3.4 6.9-8.6 11.5L12 21.3z"/></svg>',
    undo: '<svg viewBox="0 0 24 24"><path d="M12.5 8c-2.6 0-5 1-6.9 2.6L3 8v7h7l-2.9-2.9c1.4-1.2 3.2-1.9 5.2-1.9 3.5 0 6.5 2.3 7.6 5.5l2.4-.8C20.9 10.7 17 8 12.5 8z"/></svg>',
    open: '<svg viewBox="0 0 24 24"><path d="M14 3v2h3.6l-9.8 9.8 1.4 1.4L19 6.4V10h2V3h-7zM19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2v7z"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M9 16.2l-3.5-3.5a1 1 0 1 0-1.4 1.4l4.2 4.2a1 1 0 0 0 1.4 0l10.2-10.2a1 1 0 1 0-1.4-1.4L9 16.2z"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M8 5.1v13.8a1 1 0 0 0 1.5.9l10.9-6.9a1 1 0 0 0 0-1.7L9.5 4.2A1 1 0 0 0 8 5.1z"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20v-2z"/></svg>',
    shield: '<svg viewBox="0 0 24 24"><path d="M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3zm-1.2 14.2-3.5-3.5 1.4-1.4 2.1 2.1 4.9-4.9 1.4 1.4-6.3 6.3z"/></svg>',
  };

  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  function cssUrl(url) {
    return `url("${String(url).replace(/["\\\n]/g, '')}")`;
  }

  function debounce(fn, ms) {
    let t = null;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  function plural(n, one, many = `${one}s`) {
    return `${n.toLocaleString()} ${n === 1 ? one : many}`;
  }

  let cssTextPromise = null;
  NS.loadCss = () => {
    cssTextPromise ||= fetch(chrome.runtime.getURL('content/swipe.css')).then((r) => r.text());
    return cssTextPromise;
  };

  // -------------------------------------------------------------- persistence

  class Store {
    constructor(acct) {
      this.acct = acct;
      this.keptKey = `kept:${acct}`;
      this.markedKey = `marked:${acct}`;
      this.saveKept = debounce(() => this.write(this.keptKey, [...this.kept].slice(-MAX_KEPT_IDS)), 600);
      this.saveMarked = debounce(() => this.write(this.markedKey, [...this.marked.values()]), 300);
      this.saveStats = debounce(() => this.write('stats', this.stats), 600);
    }

    async load() {
      const data = await chrome.storage.local.get(['settings', 'stats', this.keptKey, this.markedKey]);
      this.settings = { ...DEFAULT_SETTINGS, ...data.settings };
      this.stats = { ...DEFAULT_STATS, ...data.stats };
      this.kept = new Set(data[this.keptKey] || []);
      this.marked = new Map((data[this.markedKey] || []).map((i) => [i.id, i]));
      return this;
    }

    write(key, value) {
      chrome.storage.local.set({ [key]: value }).catch(() => {});
    }
  }

  // ---------------------------------------------------------------- the app

  class SwipeApp {
    constructor() {
      this.isOpen = false;
      this.screen = 'swipe';
      this.session = null;
      this.cardEls = new Map();
      this.loading = false;
      this.trashing = false;
      this.cancelTrash = false;
      this.reviewKeep = new Set();
      this.wheel = { dx: 0, locked: false, unlockTimer: null, idleTimer: null };
      this.onKeyDown = this.onKeyDown.bind(this);
      this.onKeyOther = this.onKeyOther.bind(this);
      this.onWheel = this.onWheel.bind(this);
      this.listeners = new Set();
    }

    /** Subscribe to marked-count changes (used by the floating button badge). */
    onChange(fn) {
      this.listeners.add(fn);
    }

    emitChange() {
      for (const fn of this.listeners) fn(this.store?.marked.size || 0);
    }

    // ------------------------------------------------------------ lifecycle

    async toggle() {
      if (this.isOpen) this.close();
      else await this.open();
    }

    async open() {
      if (this.isOpen || this.opening) return;
      this.opening = true;
      try {
        await this.openInner();
      } finally {
        this.opening = false;
      }
    }

    async openInner() {
      await this.mount();
      const acct = dom.accountKey();
      this.store = await new Store(acct).load();

      const resumable = this.session && this.session.acct === acct && this.session.path === location.pathname;
      if (!resumable) this.session = this.newSession(acct);

      this.isOpen = true;
      this.host.style.display = 'block';
      document.documentElement.classList.add('swipe-photos-open');
      window.addEventListener('keydown', this.onKeyDown, true);
      window.addEventListener('keyup', this.onKeyOther, true);
      window.addEventListener('keypress', this.onKeyOther, true);
      this.root.addEventListener('wheel', this.onWheel, { passive: false });

      requestAnimationFrame(() => this.overlay.classList.add('is-visible'));
      this.setScreen('swipe');
      this.updateCounters();
      this.emitChange();

      if (dom.isTrashPage()) {
        this.renderMessage('This is your trash', 'Open your Photos library to start swiping.');
        return;
      }
      if (!resumable) this.startFromViewport();
      this.renderDeck();
      if (this.remaining() < QUEUE_LOW_WATER) this.loadMore();
    }

    close() {
      if (!this.isOpen || this.trashing) return;
      this.isOpen = false;
      window.removeEventListener('keydown', this.onKeyDown, true);
      window.removeEventListener('keyup', this.onKeyOther, true);
      window.removeEventListener('keypress', this.onKeyOther, true);
      this.root.removeEventListener('wheel', this.onWheel);
      this.overlay.classList.remove('is-visible');
      document.documentElement.classList.remove('swipe-photos-open');
      setTimeout(() => {
        if (!this.isOpen) this.host.style.display = 'none';
      }, 260);
      this.emitChange();
    }

    newSession(acct) {
      return {
        acct,
        path: location.pathname,
        queue: [],
        pos: 0,
        seen: new Set(),
        history: [],
        cursor: 0,
        ended: false,
        reviewed: 0,
        kept: 0,
        deleted: 0,
        skippedKept: 0,
      };
    }

    async mount() {
      if (this.host) return;
      const css = await NS.loadCss();
      this.host = document.createElement('div');
      this.host.id = 'swipe-photos-host';
      this.host.style.cssText = 'all: initial; position: fixed; inset: 0; z-index: 2147483646; display: none;';
      this.root = this.host.attachShadow({ mode: 'open' });
      this.root.innerHTML = `<style>${css}</style>`;
      this.overlay = el(`
        <div class="sp-overlay" data-screen="swipe">
          <div class="sp-backdrop"></div>

          <section class="sp-screen sp-swipe">
            <header class="sp-top">
              <div class="sp-brand">
                <img src="${chrome.runtime.getURL('icons/icon-128.png')}" alt="">
                <span>Swipe Photos</span>
              </div>
              <div class="sp-counters">
                <span class="sp-chip sp-chip-del" title="Marked for trash">${icon.trash}<b data-r="delCount">0</b></span>
                <span class="sp-chip sp-chip-keep" title="Kept">${icon.heart}<b data-r="keepCount">0</b></span>
              </div>
              <button class="sp-icon-btn" data-a="close" title="Close (Esc)">${icon.close}</button>
            </header>

            <div class="sp-loading-chip" data-r="loadingChip"><span class="sp-spinner"></span><span data-r="loadingText">Loading photos…</span></div>

            <main class="sp-stage">
              <div class="sp-deck" data-r="deck"></div>
              <div class="sp-message" data-r="message" hidden></div>
            </main>

            <footer class="sp-controls">
              <button class="sp-round sp-round-sm sp-undo" data-a="undo" title="Undo (Z)">${icon.undo}</button>
              <button class="sp-round sp-round-lg sp-del" data-a="delete" title="Trash (←)">${icon.close}</button>
              <button class="sp-round sp-round-lg sp-keep" data-a="keep" title="Keep (→)">${icon.heart}</button>
              <button class="sp-round sp-round-sm sp-open" data-a="open" title="Open in Google Photos (O)">${icon.open}</button>
            </footer>

            <div class="sp-bottom">
              <button class="sp-review-btn" data-a="review" data-r="reviewBtn" disabled>
                Review &amp; trash <span class="sp-badge" data-r="reviewCount">0</span>
              </button>
              <div class="sp-hints">
                <span><kbd>←</kbd> trash</span><span><kbd>→</kbd> keep</span><span><kbd>Z</kbd> undo</span>
                <span><kbd>O</kbd> open</span><span><kbd>R</kbd> review</span><span><kbd>Esc</kbd> close</span>
              </div>
            </div>
          </section>

          <section class="sp-screen sp-review">
            <header class="sp-review-head">
              <button class="sp-icon-btn" data-a="back" title="Back to swiping (Esc)">${icon.back}</button>
              <div>
                <h2 data-r="reviewTitle">Review</h2>
                <p>Tap anything you want to keep after all.</p>
              </div>
              <button class="sp-link" data-a="clearMarked">Clear list</button>
            </header>
            <div class="sp-safety">${icon.shield}<span>Photos go to your Google Photos <b>Trash</b> and can be restored for 60 days.</span></div>
            <div class="sp-grid" data-r="grid"></div>
            <footer class="sp-review-foot">
              <button class="sp-btn sp-btn-ghost" data-a="back">Keep swiping</button>
              <button class="sp-btn sp-btn-danger" data-a="confirmTrash" data-r="confirmBtn">Move to trash</button>
            </footer>
          </section>

          <section class="sp-screen sp-progress">
            <div class="sp-progress-card">
              <div class="sp-progress-icon">${icon.trash}</div>
              <h2 data-r="progressTitle">Selecting photos…</h2>
              <p data-r="progressSub">Hang tight — Google Photos is scrolling behind this window.</p>
              <div class="sp-bar"><div class="sp-bar-fill" data-r="progressFill"></div></div>
              <button class="sp-btn sp-btn-ghost" data-a="cancelTrash" data-r="cancelBtn">Cancel</button>
            </div>
          </section>

          <section class="sp-screen sp-done">
            <div class="sp-progress-card">
              <div class="sp-confetti" data-r="confetti"></div>
              <div class="sp-done-icon" data-r="doneIcon">${icon.check}</div>
              <h2 data-r="doneTitle"></h2>
              <p data-r="doneSub"></p>
              <div class="sp-done-actions">
                <button class="sp-btn sp-btn-ghost" data-a="close">Close</button>
                <button class="sp-btn sp-btn-primary" data-a="back" data-r="continueBtn">Keep swiping</button>
              </div>
            </div>
          </section>

          <div class="sp-toast" data-r="toast"></div>
        </div>
      `);
      this.root.appendChild(this.overlay);
      document.documentElement.appendChild(this.host);

      this.refs = {};
      for (const node of this.overlay.querySelectorAll('[data-r]')) this.refs[node.dataset.r] = node;
      this.deck = this.refs.deck;

      this.overlay.addEventListener('click', (e) => this.onClick(e));
      this.deck.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    }

    setScreen(name) {
      this.screen = name;
      this.overlay.dataset.screen = name;
    }

    // ------------------------------------------------------------ the queue

    current() {
      return this.session.queue[this.session.pos] || null;
    }

    remaining() {
      return this.session.queue.length - this.session.pos;
    }

    /** Begin from the first photo visible in the grid, so you can jump to any date first. */
    startFromViewport() {
      const s = this.session;
      const scroller = dom.getScroller();
      const top = dom.scrollTopOf(scroller);
      const tiles = dom.scanTiles();
      for (const t of tiles) {
        if (t.offset < top - 150) s.seen.add(t.id); // above the fold: skip
      }
      s.cursor = top;
      this.ingest(tiles);
    }

    /** Add newly discovered tiles to the queue. Returns the number of never-before-seen tiles. */
    ingest(tiles) {
      const s = this.session;
      const { kept, marked, settings } = this.store;
      let fresh = 0;
      for (const t of tiles) {
        if (s.seen.has(t.id)) continue;
        s.seen.add(t.id);
        fresh++;
        s.cursor = Math.max(s.cursor, t.offset);
        if (marked.has(t.id)) continue;
        if (settings.skipKept && kept.has(t.id)) {
          s.skippedKept++;
          continue;
        }
        s.queue.push(t);
      }
      return fresh;
    }

    async loadMore() {
      const s = this.session;
      if (this.loading || s.ended || this.trashing) return;
      this.loading = true;
      this.renderLoading();
      try {
        const scroller = dom.getScroller();
        const vh = scroller.clientHeight || window.innerHeight;
        // The grid may have been scrolled elsewhere (e.g. while trashing) — go back to where we left off.
        if (Math.abs(dom.scrollTopOf(scroller) + vh - s.cursor) > vh * 1.5) {
          dom.setScrollTop(scroller, Math.max(0, s.cursor - vh * 0.6));
          await dom.sleep(450);
          this.ingest(dom.scanTiles());
        }

        let idle = 0;
        for (let step = 0; step < 120 && this.remaining() < QUEUE_TARGET && this.isOpen && !this.trashing; step++) {
          const moved = await dom.scrollForward();
          const fresh = this.ingest(dom.scanTiles());
          idle = moved || fresh ? 0 : idle + 1;
          if (idle >= 3) {
            s.ended = true;
            break;
          }
          this.renderLoading();
          if (!this.current()) this.renderDeck(); // show the first card as soon as one is available
        }
      } catch (err) {
        console.warn('[Swipe Photos] loading failed', err);
        s.ended = true;
      } finally {
        this.loading = false;
        this.renderLoading();
        this.renderDeck();
      }
    }

    // ------------------------------------------------------------ decisions

    decide(dir, drag = { dx: 0, dy: 0 }) {
      if (this.screen !== 'swipe') return;
      const item = this.current();
      if (!item) return;
      const s = this.session;
      const { store } = this;

      const card = this.cardEls.get(item.id);
      this.cardEls.delete(item.id);
      if (card) this.flyOut(card, dir, drag);

      s.pos++;
      s.reviewed++;
      store.stats.reviewed++;
      if (dir === 'left') {
        store.marked.set(item.id, item);
        s.deleted++;
        store.saveMarked();
      } else {
        store.kept.add(item.id);
        store.stats.kept++;
        s.kept++;
        store.saveKept();
      }
      store.saveStats();
      s.history.push({ item, dir });

      this.renderDeck();
      this.updateCounters();
      this.emitChange();
      if (MILESTONES.includes(s.reviewed)) this.toast(`🔥 ${s.reviewed} reviewed — nice pace!`);
      if (this.remaining() < QUEUE_LOW_WATER) this.loadMore();
    }

    undo() {
      if (this.screen !== 'swipe') return;
      const s = this.session;
      const last = s.history.pop();
      if (!last) return;
      const { store } = this;
      s.pos--;
      s.reviewed--;
      store.stats.reviewed = Math.max(0, store.stats.reviewed - 1);
      if (last.dir === 'left') {
        store.marked.delete(last.item.id);
        s.deleted--;
        store.saveMarked();
      } else {
        store.kept.delete(last.item.id);
        store.stats.kept = Math.max(0, store.stats.kept - 1);
        s.kept--;
        store.saveKept();
      }
      store.saveStats();
      this.renderDeck({ enteringId: last.item.id, from: last.dir });
      this.updateCounters();
      this.emitChange();
    }

    openCurrent() {
      const item = this.current();
      if (item?.href) window.open(item.href, '_blank', 'noopener');
    }

    // ------------------------------------------------------------ rendering

    makeCard(item) {
      const card = el(`
        <div class="sp-card">
          <div class="sp-card-bg" style='background-image: ${cssUrl(item.src)}'></div>
          <img class="sp-card-img" draggable="false" alt="">
          <div class="sp-tint sp-tint-keep"></div>
          <div class="sp-tint sp-tint-del"></div>
          <div class="sp-stamp sp-stamp-keep">KEEP</div>
          <div class="sp-stamp sp-stamp-del">TRASH</div>
          ${item.isVideo ? `<button class="sp-play" data-a="open" title="Play in Google Photos">${icon.play}</button>` : ''}
          <div class="sp-card-meta">
            ${item.isVideo ? '<span class="sp-type">Video</span>' : ''}
            <span class="sp-when">${escapeHtml(item.when || '')}</span>
          </div>
        </div>
      `);
      const img = card.querySelector('.sp-card-img');
      img.src = item.src; // already cached by the grid — instant
      const hi = new Image();
      hi.onload = () => {
        img.src = item.full;
        card.querySelector('.sp-card-bg').style.backgroundImage = cssUrl(item.full);
      };
      hi.src = item.full;
      return card;
    }

    renderDeck({ enteringId = null, from = null } = {}) {
      const s = this.session;
      const visible = s.queue.slice(s.pos, s.pos + DECK_SIZE);
      const ids = new Set(visible.map((i) => i.id));

      for (const [id, card] of this.cardEls) {
        if (!ids.has(id)) {
          card.remove();
          this.cardEls.delete(id);
        }
      }

      visible.forEach((item, depth) => {
        let card = this.cardEls.get(item.id);
        if (!card) {
          card = this.makeCard(item);
          this.cardEls.set(item.id, card);
          this.deck.appendChild(card);
          if (item.id === enteringId) {
            const sign = from === 'left' ? -1 : 1;
            card.style.transition = 'none';
            card.style.transform = `translate(${sign * window.innerWidth}px, 40px) rotate(${sign * 25}deg)`;
            card.getBoundingClientRect(); // flush so the transition runs
            card.style.transition = '';
          }
        }
        card.dataset.depth = String(depth);
        card.style.zIndex = String(DECK_SIZE - depth);
        card.style.transform = '';
        card.style.removeProperty('--keep');
        card.style.removeProperty('--del');
      });

      // Warm the cache for what's coming up.
      for (const item of s.queue.slice(s.pos + DECK_SIZE, s.pos + PRELOAD_AHEAD)) {
        if (!item._preloaded) {
          item._preloaded = true;
          new Image().src = item.full;
        }
      }

      const empty = !visible.length;
      this.refs.message.hidden = !empty;
      this.overlay.classList.toggle('is-empty', empty);
      if (empty) this.renderEmpty();
      this.overlay.querySelector('[data-a="undo"]').disabled = !s.history.length;
    }

    renderEmpty() {
      const s = this.session;
      const marked = this.store.marked.size;
      if (!s.ended) {
        this.renderMessage('Finding photos…', 'Loading your library.', true);
      } else if (!s.seen.size) {
        this.renderMessage(
          'No photos here',
          'Open your Photos library, an album or search results, then start swiping.'
        );
      } else {
        const skipped = s.skippedKept ? ` Skipped ${plural(s.skippedKept, 'photo')} you already kept.` : '';
        this.renderMessage(
          'You’re all caught up 🎉',
          (marked ? `${plural(marked, 'photo')} waiting to be trashed.` : 'Nothing marked for trash.') + skipped,
          false,
          marked > 0
        );
      }
    }

    renderMessage(title, sub, spinner = false, withReview = false) {
      const m = this.refs.message;
      m.hidden = false;
      m.innerHTML = `
        ${spinner ? '<div class="sp-spinner sp-spinner-lg"></div>' : ''}
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(sub)}</p>
        ${withReview ? '<button class="sp-btn sp-btn-danger" data-a="review">Review &amp; trash</button>' : ''}
      `;
    }

    renderLoading() {
      const s = this.session;
      const show = this.loading && this.screen === 'swipe';
      this.refs.loadingChip.classList.toggle('is-visible', show);
      this.refs.loadingText.textContent = s.skippedKept
        ? `Loading… (skipped ${s.skippedKept.toLocaleString()} already kept)`
        : 'Loading more photos…';
      if (!this.current()) this.renderDeck();
    }

    updateCounters() {
      const s = this.session;
      const marked = this.store.marked.size;
      this.refs.delCount.textContent = marked.toLocaleString();
      this.refs.keepCount.textContent = s.kept.toLocaleString();
      this.refs.reviewCount.textContent = marked.toLocaleString();
      this.refs.reviewBtn.disabled = marked === 0;
      this.refs.reviewBtn.classList.toggle('has-items', marked > 0);
    }

    toast(text) {
      const t = this.refs.toast;
      t.textContent = text;
      t.classList.add('is-visible');
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => t.classList.remove('is-visible'), 2200);
    }

    // ------------------------------------------------------------ animation

    applyDrag(card, dx, dy) {
      const rot = Math.max(-25, Math.min(25, dx * 0.07));
      card.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg)`;
      const p = Math.min(1, Math.abs(dx) / SWIPE_THRESHOLD);
      card.style.setProperty('--keep', dx > 0 ? p : 0);
      card.style.setProperty('--del', dx < 0 ? p : 0);
      this.deck.style.setProperty('--progress', p);
    }

    resetDrag(card) {
      this.deck.classList.remove('is-dragging');
      card.classList.remove('is-dragging');
      card.style.transform = '';
      card.style.removeProperty('--keep');
      card.style.removeProperty('--del');
      this.deck.style.setProperty('--progress', 0);
    }

    flyOut(card, dir, { dx = 0, dy = 0 } = {}) {
      const sign = dir === 'left' ? -1 : 1;
      this.deck.classList.remove('is-dragging');
      this.deck.style.setProperty('--progress', 0);
      card.classList.remove('is-dragging');
      card.classList.add('is-flying');
      card.dataset.depth = 'out';
      card.style.setProperty(dir === 'left' ? '--del' : '--keep', 1);
      const x = sign * (window.innerWidth * 0.75 + Math.abs(dx));
      const y = dy + 60;
      requestAnimationFrame(() => {
        card.style.transform = `translate(${x}px, ${y}px) rotate(${sign * 28}deg)`;
        card.style.opacity = '0';
      });
      setTimeout(() => card.remove(), 450);
    }

    // ------------------------------------------------------------ input

    onClick(e) {
      const btn = e.target.closest('[data-a]');
      if (!btn || btn.disabled) return;
      const a = btn.dataset.a;
      if (a === 'close') this.close();
      else if (a === 'delete') this.decide('left');
      else if (a === 'keep') this.decide('right');
      else if (a === 'undo') this.undo();
      else if (a === 'open') this.openCurrent();
      else if (a === 'review') this.showReview();
      else if (a === 'back') this.backToSwipe();
      else if (a === 'confirmTrash') this.confirmTrash();
      else if (a === 'cancelTrash') this.cancelTrash = true;
      else if (a === 'clearMarked') this.clearMarked();
      else if (a === 'toggleItem') this.toggleReviewItem(btn);
    }

    onPointerDown(e) {
      if (e.button !== 0 || this.screen !== 'swipe') return;
      if (e.target.closest('[data-a]')) return;
      const card = e.target.closest('.sp-card[data-depth="0"]');
      if (!card) return;
      e.preventDefault();
      card.setPointerCapture(e.pointerId);
      card.classList.add('is-dragging');
      this.deck.classList.add('is-dragging');

      const startX = e.clientX;
      const startY = e.clientY;
      let dx = 0;
      let dy = 0;
      let lastX = startX;
      let lastT = performance.now();
      let vx = 0;

      const move = (ev) => {
        dx = ev.clientX - startX;
        dy = (ev.clientY - startY) * 0.4;
        const now = performance.now();
        const dt = Math.max(1, now - lastT);
        vx = 0.8 * ((ev.clientX - lastX) / dt) + 0.2 * vx;
        lastX = ev.clientX;
        lastT = now;
        this.applyDrag(card, dx, dy);
      };
      const up = () => {
        card.removeEventListener('pointermove', move);
        card.removeEventListener('pointerup', up);
        card.removeEventListener('pointercancel', up);
        const flick = Math.abs(vx) > FLICK_VELOCITY && Math.abs(dx) > 30 && Math.sign(vx) === Math.sign(dx);
        if (Math.abs(dx) > SWIPE_THRESHOLD || flick) this.decide(dx < 0 ? 'left' : 'right', { dx, dy });
        else this.resetDrag(card);
      };
      card.addEventListener('pointermove', move);
      card.addEventListener('pointerup', up);
      card.addEventListener('pointercancel', up);
    }

    /** Two-finger horizontal trackpad swipe drives the card just like a drag. */
    onWheel(e) {
      if (this.screen === 'review') return; // let the review grid scroll
      e.preventDefault();
      if (this.screen !== 'swipe') return;
      const w = this.wheel;
      if (w.locked) {
        // Swallow the trackpad's momentum tail after a commit.
        clearTimeout(w.unlockTimer);
        w.unlockTimer = setTimeout(() => (w.locked = false), 220);
        return;
      }
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      const card = this.current() && this.cardEls.get(this.current().id);
      if (!card) return;

      w.dx -= e.deltaX;
      card.classList.add('is-dragging');
      this.deck.classList.add('is-dragging');
      this.applyDrag(card, w.dx, 0);
      clearTimeout(w.idleTimer);

      if (Math.abs(w.dx) > SWIPE_THRESHOLD * 1.3) {
        const dx = w.dx;
        w.dx = 0;
        w.locked = true;
        w.unlockTimer = setTimeout(() => (w.locked = false), 220);
        this.decide(dx < 0 ? 'left' : 'right', { dx, dy: 0 });
      } else {
        w.idleTimer = setTimeout(() => {
          w.dx = 0;
          this.resetDrag(card);
        }, 160);
      }
    }

    onKeyDown(e) {
      if (!this.isOpen || !e.isTrusted) return;
      const k = e.key;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && k.toLowerCase() === 'z' && this.screen === 'swipe') {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.undo();
        return;
      }
      if (mod || e.altKey) return; // leave browser shortcuts alone
      e.stopImmediatePropagation(); // keep Google Photos' own shortcuts from firing underneath

      if (this.screen === 'swipe') {
        if (k === 'ArrowLeft' || k === 'a' || k === 'A' || k === 'Delete') this.decide('left');
        else if (k === 'ArrowRight' || k === 'd' || k === 'D') this.decide('right');
        else if (k === 'z' || k === 'Z' || k === 'Backspace' || k === 'ArrowDown') this.undo();
        else if (k === 'o' || k === 'O' || k === 'ArrowUp') this.openCurrent();
        else if ((k === 'r' || k === 'R' || k === 'Enter') && this.store.marked.size) this.showReview();
        else if (k === 'Escape') this.close();
        else if (k !== ' ') return; // Space is swallowed so it can't "click" a focused button
      } else if (this.screen === 'review') {
        if (k === 'Escape') this.backToSwipe();
        else return;
      } else if (this.screen === 'done') {
        if (k === 'Escape') this.close();
        else if (k === 'Enter') this.backToSwipe();
        else return;
      } else if (this.screen === 'progress') {
        if (k === 'Escape') this.cancelTrash = true;
        else return;
      }
      e.preventDefault();
    }

    onKeyOther(e) {
      if (this.isOpen && e.isTrusted && !(e.metaKey || e.ctrlKey || e.altKey)) e.stopImmediatePropagation();
    }

    // ------------------------------------------------------------ review

    showReview() {
      const items = [...this.store.marked.values()];
      if (!items.length) return;
      this.reviewKeep.clear();
      const grid = this.refs.grid;
      grid.innerHTML = '';
      for (const item of items) {
        const tile = el(`
          <button class="sp-tile" data-a="toggleItem" data-id="${escapeHtml(item.id)}" title="Click to keep">
            <img alt="" loading="lazy" draggable="false">
            ${item.isVideo ? `<span class="sp-tile-video">${icon.play}</span>` : ''}
            <span class="sp-tile-mark">${icon.trash}</span>
            <span class="sp-tile-kept">${icon.heart}<span>Keep</span></span>
          </button>
        `);
        const img = tile.querySelector('img');
        img.src = item.thumb;
        img.onerror = () => {
          if (img.src !== item.src) img.src = item.src;
        };
        grid.appendChild(tile);
      }
      this.updateReviewCounts();
      this.setScreen('review');
      this.refs.grid.scrollTop = 0;
    }

    toggleReviewItem(btn) {
      const id = btn.dataset.id;
      if (this.reviewKeep.has(id)) this.reviewKeep.delete(id);
      else this.reviewKeep.add(id);
      btn.classList.toggle('is-kept', this.reviewKeep.has(id));
      this.updateReviewCounts();
    }

    updateReviewCounts() {
      const n = this.store.marked.size - this.reviewKeep.size;
      this.refs.reviewTitle.textContent = `${plural(n, 'photo')} to trash`;
      this.refs.confirmBtn.textContent = n ? `Move ${plural(n, 'item')} to trash` : 'Nothing to trash';
      this.refs.confirmBtn.disabled = n === 0;
    }

    /** Apply "keep after all" choices made in the review grid. */
    applyReviewKeeps() {
      const { store } = this;
      if (!this.reviewKeep.size) return;
      for (const id of this.reviewKeep) {
        store.marked.delete(id);
        store.kept.add(id);
        store.stats.kept++;
      }
      // Undo history would be confusing for these items now.
      this.session.history = this.session.history.filter((h) => !this.reviewKeep.has(h.item.id));
      this.reviewKeep.clear();
      store.saveMarked();
      store.saveKept();
      store.saveStats();
      this.updateCounters();
      this.emitChange();
    }

    backToSwipe() {
      if (this.screen === 'review') this.applyReviewKeeps();
      this.setScreen('swipe');
      this.renderDeck();
      this.renderLoading();
      if (this.remaining() < QUEUE_LOW_WATER) this.loadMore();
    }

    clearMarked() {
      const n = this.store.marked.size;
      if (!n || !window.confirm(`Clear ${plural(n, 'photo')} from the trash list? They won't be deleted.`)) return;
      this.store.marked.clear();
      this.session.history = this.session.history.filter((h) => h.dir !== 'left');
      this.store.saveMarked();
      this.updateCounters();
      this.emitChange();
      this.backToSwipe();
    }

    // ------------------------------------------------------------ trashing

    async confirmTrash() {
      this.applyReviewKeeps();
      const items = [...this.store.marked.values()];
      if (!items.length) return this.backToSwipe();

      // Let any in-flight loading step finish before we take over the grid's scroll position.
      while (this.loading) await dom.sleep(100);

      this.trashing = true;
      this.cancelTrash = false;
      this.setScreen('progress');
      this.overlay.classList.add('is-working');
      this.refs.cancelBtn.hidden = false;
      this.setProgress('Selecting photos…', `0 of ${items.length}`, 0);

      let result;
      try {
        result = await dom.trashItems(
          items,
          (phase, done, total) => {
            if (phase === 'select') this.setProgress('Selecting photos…', `${done} of ${total}`, done / total);
            else {
              this.refs.cancelBtn.hidden = true;
              this.setProgress('Moving to trash…', `${plural(done, 'item')} selected`, 1);
            }
          },
          () => this.cancelTrash
        );
      } catch (err) {
        console.error('[Swipe Photos] trash failed', err);
        result = { ok: false, selected: 0, missing: [], reason: 'error' };
      } finally {
        this.trashing = false;
        this.overlay.classList.remove('is-working');
      }
      this.finishTrash(items, result);
    }

    setProgress(title, sub, fraction) {
      this.refs.progressTitle.textContent = title;
      this.refs.progressSub.textContent = sub;
      this.refs.progressFill.style.width = `${Math.round(fraction * 100)}%`;
    }

    finishTrash(items, result) {
      const { store } = this;
      const missing = new Set(result.missing || []);

      if (result.reason === 'cancelled') {
        this.toast('Cancelled — nothing was moved to trash.');
        return this.backToSwipe();
      }

      const confirmed = result.ok || result.reason === 'timeout';
      if (confirmed) {
        for (const item of items) if (!missing.has(item.id)) store.marked.delete(item.id);
        store.stats.trashed += result.selected;
        store.saveMarked();
        store.saveStats();
        this.compensateForRemoved(items.filter((i) => !missing.has(i.id)));
        // Trashed items can't be "undone" from here.
        this.session.history = this.session.history.filter((h) => store.marked.has(h.item.id) || h.dir === 'right');
      }
      this.updateCounters();
      this.emitChange();

      const r = this.refs;
      r.continueBtn.hidden = false;
      this.overlay.querySelector('.sp-done').classList.toggle('is-error', !confirmed);
      if (confirmed) {
        r.doneIcon.innerHTML = icon.check;
        r.doneTitle.textContent = `${plural(result.selected, 'item')} moved to trash`;
        let sub = 'You can restore them from Trash in Google Photos for 60 days.';
        if (missing.size) sub += ` ${plural(missing.size, 'photo')} couldn’t be found in the grid and stay on your list.`;
        if (result.reason === 'timeout') sub = 'Google Photos is still finishing up — check your Trash in a moment.';
        r.doneSub.textContent = sub;
        this.celebrate();
      } else {
        r.doneIcon.innerHTML = icon.trash;
        r.doneTitle.textContent = 'Almost there';
        const reasons = {
          'trash-page': 'You’re on the Trash page. Open your library and try again.',
          'none-selected': 'Couldn’t find those photos in the grid. Open the library view they came from and try again.',
          'no-trash-button': `${plural(result.selected, 'item')} are selected in Google Photos, but this page has no trash button (albums only allow “remove”). Close this window and use the ⋮ menu → Move to trash.`,
          'no-confirm-dialog': `${plural(result.selected, 'item')} are selected. Close this window and click the trash icon (top right) to finish.`,
          error: 'Something went wrong. Your list is saved — try again.',
        };
        r.doneSub.textContent = reasons[result.reason] || reasons.error;
        r.continueBtn.hidden = result.selected > 0; // if items are selected, the user should finish in Google Photos
      }
      this.setScreen('done');
      this.renderDeck();
    }

    /**
     * Trashed tiles disappear from the grid, so everything below them moves up.
     * Shift our remembered positions so we can still find (and keep loading after) the rest.
     */
    compensateForRemoved(removed) {
      if (!removed.length) return;
      const shift = dom.estimateHeightOf(removed.length);
      const minOffset = Math.min(...removed.map((i) => i.offset));
      const adjust = (item) => {
        if (item.offset > minOffset) item.offset = Math.max(minOffset, item.offset - shift);
      };
      const s = this.session;
      s.queue.slice(s.pos).forEach(adjust);
      this.store.marked.forEach(adjust);
      this.store.saveMarked();
      // Back up generously; tiles we've already seen are de-duplicated anyway.
      s.cursor = Math.max(0, s.cursor - shift * 1.5);
    }

    celebrate() {
      const box = this.refs.confetti;
      box.innerHTML = '';
      const colors = ['#ff5f6d', '#7b5cff', '#2fd38a', '#ffc94d', '#4fc3ff'];
      for (let i = 0; i < 40; i++) {
        const p = document.createElement('i');
        const angle = Math.random() * Math.PI * 2;
        const dist = 90 + Math.random() * 160;
        p.style.setProperty('--x', `${Math.cos(angle) * dist}px`);
        p.style.setProperty('--y', `${Math.sin(angle) * dist - 60}px`);
        p.style.setProperty('--r', `${Math.random() * 720 - 360}deg`);
        p.style.background = colors[i % colors.length];
        p.style.animationDelay = `${Math.random() * 80}ms`;
        box.appendChild(p);
      }
    }
  }

  NS.SwipeApp = SwipeApp;
})();
