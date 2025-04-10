const axios = require('axios');
const { supabase } = require('./supabase');

// Token storage object
let tokenStore = {
    accessToken: process.env.SPOTIFY_ACCESS_TOKEN,
    expiresAt: Date.now() + (process.env.SPOTIFY_EXPIRES_IN || 3600) * 1000,
    refreshToken: process.env.SPOTIFY_REFRESH_TOKEN
};

// Refresh token with retry logic
const refreshToken = async (attempt = 1) => {
    try {
        const { data } = await axios.post('https://accounts.spotify.com/api/token', null, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            params: {
                grant_type: 'refresh_token',
                refresh_token: tokenStore.refreshToken,
                client_id: process.env.SPOTIFY_CLIENT_ID,
                client_secret: process.env.SPOTIFY_CLIENT_SECRET
            }
        });

        // Update token store
        tokenStore = {
            accessToken: data.access_token,
            expiresAt: Date.now() + (data.expires_in * 1000),
            refreshToken: data.refresh_token || tokenStore.refreshToken
        };

        console.log('Spotify token refreshed');
        scheduleTokenRefresh();
        return true;
    } catch (error) {
        console.error('Token refresh failed:', error.message);
        if (attempt <= 3) {
            console.log(`Retrying... (Attempt ${attempt})`);
            await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
            return refreshToken(attempt + 1);
        }
        return false;
    }
};

// Schedule next refresh 5 minutes before expiration
const scheduleTokenRefresh = () => {
    const refreshTime = tokenStore.expiresAt - Date.now() - 300000; // 5 min buffer
    if (refreshTime > 0) {
        setTimeout(async () => {
            await refreshToken();
        }, refreshTime);
    }
};

// Initial schedule
scheduleTokenRefresh();

// Get valid access token (auto-refresh if needed)
const getAccessToken = async () => {
    if (Date.now() >= tokenStore.expiresAt - 60000) { // 1 min buffer
        console.log('Token expired or about to expire, refreshing...');
        await refreshToken();
    }
    return tokenStore.accessToken;
};

// Updated API call wrapper
const spotifyApiCall = async (config) => {
    try {
        const accessToken = await getAccessToken();
        config.headers = { Authorization: `Bearer ${accessToken}` };
        return await axios(config);
    } catch (error) {
        if (error.response?.status === 401) {
            await refreshToken();
            return spotifyApiCall(config); // Retry with new token
        }
        throw error;
    }
};

// Search for a track
const searchTrack = async (query) => {
    const { data } = await spotifyApiCall({
        method: 'get',
        url: 'https://api.spotify.com/v1/search',
        params: { q: query, type: 'track', limit: 1 }
    });
    return data.tracks.items[0];
};

// Add track to Spotify queue
const addToQueue = async (uri) => {
    // First check if there's an active device
    const deviceResponse = await spotifyApiCall({
        method: 'get',
        url: 'https://api.spotify.com/v1/me/player'
    });

    if (!deviceResponse.data || !deviceResponse.data.is_playing) {
        throw new Error('No active Spotify playback found. Please start playing Spotify on any device.');
    }

    // Then try to add to queue
    await spotifyApiCall({
        method: 'post',
        url: 'https://api.spotify.com/v1/me/player/queue',
        params: { uri }
    });
    
    return true;  // If we get here, the queue addition was successful
};

// Add this helper function to parse Spotify URLs
const parseSpotifyUrl = (url) => {
    // Handle different Spotify URL formats including episodes
    const patterns = [
        /spotify:track:([a-zA-Z0-9]+)/, // Spotify URI for tracks
        /spotify:episode:([a-zA-Z0-9]+)/, // Spotify URI for episodes
        /open\.spotify\.com(?:\/intl-[a-z]{2})?\/track\/([a-zA-Z0-9]+)/, // Web URL for tracks
        /open\.spotify\.com(?:\/intl-[a-z]{2})?\/episode\/([a-zA-Z0-9]+)/, // Web URL for episodes
        /spotify\.link\/([a-zA-Z0-9]+)/ // Short URL
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
            // Check if it's an episode URL
            const isEpisode = url.includes('episode');
            return {
                id: match[1],
                type: isEpisode ? 'episode' : 'track'
            };
        }
    }
    return null;
};

