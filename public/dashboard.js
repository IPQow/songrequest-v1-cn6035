let loadRequests; // Declare in outer scope
let isAuthenticated = false;

document.addEventListener('DOMContentLoaded', () => {
    const supabase = window.supabaseClient;
    let currentStatusFilter = 'all';

    // Update login form handler
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();
            
            if (data.success) {
                isAuthenticated = true;
                // Store the username in localStorage for approve/deny actions
                localStorage.setItem('moderator_username', data.username);
                document.getElementById('auth-overlay').style.display = 'none';
            } else {
                alert('Invalid credentials');
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('Login failed. Please try again.');
        }
    });

    // Initialize real-time listener with more specific filters
    const channel = supabase.channel('requests')
        .on('postgres_changes', { 
            event: 'INSERT',
            schema: 'public',
            table: 'requests',
            filter: 'hidden=eq.false'
        }, () => {
            loadRequests(currentPage);
        })
        .on('postgres_changes', { 
            event: 'UPDATE',
            schema: 'public',
            table: 'requests',
            filter: 'hidden=eq.false'
        }, () => {
            loadRequests(currentPage);
        })
        .subscribe();

    // Define loadRequests
    let currentPage = 0;
    const pageSize = 20;
    let totalRequests = 0;
    
    loadRequests = async (page = currentPage) => {
        try {
            // First, get the queue size using count only
            const { count: queueSize, error: queueError } = await supabase
                .from('requests')
                .select('*', { count: 'exact', head: true })
                .eq('hidden', false)
                .eq('status', 'approved')
                .eq('played', false);

            if (queueError) throw queueError;
            
            // Update queue size display
            document.getElementById('queue-size').textContent = `Queue: ${queueSize}`;

            // Get filtered requests with pagination
            let query = `/api/requests?page=${page}&pageSize=${pageSize}`;
            
            if (currentStatusFilter !== 'all') {
                query += `&status=${currentStatusFilter}`;
            }

            const response = await fetch(query);
            if (!response.ok) throw new Error('Failed to fetch requests');
            
            const { data, pagination } = await response.json();
            
            totalRequests = pagination.total;
            currentPage = pagination.page;
            
            renderRequests(data);
            renderPagination(pagination.total, pagination.page, pagination.pageSize);
        } catch (error) {
            console.error('Error loading requests:', error);
        }
    };

    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentStatusFilter = btn.dataset.status;
            loadRequests();
        });
    });

    // Initial load
    loadRequests();

    // Render function
    function renderRequests(requests) {
        const container = document.getElementById('requests-container');
        container.innerHTML = '';

        requests.forEach(request => {
            const card = document.createElement('div');
            card.className = 'request-card';
            
            // Add now-playing class if the song is currently playing
            if (request.status === 'approved' && request.now_playing) {
                card.classList.add('now-playing');
            }

            const displayStatus = (request.status === 'approved' && request.played) 
                ? 'played' 
                : request.status;

            card.innerHTML = `
                <a href="${request.content_type === 'episode' 
                    ? `https://open.spotify.com/episode/${request.track_id}`
                    : `https://open.spotify.com/track/${request.track_id}`}" 
                    target="_blank" 
                    class="album-link">
                    <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='24' height='24'%3E%3Cpath fill='none' d='M0 0h24v24H0z'/%3E%3Cpath d='M12 3a9 9 0 0 1 9 9h-2a7 7 0 0 0-7-7V3z' fill='rgba(255,255,255,0.5)'/%3E%3C/svg%3E" 
                         data-src="${request.album_art}" 
                         class="album-art lazy-image" 
                         alt="Album art">
                </a>
                <div class="request-info">
                    <h3 class="song-title">${request.title}</h3>
                    <p class="artist">${request.artist}</p>
                    <p class="requester">Requested by: <a href="https://twitch.tv/popout/hollsbeauti/viewercard/${request.requester}?popout=" target="_blank" class="requester-link">${request.requester}</a></p>
                    <div class="status-container">
                        <div class="status-wrapper">
                            <span class="status ${displayStatus}" 
                                  ${(displayStatus === 'approved' || displayStatus === 'played') ? 
                                    `onclick="markAsPlayed('${request.id}')"` : 
                                    ''
                                  }>${displayStatus}</span>
                            ${(displayStatus === 'approved' || displayStatus === 'played') ? `
                                <button class="requeue-btn ${request.requeued ? 'requeued' : ''}" 
                                        onclick="requeueTrack('${request.spotify_uri}', '${request.id}', this)"
                                        ${request.requeued ? 'disabled' : ''}
                                        title="${request.requeued ? 'Already requeued' : 'Add to queue again'}">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M4 4V9H4.58152M19.9381 11C19.446 7.05369 16.0796 4 12 4C8.64262 4 5.76829 6.06817 4.58152 9M4.58152 9H9M20 20V15H19.4185M19.4185 15C18.2317 17.9318 15.3574 20 12 20C7.92038 20 4.55399 16.9463 4.06189 13M19.4185 15H15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                </button>
                            ` : ''}
                        </div>
                        ${request.action_by ? `
                            <div class="action-by">${request.status} by ${request.action_by}</div>
                        ` : ''}
                    </div>
                    ${request.status === 'pending' ? `
                    <div class="actions">
                        <button class="btn approve-btn" onclick="approveRequest('${request.id}')">Approve</button>
                        <button class="btn deny-btn" onclick="denyRequest('${request.id}')">Deny</button>
                    </div>
                    ` : ''}
                </div>
            `;
            container.appendChild(card);
        });

        // Initialize lazy loading for images
        initLazyLoading();
    }

    // Add lazy loading functionality
    function initLazyLoading() {
        const lazyImages = document.querySelectorAll('.lazy-image');
        
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.dataset.src;
                        img.classList.remove('lazy-image');
                        imageObserver.unobserve(img);
                    }
                });
            });

            lazyImages.forEach(img => {
                imageObserver.observe(img);
            });
        } else {
            // Fallback for browsers that don't support IntersectionObserver
            lazyImages.forEach(img => {
                img.src = img.dataset.src;
            });
        }
    }

    // Add pagination rendering function
    function renderPagination(total, currentPage, pageSize) {
        const paginationContainer = document.getElementById('pagination-container');
        if (!paginationContainer) {
            const container = document.createElement('div');
            container.id = 'pagination-container';
            container.className = 'pagination';
            document.getElementById('requests-container').after(container);
        }
        
        const totalPages = Math.ceil(total / pageSize);
        const paginationEl = document.getElementById('pagination-container');
        paginationEl.innerHTML = '';
        
        // Previous button
        const prevBtn = document.createElement('button');
        prevBtn.innerText = '← Previous';
        prevBtn.className = 'pagination-btn';
        prevBtn.disabled = currentPage === 0;
        prevBtn.addEventListener('click', () => {
            if (currentPage > 0) {
                loadRequests(currentPage - 1);
            }
        });
        paginationEl.appendChild(prevBtn);
        
        // Page info
        const pageInfo = document.createElement('span');
        pageInfo.innerText = `Page ${currentPage + 1} of ${totalPages}`;
        pageInfo.className = 'page-info';
        paginationEl.appendChild(pageInfo);
        
        // Next button
        const nextBtn = document.createElement('button');
        nextBtn.innerText = 'Next →';
        nextBtn.className = 'pagination-btn';
        nextBtn.disabled = currentPage >= totalPages - 1;
        nextBtn.addEventListener('click', () => {
            if (currentPage < totalPages - 1) {
                loadRequests(currentPage + 1);
            }
        });
        paginationEl.appendChild(nextBtn);
    }

    // Modal handling
    const modal = document.getElementById('quick-add-modal');
    const quickAddBtn = document.getElementById('quick-add-btn');
    const closeBtn = document.querySelector('.close');
    const quickAddForm = document.getElementById('quick-add-form');

    quickAddBtn.onclick = () => {
        if (!isAuthenticated) {
            alert('Please login first');
            return;
        }
        modal.style.display = 'block';
    };

    closeBtn.onclick = () => {
        modal.style.display = 'none';
    };

    window.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };

    quickAddForm.onsubmit = async (e) => {
        e.preventDefault();
        const input = document.getElementById('song-input').value;
        const username = localStorage.getItem('moderator_username');

        try {
            const response = await fetch('/api/quick-add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    query: input,
                    username 
                })
            });

            if (!response.ok) throw new Error('Failed to add song');
            
            const data = await response.json();
            if (data.success) {
                modal.style.display = 'none';
                quickAddForm.reset();
                loadRequests();
            } else {
                throw new Error(data.message || 'Failed to add song');
            }
        } catch (error) {
            console.error('Quick add error:', error);
            alert(error.message);
        }
    };

    // Force skip button handler
    document.getElementById('force-skip-btn').addEventListener('click', async () => {
        if (!isAuthenticated) {
            alert('Please login first');
            return;
        }

        try {
            const response = await fetch('/api/force-skip', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    username: localStorage.getItem('moderator_username') 
                })
            });

            if (!response.ok) throw new Error('Failed to skip track');
            
            const data = await response.json();
            if (!data.success) {
                throw new Error(data.message || 'Failed to skip track');
            }
        } catch (error) {
            console.error('Force skip error:', error);
            alert(error.message);
        }
    });
});

// Global functions with proper error handling
async function approveRequest(requestId) {
    if (!isAuthenticated) {
        alert('Please login first');
        return;
    }
    
    try {
        const response = await fetch(`/api/approve/${requestId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                username: localStorage.getItem('moderator_username') 
            })
        });

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.message);
        }

        loadRequests();
    } catch (error) {
        console.error('Approval error:', error);
        alert(error.message);
    }
}

