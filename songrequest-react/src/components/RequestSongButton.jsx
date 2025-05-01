import React, { useState } from 'react'
import { useWallet } from '../context/WalletContext'
import SongRequestModal from './SongRequestModal'

const RequestSongButton = () => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { isConnected } = useWallet()

  return (
    <>
      <button 
        className="request-song-button"
        onClick={() => setIsModalOpen(true)}
        disabled={!isConnected}
      >
        Request Song
      </button>
      <SongRequestModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </>
  )
}

export default RequestSongButton 