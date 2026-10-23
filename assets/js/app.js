/* =========================================================================
   CampusLend — application
   -------------------------------------------------------------------------
   Vanilla ES2020, no build step, no framework. The whole app is views that
   render into a shell, a hash router, and a chat thread that subscribes to the
   store. Everything user-supplied is escaped before it reaches innerHTML.
   ========================================================================= */

(function () {
  'use strict';

  const S = window.CL.store;
  const CFG = window.CL_CONFIG;

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /* ------------------------------------------------------------- helpers */

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function initials(name) {
    const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function hueOf(id) {
    let h = 0;
    for (let i = 0; i < String(id).length; i++) h = (h * 31 + String(id).charCodeAt(i)) % 360;
    return h;
  }

  function avatar(person, cls) {
    const name = person && person.full_name ? person.full_name : '?';
    const url = person && person.avatar_url;
    const h = hueOf((person && person.id) || name);
    const style = `background:linear-gradient(140deg,hsl(${h},52%,52%),hsl(${(h + 34) % 360},56%,38%))`;
    return `<span class="avatar ${cls || ''}" style="${style}">${
      url ? `<img src="${esc(url)}" alt="" loading="lazy">` : esc(initials(name))
    }</span>`;
  }

  function ratingLabel(p) {
    if (!p || !p.rating_count) return 'New here';
    const avg = (p.rating_sum / p.rating_count).toFixed(1);
    return avg + ' ★ · ' + p.rating_count + (p.rating_count === 1 ? ' rental' : ' rentals');
  }

  const CATEGORY_PATHS = {
    electronics: "M13 2 4 14h6l-1 8 9-12h-6Z",
    study: "M4 20h4L20 8l-4-4L4 16Z M14 6l4 4",
    transport: "m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z M9 3v15 M15 6v15",
    events: "m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9Z",
    sports: "M12 3 5 6v6c0 4.5 3 8 7 9 4-1 7-4.5 7-9V6Z",
    all: "M3 10.5 12 3l9 7.5 M5.5 9.5V20h13V9.5",
  };

  /** A deterministic, tasteful stand-in for a photo, drawn as an inline SVG. */
  function art(item) {
    const h = item.hue == null ? hueOf(item.title || item.id) : item.hue;
    const path = CATEGORY_PATHS[item.category] || CATEGORY_PATHS.all;
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">` +
        `<defs>` +
          `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
            `<stop offset="0" stop-color="hsl(${h},58%,80%)"/>` +
            `<stop offset="1" stop-color="hsl(${(h + 30) % 360},52%,58%)"/>` +
          `</linearGradient>` +
        `</defs>` +
        `<rect width="800" height="600" fill="url(#g)"/>` +
        `<circle cx="660" cy="90" r="150" fill="white" opacity="0.08"/>` +
        `<circle cx="110" cy="540" r="190" fill="white" opacity="0.07"/>` +
        `<g transform="translate(400 300) scale(11) translate(-12 -12)" fill="none" stroke="white" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" opacity="0.45"><path d="${path}"/></g>` +
      `</svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function photoOf(item) {
    return item.photo_url || art(item);
  }

  function timeShort(iso) {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function dayStart(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x.getTime();
  }

  function dayLabel(iso) {
    const d = new Date(iso);
    const today = dayStart(Date.now());
    const day = dayStart(d);
    const diff = Math.round((today - day) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return d.toLocaleDateString([], { weekday: 'long' });
    return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function listTime(iso) {
    if (!iso) return '';
    const today = dayStart(Date.now());
    const day = dayStart(iso);
    const diff = Math.round((today - day) / 86400000);
    if (diff === 0) return timeShort(iso);
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return new Date(iso).toLocaleDateString([], { weekday: 'short' });
    return new Date(iso).toLocaleDateString([], { day: '2-digit', month: '2-digit' });
  }

  let toastTimer = null;
  function toast(msg, kind) {
    const box = $('#toasts');
    const el = document.createElement('div');
    el.className = 'toast' + (kind === 'err' ? ' toast--err' : '');
    el.innerHTML = `<svg><use href="#${kind === 'err' ? 'i-close' : 'i-check-circle'}"/></svg><span>${esc(msg)}</span>`;
    box.appendChild(el);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(6px)'; }, 2600);
    setTimeout(() => el.remove(), 3100);
  }

  /* --------------------------------------------------------------- state */

  const state = {
    me: null,
    view: 'market',
    query: '',
    category: 'all',
    listings: [],
    conversations: [],
    activeConv: null,
    messages: [],
    typing: null,
    threadBusy: false,
  };

  /* ---------------------------------------------------------------- auth */

  let authEmail = '';

  function showAuth() {
    $('#auth').hidden = false;
    $('#app').hidden = true;
  }

  function showApp() {
    $('#auth').hidden = true;
    $('#app').hidden = false;
  }

  function authError(msg) {
    const el = $('#auth-error');
    if (!msg) { el.hidden = true; el.textContent = ''; return; }
    el.hidden = false;
    el.textContent = msg;
  }

  async function submitAuth(e) {
    e.preventDefault();
    authError('');
    const btn = $('#auth-submit');
    const codeField = $('#field-code');

    try {
      if (codeField.hidden) {
        const email = $('#auth-email').value.trim();
        if (!email) return;
        btn.disabled = true;
        btn.textContent = 'Sending…';
        await S.signIn(email);
        authEmail = email;
        codeField.hidden = false;
        $('#auth-code').focus();
        $('#auth-title').textContent = 'Check your email';
        $('#auth-lede').textContent = 'We sent a six-digit code to ' + email + '. It expires in a few minutes.';
        $('#auth-back').hidden = false;
        btn.textContent = 'Verify code';
        if (S.mode === 'demo') toast('Demo mode — the code is 123456');
      } else {
        const code = $('#auth-code').value.trim();
        if (!code) return;
        btn.disabled = true;
        btn.textContent = 'Verifying…';
        const me = await S.verify(authEmail, code);
        state.me = me;
        showApp();
        await bootApp();
      }
    } catch (err) {
      authError(err.message || 'Something went wrong.');
    } finally {
      btn.disabled = false;
      if (codeField.hidden) btn.textContent = 'Send code';
    }
  }

  function resetAuthForm() {
    $('#field-code').hidden = true;
    $('#auth-code').value = '';
    $('#auth-title').textContent = 'Sign in';
    $('#auth-lede').textContent = "Use your college email. We'll send a six-digit code — no password to remember.";
    $('#auth-back').hidden = true;
    $('#auth-submit').textContent = 'Send code';
    authError('');
    $('#auth-email').focus();
  }

  /* -------------------------------------------------------------- router */

  const VIEWS = ['market', 'chats', 'selling', 'profile'];

  function route() {
    const hash = location.hash.replace(/^#\/?/, '');
    const name = hash.split('/')[0] || 'market';
    const view = VIEWS.includes(name) ? name : 'market';
    setView(view);
  }

  function setView(view) {
    state.view = view;
    document.body.dataset.view = view;
    VIEWS.forEach((v) => {
      const sec = $('#view-' + v);
      if (sec) sec.hidden = v !== view;
    });
    $$('[data-nav]').forEach((a) => {
      const on = a.dataset.nav === view;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });

    const titles = {
      market: ['Market', CFG.campus.name],
      chats: ['Chats', ''],
      selling: ['Your listings', ''],
      profile: ['Profile', ''],
    };
    $('#page-title').textContent = titles[view][0];
    $('#page-sub').textContent = titles[view][1];

    $('#btn-back').hidden = true;

    if (view === 'market') loadMarket();
    if (view === 'chats') loadConversations();
    if (view === 'selling') loadSelling();
    if (view === 'profile') renderProfile();
  }

  /* -------------------------------------------------------------- market */

  function renderCategories() {
    const box = $('#category-chips');
    box.innerHTML = S.categories.map((c) => `
      <button class="chip ${state.category === c.id ? 'is-active' : ''}" type="button" data-cat="${c.id}" role="tab" aria-selected="${state.category === c.id}">
        <svg aria-hidden="true"><use href="#${c.icon}"/></svg>${esc(c.label)}
      </button>`).join('');
  }

  function card(item) {
    const mine = state.me && item.owner_id === state.me.id;
    return `
      <button class="card" type="button" data-item="${esc(item.id)}">
        <span class="card__media">
          <img src="${esc(photoOf(item))}" alt="" loading="lazy" decoding="async">
          <span class="card__price">₹${esc(item.price_per_hour)}<small>/hr</small></span>
          ${mine ? '<span class="card__badge card__badge--mine">Yours</span>' : ''}
        </span>
        <span class="card__body">
          <span class="card__title">${esc(item.title)}</span>
          <span class="card__meta"><svg aria-hidden="true"><use href="#i-pin"/></svg>${esc(item.location || 'Campus')}</span>
          <span class="card__owner">${avatar(item.owner, 'avatar--sm')}<span>${esc(item.owner ? item.owner.full_name : 'Someone')}</span></span>
        </span>
      </button>`;
  }

  async function loadMarket() {
    renderCategories();
    const grid = $('#market-grid');
    grid.innerHTML = '<div class="empty"><p>Loading…</p></div>';
    try {
      state.listings = await S.listings({ q: state.query, category: state.category });
      $('#market-count').textContent = state.listings.length
        ? state.listings.length + (state.listings.length === 1 ? ' item' : ' items')
        : '';
      $('#market-heading').textContent = state.query.trim() ? 'Results' : (state.category === 'all' ? 'Near you' : 'In ' + catLabel(state.category));

      if (!state.listings.length) {
        const scoped = state.category !== 'all';
        grid.innerHTML = `
          <div class="empty" style="grid-column:1/-1">
            <div class="empty__glyph"><svg><use href="#i-search"/></svg></div>
            <h3>${state.query.trim() ? 'Nothing matches that' : 'Nothing here yet'}</h3>
            <p>${state.query.trim()
              ? (scoped ? 'Nothing in this category matches. It may be in another one.' : 'Try a broader word, or check the spelling.')
              : 'Be the first to list something in this category.'}</p>
            ${scoped && state.query.trim()
              ? '<button class="btn btn--ghost" type="button" data-cat="all">Search everything</button>'
              : ''}
          </div>`;
        return;
      }
      grid.innerHTML = state.listings.map(card).join('');
    } catch (err) {
      grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><h3>Could not load</h3><p>${esc(err.message)}</p></div>`;
    }
  }

  function catLabel(id) {
    const c = S.categories.find((x) => x.id === id);
    return c ? c.label : id;
  }

  /* ---------------------------------------------------------- item sheet */

  async function openItem(id) {
    const sheet = $('#sheet');
    const cardEl = $('#sheet-card');
    cardEl.innerHTML = '<div class="sheet__body"><p class="muted">Loading…</p></div>';
    sheet.hidden = false;
    document.body.style.overflow = 'hidden';

    try {
      const item = await S.listing(id);
      if (!item) throw new Error('That listing is no longer available.');
      const mine = state.me && item.owner_id === state.me.id;
      const owner = item.owner || {};

      cardEl.innerHTML = `
        <div class="sheet__hero">
          <img src="${esc(photoOf(item))}" alt="">
          <button class="sheet__close" type="button" data-close="sheet" aria-label="Close"><svg><use href="#i-close"/></svg></button>
        </div>
        <div class="sheet__body">
          <div class="sheet__price"><strong>₹${esc(item.price_per_hour)}</strong><span>per hour</span></div>
          <h2 class="sheet__title" id="sheet-title">${esc(item.title)}</h2>
          <div class="facts">
            <span class="fact"><svg><use href="#i-pin"/></svg>${esc(item.location || 'Campus')}</span>
            <span class="fact"><svg><use href="#i-shield"/></svg>${esc(condLabel(item.condition))}</span>
            <span class="fact"><svg><use href="#i-tag"/></svg>${esc(catLabel(item.category))}</span>
          </div>
          ${item.description ? `<p class="sheet__desc">${esc(item.description)}</p>` : ''}

          <div class="owner">
            ${avatar(owner)}
            <div class="owner__main">
              <div class="owner__name">${esc(owner.full_name || 'Someone')}</div>
              <div class="owner__sub"><svg><use href="#i-star"/></svg>${esc(ratingLabel(owner))}</div>
            </div>
          </div>

          <div class="sheet__actions">
            ${mine
              ? `<button class="btn btn--outline" type="button" data-del="${esc(item.id)}"><svg><use href="#i-trash"/></svg>Remove listing</button>`
              : `<button class="btn btn--ghost" type="button" data-chat="${esc(item.id)}"><svg><use href="#i-chat"/></svg>Message</button>
                 <button class="btn btn--primary" type="button" data-chat="${esc(item.id)}">Request this</button>`}
          </div>
          <p class="sheet__note">Pay the owner directly over UPI when you return it. CampusLend never holds your money.</p>
        </div>`;
    } catch (err) {
      cardEl.innerHTML = `<div class="sheet__body"><p>${esc(err.message)}</p></div>`;
    }
  }

  function condLabel(c) {
    return ({ 'like-new': 'Like new', good: 'Good', fair: 'Fair' })[c] || c || 'Good';
  }

  function closeSheet() {
    $('#sheet').hidden = true;
    document.body.style.overflow = '';
  }

  async function startChatFromItem(listingId) {
    const item = await S.listing(listingId);
    if (!item) return;
    if (state.me && item.owner_id === state.me.id) { toast('That one is yours.'); return; }
    const convId = await S.openConversation({ listingId, otherId: item.owner_id });
    closeSheet();
    location.hash = '#/chats';
    setView('chats');
    await loadConversations();
    openThread(convId);
  }

  /* --------------------------------------------------------------- chats */

  function chatItem(c) {
    const last = c.last;
    const mine = last && state.me && last.sender_id === state.me.id;
    const preview = last
      ? (last.image_url && !last.body ? 'Photo' : (last.body || ''))
      : 'Say hello';
    const tick = mine ? `<svg class="tick ${last.read_at ? 'tick--read' : 'tick--sent'}" style="width:14px;height:14px"><use href="#${last.read_at ? 'i-checks' : 'i-check'}"/></svg>` : '';

    return `
      <button class="chatitem ${state.activeConv === c.id ? 'is-active' : ''}" type="button" data-conv="${esc(c.id)}">
        ${avatar(c.other)}
        <span class="chatitem__main">
          <span class="chatitem__top">
            <span class="chatitem__name">${esc(c.other ? c.other.full_name : 'Someone')}</span>
            <span class="chatitem__time">${esc(listTime(c.last ? c.last.created_at : c.created_at))}</span>
          </span>
          <span class="chatitem__bottom">
            <span class="chatitem__preview">${tick}${esc(preview)}</span>
            ${c.unread ? `<span class="chatitem__unread">${c.unread > 9 ? '9+' : c.unread}</span>` : ''}
          </span>
        </span>
      </button>`;
  }

  async function loadConversations() {
    try {
      state.conversations = await S.conversations();
      $('#chatlist').innerHTML = state.conversations.map(chatItem).join('');
      $('#chats-empty').hidden = state.conversations.length > 0;
      updateUnread();
    } catch (err) {
      $('#chatlist').innerHTML = `<div class="empty empty--sm"><p>${esc(err.message)}</p></div>`;
    }
  }

  function updateUnread() {
    const total = state.conversations.reduce((n, c) => n + (c.unread || 0), 0);
    [['#tab-unread'], ['#rail-unread']].forEach(([sel]) => {
      const el = $(sel);
      if (!el) return;
      el.hidden = !total;
      el.textContent = total > 9 ? '9+' : String(total);
    });
  }

  function renderMessages() {
    const box = $('#thread-messages');
    if (!state.messages.length) {
      box.innerHTML = '<div class="thread__empty-state">No messages yet. Say hello — tell them when you need it.</div>';
      return;
    }

    const me = state.me ? state.me.id : null;
    let lastDay = null;
    let prev = null;
    const out = [];

    for (const m of state.messages) {
      const day = dayStart(m.created_at);
      if (day !== lastDay) {
        out.push(`<div class="daysep"><span>${esc(dayLabel(m.created_at))}</span></div>`);
        lastDay = day;
        prev = null;
      }

      const mine = m.sender_id === me;
      const grouped = prev && prev.sender_id === m.sender_id &&
        (new Date(m.created_at) - new Date(prev.created_at)) < 5 * 60000 &&
        dayStart(prev.created_at) === day;

      const other = state.activeConv ? otherOf(state.activeConv) : null;
      const showAvatar = !mine && !grouped;

      const tick = mine
        ? `<svg class="tick ${m.read_at ? 'tick--read' : 'tick--sent'}"><use href="#${m.read_at ? 'i-checks' : 'i-check'}"/></svg>`
        : '';

      const body = m.image_url
        ? `<div class="bubble bubble--img"><img src="${esc(m.image_url)}" alt="Photo" loading="lazy" onerror="this.style.display='none'"><span class="bubble__meta">${esc(timeShort(m.created_at))} ${tick}</span></div>`
        : `<div class="bubble">${esc(m.body)}<span class="bubble__meta">${esc(timeShort(m.created_at))} ${tick}</span></div>`;

      out.push(
        `<div class="msg ${mine ? 'msg--out' : 'msg--in'} ${grouped ? 'msg--grouped' : ''} ${m._pending ? 'msg__pending' : ''}">` +
          (showAvatar ? avatar(other, 'avatar--sm msg__avatar') : (grouped ? '' : '')) +
          body +
        `</div>`
      );
      prev = m;
    }

    box.innerHTML = out.join('');
  }

  function otherOf(convId) {
    const c = state.conversations.find((x) => x.id === convId);
    return c ? c.other : null;
  }

  async function openThread(convId) {
    state.activeConv = convId;
    const c = state.conversations.find((x) => x.id === convId);
    if (!c) return;

    $('#thread-empty').hidden = true;
    $('#thread').hidden = false;
    $('#chats-layout').classList.add('is-thread');
    document.body.classList.add('is-threading');

    $('#thread-head').innerHTML = `
      <button class="iconbtn" id="thread-back" type="button" aria-label="Back to chats"><svg><use href="#i-back"/></svg></button>
      ${avatar(c.other)}
      <div class="thread__head-main">
        <div class="thread__head-name">${esc(c.other ? c.other.full_name : 'Someone')}</div>
        <div class="thread__head-sub"><span class="dot dot--off"></span>${esc(ratingLabel(c.other))}</div>
      </div>
      ${c.listing ? `<button class="iconbtn" type="button" data-item="${esc(c.listing.id)}" aria-label="View listing"><svg><use href="#i-eye"/></svg></button>` : ''}`;

    state.messages = await S.messages(convId);
    renderMessages();
    scrollToEnd(true);

    S.subscribe(convId);

    // Reading is a write, and a slow one; it must not hold up the render.
    S.markRead(convId).then(() => {
      state.conversations = state.conversations.map((x) => x.id === convId ? { ...x, unread: 0 } : x);
      $('#chatlist').innerHTML = state.conversations.map(chatItem).join('');
      updateUnread();
    }).catch(() => {});

    $('#composer-input').focus({ preventScroll: true });
  }

  function closeThread() {
    state.activeConv = null;
    $('#thread').hidden = true;
    $('#thread-empty').hidden = false;
    $('#chats-layout').classList.remove('is-thread');
    document.body.classList.remove('is-threading');
    loadConversations();
  }

  function scrollToEnd(force) {
    const sc = $('#thread-scroll');
    if (!sc) return;
    const near = sc.scrollHeight - sc.scrollTop - sc.clientHeight < 160;
    if (force || near) {
      requestAnimationFrame(() => { sc.scrollTop = sc.scrollHeight; });
    }
  }

  function showTyping(info) {
    const el = $('#typing');
    if (!info || !info.userId) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    el.innerHTML = `<span class="typing__dots"><i></i><i></i><i></i></span>${esc(info.name || 'They')} is typing`;
  }

  async function sendMessage() {
    const input = $('#composer-input');
    const body = input.value.trim();
    if (!body || !state.activeConv) return;

    input.value = '';
    autoGrow(input);
    $('#btn-send').disabled = true;

    // Optimistic: the bubble appears immediately, then the real row replaces it.
    const temp = {
      id: 'tmp-' + Date.now(),
      conversation_id: state.activeConv,
      sender_id: state.me.id,
      body,
      created_at: new Date().toISOString(),
      read_at: null,
      _pending: true,
    };
    state.messages.push(temp);
    renderMessages();
    scrollToEnd(true);

    try {
      const saved = await S.send(state.activeConv, { body });
      const i = state.messages.findIndex((m) => m.id === temp.id);
      if (i >= 0) state.messages[i] = saved;
      renderMessages();
      scrollToEnd();
      loadConversations();
    } catch (err) {
      const i = state.messages.findIndex((m) => m.id === temp.id);
      if (i >= 0) state.messages.splice(i, 1);
      renderMessages();
      toast(err.message || 'Message did not send.', 'err');
    }
  }

  async function sendImage(file) {
    if (!file || !state.activeConv) return;
    try {
      toast('Uploading photo…');
      const url = await S.uploadImage(file);
      await S.send(state.activeConv, { image: url, body: '' });
      state.messages = await S.messages(state.activeConv);
      renderMessages();
      scrollToEnd(true);
      loadConversations();
    } catch (err) {
      toast(err.message || 'Could not send that photo.', 'err');
    }
  }

  function autoGrow(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 132) + 'px';
  }

  /* -------------------------------------------------------------- selling */

  async function loadSelling() {
    const grid = $('#selling-grid');
    grid.innerHTML = '<div class="empty"><p>Loading…</p></div>';
    try {
      const mine = await S.myListings();
      $('#selling-count').textContent = mine.length ? mine.length + ' live' : '';
      $('#selling-empty').hidden = mine.length > 0;
      grid.innerHTML = mine.length ? mine.map(card).join('') : '';
    } catch (err) {
      grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><h3>Could not load</h3><p>${esc(err.message)}</p></div>`;
    }
  }

  /* -------------------------------------------------------------- profile */

  function renderProfile() {
    const me = state.me || {};
    const avg = me.rating_count ? (me.rating_sum / me.rating_count) : 0;
    const pct = Math.max(0.04, Math.min(1, avg / 5));
    const C = 2 * Math.PI * 26;
    const offset = C * (1 - pct);

    $('#profile').innerHTML = `
      <div class="profile__card">
        <div class="profile__hero">
          ${avatar(me, 'avatar--lg')}
          <div>
            <div class="profile__name">${esc(me.full_name || 'You')}</div>
            <div class="profile__email">${esc(me.email || '')}</div>
          </div>
        </div>
        <div class="trust">
          <div class="trust__ring">
            <svg viewBox="0 0 62 62" aria-hidden="true">
              <circle class="bg" cx="31" cy="31" r="26"/>
              <circle class="fg" cx="31" cy="31" r="26"
                stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"
                transform="rotate(-90 31 31)"/>
            </svg>
            <span class="trust__num">${avg ? avg.toFixed(1) : '—'}</span>
          </div>
          <div class="trust__text">
            <h4>${esc(ratingLabel(me))}</h4>
            <p>${me.rating_count ? 'Built from rentals that were returned on time.' : 'Complete your first rental to start building trust.'}</p>
          </div>
        </div>
      </div>

      <div class="profile__card">
        <div class="prow">
          <span class="prow__icon"><svg><use href="#i-shield"/></svg></span>
          <span class="prow__main"><span class="prow__label">Campus</span><span class="prow__sub">Only students here can sign in</span></span>
          <span class="prow__value">${esc(CFG.campus.name)}</span>
        </div>
        <div class="prow">
          <span class="prow__icon"><svg><use href="#i-bolt"/></svg></span>
          <span class="prow__main"><span class="prow__label">Backend</span><span class="prow__sub">${S.mode === 'live' ? 'Connected to Supabase' : 'Local demo data on this device'}</span></span>
          <span class="prow__value">${S.mode === 'live' ? 'Live' : 'Demo'}</span>
        </div>
        <div class="prow">
          <span class="prow__icon"><svg><use href="#i-eye"/></svg></span>
          <span class="prow__main"><span class="prow__label">Appearance</span><span class="prow__sub">Follows your device</span></span>
          <button class="btn btn--outline btn--sm" type="button" id="btn-theme">Toggle</button>
        </div>
      </div>

      <button class="btn btn--danger btn--block" type="button" id="btn-signout">
        <svg><use href="#i-logout"/></svg>Sign out
      </button>

      ${S.mode === 'demo' ? `
        <p class="auth__fine" style="margin-top:18px">
          This is a demo. Data lives in this browser only, and the replies you get
          are simulated. To make it real, add your Supabase URL and anon key to
          <code>assets/js/config.js</code>.
        </p>` : ''}
    `;
  }

  /* ----------------------------------------------------------------- post */

  function openPost() {
    const sel = $('#post-category');
    sel.innerHTML = S.categories.filter((c) => c.id !== 'all')
      .map((c) => `<option value="${c.id}">${esc(c.label)}</option>`).join('');
    $('#post-error').hidden = true;
    $('#post-sheet').hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closePost() {
    $('#post-sheet').hidden = true;
    document.body.style.overflow = '';
    $('#post-form').reset();
  }

  async function submitPost(e) {
    e.preventDefault();
    const form = new FormData($('#post-form'));
    const data = Object.fromEntries(form.entries());
    const errEl = $('#post-error');
    const btn = $('#post-form button[type="submit"]');

    try {
      btn.disabled = true;
      btn.textContent = 'Publishing…';
      await S.createListing(data);
      closePost();
      toast('Listed. It is live in the market.');
      setView(state.view === 'selling' ? 'selling' : 'market');
      if (state.view === 'market') loadMarket(); else loadSelling();
    } catch (err) {
      errEl.hidden = false;
      errEl.textContent = err.message || 'Could not publish that.';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Publish listing';
    }
  }

  /* ---------------------------------------------------------------- theme */

  function applyTheme() {
    let saved = null;
    try { saved = localStorage.getItem('campuslend.theme'); } catch (e) {}
    const theme = saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0A1016' : '#0B7A5A');
  }

  function toggleTheme() {
    const now = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('campuslend.theme', now); } catch (e) {}
    document.documentElement.setAttribute('data-theme', now);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', now === 'dark' ? '#0A1016' : '#0B7A5A');
  }

  /* ----------------------------------------------------------------- boot */

  async function bootApp() {
    $('#rail-avatar').innerHTML = avatar(state.me).replace(/^<span[^>]*>/, '').replace(/<\/span>$/, '');
    await loadConversations();
    route();
  }

  function wire() {
    $('#auth-form').addEventListener('submit', submitAuth);
    $('#auth-back').addEventListener('click', resetAuthForm);

    // Delegated navigation for anything with data-nav.
    document.addEventListener('click', (e) => {
      const nav = e.target.closest('[data-nav]');
      if (nav) return; // the hash change does the work

      const cat = e.target.closest('[data-cat]');
      if (cat) { state.category = cat.dataset.cat; loadMarket(); return; }

      const item = e.target.closest('[data-item]');
      if (item) { openItem(item.dataset.item); return; }

      const talk = e.target.closest('[data-chat]');
      if (talk) { startChatFromItem(talk.dataset.chat); return; }

      const conv = e.target.closest('[data-conv]');
      if (conv) { openThread(conv.dataset.conv); return; }

      const del = e.target.closest('[data-del]');
      if (del) { removeListing(del.dataset.del); return; }

      const act = e.target.closest('[data-act="post"]');
      if (act) { openPost(); return; }

      const close = e.target.closest('[data-close]');
      if (close) {
        if (close.dataset.close === 'sheet') closeSheet();
        if (close.dataset.close === 'post-sheet') closePost();
        return;
      }

      if (e.target.closest('#btn-post')) { openPost(); return; }
      if (e.target.closest('#thread-back')) { closeThread(); return; }
      if (e.target.closest('#btn-theme')) { toggleTheme(); return; }
      if (e.target.closest('#btn-signout')) { signOut(); return; }
      if (e.target.closest('#rail-avatar')) { location.hash = '#/profile'; return; }
    });

    $('#search-input').addEventListener('input', debounce((e) => {
      state.query = e.target.value;
      $('#search-clear').hidden = !state.query;
      loadMarket();
    }, 220));

    $('#search-clear').addEventListener('click', () => {
      state.query = '';
      $('#search-input').value = '';
      $('#search-clear').hidden = true;
      loadMarket();
    });

    $('#chat-search').addEventListener('input', debounce((e) => {
      const q = e.target.value.trim().toLowerCase();
      const rows = state.conversations.filter((c) => {
        const name = c.other && c.other.full_name ? c.other.full_name : '';
        const last = c.last && c.last.body ? c.last.body : '';
        return !q || (name + ' ' + last).toLowerCase().includes(q);
      });
      $('#chatlist').innerHTML = rows.map(chatItem).join('');
    }, 160));

    $('#composer').addEventListener('submit', (e) => { e.preventDefault(); sendMessage(); });

    const input = $('#composer-input');
    input.addEventListener('input', () => {
      autoGrow(input);
      $('#btn-send').disabled = !input.value.trim();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });

    $('#btn-attach').addEventListener('click', () => $('#file-input').click());
    $('#file-input').addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) sendImage(f);
      e.target.value = '';
    });

    $('#post-form').addEventListener('submit', submitPost);

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!$('#sheet').hidden) closeSheet();
      if (!$('#post-sheet').hidden) closePost();
    });

    window.addEventListener('hashchange', route);

    // Realtime: one subscription to the bus, which both backends emit into.
    S.on('message', ({ conversationId, message }) => {
      if (conversationId !== state.activeConv) { loadConversations(); return; }
      if (state.messages.find((m) => m.id === message.id)) return;
      state.messages.push(message);
      renderMessages();
      scrollToEnd();
      S.markRead(conversationId).catch(() => {});
      loadConversations();
    });

    S.on('typing', (info) => {
      if (info.conversationId !== state.activeConv) return;
      showTyping(info);
    });

    S.on('read', () => {
      if (!state.activeConv) return;
      S.messages(state.activeConv).then((rows) => {
        state.messages = rows;
        renderMessages();
      }).catch(() => {});
    });

    window.addEventListener('online', () => toast('Back online'));
    window.addEventListener('offline', () => toast('You are offline', 'err'));
  }

  function debounce(fn, ms) {
    let t = null;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  async function removeListing(id) {
    if (!window.confirm('Remove this listing from the market?')) return;
    try {
      await S.deleteListing(id);
      closeSheet();
      toast('Listing removed');
      setView(state.view === 'selling' ? 'selling' : 'market');
      if (state.view === 'market') loadMarket(); else loadSelling();
    } catch (err) {
      toast(err.message || 'Could not remove that.', 'err');
    }
  }

  async function signOut() {
    await S.signOut();
    state.me = null;
    state.activeConv = null;
    state.messages = [];
    state.conversations = [];
    closeThread();
    showAuth();
    resetAuthForm();
    $('#auth-email').value = '';
  }

  async function boot() {
    applyTheme();
    wire();

    const saved = await S.start();
    if (saved) {
      state.me = saved;
      showApp();
      await bootApp();
    } else {
      showAuth();
      $('#auth-email').focus();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