async function denyRequest(id) {
    if (!isAuthenticated) {
        alert('Please login first');
        return;
    }
    try {
        const username = localStorage.getItem('moderator_username');
        const response = await fetch(`/api/deny/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });

        if (!response.ok) throw new Error('Denial failed');
        loadRequests();
    } catch (error) {
        console.error('Denial error:', error);
        alert(error.message);
    }
}

// Add this new function to handle marking as played
async function markAsPlayed(requestId) {
    try {
        // First, get the current state of the request
        const { data, error: fetchError } = await window.supabaseClient
            .from('requests')
            .select('played')
            .eq('id', requestId)
            .single();

        if (fetchError) throw fetchError;

        // Toggle the played state
        const { error: updateError } = await window.supabaseClient
            .from('requests')
            .update({ played: !data.played })
            .eq('id', requestId);

        if (updateError) throw updateError;

        loadRequests();
    } catch (error) {
        console.error('Error toggling played status:', error);
        alert('Failed to update played status. Please try again.');
    }
}

// Add this new function for re-queueing tracks
async function requeueTrack(spotifyUri, requestId, buttonElement) {
    if (!isAuthenticated) {
        alert('Please login first');
        return;
    }

    // Check if already requeued
    if (buttonElement.hasAttribute('disabled')) {
        return;
    }
    
    try {
        const response = await fetch('/api/queue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uri: spotifyUri })
        });

        if (!response.ok) throw new Error('Failed to add track to queue');
        
        const data = await response.json();
        if (data.success) {
            // Update requeued status in database
            const { error } = await window.supabaseClient
                .from('requests')
                .update({ requeued: true })
                .eq('id', requestId);

            if (error) throw error;
            
            buttonElement.classList.add('requeued');
            buttonElement.setAttribute('disabled', '');
            buttonElement.title = 'Already requeued';
            loadRequests(); // Reload to show updated state
        } else {
            throw new Error(data.message || 'Failed to add track to queue');
        }
    } catch (error) {
        console.error('Re-queue error:', error);
        alert(error.message);
    }
}