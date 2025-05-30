const express = require('express');
const router = express.Router();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * @route GET /api/zendesk/tickets
 * @desc Fetch recent Zendesk tickets
 * @access Private (Admin)
 */
router.get('/tickets', async (req, res) => {
  try {
    const { days = 7, status = 'open,pending' } = req.query;
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(days));
    
    // Format date for Zendesk API (ISO format)
    const startDate = daysAgo.toISOString();
    
    // Fetch tickets
    const tickets = await fetchTickets(startDate, status);
    
    res.json({
      success: true,
      count: tickets.length,
      tickets
    });
  } catch (error) {
    console.error('Error fetching Zendesk tickets:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Zendesk tickets',
      details: error.message
    });
  }
});

/**
 * Fetch tickets from Zendesk API
 * @param {string} startDate ISO date string for oldest ticket to fetch
 * @param {string} status Comma-separated list of statuses to filter by
 * @returns {Promise<Array>} Array of tickets
 */
async function fetchTickets(startDate, status) {
  try {
    // Construct the search query
    const query = `type:ticket created>${startDate} status:${status}`;
    
    // Zendesk authentication
    const auth = Buffer.from(`${process.env.ZENDESK_EMAIL}/token:${process.env.ZENDESK_API_TOKEN}`).toString('base64');
    
    const response = await axios.get(`https://${process.env.ZENDESK_SUBDOMAIN}.zendesk.com/api/v2/search.json`, {
      headers: {
        Authorization: `Basic ${auth}`
      },
      params: {
        query,
        sort_by: 'created_at',
        sort_order: 'desc'
      }
    });
    
    // Filter to only include tickets
    const tickets = response.data.results.filter(result => result.type === 'ticket');
    
    // Fetch additional details for each ticket
    const ticketsWithDetails = await Promise.all(
      tickets.map(async ticket => {
        try {
          // Get ticket comments
          const commentsResponse = await axios.get(
            `https://${process.env.ZENDESK_SUBDOMAIN}.zendesk.com/api/v2/tickets/${ticket.id}/comments.json`,
            {
              headers: {
                Authorization: `Basic ${auth}`
              }
            }
          );
          
          return {
            ...ticket,
            comments: commentsResponse.data.comments
          };
        } catch (error) {
          console.warn(`Could not fetch comments for ticket ${ticket.id}:`, error.message);
          return {
            ...ticket,
            comments: []
          };
        }
      })
    );
    
    return ticketsWithDetails;
  } catch (error) {
    console.error('Error in fetchTickets:', error);
    throw error;
  }
}

module.exports = router;