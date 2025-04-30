import { TESTNET_CONFIG, APP_ID, MIN_BALANCE } from './config';

// Pera Wallet integration
let connectedAddress = null;
let username = null;
let algodClient = null;

// Initialize Pera Wallet with TestNet configuration
const peraWallet = new window.PeraWalletConnect({
    network: TESTNET_CONFIG.id,
    chainId: 416002 // TestNet chain ID
});

export function initWallet(peraWallet, algod) {
    algodClient = algod;

    // Handle connection events
    peraWallet.reconnectSession().then((accounts) => {
        if (accounts.length) {
            connectedAddress = accounts[0];
            checkAccountBalance(connectedAddress);
            updateWalletUI(true);
        }
    }).catch((e) => console.log('Reconnect failed:', e));

    // Initialize wallet functionality
    setupEventListeners(peraWallet);
}

export async function connectWallet(peraWallet) {
    try {
        const accounts = await peraWallet.connect();
        
        if (accounts && accounts.length > 0) {
            connectedAddress = accounts[0];
            updateWalletUI(true);
            return true;
        }
    } catch (error) {
        console.error('Error connecting wallet:', error);
        alert('Failed to connect wallet. Please try again.');
    }
    return false;
}

async function checkAccountBalance(address) {
    try {
        const accountInfo = await algodClient.accountInformation(address).do();
        const balance = accountInfo.amount;
        
        if (balance < MIN_BALANCE) {
            throw new Error(`Insufficient balance. You need at least 0.1 ALGO. Visit https://bank.testnet.algorand.network/ to get TestNet ALGO.`);
        }
        
        return true;
    } catch (error) {
        console.error('Balance check error:', error);
        updateWalletUI(false, error.message);
        return false;
    }
}

export async function disconnectWallet(peraWallet) {
    try {
        await peraWallet.disconnect();
        connectedAddress = null;
        username = null;
        updateWalletUI(false);
    } catch (error) {
        console.error('Error disconnecting wallet:', error);
    }
}

export function getWalletAddress() {
    return connectedAddress;
}

export function setUsername(name) {
    username = name;
}

export function getUsername() {
    return username;
}

function updateWalletUI(isConnected, errorMessage = null) {
    const connectButton = document.getElementById('connectWallet');
    const disconnectButton = document.getElementById('disconnectWallet');
    const addressDisplay = document.getElementById('walletAddress');
    const requestForm = document.getElementById('songRequestForm');

    if (connectButton) {
        connectButton.style.display = isConnected ? 'none' : 'block';
    }
    
    if (disconnectButton) {
        disconnectButton.style.display = isConnected ? 'block' : 'none';
    }
    
    if (addressDisplay) {
        addressDisplay.textContent = isConnected ? 
            `Connected: ${connectedAddress.slice(0, 6)}...${connectedAddress.slice(-4)}` : 
            errorMessage || 'Not connected';
    }
    
    if (requestForm) {
        requestForm.style.display = isConnected ? 'block' : 'none';
    }
}

// Check if wallet is connected
async function checkWalletConnection() {
    try {
        const accounts = await peraWallet.reconnectSession();
        if (accounts && accounts.length > 0) {
            await checkAccountBalance(accounts[0]);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Wallet check error:', error);
        return false;
    }
}

function setupEventListeners(peraWallet) {
    const connectButton = document.getElementById('connectWallet');
    const authConnectButton = document.getElementById('auth-wallet-btn');
    const startButton = document.getElementById('start-btn');
    const authOverlay = document.getElementById('auth-overlay');
    
    if (authConnectButton) {
        authConnectButton.addEventListener('click', async () => {
            if (connectedAddress) {
                await disconnectWallet(peraWallet);
            } else {
                await connectWallet(peraWallet);
            }
        });
    }

    if (connectButton) {
        connectButton.addEventListener('click', async () => {
            if (connectedAddress) {
                await disconnectWallet(peraWallet);
            } else {
                await connectWallet(peraWallet);
            }
        });
    }

    if (startButton) {
        startButton.addEventListener('click', async () => {
            const usernameInput = document.getElementById('username');
            if (usernameInput && usernameInput.value.trim()) {
                username = usernameInput.value.trim();
                
                try {
                    // Verify the account has opted into the application
                    const accountInfo = await algodClient.accountInformation(connectedAddress).do();
                    const hasOptedIn = accountInfo['apps-local-state']?.some(app => app.id === APP_ID);
                    
                    if (!hasOptedIn) {
                        // TODO: Implement opt-in transaction
                        console.log('Account needs to opt into the application');
                    }
                    
                    // Store username and wallet address in localStorage
                    localStorage.setItem('username', username);
                    localStorage.setItem('walletAddress', connectedAddress);
                    // Hide auth overlay
                    authOverlay.style.display = 'none';
                } catch (error) {
                    console.error('Error checking application opt-in:', error);
                    alert('Error verifying account. Please try again.');
                }
            }
        });
    }

    // Check for stored credentials
    const storedUsername = localStorage.getItem('username');
    const storedWalletAddress = localStorage.getItem('walletAddress');
    
    if (storedUsername && storedWalletAddress) {
        username = storedUsername;
        // Still need to connect wallet but can hide overlay
        authOverlay.style.display = 'none';
    }

    // Handle Pera Wallet events
    peraWallet.connector?.on('disconnect', () => {
        connectedAddress = null;
        username = null;
        updateWalletUI(false);
    });
}

// Initialize wallet functionality
document.addEventListener('DOMContentLoaded', () => {
    const connectButton = document.getElementById('connectWallet');
    const authConnectButton = document.getElementById('auth-wallet-btn');
    const startButton = document.getElementById('start-btn');
    const authOverlay = document.getElementById('auth-overlay');
    
    if (authConnectButton) {
        authConnectButton.addEventListener('click', async () => {
            if (connectedAddress) {
                await disconnectWallet(peraWallet);
            } else {
                await connectWallet(peraWallet);
            }
        });
    }

    if (connectButton) {
        connectButton.addEventListener('click', async () => {
            if (connectedAddress) {
                await disconnectWallet(peraWallet);
            } else {
                await connectWallet(peraWallet);
            }
        });
    }

    if (startButton) {
        startButton.addEventListener('click', async () => {
            const usernameInput = document.getElementById('username');
            if (usernameInput && usernameInput.value.trim()) {
                username = usernameInput.value.trim();
                
                try {
                    // Verify the account has opted into the application
                    const accountInfo = await algodClient.accountInformation(connectedAddress).do();
                    const hasOptedIn = accountInfo['apps-local-state']?.some(app => app.id === APP_ID);
                    
                    if (!hasOptedIn) {
                        // TODO: Implement opt-in transaction
                        console.log('Account needs to opt into the application');
                    }
                    
                    // Store username and wallet address in localStorage
                    localStorage.setItem('username', username);
                    localStorage.setItem('walletAddress', connectedAddress);
                    // Hide auth overlay
                    authOverlay.style.display = 'none';
                } catch (error) {
                    console.error('Error checking application opt-in:', error);
                    alert('Error verifying account. Please try again.');
                }
            }
        });
    }

    // Check for stored credentials
    const storedUsername = localStorage.getItem('username');
    const storedWalletAddress = localStorage.getItem('walletAddress');
    
    if (storedUsername && storedWalletAddress) {
        username = storedUsername;
        // Still need to connect wallet but can hide overlay
        authOverlay.style.display = 'none';
    }

    // Handle Pera Wallet events
    peraWallet.connector?.on('disconnect', () => {
        connectedAddress = null;
        username = null;
        updateWalletUI(false);
    });
});
