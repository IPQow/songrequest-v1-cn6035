import { PeraWalletConnect } from "@perawallet/connect";
import algosdk from "algosdk";
import { createClient } from '@supabase/supabase-js';
import { initWallet } from './wallet';
import { setupRequestHandlers } from './requests';
import { TESTNET_CONFIG, SUPABASE_CONFIG } from './config';

// Initialize Supabase client
const supabase = createClient(
    SUPABASE_CONFIG.url,
    SUPABASE_CONFIG.key
);

// Initialize Algorand client
const algodClient = new algosdk.Algodv2(
    '',
    TESTNET_CONFIG.nodeServer,
    ''
);

// Initialize Pera Wallet
const peraWallet = new PeraWalletConnect({
    chainId: TESTNET_CONFIG.id
});

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize wallet connection
    initWallet(peraWallet, algodClient);
    
    // Initialize request handlers
    setupRequestHandlers(supabase, algodClient, peraWallet);
}); 