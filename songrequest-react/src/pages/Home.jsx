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

    if (balance < SONG_REQUEST_COST / 1_000_000) {
      console.log('Insufficient balance');
      toast.error('Insufficient balance');
      return;
    }

    try {
      setProcessingPayment(song.id);
      
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
      const paymentResult = await paySongRequest(cleanAdminWallet);
      
      if (!paymentResult.success) {
        throw new Error('Payment failed');
      }

      // Update song status in database
      const { error: updateError } = await supabase
        .from('requests')
        .update({ 
          status: 'approved',
          action_by: accountAddress.slice(0, 4) + '...' + accountAddress.slice(-4),
          payment_txn: paymentResult.txId
        })
        .eq('id', song.id)

      if (updateError) {
        throw updateError
      }

      toast.success('Song successfully purchased and added to queue!')
      await fetchSongs() // Refresh the list
    } catch (error) {
      console.error('Error buying song:', error)
      toast.error(error.message || 'Failed to buy song')
    } finally {
      setProcessingPayment(null)
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

  if (loading) {
    return (
      <div className="container">
        <h1 className="page-title">Song Requests</h1>
        <div>Loading song requests...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container">
        <h1 className="page-title">Song Requests</h1>
        <div style={{ color: 'red' }}>Error: {error}</div>
      </div>
    )
  }

  return (
    <div className="container">
      <h1 className="page-title">Song Requests</h1>
      {isAuthenticated && <SongRequestForm />}
      {songs.length === 0 ? (
        <div>No song requests found.</div>
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
                      backgroundColor: '#333',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#666',
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
                <h2 className="song-title">{song.title}</h2>
                <p className="song-artist">{song.artist}</p>
                <div className="song-meta">
                  <span>Requested by: {song.requester}</span>
                  <span style={{ margin: '0 0.5rem' }}>•</span>
                  <span className={`status-tag ${getStatusClass(song.status)}`}>
                    {song.status || 'Pending'}
                  </span>
                  <span style={{ margin: '0 0.5rem' }}>•</span>
                  <span className="time-ago">{formatTimeSince(song.created_at)}</span>
                </div>
                {song.status === 'pending' && (
                  <div className="song-actions">
                    <button
                      className="buy-button"
                      onClick={() => handleBuySong(song)}
                      disabled={!isConnected || processingPayment === song.id || balance < SONG_REQUEST_COST / 1_000_000}
                    >
                      {processingPayment === song.id ? (
                        'Processing...'
                      ) : (
                        <>Buy for {SONG_REQUEST_COST / 1_000_000} ALGO</>
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