import React, { useState } from 'react'
import toast from 'react-hot-toast'

const SongRequestForm = () => {
  const [formData, setFormData] = useState({
    title: '',
    artist: '',
    requester: ''
  })
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      // TODO: Implement the actual submission logic using Supabase
      console.log('Submitting song request:', formData)
      toast.success('Song request submitted successfully!')
      // Clear form
      setFormData({
        title: '',
        artist: '',
        requester: ''
      })
    } catch (error) {
      console.error('Error submitting song request:', error)
      toast.error('Failed to submit song request')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="song-request-form">
      <h2>Request a Song</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="title">Song Title</label>
          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
            placeholder="Enter song title"
          />
        </div>
        <div className="form-group">
          <label htmlFor="artist">Artist</label>
          <input
            type="text"
            id="artist"
            name="artist"
            value={formData.artist}
            onChange={handleChange}
            required
            placeholder="Enter artist name"
          />
        </div>
        <div className="form-group">
          <label htmlFor="requester">Your Name</label>
          <input
            type="text"
            id="requester"
            name="requester"
            value={formData.requester}
            onChange={handleChange}
            required
            placeholder="Enter your name"
          />
        </div>
        <button 
          type="submit" 
          disabled={loading}
          className="submit-button"
        >
          {loading ? 'Submitting...' : 'Submit Request'}
        </button>
      </form>
    </div>
  )
}

export default SongRequestForm 