import React from 'react'
import { useWallet } from '../context/WalletContext'

const WalletButton = () => {
  const { isConnected, accountAddress, balance, connectWallet, disconnectWallet } = useWallet()

  return (
    <div className="wallet-container">
      {isConnected ? (
        <div className="wallet-info">
          <span className="wallet-balance">{balance.toFixed(3)} ALGO</span>
          <button 
            className="wallet-button connected" 
            onClick={disconnectWallet}
            title={accountAddress}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span className="wallet-address">{accountAddress.slice(0, 4)}...{accountAddress.slice(-4)}</span>
          </button>
        </div>
      ) : (
        <button className="wallet-button" onClick={connectWallet}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="5" width="20" height="14" rx="2"></rect>
            <line x1="2" y1="10" x2="22" y2="10"></line>
          </svg>
          Connect Wallet
        </button>
      )}
    </div>
  )
}

export default WalletButton 