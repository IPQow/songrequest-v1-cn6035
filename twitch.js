require('dotenv').config();
const tmi = require('tmi.js');
const axios = require('axios');
const { handleSongRequest, getQueue, skipCurrentTrack, checkCurrentlyPlaying } = require('./spotify');
const { supabase } = require('./supabase');

// Twitch OAuth token management
let accessToken = process.env.TWITCH_OAUTH_TOKEN;

const refreshToken = async () => {
  try {
    const { data } = await axios.post('https://id.twitch.tv/oauth2/token', null, {
      params: {
        client_id: process.env.TWITCH_CLIENT_ID,
        client_secret: process.env.TWITCH_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: process.env.TWITCH_REFRESH_TOKEN
      }
    });
    accessToken = data.access_token;
    process.env.TWITCH_OAUTH_TOKEN = data.access_token;
    process.env.TWITCH_REFRESH_TOKEN = data.refresh_token;
    console.log('Twitch token refreshed');
  } catch (error) {
    console.error('Failed to refresh Twitch token:', error.response?.data || error.message);
  }
};

// Twitch chat client setup
const client = new tmi.Client({
  options: { debug: true },
  identity: {
    username: process.env.TWITCH_BOT_USERNAME,
    password: accessToken
  },
  channels: [process.env.TWITCH_CHANNEL]
});

