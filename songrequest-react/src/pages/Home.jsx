import React, { useState, useEffect } from 'react'
import { getSongRequests, supabase } from '../services/supabase'
import SongRequestForm from '../components/SongRequestForm'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { formatTimeSince } from '../utils/dateUtils'

const Home = () => {
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Home 