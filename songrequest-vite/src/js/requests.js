import { getWalletAddress, getUsername } from './wallet';
import { APP_ID } from './config';

let supabaseClient;
let algodClient;
let peraWallet;

export function setupRequestHandlers(supabase, algod, pera) {
    supabaseClient = supabase;
    algodClient = algod;
    peraWallet = pera;

    // Add event listeners for song request form
    const requestForm = document.getElementById('songRequestForm');
    if (requestForm) {
        requestForm.addEventListener('submit', handleSongRequest);
    }

    // Start polling for queue updates
    pollQueueUpdates();
}

async function handleSongRequest(event) {
    event.preventDefault();
    
    const songTitle = document.getElementById('songTitle').value;
    const artistName = document.getElementById('artistName').value;
    
    if (!songTitle || !artistName) {
        alert('Please fill in both song title and artist name');
        return;
    }

    try {
        // Create song request in Supabase
        const { data, error } = await supabaseClient
            .from('song_requests')
            .insert([
                {
                    song_title: songTitle,
                    artist_name: artistName,
                    requester_address: getWalletAddress(),
                    requester_name: getUsername(),
                    status: 'pending'
                }
            ]);

        if (error) throw error;

        // Clear form
        event.target.reset();
        
        // Refresh queue display
        await updateQueueDisplay();
        
        alert('Song request submitted successfully!');
    } catch (error) {
        console.error('Error submitting song request:', error);
        alert('Failed to submit song request. Please try again.');
    }
}

async function updateQueueDisplay() {
    try {
        const { data, error } = await supabaseClient
            .from('song_requests')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) throw error;

        const queueContainer = document.getElementById('queueContainer');
        if (!queueContainer) return;

        queueContainer.innerHTML = '';
        
        data.forEach(request => {
            const requestElement = document.createElement('div');
            requestElement.className = 'request-item';
            requestElement.innerHTML = `
                <h3>${request.song_title}</h3>
                <p>Artist: ${request.artist_name}</p>
                <p>Requested by: ${request.requester_name || request.requester_address}</p>
                <p>Status: ${request.status}</p>
            `;
            queueContainer.appendChild(requestElement);
        });
    } catch (error) {
        console.error('Error updating queue display:', error);
    }
}

function pollQueueUpdates() {
    // Update queue display every 10 seconds
    setInterval(updateQueueDisplay, 10000);
}

// Initial queue update
updateQueueDisplay(); 