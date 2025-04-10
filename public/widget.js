document.addEventListener('DOMContentLoaded', () => {
    const supabase = window.supabaseClient;

    function showNotification(request, type = 'request') {
        const container = document.getElementById('notifications');
        const notification = document.createElement('div');
        
        if (type === 'queue') {
            // Only show notification if queue has items
            if (!request || request.length === 0) {
                return;
            }

            notification.className = 'notification queue';
            
            // Take only first 5 songs for display
            const displayTracks = request.slice(0, 5);
            const queueList = displayTracks.map((track, index) => 
                `<div class="queue-item">
                    <span class="queue-number">${index + 1}.</span>
                    <div class="queue-info">
                        <p class="song-title">${track.title}</p>
                        <p class="artist">${track.artist}</p>
                    </div>
                </div>`
            ).join('');
            
            // Add remaining count if queue is longer than 5
            const remainingCount = request.length - 5;
            const remainingText = remainingCount > 0 ? 
                `<div class="queue-item remaining-count">+${remainingCount} more</div>` : '';
            
            notification.innerHTML = `
                <div class="notification-content queue-content">
                    <p class="queue-header">Current Queue: ${request.length} song${request.length !== 1 ? 's' : ''}</p>
                    ${queueList}
                    ${remainingText}
                </div>
            `;
        } else {
            // Skip notification if it's a "playing now" update
            if (request.played && request.status === 'approved') {
                return;
            }
            
            notification.className = `notification ${request.played ? 'played' : request.status}`;
            const statusText = request.status === 'pending' 
                ? `sent to moderation queue`
                : request.played
                    ? `is playing now!`
                    : request.status === 'denied'
                        ? `Denied by ${request.action_by}`
                        : `Added to queue by ${request.action_by}`;
            
            notification.innerHTML = `
                <img src="${request.album_art}" class="album-art" alt="Album Art">
                <div class="notification-content">
                    <p class="song-title">${request.title}</p>
                    <p class="artist">${request.artist}</p>
                    <p class="requester">Requested by: ${request.requester}</p>
                    <span class="status ${request.played ? 'played' : request.status}">${statusText}</span>
                </div>
            `;
        }

        container.appendChild(notification);

        // Modified removal animation
        setTimeout(() => {
            notification.classList.add('fade-out');
            notification.addEventListener('transitionend', () => {
                notification.remove();
            });
        }, 3500);
    }

    // Make showNotification available globally for testing
    window.showNotification = showNotification;

    // Subscribe to realtime changes
    supabase
        .channel('requests')
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'requests' 
        }, payload => {
            showNotification(payload.new);
        })
        .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'requests' 
        }, payload => {
            showNotification(payload.new);
        })
        .subscribe();

    // Subscribe to queue notifications
    supabase
        .channel('queue_notifications')
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'queue_notifications' 
        }, payload => {
            showNotification(payload.new.tracks, 'queue');
        })
        .subscribe();

    // Subscribe to skip vote notifications
    supabase
        .channel('skip_votes')
        .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'skip_votes' 
        }, payload => {
            const vote = payload.new;
            const container = document.getElementById('notifications');
            
            // Look for existing skip vote notification
            let notification = document.querySelector('.skip-vote-notification');
            const progress = (vote.current_votes / vote.required_votes) * 100;
            const isSkipped = vote.current_votes === vote.required_votes;
            
            if (notification) {
                // Update existing notification
                const progressBar = notification.querySelector('.skip-vote-bar');
                const voteCount = notification.querySelector('.skip-vote-counts');
                const header = notification.querySelector('.skip-vote-header');
                
                progressBar.style.width = `${progress}%`;
                
                if (isSkipped) {
                    notification.classList.add('skipped');
                    header.classList.add('skipped');
                    progressBar.classList.add('skipped');
                    header.textContent = 'Song Skipped';
                    voteCount.textContent = 'Vote successful!';
                } else {
                    voteCount.textContent = `${vote.current_votes}/${vote.required_votes} votes`;
                }
            } else {
                // Create new notification if none exists
                notification = document.createElement('div');
                notification.className = `skip-vote-notification${isSkipped ? ' skipped' : ''}`;
                
                notification.innerHTML = `
                    <p class="skip-vote-header${isSkipped ? ' skipped' : ''}">${isSkipped ? 'Song Skipped' : 'Vote skip'}</p>
                    <div class="skip-vote-progress">
                        <div class="skip-vote-bar${isSkipped ? ' skipped' : ''}" style="width: ${progress}%"></div>
                    </div>
                    <p class="skip-vote-counts">${isSkipped ? 'Vote successful!' : `${vote.current_votes}/${vote.required_votes} votes`}</p>
                `;
                
                container.insertBefore(notification, container.firstChild);
            }
            
            // Remove after vote expires or 3 seconds if successful
            const timeLeft = new Date(vote.expires_at) - new Date();
            if (isSkipped) {
                setTimeout(() => {
                    notification.classList.add('removing');
                    setTimeout(() => {
                        notification.remove();
                    }, 500);
                }, 3000); // 3 seconds for successful votes
            } else if (timeLeft > 0) {
                setTimeout(() => {
                    notification.classList.add('removing');
                    setTimeout(() => {
                        notification.remove();
                    }, 500);
                }, timeLeft);
            }
        })
        .subscribe();
});