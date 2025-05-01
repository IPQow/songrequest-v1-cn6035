import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import { WalletProvider } from '@txnlab/use-wallet-react'
import { PeraWalletConnect } from '@perawallet/connect'
import algosdk from 'algosdk'
import WalletButton from './components/WalletButton'
import './App.css'
import Home from './pages/Home'

// Initialize the algod client
const algodClient = new algosdk.Algodv2(
  '',
  'https://testnet-api.algonode.cloud',
  ''
)

// Define providers
const walletProviders = {
  'pera': {
    id: 'pera',
    name: 'Pera Wallet',
    provider: PeraWalletConnect,
    options: {
      shouldShowSignTxnToast: false
    }
  }
}

function App() {
  return (
    <WalletProvider
      value={{
        providers: walletProviders,
        nodeConfig: {
          network: 'testnet',
          nodeServer: 'https://testnet-api.algonode.cloud',
          nodeToken: '',
          nodePort: '',
          algodClient: algodClient
        }
      }}
    >
      <Router>
        <AuthProvider>
          <div className="App">
            <WalletButton />
            <Routes>
              <Route path="/" element={<Home />} />
            </Routes>
          </div>
          <Toaster 
            position="bottom-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
              success: {
                duration: 3000,
                iconTheme: {
                  primary: '#22c55e',
                  secondary: '#fff',
                },
              },
              error: {
                duration: 3000,
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fff',
                },
              },
            }}
          />
        </AuthProvider>
      </Router>
    </WalletProvider>
  )
}

export default App
