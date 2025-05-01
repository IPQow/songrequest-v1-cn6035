import { useWallet } from '@txnlab/use-wallet-react'
import { useState } from 'react'
import toast from 'react-hot-toast'

const WalletButton = () => {
  const { activeAccount, activeNetwork, providers, isReady } = useWallet()

  if (!isReady) {
    return <div>Loading wallet...</div>
  }

  if (activeAccount) {
    return <ConnectedWallet />
  }
  
  return <WalletList providers={providers} />
}

const WalletList = ({ providers }) => {
  return (
    <div className="wallet-list">
      <h3>Connect Wallet</h3>
      <div className="wallet-options">
        {Object.values(providers).map((provider) => (
          <WalletOption
            key={provider.id}
            provider={provider}
          />
        ))}
      </div>
    </div>
  )
}

const WalletOption = ({ provider }) => {
  const { connect } = useWallet()
  const [connecting, setConnecting] = useState(false)
  
  const handleConnect = async () => {
    setConnecting(true)
    try {
      await connect(provider.id)
      toast.success('Wallet connected successfully!')
    } catch (error) {
      console.error('Failed to connect:', error)
      toast.error('Failed to connect wallet')
    } finally {
      setConnecting(false)
    }
  }
  
  return (
    <button
      onClick={handleConnect}
      disabled={connecting}
      className="wallet-option"
    >
      {provider.metadata && (
        <img
          src={provider.metadata.icon}
          alt={provider.metadata.name}
          width={32}
          height={32}
        />
      )}
      <span>{provider.name}</span>
    </button>
  )
}

const ConnectedWallet = () => {
  const { activeAccount, activeNetwork, disconnect } = useWallet()

  const handleDisconnect = async () => {
    try {
      await disconnect()
      toast.success('Wallet disconnected')
    } catch (error) {
      console.error('Failed to disconnect:', error)
      toast.error('Failed to disconnect wallet')
    }
  }

  return (
    <div className="connected-wallet">
      <div className="wallet-header">
        <span>{activeAccount.name}</span>
        {activeNetwork && (
          <span className="network-badge">{activeNetwork}</span>
        )}
      </div>
      
      <div className="account-info">
        <span>{activeAccount.address}</span>
      </div>
      
      <button onClick={handleDisconnect}>
        Disconnect
      </button>
    </div>
  )
}

export default WalletButton 