// Update handleSongRequest function
const handleSongRequest = async (query, requester) => {
    try {
        console.log('[Spotify] Handling request:', query);
        let item;
        let type = 'track';
        
        // Check if the query is a Spotify URL/URI
        const parsed = parseSpotifyUrl(query);
        
        if (parsed) {
            console.log(`[Spotify] Fetching ${parsed.type} by ID:`, parsed.id);
            const { data } = await spotifyApiCall({
                method: 'get',
                url: `https://api.spotify.com/v1/${parsed.type}s/${parsed.id}`
            });
            item = data;
            type = parsed.type;
        } else {
            console.log('[Spotify] Searching for track:', query);
            item = await searchTrack(query);
        }

        if (!item) {
            console.error('[Spotify] No item found for:', query);
            return { success: false };
        }

        console.log(`[Spotify] Found ${type}:`, item.name);
        console.log('[Supabase] Inserting request...');

        // Handle both tracks and episodes
        const { error } = await supabase.from('requests').insert({
            track_id: item.id,
            title: item.name,
            artist: type === 'track' ? item.artists[0].name : item.show?.name || 'Podcast',
            album_art: type === 'track' ? item.album.images[0]?.url : item.images[0]?.url,
            requester,
            status: 'pending',
            spotify_uri: item.uri,
            content_type: type
        });

        if (error) {
            console.error('[Supabase] Insert error:', error);
            return { success: false };
        }

        return { 
            success: true, 
            title: item.name,
            artist: type === 'track' ? item.artists[0].name : item.show?.name || 'Podcast'
        };
    } catch (error) {
        console.error('[Error] Full error:', error.response?.data || error.message);
        return { success: false };
    }
};

const checkCurrentlyPlaying = async () => {
    try {
        const { data } = await spotifyApiCall({
            method: 'get',
            url: 'https://api.spotify.com/v1/me/player/currently-playing'
        });

        if (!data || !data.item) return null;

        // Get all approved requests (both played and unplayed)
        const { data: requests, error } = await supabase
            .from('requests')
            .select('*')
            .eq('status', 'approved');

        if (error) throw error;

        // Check if current track matches any requests
        const matchingRequest = requests.find(req => req.track_id === data.item.id);
        
        if (matchingRequest) {
            // Only update if the matching request isn't already marked as now_playing
            if (!matchingRequest.now_playing) {
                // First reset any other now_playing tracks
                await supabase
                    .from('requests')
                    .update({ now_playing: false })
                    .eq('now_playing', true);

                // Then set this track as now_playing
                const { error: updateError } = await supabase
                    .from('requests')
                    .update({ 
                        played: true,
                        now_playing: true
                    })
                    .eq('id', matchingRequest.id);

                if (updateError) throw updateError;
            }
        } else {
            // If no matching request found, reset all now_playing flags
            await supabase
                .from('requests')
                .update({ now_playing: false })
                .eq('now_playing', true);
        }

        return data.item;
    } catch (error) {
        console.error('Error checking currently playing:', error);
        return null;
    }
};

const getQueue = async () => {
    try {
        const { data } = await spotifyApiCall({
            method: 'get',
            url: 'https://api.spotify.com/v1/me/player/queue'
        });

        if (!data || !data.queue) return [];

        // Get all tracks
        const queueTracks = data.queue.map(track => ({
            name: track.name,
            artist: track.artists[0].name
        }));

        await supabase
            .from('queue_notifications')
            .insert({
                tracks: queueTracks,
                expires_at: new Date(Date.now() + 5000).toISOString() // 5 seconds from now
            });

        return queueTracks;
    } catch (error) {
        console.error('Error fetching queue:', error);
        return [];
    }
};

const skipCurrentTrack = async () => {
    await spotifyApiCall({
        method: 'post',
        url: 'https://api.spotify.com/v1/me/player/next'
    });
    return true;
};

const moduleExports = {
    searchTrack,
    addToQueue,
    handleSongRequest,
    checkCurrentlyPlaying,
    getQueue,
    skipCurrentTrack
};
  
if (process.env.NODE_ENV !== 'production') {
    moduleExports.refreshToken = refreshToken;
    moduleExports.getAccessToken = getAccessToken;
}
  
module.exports = moduleExports;