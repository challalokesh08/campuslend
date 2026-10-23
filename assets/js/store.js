/* =========================================================================
   CampusLend — data layer
   -------------------------------------------------------------------------
   One interface, two implementations:

     DEMO  — localStorage, seeded data, simulated replies. Works with no
             backend at all, which is why the deployed site is useful before
             anyone has created a Supabase project.
     LIVE  — Supabase Auth + Postgres + Realtime.

   The UI only ever talks to CL.store, so switching backends changes nothing
   above this file. That is the whole point of the split: the chat in demo mode
   is the same chat, so the layout, the ticks and the typing indicator are all
   exercised before a single row reaches Postgres.
   ========================================================================= */

(function () {
  'use strict';

  const CFG = window.CL_CONFIG;
  const LIVE = Boolean(CFG.supabaseUrl && CFG.supabaseAnonKey);
  const DEMO_KEY = 'campuslend.demo.v1';
  const SESSION_KEY = 'campuslend.demo.session';

  /* ---------------------------------------------------------------- demo */

  const SEED_USERS = [
    { id: 'u-aarav', full_name: 'Aarav Sharma', email: 'aarav.s@cambridge.edu.in', campus: 'Cambridge Institute of Technology', rating_sum: 47, rating_count: 9 },
    { id: 'u-diya', full_name: 'Diya Menon', email: 'diya.m@cambridge.edu.in', campus: 'Cambridge Institute of Technology', rating_sum: 29, rating_count: 6 },
    { id: 'u-sneha', full_name: 'Sneha Kulkarni', email: 'sneha.k@cambridge.edu.in', campus: 'Cambridge Institute of Technology', rating_sum: 61, rating_count: 12 },
    { id: 'u-rahul', full_name: 'Rahul Verma', email: 'rahul.v@cambridge.edu.in', campus: 'Cambridge Institute of Technology', rating_sum: 18, rating_count: 4 },
    { id: 'u-isha', full_name: 'Isha Nair', email: 'isha.n@cambridge.edu.in', campus: 'Cambridge Institute of Technology', rating_sum: 39, rating_count: 8 },
  ];

  const ME = { id: 'u-me', full_name: 'You', email: 'you@cambridge.edu.in', campus: 'Cambridge Institute of Technology', rating_sum: 22, rating_count: 5 };

  const CATEGORIES = [
    { id: 'all', label: 'Everything', icon: 'i-market' },
    { id: 'electronics', label: 'Electronics', icon: 'i-bolt' },
    { id: 'study', label: 'Study', icon: 'i-edit' },
    { id: 'transport', label: 'Transport', icon: 'i-map' },
    { id: 'events', label: 'Events', icon: 'i-star' },
    { id: 'sports', label: 'Sports', icon: 'i-shield' },
  ];

  const SEED_LISTINGS = [
    { title: 'Casio FX-991EX calculator', category: 'study', price: 20, location: 'Block C, 2nd floor', condition: 'like-new', owner: 'u-diya', description: 'The one the exam allows. Fresh battery, cover included.', hue: 158 },
    { title: 'Hero Sprint cycle', category: 'transport', price: 35, location: 'Cycle stand, Gate 2', condition: 'good', owner: 'u-aarav', description: 'Gears work, brakes are new. Comes with a lock.', hue: 205 },
    { title: 'DSLR for club shoots', category: 'electronics', price: 150, location: 'Media room', condition: 'good', owner: 'u-sneha', description: 'Canon 200D with a 50mm lens. Two batteries, one charger.', hue: 268 },
    { title: 'Lab coat, size M', category: 'study', price: 10, location: 'Hostel B', condition: 'good', owner: 'u-rahul', description: 'Washed and ironed. Saved my practical marks twice.', hue: 190 },
    { title: 'Bluetooth speaker', category: 'events', price: 60, location: 'Block A common room', condition: 'good', owner: 'u-isha', description: 'Loud enough for a 40-person room. Charged.', hue: 22 },
    { title: 'Badminton racket pair', category: 'sports', price: 25, location: 'Sports complex', condition: 'fair', owner: 'u-aarav', description: 'Two rackets and a tube of shuttles.', hue: 142 },
    { title: 'Graphing calculator TI-84', category: 'study', price: 30, location: 'Library desk 4', condition: 'good', owner: 'u-sneha', description: 'For the stats paper. Works, screen is clean.', hue: 330 },
    { title: 'Projector, 720p', category: 'events', price: 200, location: 'Seminar hall store', condition: 'good', owner: 'u-diya', description: 'HDMI cable included. Needs a wall socket nearby.', hue: 240 },
    { title: 'Trekking backpack, 50L', category: 'transport', price: 40, location: 'Hostel C', condition: 'like-new', owner: 'u-rahul', description: 'Rain cover included. Did one Coorg trip.', hue: 95 },
    { title: 'USB-C dock', category: 'electronics', price: 45, location: 'Block D, 3rd floor', condition: 'like-new', owner: 'u-isha', description: 'HDMI, two USB-A, SD card reader. For presentations.', hue: 285 },
    { title: 'Cricket bat and ball', category: 'sports', price: 20, location: 'Ground equipment room', condition: 'fair', owner: 'u-diya', description: 'Kashmir willow. Grip is worn but it plays fine.', hue: 40 },
    { title: 'Formal shoes, UK 8', category: 'events', price: 30, location: 'Hostel A', condition: 'good', owner: 'u-rahul', description: 'For placements. Polished, barely worn.', hue: 210 },
  ];

  function seed() {
    const now = Date.now();
    const listings = SEED_LISTINGS.map((l, i) => ({
      id: 'l-' + (i + 1),
      owner_id: l.owner,
      title: l.title,
      description: l.description,
      category: l.category,
      price_per_hour: l.price,
      location: l.location,
      condition: l.condition,
      photo_url: null,
      hue: l.hue,
      status: 'active',
      created_at: new Date(now - (i + 1) * 3600e3).toISOString(),
    }));

    const messages = [
      { id: 'm1', conversation_id: 'c-1', sender_id: 'u-diya', body: 'Hi! The calculator is available today.', created_at: new Date(now - 5 * 3600e3).toISOString(), read_at: new Date(now - 5 * 3600e3).toISOString() },
      { id: 'm2', conversation_id: 'c-1', sender_id: 'u-me', body: 'Perfect. I need it for the 2pm exam — could I pick it up at 1?', created_at: new Date(now - 4.9 * 3600e3).toISOString(), read_at: new Date(now - 4.8 * 3600e3).toISOString() },
      { id: 'm3', conversation_id: 'c-1', sender_id: 'u-diya', body: "Yes, that works. I'll be in the Block C reading room.", created_at: new Date(now - 4.8 * 3600e3).toISOString(), read_at: new Date(now - 4.7 * 3600e3).toISOString() },
      { id: 'm4', conversation_id: 'c-1', sender_id: 'u-me', body: 'See you at 1. Thanks!', created_at: new Date(now - 26 * 60e3).toISOString(), read_at: null },

      { id: 'm5', conversation_id: 'c-2', sender_id: 'u-aarav', body: 'Cycle is free from 4pm. ₹35/hour, lock included.', created_at: new Date(now - 2 * 86400e3).toISOString(), read_at: new Date(now - 2 * 86400e3).toISOString() },
      { id: 'm6', conversation_id: 'c-2', sender_id: 'u-me', body: 'Booking it for two hours, back by 6.', created_at: new Date(now - 47 * 3600e3).toISOString(), read_at: new Date(now - 47 * 3600e3).toISOString() },

      { id: 'm7', conversation_id: 'c-3', sender_id: 'u-sneha', body: 'The 50mm lens is the good one, bring your own SD card.', created_at: new Date(now - 3 * 86400e3).toISOString(), read_at: null },
    ];

    const conversations = [
      { id: 'c-1', listing_id: 'l-1', a_id: 'u-me', b_id: 'u-diya', created_at: new Date(now - 5 * 3600e3).toISOString(), last_message_at: new Date(now - 26 * 60e3).toISOString() },
      { id: 'c-2', listing_id: 'l-2', a_id: 'u-me', b_id: 'u-aarav', created_at: new Date(now - 2 * 86400e3).toISOString(), last_message_at: new Date(now - 47 * 3600e3).toISOString() },
      { id: 'c-3', listing_id: 'l-3', a_id: 'u-me', b_id: 'u-sneha', created_at: new Date(now - 3 * 86400e3).toISOString(), last_message_at: new Date(now - 3 * 86400e3).toISOString() },
    ];

    return { listings, conversations, messages, users: [...SEED_USERS, ME], me: ME.id };
  }

  const demo = {
    db: null,

    load() {
      try {
        const raw = localStorage.getItem(DEMO_KEY);
        if (raw) return JSON.parse(raw);
      } catch (e) { /* fall through to a fresh seed */ }
      const fresh = seed();
      this.save(fresh);
      return fresh;
    },

    save(db) {
      this.db = db;
      try { localStorage.setItem(DEMO_KEY, JSON.stringify(db)); } catch (e) { /* private mode */ }
    },

    reset() {
      try { localStorage.removeItem(DEMO_KEY); } catch (e) {}
      this.db = null;
    },

    session() {
      try {
        const raw = localStorage.getItem(SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    },

    setSession(profile) {
      try {
        if (profile) localStorage.setItem(SESSION_KEY, JSON.stringify(profile));
        else localStorage.removeItem(SESSION_KEY);
      } catch (e) {}
    },

    async signIn(email) {
      const domain = CFG.campus.domain.toLowerCase();
      if (!email.toLowerCase().endsWith('@' + domain)) {
        throw new Error('Use your @' + domain + ' email.');
      }
      return { code: '123456' };
    },

    async verify(email, code) {
      if (String(code).trim() !== '123456') throw new Error('That code is not right. Demo mode uses 123456.');
      const profile = { ...ME, full_name: nameFromEmail(email), email: email.toLowerCase() };
      this.setSession(profile);
      const db = this.load();
      if (!db.users.find((u) => u.id === ME.id)) db.users.push(profile);
      this.save(db);
      return profile;
    },

    user(id) {
      const db = this.db || this.load();
      return db.users.find((u) => u.id === id) || MYSTERY;
    },

    listings({ q = '', category = 'all' } = {}) {
      const db = this.db || this.load();
      const needle = q.trim().toLowerCase();
      return db.listings
        .filter((l) => l.status === 'active')
        .filter((l) => category === 'all' || l.category === category)
        .filter((l) => !needle || (l.title + ' ' + l.description + ' ' + l.location).toLowerCase().includes(needle))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((l) => ({ ...l, owner: this.user(l.owner_id) }));
    },

    listing(id) {
      const db = this.db || this.load();
      const l = db.listings.find((x) => x.id === id);
      return l ? { ...l, owner: this.user(l.owner_id) } : null;
    },

    conversations() {
      const db = this.db || this.load();
      const me = meId();
      return db.conversations
        .filter((c) => c.a_id === me || c.b_id === me)
        .map((c) => {
          const otherId = c.a_id === me ? c.b_id : c.a_id;
          const last = db.messages.filter((m) => m.conversation_id === c.id).sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(-1)[0] || null;
          const unread = db.messages.filter((m) => m.conversation_id === c.id && m.sender_id !== me && !m.read_at).length;
          const listing = db.listings.find((l) => l.id === c.listing_id) || null;
          return { ...c, other: this.user(otherId), last, unread, listing };
        })
        .sort((a, b) => String(b.last ? b.last.created_at : b.created_at).localeCompare(String(a.last ? a.last.created_at : a.created_at)));
    },

    async openConversation({ listingId, otherId }) {
      const db = this.db || this.load();
      const me = meId();
      let c = db.conversations.find((x) => x.listing_id === listingId && [x.a_id, x.b_id].includes(me) && [x.a_id, x.b_id].includes(otherId));
      if (!c) {
        c = { id: 'c-' + Math.random().toString(36).slice(2, 9), listing_id: listingId, a_id: me, b_id: otherId, created_at: new Date().toISOString(), last_message_at: new Date().toISOString() };
        db.conversations.push(c);
        this.save(db);
      }
      return c.id;
    },

    messages(convId) {
      const db = this.db || this.load();
      return db.messages.filter((m) => m.conversation_id === convId).sort((a, b) => a.created_at.localeCompare(b.created_at));
    },

    async send(convId, { body, image }) {
      const db = this.db || this.load();
      const msg = {
        id: 'm-' + Math.random().toString(36).slice(2, 10),
        conversation_id: convId,
        sender_id: meId(),
        body: body || '',
        image_url: image || null,
        created_at: new Date().toISOString(),
        read_at: null,
      };
      db.messages.push(msg);
      const c = db.conversations.find((x) => x.id === convId);
      if (c) c.last_message_at = msg.created_at;
      this.save(db);
      this._scheduleReply(convId);
      return msg;
    },

    /** A fake counterpart, so the product feels alive before a backend exists. */
    _scheduleReply(convId) {
      const db = this.db || this.load();
      const c = db.conversations.find((x) => x.id === convId);
      if (!c) return;
      const otherId = c.a_id === meId() ? c.b_id : c.a_id;
      if (!otherId || otherId === meId()) return;
      const other = this.user(otherId);

      const lines = [
        'Sure, that works for me.',
        'I can keep it aside until then.',
        "Sounds good. I'll be there.",
        'Let me check and get back to you in a minute.',
        'Yes — bring your student ID if you can.',
      ];
      const line = lines[Math.floor(Math.random() * lines.length)];

      setTimeout(() => {
        bus.emit('typing', { conversationId: convId, userId: otherId, name: other.full_name });
      }, 900 + Math.random() * 700);

      setTimeout(() => {
        bus.emit('typing', { conversationId: convId, userId: null });
        const live2 = this.db || this.load();
        live2.messages.push({
          id: 'm-' + Math.random().toString(36).slice(2, 10),
          conversation_id: convId,
          sender_id: otherId,
          body: line,
          created_at: new Date().toISOString(),
          read_at: null,
        });
        const cc = live2.conversations.find((x) => x.id === convId);
        if (cc) cc.last_message_at = new Date().toISOString();
        this.save(live2);
        bus.emit('message', { conversationId: convId, message: live2.messages[live2.messages.length - 1] });
      }, 2400 + Math.random() * 1400);
    },

    async markRead(convId) {
      const db = this.db || this.load();
      let changed = false;
      for (const m of db.messages) {
        if (m.conversation_id === convId && m.sender_id !== meId() && !m.read_at) {
          m.read_at = new Date().toISOString();
          changed = true;
        }
      }
      if (changed) { this.save(db); bus.emit('read', { conversationId: convId }); }
    },

    async createListing(data) {
      const db = this.db || this.load();
      const l = {
        id: 'l-' + Math.random().toString(36).slice(2, 9),
        owner_id: meId(),
        title: data.title,
        description: data.description || '',
        category: data.category,
        price_per_hour: Number(data.price) || 0,
        location: data.location || '',
        condition: data.condition || 'good',
        photo_url: data.photo || null,
        hue: Math.floor(Math.random() * 360),
        status: 'active',
        created_at: new Date().toISOString(),
      };
      db.listings.push(l);
      this.save(db);
      return l;
    },

    async myListings() {
      const db = this.db || this.load();
      return db.listings.filter((l) => l.owner_id === meId()).sort((a, b) => b.created_at.localeCompare(a.created_at)).map((l) => ({ ...l, owner: this.user(l.owner_id) }));
    },

    async deleteListing(id) {
      const db = this.db || this.load();
      const l = db.listings.find((x) => x.id === id);
      if (!l || l.owner_id !== meId()) throw new Error('That is not yours to delete.');
      l.status = 'removed';
      this.save(db);
    },
  };

  const MYSTERY = { id: 'u-unknown', full_name: 'Someone', email: '', campus: '', rating_sum: 0, rating_count: 0 };

  /** "aarav.s@campus.edu" -> "Aarav S" — the same rule the database trigger uses. */
  function nameFromEmail(email) {
    const local = String(email || '').split('@')[0];
    const words = local.split(/[._-]+/).filter(Boolean).slice(0, 2);
    const name = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return name || 'Student';
  }

  /* ---------------------------------------------------------------- live */

  let sb = null;
  let currentUser = null;
  let channels = [];

  function initLive() {
    sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }

  function meId() {
    if (LIVE) return currentUser ? currentUser.id : null;
    return ME.id;
  }

  async function ensureProfile(user) {
    const { data, error } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (error) throw error;
    if (data) return data;

    const email = user.email || '';
    const name = nameFromEmail(email);

    const row = {
      id: user.id,
      full_name: name,
      email,
      campus: CFG.campus.name,
      rating_sum: 0,
      rating_count: 0,
    };
    const { data: made, error: insErr } = await sb.from('profiles').insert(row).select().single();
    if (insErr) throw insErr;
    return made;
  }

  const live = {
    async signIn(email) {
      const domain = CFG.campus.domain.toLowerCase();
      if (!email.toLowerCase().endsWith('@' + domain)) {
        throw new Error('CampusLend is only open to @' + domain + ' addresses.');
      }
      const { error } = await sb.auth.signInWithOtp({
        email: email.toLowerCase(),
        options: { shouldCreateUser: true },
      });
      if (error) throw new Error(error.message);
      return {};
    },

    async verify(email, code) {
      const { data, error } = await sb.auth.verifyOtp({
        email: email.toLowerCase(),
        token: String(code).trim(),
        type: 'email',
      });
      if (error) throw new Error(error.message);
      currentUser = data.user;
      return ensureProfile(data.user);
    },

    async signOut() {
      channels.forEach((c) => { try { sb.removeChannel(c); } catch (e) {} });
      channels = [];
      currentUser = null;
      await sb.auth.signOut();
    },

    async restore() {
      const { data } = await sb.auth.getSession();
      const user = data && data.session ? data.session.user : null;
      if (!user) return null;
      currentUser = user;
      try { return await ensureProfile(user); } catch (e) { return { id: user.id, full_name: user.email, email: user.email }; }
    },

    async listings({ q = '', category = 'all' } = {}) {
      let query = sb.from('listings')
        .select('*, owner:profiles!listings_owner_id_fkey(id, full_name, avatar_url, campus, rating_sum, rating_count)')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(120);
      if (category !== 'all') query = query.eq('category', category);
      if (q.trim()) query = query.or('title.ilike.%' + q.trim() + '%,description.ilike.%' + q.trim() + '%');
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data || [];
    },

    async listing(id) {
      const { data, error } = await sb.from('listings')
        .select('*, owner:profiles!listings_owner_id_fkey(id, full_name, avatar_url, campus, rating_sum, rating_count)')
        .eq('id', id).maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },

    async conversations() {
      const me = meId();
      const { data, error } = await sb.from('conversations')
        .select('*, listing:listings(id, title, price_per_hour, photo_url, hue), a:profiles!conversations_a_id_fkey(id, full_name, avatar_url), b:profiles!conversations_b_id_fkey(id, full_name, avatar_url)')
        .or('a_id.eq.' + me + ',b_id.eq.' + me)
        .order('last_message_at', { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);

      const rows = data || [];
      if (!rows.length) return [];

      // One query for the newest message per conversation, rather than N.
      const ids = rows.map((c) => c.id);
      const { data: recent } = await sb.from('messages')
        .select('id, conversation_id, sender_id, body, image_url, created_at, read_at')
        .in('conversation_id', ids)
        .order('created_at', { ascending: false })
        .limit(400);

      const lastBy = new Map();
      for (const m of recent || []) {
        if (!lastBy.has(m.conversation_id)) lastBy.set(m.conversation_id, m);
      }

      const { data: unreadRows } = await sb.from('messages')
        .select('conversation_id')
        .in('conversation_id', ids)
        .neq('sender_id', me)
        .is('read_at', null);
      const unreadBy = new Map();
      for (const m of unreadRows || []) {
        unreadBy.set(m.conversation_id, (unreadBy.get(m.conversation_id) || 0) + 1);
      }

      return rows.map((c) => {
        const other = c.a_id === me ? c.b : c.a;
        return { ...c, other, last: lastBy.get(c.id) || null, unread: unreadBy.get(c.id) || 0 };
      });
    },

    async openConversation({ listingId, otherId }) {
      const me = meId();
      const low = me < otherId ? me : otherId;
      const high = me < otherId ? otherId : me;

      const { data: existing, error } = await sb.from('conversations')
        .select('*')
        .eq('a_id', low).eq('b_id', high).eq('listing_id', listingId)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw new Error(error.message);
      if (existing) return existing.id;

      const { data, error: insErr } = await sb.from('conversations')
        .insert({ a_id: low, b_id: high, listing_id: listingId })
        .select().single();
      if (insErr) throw new Error(insErr.message);
      return data.id;
    },

    async messages(convId) {
      const { data, error } = await sb.from('messages')
        .select('*').eq('conversation_id', convId)
        .order('created_at', { ascending: true })
        .limit(300);
      if (error) throw new Error(error.message);
      return data || [];
    },

    async send(convId, { body, image }) {
      const { data, error } = await sb.from('messages')
        .insert({ conversation_id: convId, sender_id: meId(), body: body || '', image_url: image || null })
        .select().single();
      if (error) throw new Error(error.message);
      await sb.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', convId);
      return data;
    },

    async markRead(convId) {
      await sb.from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('conversation_id', convId)
        .neq('sender_id', meId())
        .is('read_at', null);
    },

    async createListing(data) {
      const { data: row, error } = await sb.from('listings').insert({
        owner_id: meId(),
        title: data.title,
        description: data.description || '',
        category: data.category,
        price_per_hour: Number(data.price) || 0,
        location: data.location || '',
        condition: data.condition || 'good',
        photo_url: data.photo || null,
        hue: Math.floor(Math.random() * 360),
      }).select().single();
      if (error) throw new Error(error.message);
      return row;
    },

    async myListings() {
      const { data, error } = await sb.from('listings')
        .select('*, owner:profiles!listings_owner_id_fkey(id, full_name, avatar_url, campus, rating_sum, rating_count)')
        .eq('owner_id', meId()).eq('status', 'active')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data || [];
    },

    async deleteListing(id) {
      const { error } = await sb.from('listings').update({ status: 'removed' }).eq('id', id).eq('owner_id', meId());
      if (error) throw new Error(error.message);
    },

    subscribe(convId) {
      channels.forEach((c) => { try { sb.removeChannel(c); } catch (e) {} });
      channels = [];
      if (!convId) return;

      const ch = sb.channel('conv:' + convId)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'conversation_id=eq.' + convId }, (payload) => {
          bus.emit('message', { conversationId: convId, message: payload.new });
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: 'conversation_id=eq.' + convId }, (payload) => {
          bus.emit('read', { conversationId: convId, message: payload.new });
        })
        .subscribe();
      channels.push(ch);
    },

    async uploadImage(file) {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = meId() + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
      const { error } = await sb.storage.from(CFG.chatBucket).upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw new Error(error.message);
      const { data } = sb.storage.from(CFG.chatBucket).getPublicUrl(path);
      return data.publicUrl;
    },
  };

  /* ---------------------------------------------------------------- bus */

  const bus = {
    _t: new EventTarget(),
    on(type, fn) {
      const h = (e) => fn(e.detail);
      this._t.addEventListener(type, h);
      return () => this._t.removeEventListener(type, h);
    },
    emit(type, detail) { this._t.dispatchEvent(new CustomEvent(type, { detail })); },
  };

  /* -------------------------------------------------------------- public */

  const store = {
    mode: LIVE ? 'live' : 'demo',
    categories: CATEGORIES,
    on: bus.on.bind(bus),
    resetDemo() { demo.reset(); },
  };

  if (LIVE) {
    initLive();
    Object.assign(store, live, {
      async start() {
        const profile = await live.restore();
        return profile;
      },
    });
  } else {
    Object.assign(store, {
      async start() {
        demo.load();
        return demo.session();
      },
      signIn: (e) => demo.signIn(e),
      verify: (e, c) => demo.verify(e, c),
      async signOut() { demo.setSession(null); },
      listings: (o) => Promise.resolve(demo.listings(o)),
      listing: (id) => Promise.resolve(demo.listing(id)),
      conversations: () => Promise.resolve(demo.conversations()),
      openConversation: (o) => demo.openConversation(o),
      messages: (id) => Promise.resolve(demo.messages(id)),
      send: (id, m) => demo.send(id, m),
      markRead: (id) => demo.markRead(id),
      createListing: (d) => demo.createListing(d),
      myListings: () => demo.myListings(),
      deleteListing: (id) => demo.deleteListing(id),
      subscribe() {},
      async uploadImage(file) {
        // Data URL, so demo mode can show a picture without any storage.
        return await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result);
          r.onerror = () => reject(new Error('Could not read that image.'));
          r.readAsDataURL(file);
        });
      },
    });
  }

  window.CL = window.CL || {};
  window.CL.store = store;
})();
