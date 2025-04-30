import React, { createContext, useContext, useState, useEffect } from 'react'
import { PeraWalletConnect } from "@perawallet/connect"
import algosdk from "algosdk"
import toast from 'react-hot-toast'

const WalletContext = createContext({})

// Initialize the Pera Wallet connector with browser WebSocket
const peraWallet = new PeraWalletConnect({
  shouldShowSignTxnToast: false,
  network: "testnet"
})

// Initialize the Algorand client for TestNet
const algod = new algosdk.Algodv2(
  "",
  "https://testnet-api.algonode.cloud",
  443
)

export const useWallet = () => {
  return useContext(WalletContext)
}

export const WalletProvider = ({ children }) => {
  const [accountAddress, setAccountAddress] = useState(null)
  const [balance, setBalance] = useState(0)

  useEffect(() => {
    // Reconnect to session when the component is mounted
    peraWallet.reconnectSession().then((accounts) => {
      if (accounts.length) {
        setAccountAddress(accounts[0])
      }
    })

    // Handle disconnect event
    peraWallet.connector?.on("disconnect", handleDisconnect)

    return () => {
      // Cleanup event listener
      peraWallet.connector?.off("disconnect", handleDisconnect)
    }
  }, [])

  const handleDisconnect = () => {
    setAccountAddress(null)
    setBalance(0)
  }

  // Fetch account balance when address changes
  useEffect(() => {
    if (accountAddress) {
      fetchBalance()
    }
  }, [accountAddress])

  const fetchBalance = async () => {
    try {
      const accountInfo = await algod.accountInformation(accountAddress).do()
      // Convert microAlgos to Algos (1 Algo = 1,000,000 microAlgos)
      setBalance(accountInfo.amount / 1000000)
    } catch (error) {
      console.error('Error fetching balance:', error)
      toast.error('Failed to fetch account balance')
    }
  }

  const connectWallet = async () => {
    try {
      const newAccounts = await peraWallet.connect()
      if (newAccounts.length) {
        setAccountAddress(newAccounts[0])
        toast.success('Wallet connected successfully!')
      }
    } catch (error) {
      console.error('Error connecting wallet:', error)
      toast.error('Failed to connect wallet')
    }
  }

  const disconnectWallet = async () => {
    try {
      await peraWallet.disconnect()
      handleDisconnect()
      toast.success('Wallet disconnected')
    } catch (error) {
      console.error('Error disconnecting wallet:', error)
      toast.error('Failed to disconnect wallet')
    }
  }

  const value = {
    accountAddress,
    balance,
    connectWallet,
    disconnectWallet,
    isConnected: !!accountAddress
  }

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  )
}

export default WalletContext 