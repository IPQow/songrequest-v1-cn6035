// Algorand TestNet Configuration
const algodClient = new algosdk.Algodv2(
    '', // No token needed for PureStake
    'https://testnet-api.algonode.cloud',
    ''
);

// TestNet Asset ID for your song voting application (you'll need to create this)
const SONG_VOTE_APP_ID = 738512643; // Replace with your actual TestNet application ID

// Constants for the application
const TESTNET_NETWORK = {
    id: 'testnet',
    nodeServer: 'https://testnet-api.algonode.cloud',
    indexerServer: 'https://testnet-idx.algonode.cloud',
    genesisHash: 'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=',
    genesisID: 'testnet-v1.0'
};

// Minimum balance required for transactions (in microAlgos)
const MIN_BALANCE = 100000; // 0.1 ALGO 