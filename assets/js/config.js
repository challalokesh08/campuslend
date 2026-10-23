/* =========================================================================
   CampusLend — configuration
   -------------------------------------------------------------------------
   This file is PUBLIC. Everything in it is served to every visitor, which is
   fine and expected: the Supabase anon key is designed to be public. What
   keeps the database safe is Row Level Security in supabase/schema.sql, not
   the secrecy of these values. Never put a service_role key here.

   Leave SUPABASE_URL and SUPABASE_ANON_KEY empty and the site runs in DEMO
   MODE: a complete, clickable app backed by localStorage with seeded data and
   simulated replies. That is how it is deployed by default, so the link works
   for someone before any backend exists.

   Fill both in and it switches to LIVE: real accounts, real email codes, and
   real-time messaging between browsers.
   ========================================================================= */

window.CL_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: '',

  campus: {
    name: 'Cambridge Institute of Technology',
    // Sign-up is restricted to this domain when the backend enforces it. In
    // demo mode it is only used for the sample accounts.
    domain: 'cambridge.edu.in',
    city: 'Bengaluru',
  },

  // Show the "Demo data" pill in the UI. Set false once live.
  showDemoBadge: true,

  // Uploaded photos go to this Storage bucket. See README → Storage.
  photoBucket: 'listing-photos',
  // Photos and videos shared inside a chat.
  chatBucket: 'chat-media',
};
