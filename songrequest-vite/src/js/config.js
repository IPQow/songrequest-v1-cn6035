export const TESTNET_CONFIG = {
    nodeServer: 'https://testnet-api.algonode.cloud',
    indexerServer: 'https://testnet-idx.algonode.cloud',
    network: 'testnet',
    id: 416002 // TestNet chain ID
};

// Your application ID from the deployed smart contract
export const APP_ID = 0; // Replace with your actual app ID

// Minimum balance required for transactions (in microAlgos)
export const MIN_BALANCE = 100000; // 0.1 ALGO

// Supabase configuration
export const SUPABASE_CONFIG = {
    url: process.env.SUPABASE_URL || 'your-supabase-url',
    key: process.env.SUPABASE_KEY || 'your-supabase-key'
}; 