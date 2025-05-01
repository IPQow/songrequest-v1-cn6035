import React, { useState, useEffect } from 'react'
import { getSongRequests, supabase } from '../services/supabase'
import SongRequestForm from '../components/SongRequestForm'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useWallet } from '../context/WalletContext'
import toast from 'react-hot-toast'
import { formatTimeSince } from '../utils/dateUtils'
import algosdk from 'algosdk'

const Home = () => {
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [processingPayment, setProcessingPayment] = useState(null)
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const { isConnected, accountAddress, paySongRequest, SONG_REQUEST_COST, balance } = useWallet()

  useEffect(() => {
    fetchSongs()
    
    const subscription = supabase
      .channel('requests-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'requests'
        },
        (payload) => {
          console.log('Real-time update received:', payload)
          // Refresh the songs list when any change occurs
          fetchSongs()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const fetchSongs = async () => {
    try {
      setLoading(true)
      const data = await getSongRequests()
      setSongs(data)
    } catch (err) {
      console.error('Error fetching songs:', err)
      setError('Failed to load song requests')
      toast.error('Failed to load song requests')
    } finally {
      setLoading(false)
    }
  }

  const handleBuySong = async (song) => {
    console.log('\n=== handleBuySong Debug ===');
    
    if (!isConnected) {
      console.log('Wallet not connected');
      toast.error('Please connect your wallet first');
      return;
    }

    try {
      setProcessingPayment(song.id);

      // Immediately queue the song in Spotify
      try {
        // Call the queue API endpoint to add the song to Spotify queue
        const queueResponse = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/queue`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ uri: song.spotify_uri }),
        });

        if (!queueResponse.ok) {
          const queueError = await queueResponse.json();
          console.error('Failed to add song to queue:', queueError);
          toast.error('Song added to queue but encountered an error');
        } else {
          // Update song status in database for the queued song
          const { error: queueUpdateError } = await supabase
            .from('requests')
            .update({ 
              status: 'queued',
              action_by: 'Auto-Queue System'
            })
            .eq('id', song.id);

          if (queueUpdateError) {
            console.error('Error updating song status:', queueUpdateError);
          }
          
          toast.success('Song added to queue successfully!');
        }
      } catch (queueError) {
        console.error('Error adding to Spotify queue:', queueError);
        toast.error('Failed to add song to queue');
      }
      
      // Now attempt payment (after queuing) if user has sufficient balance
      if (balance < SONG_REQUEST_COST / 1_000_000) {
        console.log('Insufficient balance');
        toast.success('Song added to queue!');
        return;
      }
      
      // Hardcoded admin wallet address
      const adminWallet = "CXQ3YB74QKIPUC4HZ63KKGTWGVX423LMFYV3INDUX2HFMUJM5T5WL5IAQU";
      
      console.log('Debug - handleBuySong:');
      console.log('- Admin Wallet:', adminWallet);
      console.log('- Admin Wallet Length:', adminWallet.length);
      console.log('- Song ID:', song.id);
      console.log('- Connected Wallet:', accountAddress);
      console.log('- Balance:', balance);

      // Validate admin wallet address before proceeding
      if (!adminWallet || adminWallet.trim() === '') {
        throw new Error('Admin wallet address is not configured');
      }

      // Validate the admin wallet format
      try {
        const decodedAdmin = algosdk.decodeAddress(adminWallet);
        console.log('Admin wallet validated:', decodedAdmin);
      } catch (error) {
        console.error('Admin wallet validation failed:', error);
        throw new Error('Invalid admin wallet address format');
      }

      // Create a clean copy of the admin wallet address
      const cleanAdminWallet = adminWallet.trim();
      console.log('Clean admin wallet address:', cleanAdminWallet);

      // Attempt to decode again to verify
      const verifyDecode = algosdk.decodeAddress(cleanAdminWallet);
      console.log('Verified admin wallet decode:', verifyDecode);

      console.log('Calling paySongRequest with admin wallet:', cleanAdminWallet);
      
      try {
        const paymentResult = await paySongRequest(cleanAdminWallet);
        
        if (paymentResult.success) {
          // Update payment info in database
          const { error: updateError } = await supabase
            .from('requests')
            .update({ 
              payment_txn: paymentResult.txId
            })
            .eq('id', song.id);

          if (updateError) {
            console.error('Error updating payment transaction:', updateError);
          }
          
          toast.success('Payment processed successfully!');
        }
      } catch (paymentError) {
        console.error('Payment error:', paymentError);
        toast.success('Song added to queue!');
      }

      await fetchSongs() // Refresh the list
    } catch (error) {
      console.error('Error handling song request:', error);
      toast.error(error.message || 'Error occurred while processing request');
    } finally {
      setProcessingPayment(null);
    }
  }

  const getStatusClass = (status) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return 'status-approved'
      case 'denied':
        return 'status-denied'
      default:
        return 'status-pending'
    }
  }

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return '✓'
      case 'denied':
        return '✗'
      default:
        return '⌛'
    }
  }

  if (loading) {
    return (
      <div className="container">
        <h1 className="page-title">Song Requests</h1>
        <div className="loading-container">
          <div className="loading-text">Loading song requests...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container">
        <h1 className="page-title">Song Requests</h1>
        <div style={{ color: 'var(--error-color)', padding: '2rem', textAlign: 'center' }}>
          <p>Error: {error}</p>
          <button onClick={fetchSongs} style={{ marginTop: '1rem' }}>Try Again</button>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      {isAuthenticated && <SongRequestForm />}
      {songs.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '3rem 1rem', 
          color: 'var(--text-secondary)',
          backgroundColor: 'var(--card-bg)',
          borderRadius: '12px',
          border: '1px dashed var(--border-color)',
          margin: '2rem 0'
        }}>
          <p>No song requests found.</p>
          {isAuthenticated && <p>Be the first to request a song!</p>}
        </div>
      ) : (
        <div className="song-list">
          {songs.map((song) => (
            <div key={song.id} className="song-card">
              <div className="song-art">
                {song.album_art ? (
                  <img src={song.album_art} alt={`${song.title} album art`} />
                ) : (
                  <div 
                    style={{ 
                      width: '100%', 
                      height: '100%', 
                      backgroundColor: 'rgba(0,0,0,0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-tertiary)',
                      fontSize: '0.75rem',
                      textAlign: 'center',
                      padding: '0.5rem'
                    }}
                  >
                    No Image
                  </div>
                )}
              </div>
              <div className="song-info">
                <div>
                  <h2 className="song-title">{song.title}</h2>
                  <p className="song-artist">{song.artist}</p>
                </div>
                
                <div className="song-meta">
                  <span>
                    <strong style={{ color: 'var(--text-secondary)' }}>Requested by:</strong> {song.requester}
                  </span>
                  <span className="time-ago">{formatTimeSince(song.created_at)}</span>
                  
                  {song.payment_txn && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                      Processed by: {song.action_by || 'Unknown'}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="card-actions">
                <span className={`status-tag ${getStatusClass(song.status)}`}>
                  {getStatusIcon(song.status)} {song.status || 'Pending'}
                </span>
                
                {song.status === 'pending' && (
                  <div className="song-actions">
                    <button
                      className="buy-button"
                      onClick={() => handleBuySong(song)}
                      disabled={!isConnected || processingPayment === song.id}
                    >
                      {processingPayment === song.id ? (
                        <span>Processing...</span>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 6v6l3 3" />
                          </svg>
                          Add to queue (0.1 ALGO)
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Home 