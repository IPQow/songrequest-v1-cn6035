import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import { WalletProvider } from './context/WalletContext'
import WalletButton from './components/WalletButton'
import './App.css'
import Home from './pages/Home'

function App() {
  return (
    <Router>
      <AuthProvider>
        <WalletProvider>
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
        </WalletProvider>
      </AuthProvider>
    </Router>
  )
}

export default App
