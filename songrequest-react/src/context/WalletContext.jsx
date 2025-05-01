import React, { createContext, useContext, useState, useEffect } from 'react'
import { PeraWalletConnect } from "@perawallet/connect"
import algosdk from "algosdk"
import toast from 'react-hot-toast'

const WalletContext = createContext({})

// Initialize the Pera Wallet connector with browser WebSocket
const peraWallet = new PeraWalletConnect({
  shouldShowSignTxnToast: false,
  chainId: 416002  // TestNet chain ID
})

// Initialize the Algorand client for TestNet
const algod = new algosdk.Algodv2(
  "",
  "https://testnet-api.algonode.cloud",
  443
)

// Constants
const SONG_REQUEST_COST = BigInt(0.1 * 1_000_000) // 0.1 Algo in microAlgos

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
      // Convert microAlgos (BigInt) to Algos (Number)
      const microAlgos = BigInt(accountInfo.amount)
      const algos = Number(microAlgos) / 1_000_000
      setBalance(algos)
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

  const paySongRequest = async (receiverAddress) => {
    try {
      if (!accountAddress) {
        throw new Error('Sender address is null or undefined');
      }

      if (!receiverAddress) {
        throw new Error('Receiver address is null or undefined');
      }
      
      try {
        decodedSender = algosdk.decodeAddress(accountAddress);
        console.log('Sender address decoded successfully:', decodedSender);
      } catch (error) {
        console.error('Failed to decode sender address:', error);
        throw new Error('Invalid sender address format');
      }

      try {
        decodedReceiver = algosdk.decodeAddress(receiverAddress);
        console.log('Receiver address decoded successfully:', decodedReceiver);
      } catch (error) {
        console.error('Failed to decode receiver address:', error);
        throw new Error('Invalid receiver address format');
      }

      const suggestedParams = await algod.getTransactionParams().do();      

      const amount = Number(SONG_REQUEST_COST);
      let sender = accountAddress;
      let receiver = receiverAddress;
      
      //console.log('Creating transaction with parameters:');
      //console.log('- Amount:', amount);
      //console.log('- Sender:', sender);
      //console.log('- Receiver:', receiver);
      //console.log('- Fee:', suggestedParams.fee);

      // Create basic payment transaction
      const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        suggestedParams: suggestedParams,
        from: sender,
        to: receiver,
        amount: amount,
        type: 'pay'
      });


      const txnToSign = [{ txn: txn }];


      const signedTxn = await peraWallet.signTransaction([txnToSign]);

      const { txId } = await algod.sendRawTransaction(signedTxn).do();

      await algosdk.waitForConfirmation(algod, txId, 4);

      // Refresh balance
      await fetchBalance();

      return { success: true, txId };
    } catch (error) {
      console.error('\n=== Transaction Error ===');
      console.error('Error details:', error);
      console.error('Error stack:', error.stack);
      throw error;
    }
  }

  const value = {
    accountAddress,
    balance,
    connectWallet,
    disconnectWallet,
    paySongRequest,
    isConnected: !!accountAddress,
    SONG_REQUEST_COST: Number(SONG_REQUEST_COST) // Convert to Number for display purposes
  }

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  )
}

export default WalletContext 