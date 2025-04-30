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
            {accountAddress.slice(0, 4)}...{accountAddress.slice(-4)}
          </button>
        </div>
      ) : (
        <button className="wallet-button" onClick={connectWallet}>
          Connect Wallet
        </button>
      )}
    </div>
  )
}

export default WalletButton 