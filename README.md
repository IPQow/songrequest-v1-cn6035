# Twitch Song Requests with Algorand Integration

A modernized Twitch song request application that leverages Algorand blockchain for payments. This project transforms the original moderator-based song request system into a direct viewer-to-playlist flow with cryptocurrency payments.

## 🔄 Changes from Original Project

The original project was a Twitch song request bot that:
- Listened for channel point redemptions
- Searched Spotify based on redemption messages
- Displayed results on a moderator dashboard for approval
- Used plain HTML, CSS, and JavaScript

### Key Modifications:

1. **React Migration**
   - Converted entire application to React using Vite
   - Implemented component-based architecture
   - Added proper state management using Context API
   - Enhanced UI/UX with React components

2. **Algorand Blockchain Integration**
   - Implemented 0.1 ALGO payment system for song requests
   - Added wallet connection functionality
   - Created transaction verification system
   - Built error handling for failed transactions

3. **Direct Viewer-to-Playlist Flow**
   - Removed moderator approval requirement
   - Added automatic song queuing upon payment verification
   - Implemented chat command parsing system
   - Enhanced queue management

## 📋 Prerequisites

- Node.js (v16+)
- npm or yarn
- Twitch Developer Account
- Spotify Developer Account
- Algorand TestNet Account (for testing) or MainNet Account (for production)

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/IPQow/songrequest-v1-cn603
   cd songrequest-v1-cn603
   ```

2. **Install dependencies for the server**
   ```bash
   npm install
   ```

3. **Install dependencies for the React application**
   ```bash
   cd songrequest-react
   npm install
   cd ..
   ```

4. **Set up environment variables**

   Create a `.env` file in the root directory with the following variables:
   ```
   TWITCH_BOT_USERNAME=...
   TWITCH_OAUTH_TOKEN=...
   TWITCH_REFRESH_TOKEN=...
   TWITCH_CHANNEL=...
   TWITCH_CLIENT_ID=...
   TWITCH_CLIENT_SECRET=...
   
   SPOTIFY_CLIENT_ID=...
   SPOTIFY_CLIENT_SECRET=...
   SPOTIFY_REFRESH_TOKEN=...
   SPOTIFY_ACCESS_TOKEN=...
   SPOTIFY_EXPIRES_IN=...
   
   SUPABASE_URL=...
   SUPABASE_KEY=...
   ```

   Create another `.env` file in the `songrequest-react` directory with the following variables:
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_KEY=...
   VITE_ADMIN_WALLET_ADDRESS=...
   ```

5. **Build the React application (optional for production)**
   ```bash
   cd songrequest-react
   npm run build
   cd ..
   ```

6. **Set up Supabase Database**

   a. Create a new project in Supabase
   b. Navigate to the SQL Editor
   c. Enable Realtime for the `requests` table:
      - Go to Database → Replication
      - Click "Add Publication"
      - Select the `requests` table
      - Enable "Insert", "Update", and "Delete" operations
   
   d. Create the requests table by running this SQL:
   ```sql
   CREATE TABLE public.requests (
     id serial NOT NULL,
     track_id character varying(255) NULL,
     title character varying(255) NOT NULL,
     artist character varying(255) NULL,
     album_art character varying(255) NULL,
     requester character varying(255) NOT NULL,
     status character varying(50) NULL DEFAULT 'pending'::character varying,
     action_by character varying(255) NULL,
     spotify_uri character varying(255) NULL,
     content_type character varying(50) NULL DEFAULT 'track'::character varying,
     played boolean NULL DEFAULT false,
     hidden boolean NULL DEFAULT false,
     now_playing boolean NULL DEFAULT false,
     created_at timestamp with time zone NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT requests_pkey PRIMARY KEY (id)
   );
   ```

   e. Copy your Supabase URL and anon key from the project settings and add them to your environment variables


## 🚀 Running the Application

You need to run three separate components:

1. **Start the Twitch chat bot**
   ```bash
   node twitch.js
   ```

2. **Start the main server**
   ```bash
   node index.js
   ```

3. **Start the React development server**
   ```bash
   cd songrequest-react
   npm run dev
   ```

The application should now be running with:
- Twitch bot listening to chat commands
- Backend server processing payments and Spotify requests
- React frontend available at http://localhost:5173

## 🔌 Usage

1. **For Streamers:**
   - Complete the authentication process for both Twitch and Spotify
   - Connect your Algorand wallet to receive payments
   - Start streaming and inform viewers of the song request command

2. **For Viewers:**
   - Select the 'Song Request' channel point redemption and input a song name or spotify link
   - Connect Algorand wallet when prompted
   - Confirm payment of 0.1 ALGO
   - Song will be automatically added to the queue upon payment verification

## 🧪 Testing

To test without using real ALGO:
1. Switch to TestNet in your Algorand configuration
2. Use the Algorand TestNet Dispenser to get free test ALGO
3. Follow the normal song request process