import React from 'react'
import SongRequestForm from './SongRequestForm'
import './SongRequestModal.css'

const SongRequestModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        <SongRequestForm />
      </div>
    </div>
  )
}

export default SongRequestModal 