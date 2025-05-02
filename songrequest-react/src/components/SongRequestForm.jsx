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
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Submitting...
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18V5l12-2v13"></path>
                <circle cx="6" cy="18" r="3"></circle>
                <circle cx="18" cy="16" r="3"></circle>
              </svg>
              Submit Request
            </>
          )}
        </button>
      </form>
    </div>
  )
}

export default SongRequestForm 