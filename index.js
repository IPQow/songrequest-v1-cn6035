require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const compression = require('compression');
const { supabase } = require('./supabase');
const { addToQueue, checkCurrentlyPlaying, handleSongRequest, skipCurrentTrack } = require('./spotify');
const ejs = require('ejs');
const NodeCache = require('node-cache');

// Initialize cache with 5 minute TTL
const apiCache = new NodeCache({ stdTTL: 300 });

const app = express();
const port = process.env.PORT || 3001;

// Cache middleware
const cacheMiddleware = (duration) => {
  return (req, res, next) => {
    if (req.method !== 'GET') {
      return next();
    }

    const key = `__express__${req.originalUrl || req.url}`;
    const cachedBody = apiCache.get(key);

    if (cachedBody) {
      res.send(cachedBody);
      return;
    } else {
      res.sendResponse = res.send;
      res.send = (body) => {
        apiCache.set(key, body, duration);
        res.sendResponse(body);
      };
      next();
    }
  };
};

// Middleware
app.use(compression());
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/widget', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'widget.html'));
});

// API Endpoints
app.post('/api/request', async (req, res) => {
  const { song, user } = req.body;
  if (!song || !user) return res.status(400).send('Missing song or user');

  try {
    const { error } = await supabase.from('requests').insert({
      title: song,
      requester: user,
      status: 'pending'
    });
    if (error) throw error;
    
    // Clear cache when new data is added
    apiCache.flushAll();
    
    res.sendStatus(200);
  } catch (error) {
    console.error('Request error:', error);
    res.status(500).send('Failed to submit request');
  }
});

app.post('/api/approve/:id', async (req, res) => {
    try {
        const { username } = req.body;

        // First fetch the request
        const { data: request, error: fetchError } = await supabase
            .from('requests')
            .select('spotify_uri')
            .eq('id', req.params.id)
            .single();

        if (fetchError) {
            console.error('Fetch error:', fetchError);
            return res.status(500).json({ 
                success: false, 
                message: 'Failed to fetch request' 
            });
        }

        // Add to Spotify queue
        try {
            await addToQueue(request.spotify_uri);
        } catch (error) {
            console.error('Queue error:', error);
            return res.status(500).json({ 
                success: false, 
                message: error.message || 'Failed to add to queue' 
            });
        }

        // Update request status
        const { error: updateError } = await supabase
            .from('requests')
            .update({ 
                status: 'approved',
                action_by: username 
            })
            .eq('id', req.params.id);

        if (updateError) {
            console.error('Update error:', updateError);
            return res.status(500).json({ 
                success: false, 
                message: 'Failed to update request status' 
            });
        }

        // Clear cache when data is modified
        apiCache.flushAll();

        res.json({ success: true });
    } catch (error) {
        console.error('Approval error:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Failed to approve request' 
        });
    }
});

app.post('/api/deny/:id', async (req, res) => {
  try {
    const { username } = req.body;

    const { error } = await supabase
      .from('requests')
      .update({ 
        status: 'denied',
        action_by: username 
      })
      .eq('id', req.params.id);

    if (error) throw error;
    
    // Clear cache when data is modified
    apiCache.flushAll();
    
    res.sendStatus(200);
  } catch (error) {
    console.error('Denial error:', error);
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/requests', cacheMiddleware(60), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 0;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const startIndex = page * pageSize;
    const status = req.query.status;
    
    let query = supabase
      .from('requests')
      .select('id, title, artist, requester, status, created_at, album_art, track_id, content_type, spotify_uri, played, hidden, now_playing, action_by, requeued', { count: 'exact' })
      .eq('hidden', false);
      
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    
    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(startIndex, startIndex + pageSize - 1);
      
    if (error) throw error;
    res.json({
      data,
      pagination: {
        total: count,
        page,
        pageSize
      }
    });
  } catch (error) {
    console.error('Fetch error:', error);
    res.status(500).send('Failed to fetch requests');
  }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    try {
        const { data: moderator, error } = await supabase
            .from('moderators')
            .select('username, password_hash')
            .eq('username', username)
            .single();

        if (error || !moderator) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid credentials'
            });
        }

        // Compare password with hash
        // For this example, we're storing plain text, but in production
        // you should use bcrypt or similar
        if (moderator.password_hash === password) {
            res.json({ 
                success: true,
                username: moderator.username 
            });
        } else {
            res.status(401).json({ 
                success: false, 
                message: 'Invalid credentials'
            });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error'
        });
    }
});

