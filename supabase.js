require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Configure Supabase client with optimized settings
const supabase = createClient(
  process.env.SUPABASE_URL, 
  process.env.SUPABASE_KEY,
  {
    auth: {
      persistSession: false // Don't persist auth session as we're using server-side
    },
    global: {
      headers: {
        'x-application-name': 'song-request-app'
      },
    },
    db: {
      schema: 'public'
    },
    realtime: {
      // Only subscribe to specific tables we need
      params: {
        eventsPerSecond: 2 // Limit events per second
      }
    }
  }
);

module.exports = { supabase };