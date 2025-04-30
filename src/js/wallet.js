import { MIN_BALANCE } from './config';

let walletAddress = null;
let username = null;

export async function initWallet(peraWallet, algodClient) {
    // Try to reconnect existing session
    peraWallet.reconnectSession().then((accounts) => {
        if (accounts.length) {
            walletAddress = accounts[0];
            checkAccountBalance(algodClient, accounts[0]);
            updateWalletStatus();
        }
    }).catch(error => console.log('Reconnect failed:', error));

    // Set up event listeners
    setupWalletListeners(peraWallet, algodClient);
}

function setupWalletListeners(peraWallet, algodClient) {
    const connectButton = document.getElementById('connect-wallet');
    const authConnectButton = document.getElementById('auth-wallet-btn');
    const startButton = document.getElementById('start-btn');
    const authOverlay = document.getElementById('auth-overlay');

    if (authConnectButton) {
        authConnectButton.addEventListener('click', async () => {
            if (walletAddress) {
                await disconnectWallet(peraWallet);
            } else {
                await connectWallet(peraWallet, algodClient, true);
            }
        });
    }

    if (connectButton) {
        connectButton.addEventListener('click', async () => {
            if (walletAddress) {
                await disconnectWallet(peraWallet);
            } else {
                await connectWallet(peraWallet, algodClient);
            }
        });
    }

    if (startButton) {
        startButton.addEventListener('click', () => {
            const usernameInput = document.getElementById('username');
            if (usernameInput && usernameInput.value.trim()) {
                username = usernameInput.value.trim();
                localStorage.setItem('username', username);
                localStorage.setItem('walletAddress', walletAddress);
                authOverlay.style.display = 'none';
            }
        });
    }

    // Handle Pera Wallet events
    peraWallet.connector?.on('disconnect', () => {
        walletAddress = null;
        username = null;
        updateWalletStatus();
    });
}

async function connectWallet(peraWallet, algodClient, isAuth = false) {
    try {
        const accounts = await peraWallet.connect();
        
        if (accounts && accounts.length > 0) {
            walletAddress = accounts[0];
            
            // Check if the account has sufficient balance
            await checkAccountBalance(algodClient, accounts[0]);
            
            // Update UI
            updateWalletStatus(isAuth);
            
            if (isAuth) {
                document.getElementById('username-section').style.display = 'block';
            } else {
                document.dispatchEvent(new CustomEvent('walletConnected', {
                    detail: { address: walletAddress }
                }));
            }
            
            return true;
        } else {
            throw new Error('No accounts found. Please connect your Pera Wallet.');
        }
    } catch (error) {
        console.error('Wallet connection error:', error);
        updateWalletStatus(isAuth, error.message);
        return false;
    }
}

async function disconnectWallet(peraWallet) {
    try {
        await peraWallet.disconnect();
        walletAddress = null;
        username = null;
        updateWalletStatus();
        
        document.dispatchEvent(new CustomEvent('walletDisconnected'));
    } catch (error) {
        console.error('Disconnect error:', error);
    }
}

async function checkAccountBalance(algodClient, address) {
    try {
        const accountInfo = await algodClient.accountInformation(address).do();
        const balance = accountInfo.amount;
        
        if (balance < MIN_BALANCE) {
            throw new Error(`Insufficient balance. You need at least 0.1 ALGO. Visit https://bank.testnet.algorand.network/ to get TestNet ALGO.`);
        }
        
        return true;
    } catch (error) {
        console.error('Balance check error:', error);
        updateWalletStatus(false, error.message);
        return false;
    }
}

function updateWalletStatus(isAuth = false, errorMessage = null) {
    const statusElement = isAuth ? 
        document.getElementById('auth-wallet-status') : 
        document.getElementById('wallet-status');
    const connectButton = isAuth ? 
        document.getElementById('auth-wallet-btn') : 
        document.getElementById('connect-wallet');
    
    if (!statusElement || !connectButton) return;

    if (walletAddress) {
        statusElement.innerHTML = `Connected: ${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}`;
        statusElement.classList.remove('error');
        connectButton.textContent = 'Disconnect';
        connectButton.classList.add('connected');
    } else {
        statusElement.innerHTML = errorMessage || 'Not connected';
        statusElement.classList.add('error');
        connectButton.textContent = 'Connect Wallet';
        connectButton.classList.remove('connected');
    }
}

export function getWalletAddress() {
    return walletAddress;
}

export function getUsername() {
    return username;
} 