// Add before other routes
//app.use('/auth', authRouter);

// Poll every 5 seconds to check currently playing track
setInterval(async () => {
    await checkCurrentlyPlaying();
}, 5000);

// Add this after your other endpoints
app.post('/api/purge', async (req, res) => {
    try {
        // Use a more efficient single query with RPC instead of multiple updates
        // This reduces the number of database operations and network traffic
        const { error } = await supabase.rpc('purge_non_pending_requests');
        
        if (error) {
            console.error('Purge RPC error:', error);
            throw error;
        }
        
        // Clear cache when data is modified
        apiCache.flushAll();
        
        res.json({ success: true });
    } catch (error) {
        console.error('Purge error:', error);
        res.status(500).json({ message: error.message });
    }
});

// Update the daily purge interval
setInterval(async () => {
    try {
        const now = new Date();
        if (now.getHours() === 12 && now.getMinutes() === 0) {
            const { error } = await supabase
                .from('requests')
                .update({ 
                    played: true,
                    hidden: true 
                })
                .eq('hidden', false)
                .not('status', 'eq', 'pending');

            if (error) throw error;
            console.log('Daily purge completed');
        }
    } catch (error) {
        console.error('Daily purge error:', error);
    }
}, 60000); // Check every minute

// Add near the other API endpoints
app.post('/api/cancel-purge', async (req, res) => {
    try {
        const { error } = await supabase
            .from('purge_status')
            .update({ cancelled: true })
            .eq('id', req.body.purgeId);

        if (error) throw error;
        res.sendStatus(200);
    } catch (error) {
        console.error('Cancel purge error:', error);
        res.status(500).json({ message: error.message });
    }
});

// Add this new endpoint after your other endpoints
app.post('/api/queue', async (req, res) => {
    try {
        const { uri } = req.body;
        await addToQueue(uri);
        res.json({ success: true });
    } catch (error) {
        console.error('Queue error:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

app.post('/api/quick-add', async (req, res) => {
    try {
        const { query, username } = req.body;
        
        // Use existing song request handler
        const result = await handleSongRequest(query, username);
        
        if (!result.success) {
            return res.status(400).json({ success: false, message: 'Failed to find song' });
        }

        // Get the newly created request
        const { data: requests, error: fetchError } = await supabase
            .from('requests')
            .select('*')  // Changed to select all fields
            .eq('title', result.title)
            .eq('artist', result.artist)
            .eq('requester', username)
            .order('created_at', { ascending: false })
            .limit(1);

        if (fetchError) throw fetchError;
        
        // Add to Spotify queue
        await addToQueue(requests[0].spotify_uri);
        
        // Update the database
        const { error: updateError } = await supabase
            .from('requests')
            .update({ 
                status: 'approved',
                action_by: username 
            })
            .eq('id', requests[0].id);

        if (updateError) {
            throw new Error('Failed to update status');
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Quick add error:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

app.post('/api/force-skip', async (req, res) => {
    try {
        const { username } = req.body;
        if (!username) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        await skipCurrentTrack();
        res.json({ success: true });
    } catch (error) {
        console.error('Force skip error:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Failed to skip track' 
        });
    }
});

// Add this new endpoint after your other endpoints
app.get('/api/np', cacheMiddleware(10), async (req, res) => {
    try {
        const currentTrack = await checkCurrentlyPlaying();
        
        if (!currentTrack) {
            return res.json({ 
                success: false, 
                message: 'No track currently playing' 
            });
        }

        res.json({ 
            success: true,
            track: {
                name: currentTrack.name,
                artist: currentTrack.artists ? currentTrack.artists[0].name : currentTrack.show?.name || 'Unknown Artist',
                album_art: currentTrack.album?.images[0]?.url,
                spotify_uri: currentTrack.uri,
                duration_ms: currentTrack.duration_ms,
                id: currentTrack.id
            }
        });
    } catch (error) {
        console.error('Now playing error:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Failed to fetch current track' 
        });
    }
});

// Start server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});