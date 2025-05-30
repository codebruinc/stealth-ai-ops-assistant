const express = require('express');
const router = express.Router();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * @route GET /api/slack/messages
 * @desc Fetch recent Slack messages
 * @access Private (Admin)
 */
router.get('/messages', async (req, res) => {
  try {
    const { days = 1, channels } = req.query;
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(days));
    
    // Convert to Unix timestamp (seconds)
    const oldest = Math.floor(daysAgo.getTime() / 1000);
    
    // If specific channels are requested, use those, otherwise fetch from all channels
    const channelList = channels ? channels.split(',') : await getAllChannels();
    
    const messages = [];
    
    // Fetch messages from each channel
    for (const channelId of channelList) {
      const channelMessages = await fetchChannelMessages(channelId, oldest);
      messages.push(...channelMessages);
    }
    
    res.json({
      success: true,
      count: messages.length,
      messages
    });
  } catch (error) {
    console.error('Error fetching Slack messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Slack messages',
      details: error.message
    });
  }
});

/**
 * Fetch all available channels
 * @returns {Promise<string[]>} Array of channel IDs
 */
async function getAllChannels() {
  try {
    const response = await axios.get('https://slack.com/api/conversations.list', {
      headers: {
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`
      },
      params: {
        types: 'public_channel,private_channel',
        exclude_archived: true,
        limit: 1000
      }
    });
    
    if (!response.data.ok) {
      throw new Error(`Slack API error: ${response.data.error}`);
    }
    
    // Auto-join public channels if SLACK_MODE is set to 'all'
    if (process.env.SLACK_MODE === 'all') {
      await joinAllChannels(response.data.channels);
    }
    
    return response.data.channels.map(channel => channel.id);
  } catch (error) {
    console.error('Error fetching channels:', error);
    throw error;
  }
}

/**
 * Join all available public channels
 * @param {Array} channels List of channels from the API
 */
async function joinAllChannels(channels) {
  for (const channel of channels) {
    // Skip private channels (bot must be invited manually)
    if (channel.is_private) continue;
    
    try {
      await axios.post('https://slack.com/api/conversations.join', {
        channel: channel.id
      }, {
        headers: {
          Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      // Log but don't fail if we can't join a channel
      console.warn(`Could not join channel ${channel.name}:`, error.message);
    }
  }
}

/**
 * Fetch messages from a specific channel
 * @param {string} channelId The channel ID
 * @param {number} oldest Unix timestamp for oldest message to fetch
 * @returns {Promise<Array>} Array of messages
 */
async function fetchChannelMessages(channelId, oldest) {
  try {
    const response = await axios.get('https://slack.com/api/conversations.history', {
      headers: {
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`
      },
      params: {
        channel: channelId,
        oldest,
        limit: 100,
        include_all_metadata: true
      }
    });
    
    if (!response.data.ok) {
      throw new Error(`Slack API error: ${response.data.error}`);
    }
    
    // Get channel info for context
    const channelInfo = await axios.get('https://slack.com/api/conversations.info', {
      headers: {
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`
      },
      params: {
        channel: channelId
      }
    });
    
    if (!channelInfo.data.ok) {
      throw new Error(`Slack API error: ${channelInfo.data.error}`);
    }
    
    // Add channel name to each message
    const channelName = channelInfo.data.channel.name;
    return response.data.messages.map(msg => ({
      ...msg,
      channel_id: channelId,
      channel_name: channelName
    }));
  } catch (error) {
    console.error(`Error fetching messages from channel ${channelId}:`, error);
    return []; // Return empty array instead of failing the entire request
  }
}

module.exports = router;