// Add this function near the top with the other imports and setup
const checkStreamStatus = async (channelName) => {
  // Add this line to bypass the check during testing
  if (process.env.NODE_ENV === 'development') return true;

  try {
    const response = await axios.get(`https://api.twitch.tv/helix/streams?user_login=${channelName.replace('#', '')}`, {
      headers: {
        'Client-ID': process.env.TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${accessToken}`
      }
    });
    return response.data.data.length > 0; // Returns true if stream is live
  } catch (error) {
    console.error('Error checking stream status:', error);
    return true; // Default to allowing requests if check fails
  }
};

// Add cooldown tracking
const QUEUE_COOLDOWN = 10000;
let lastQueueCommand = 0;

let skipVoteActive = false;
let skipVoters = new Set();
let skipVoteTimeout = null;
const REQUIRED_VOTES = 4;
const VOTE_DURATION = 30000; // 30 seconds

// Add after line 60
const SKIP_COOLDOWN = 30000; // 30 seconds
let lastSuccessfulSkip = 0;

// Add these near the top with other handlers
const handleChannelPointRedemption = async (channel, tags, message) => {
    if (tags["custom-reward-id"] !== process.env.TWITCH_CHANNELPOINT_REWARD_ID) {
        return false;
    }

    /*const isLive = await checkStreamStatus(channel);
    if (!isLive) {
        client.say(channel, `@${tags.username}, song requests are only available when the stream is live!`);
        return true;
    }*/

    const query = message.trim();
    
    // Check if it's a link but not a valid Spotify link
    const validSpotifyPatterns = [
        /spotify:track:([a-zA-Z0-9]+)/,
        /spotify:episode:([a-zA-Z0-9]+)/,
        /open\.spotify\.com(?:\/intl-[a-z]{2})?\/track\/([a-zA-Z0-9]+)/,
        /open\.spotify\.com(?:\/intl-[a-z]{2})?\/episode\/([a-zA-Z0-9]+)/,
        /spotify\.link\/([a-zA-Z0-9]+)/
    ];
    
    if (query.includes('http') || query.includes('spotify:')) {
        const isValidSpotifyLink = validSpotifyPatterns.some(pattern => pattern.test(query));
        if (!isValidSpotifyLink) {
            client.say(channel, `@${tags.username}, only Spotify links are accepted!`);
            return true;
        }
    }

    try {
        const result = await handleSongRequest(query, tags.username);
        if (result.success) {
            // Get count of approved but unplayed songs
            const { data: queueData, error: queueError } = await supabase
                .from('requests')
                .select('id')
                .eq('status', 'approved')
                .eq('played', false)
                .eq('hidden', false)
                .order('created_at', { ascending: true });

            if (queueError) throw queueError;

            const position = parseInt(queueData.length) + 1;

            client.say(channel, `@${tags.username}, "${result.title}" by ${result.artist} has been added to the queue! Position: #${position}`);
        } else {
            client.say(channel, `@${tags.username}, failed to add your song. Please try again!`);
        }
    } catch (error) {
        console.error('Error handling song request:', error);
        let errorMessage = `@${tags.username}, something went wrong. Please try again later!`;

        if (error.response) {
            if (error.response.status === 401) {
                errorMessage = `@${tags.username}, Spotify authentication failed. Please notify @ipqow`;
            } else if (error.response.status === 404) {
                errorMessage = `@${tags.username}, song not found. Please try a different search, or a direct link!`;
            } else if (error.response.status === 403) {
                errorMessage = `@${tags.username}, Spotify playback is not available. Please notify @ipqow`;
            }
        }
        client.say(channel, errorMessage);
    }
    return true;
};

const handleQueueCommand = async (channel, tags) => {
    const now = Date.now();
    if (now - lastQueueCommand < QUEUE_COOLDOWN) {
        return true;
    }

    const isLive = await checkStreamStatus(channel);
    if (!isLive) {
        client.say(channel, `@${tags.username}, queue command is only available when the stream is live`);
        return true;
    }

    lastQueueCommand = now;

    try {
        const { data: queue, error: queueError } = await supabase
            .from('requests')
            .select('title, artist')
            .eq('status', 'approved')
            .eq('played', false)
            .eq('hidden', false)
            .order('created_at', { ascending: true });

        if (queueError) throw queueError;
        if (queue.length === 0) {
            client.say(channel, `@${tags.username}, the queue is currently empty! If you've requested a song, the mods have to approve it before it gets added to the queue`);
            return true;
        }

        // Take only first 5 songs for display
        const displayQueue = queue.slice(0, 5);
        const queueList = displayQueue.map((track, index) =>
            `${index + 1}. ${track.title} - ${track.artist}`
        ).join(' || ');
        
        // Add remaining songs count if queue is longer than 5
        const remainingCount = queue.length - 5;
        const remainingText = remainingCount > 0 ? ` || +${remainingCount} more` : '';
        
        // Modified message to include queue length and remaining count
        client.say(channel, `@${tags.username}, ${queue.length === 1 ? 'There is' : 'There are'} ${queue.length} song${queue.length > 1 ? 's' : ''} in the queue: ${queueList}${remainingText}`);
    } catch (error) {
        console.error('Queue command error:', error);
        client.say(channel, `@${tags.username}, catsittingverycomfortablebutmissingitsfriendswherearethey idk`);
    }
    return true;
};

// Add this near the other command handlers
const handleForceSkip = async (channel, tags) => {
    const badgesForCheck = tags.badges || {};
    const isMod = badgesForCheck.moderator || badgesForCheck.broadcaster;
    
    if (!isMod) {
        client.say(channel, `@${tags.username}, Tssk`);
        return;
    }

    const isLive = await checkStreamStatus(channel);
    if (!isLive) {
        client.say(channel, `@${tags.username}, wouldn't that be funny`);
        return;
    }

    try {
        await skipCurrentTrack();
        client.say(channel, `@${tags.username} force skipped the current track!`);
    } catch (error) {
        console.error('Error force skipping track:', error);
        client.say(channel, `Error skipping track.`);
    }
};

// Add this with the other command handlers
const handleNowPlaying = async (channel, tags) => {
    try {
        const isLive = await checkStreamStatus(channel);
        if (!isLive) {
            client.say(channel, `@${tags.username}, this command is only available when the stream is live!`);
            return;
        }

        const currentTrack = await checkCurrentlyPlaying();
        
        if (!currentTrack) {
            client.say(channel, `@${tags.username}, no track is currently playing.`);
            return;
        }

        const artistName = currentTrack.artists ? currentTrack.artists[0].name : currentTrack.show?.name || 'Unknown Artist';
        client.say(channel, `@${tags.username}, "${currentTrack.name}" by ${artistName}`);
    } catch (error) {
        console.error('Error getting current track:', error);
        client.say(channel, `@${tags.username}, i dont know.`);
    }
};

// Update the message handler to include the new command
client.on('message', async (channel, tags, message, self) => {
    if (self) return;

    const command = message.toLowerCase();

    // Handle commands in order
    try {
        if (command === '!queue') {
            await handleQueueCommand(channel, tags);
            return;
        }

        if (command === '!skip' || command === '!voteskip') {
            await handleSkipVote(channel, tags);
            return;
        }

        if (command === '!fskip') {
            await handleForceSkip(channel, tags);
            return;
        }

        if (command === '!np' || command === '!song') {
            await handleNowPlaying(channel, tags);
            return;
        }

        if (command === '!sr' || command === '!songrequest') {
            client.say(channel, `@${tags.username}, Song requests are done through channel points`);
            return;
        }

        // Handle channel point redemptions last
        await handleChannelPointRedemption(channel, tags, message);
    } catch (error) {
        console.error('Error handling message:', error);
    }
});

// Handle token expiry
client.on('disconnected', async (reason) => {
  if (reason.includes('Login authentication failed')) {
    console.log('Token expired, refreshing...');
    await refreshToken();
    client.opts.identity.password = accessToken;
    client.connect();
  }
});

// Add daily reconnection timer
const scheduleReconnection = () => {
  const now = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(now.getDate() + 1);
  tomorrow.setHours(6, 0, 0, 0); // Set to 6:00 AM

  const timeUntilReconnect = tomorrow - now;
  console.log(`Scheduled reconnection in ${Math.floor(timeUntilReconnect / (1000 * 60 * 60))} hours`);
  
  setTimeout(() => {
    console.log('Performing scheduled daily reconnection...');
    client.disconnect()
      .then(() => {
        console.log('Disconnected successfully, reconnecting...');
        return client.connect();
      })
      .then(() => {
        console.log('Reconnected successfully');
        scheduleReconnection(); // Schedule next day's reconnection
      })
      .catch(err => {
        console.error('Error during scheduled reconnection:', err);
        // Try to reconnect again after 5 minutes if it failed
        setTimeout(() => client.connect(), 5 * 60 * 1000);
        scheduleReconnection(); // Still schedule next day's reconnection
      });
  }, timeUntilReconnect);
};

// Start the bot
client.connect()
  .then(() => {
    console.log('Twitch bot connected');
    scheduleReconnection(); // Schedule the first reconnection
  })
  .catch(err => console.error('Failed to connect:', err));

// Refresh token every 4 hours (tokens expire in 14400 seconds)
setInterval(refreshToken, 4 * 60 * 60 * 1000);

const handleSkipVote = async (channel, tags) => {
    const now = Date.now();
    if (now - lastSuccessfulSkip < SKIP_COOLDOWN) {
        const remainingCooldown = Math.ceil((SKIP_COOLDOWN - (now - lastSuccessfulSkip)) / 1000);
        client.say(channel, `@${tags.username}, skip voting is on cooldown for ${remainingCooldown} seconds!`);
        return;
    }

    //const isLive = await checkStreamStatus(channel);
    /*if (!isLive) {
        client.say(channel, `@${tags.username}, skip voting is only available when the stream is live!`);
        return;
    }*/

    if (!skipVoteActive) {
        // Start new vote
        skipVoteActive = true;
        skipVoters.clear();
        skipVoters.add(tags.username);

        // Insert skip vote notification
        const { error } = await supabase
            .from('skip_votes')
            .insert({
                initiator: tags.username,
                current_votes: 1,
                required_votes: REQUIRED_VOTES,
                expires_at: new Date(Date.now() + VOTE_DURATION).toISOString()
            });

        if (error) {
            console.error('Error creating skip vote:', error);
            return;
        }

        // Set timeout to clear vote
        skipVoteTimeout = setTimeout(() => {
            skipVoteActive = false;
            skipVoters.clear();
            client.say(channel, `Skip vote failed - not enough votes received in time.`);
        }, VOTE_DURATION);

        client.say(channel, `@${tags.username} started a vote to skip the current song! Type !skip to vote. ${REQUIRED_VOTES} votes needed in ${VOTE_DURATION / 1000} seconds.`);
    } else if (!skipVoters.has(tags.username)) {
        // Add vote
        skipVoters.add(tags.username);
        const currentVotes = skipVoters.size;

        // Update vote count
        await supabase
            .from('skip_votes')
            .update({ current_votes: currentVotes })
            .eq('active', true);

        if (currentVotes >= REQUIRED_VOTES) {
            // Skip the track
            try {
                await skipCurrentTrack();
                lastSuccessfulSkip = Date.now(); // Update the last successful skip time
                client.say(channel, `Skip vote successful! Skipping current track.`);
            } catch (error) {
                console.error('Error skipping track:', error);
                client.say(channel, `Error skipping track.`);
            }

            // Clear vote state
            clearTimeout(skipVoteTimeout);
            skipVoteActive = false;
            skipVoters.clear();
        } else {
            client.say(channel, `@${tags.username} voted to skip! ${REQUIRED_VOTES - currentVotes} more votes needed!`);
        }
    }
};