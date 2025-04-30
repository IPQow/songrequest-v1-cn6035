let loadRequests; // Declare in outer scope
let isWalletConnected = false;

document.addEventListener('DOMContentLoaded', () => {
    const supabase = window.supabaseClient;
    let currentStatusFilter = 'all';

    // Initialize real-time listener
    const channel = supabase.channel('requests')
        .on('postgres_changes', { 
            event: 'INSERT',
            schema: 'public',
            table: 'requests'
        }, (payload) => {
            // Start countdown for new requests
            startQueueCountdown(payload.new.id);
            loadRequests(currentPage);
        })
        .on('postgres_changes', { 
            event: 'UPDATE',
            schema: 'public',
            table: 'requests'
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
            // Get queue size
            const { count: queueSize, error: queueError } = await supabase
                .from('requests')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'queued')
                .eq('played', false);

            if (queueError) throw queueError;
            
            document.getElementById('queue-size').textContent = `Queue: ${queueSize}`;

            // Get filtered requests with pagination
            let query = supabase
                .from('requests')
                .select('*', { count: 'exact' });
            
            if (currentStatusFilter === 'queued') {
                query = query.eq('status', 'queued').eq('played', false);
            } else if (currentStatusFilter === 'played') {
                query = query.eq('played', true);
            }
            
            query = query
                .order('created_at', { ascending: false })
                .range(page * pageSize, (page + 1) * pageSize - 1);

            const { data, error, count } = await query;
            if (error) throw error;
            
            totalRequests = count;
            currentPage = page;
            
            renderRequests(data);
            renderPagination(count, page, pageSize);
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
            loadRequests(0); // Reset to first page when filtering
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
            
            if (request.now_playing) {
                card.classList.add('now-playing');
            }

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
                    <p class="requester">Requested by: ${request.requester}</p>
                    <div class="status-container">
                        <div class="status-wrapper">
                            ${request.status === 'pending' ? `
                                <div class="countdown" id="countdown-${request.id}">
                                    <div class="countdown-ring"></div>
                                    <span class="countdown-text">60</span>
                                </div>
                            ` : `
                                <span class="status ${request.played ? 'played' : request.status}">${request.played ? 'Played' : 'In Queue'}</span>
                            `}
                        </div>
                    </div>
                </div>
            `;
            container.appendChild(card);

            // Start countdown if pending
            if (request.status === 'pending') {
                startQueueCountdown(request.id);
            }
        });

        // Initialize lazy loading for images
        initLazyLoading();
    }

    // Add countdown functionality
    function startQueueCountdown(requestId) {
        let timeLeft = 60; // 60 seconds countdown
        const countdownElement = document.getElementById(`countdown-${requestId}`);
        
        if (!countdownElement) return;

        const textElement = countdownElement.querySelector('.countdown-text');
        const ringElement = countdownElement.querySelector('.countdown-ring');
        
        const interval = setInterval(async () => {
            timeLeft--;
            if (textElement) {
                textElement.textContent = timeLeft;
            }
            if (ringElement) {
                ringElement.style.background = `conic-gradient(#1DB954 ${(60-timeLeft)/60*360}deg, transparent ${(60-timeLeft)/60*360}deg)`;
            }
            
            if (timeLeft <= 0) {
                clearInterval(interval);
                // Auto-queue the song
                await autoQueueSong(requestId);
            }
        }, 1000);
    }

    // Auto-queue function
    async function autoQueueSong(requestId) {
        try {
            const { data: request } = await supabase
                .from('requests')
                .select('spotify_uri')
                .eq('id', requestId)
                .single();

            if (!request) return;

            // Add to Spotify queue
            const response = await fetch('/api/queue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uri: request.spotify_uri })
            });

            if (!response.ok) throw new Error('Failed to add to queue');

            // Update request status
            await supabase
                .from('requests')
                .update({ status: 'queued' })
                .eq('id', requestId);

            loadRequests();
        } catch (error) {
            console.error('Auto-queue error:', error);
        }
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
});