import React, { useState } from 'react'
import toast from 'react-hot-toast'
import { useWallet } from '../context/WalletContext'

// Get admin wallet address from environment variables
const ADMIN_WALLET_ADDRESS = import.meta.env.VITE_ADMIN_WALLET_ADDRESS

const SongRequestForm = () => {
  const [formData, setFormData] = useState({
    title: '',
    artist: '',
    requester: ''
  })
  const [loading, setLoading] = useState(false)
  const { accountAddress, paySongRequest, SONG_REQUEST_COST, balance } = useWallet()

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
      // Check if wallet is connected
      if (!accountAddress) {
        toast.error('Please connect your wallet first')
        return
      }

      // Check if user has enough balance
      if (balance < SONG_REQUEST_COST / 1_000_000) {
        toast.error('Insufficient balance')
        return
      }

      // Check if admin wallet address is configured
      if (!ADMIN_WALLET_ADDRESS) {
        toast.error('Admin wallet not configured')
        console.error('Admin wallet address not set in environment variables')
        return
      }

      // Process payment
      const paymentResult = await paySongRequest(ADMIN_WALLET_ADDRESS)

      if (!paymentResult.success) {
        throw new Error('Payment failed')
      }

      // If payment successful, submit the song request
      const response = await fetch('/api/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          song: formData.title,
          artist: formData.artist,
          user: formData.requester,
          paymentTxId: paymentResult.txId
        })
      })

      if (!response.ok) {
        throw new Error('Failed to submit request')
      }

      toast.success('Song request submitted successfully!')
      // Clear form
      setFormData({
        title: '',
        artist: '',
        requester: ''
      })
    } catch (error) {
      console.error('Error submitting song request:', error)
      toast.error(error.message || 'Failed to submit song request')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="song-request-form">
      <h2>Request a Song</h2>
      <div className="payment-info">
        <p>Cost: {SONG_REQUEST_COST / 1_000_000} ALGO</p>
        {accountAddress ? (
          <p>Your balance: {balance.toFixed(3)} ALGO</p>
        ) : (
          <p>Connect your wallet to request songs</p>
        )}
      </div>
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
          disabled={loading || !accountAddress || balance < SONG_REQUEST_COST / 1_000_000}
          className="submit-button"
        >
          {loading ? 'Processing...' : 'Submit Request'}
        </button>
      </form>
    </div>
  )
}

export default SongRequestForm 