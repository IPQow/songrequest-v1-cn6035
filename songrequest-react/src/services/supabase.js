import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY

console.log('Initializing Supabase with URL:', supabaseUrl)
export const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: {
    params: {
      eventsPerSecond: 2
    }
  }
})

export const getSongRequests = async () => {
  try {
    console.log('Fetching song requests from Supabase...')
    const { data, error } = await supabase
      .from('requests')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Supabase error:', error)
      throw error
    }

    console.log('Successfully fetched song requests:', data)
    return data
  } catch (error) {
    console.error('Error in getSongRequests:', error)
    throw error
  }
}

export const voteSong = async (songId, walletAddress) => {
  // PLACEHGOLDER, DOES NOTHING RN
  console.log('Voting for song:', songId, 'by wallet:', walletAddress)
} 