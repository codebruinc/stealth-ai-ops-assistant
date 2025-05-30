const express = require('express');
const router = express.Router();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * @route GET /api/harvest/time
 * @desc Fetch recent Harvest time entries
 * @access Private (Admin)
 */
router.get('/time', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(days));
    
    // Format date for Harvest API (YYYYMMDD)
    const fromDate = daysAgo.toISOString().split('T')[0].replace(/-/g, '');
    
    // Fetch time entries
    const timeEntries = await fetchTimeEntries(fromDate);
    
    res.json({
      success: true,
      count: timeEntries.length,
      timeEntries
    });
  } catch (error) {
    console.error('Error fetching Harvest time entries:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Harvest time entries',
      details: error.message
    });
  }
});

/**
 * @route GET /api/harvest/invoices
 * @desc Fetch Harvest invoices
 * @access Private (Admin)
 */
router.get('/invoices', async (req, res) => {
  try {
    const { status = 'open' } = req.query;
    
    // Fetch invoices
    const invoices = await fetchInvoices(status);
    
    res.json({
      success: true,
      count: invoices.length,
      invoices
    });
  } catch (error) {
    console.error('Error fetching Harvest invoices:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Harvest invoices',
      details: error.message
    });
  }
});

/**
 * Fetch time entries from Harvest API
 * @param {string} fromDate Date string in YYYYMMDD format
 * @returns {Promise<Array>} Array of time entries
 */
async function fetchTimeEntries(fromDate) {
  try {
    const response = await axios.get('https://api.harvestapp.com/v2/time_entries', {
      headers: {
        'Authorization': `Bearer ${process.env.HARVEST_ACCESS_TOKEN}`,
        'Harvest-Account-ID': process.env.HARVEST_ACCOUNT_ID,
        'User-Agent': 'Stealth AI Ops Assistant (support@example.com)'
      },
      params: {
        from: fromDate,
        is_running: false
      }
    });
    
    // Enrich time entries with project and client information
    const timeEntries = response.data.time_entries;
    
    // Get all projects for reference
    const projectsResponse = await axios.get('https://api.harvestapp.com/v2/projects', {
      headers: {
        'Authorization': `Bearer ${process.env.HARVEST_ACCESS_TOKEN}`,
        'Harvest-Account-ID': process.env.HARVEST_ACCOUNT_ID,
        'User-Agent': 'Stealth AI Ops Assistant (support@example.com)'
      }
    });
    
    const projects = projectsResponse.data.projects;
    
    // Get all clients for reference
    const clientsResponse = await axios.get('https://api.harvestapp.com/v2/clients', {
      headers: {
        'Authorization': `Bearer ${process.env.HARVEST_ACCESS_TOKEN}`,
        'Harvest-Account-ID': process.env.HARVEST_ACCOUNT_ID,
        'User-Agent': 'Stealth AI Ops Assistant (support@example.com)'
      }
    });
    
    const clients = clientsResponse.data.clients;
    
    // Enrich time entries with project and client details
    return timeEntries.map(entry => {
      const project = projects.find(p => p.id === entry.project.id);
      const client = project ? clients.find(c => c.id === project.client.id) : null;
      
      return {
        ...entry,
        project_details: project || {},
        client_details: client || {}
      };
    });
  } catch (error) {
    console.error('Error in fetchTimeEntries:', error);
    throw error;
  }
}

/**
 * Fetch invoices from Harvest API
 * @param {string} status Invoice status to filter by
 * @returns {Promise<Array>} Array of invoices
 */
async function fetchInvoices(status) {
  try {
    const response = await axios.get('https://api.harvestapp.com/v2/invoices', {
      headers: {
        'Authorization': `Bearer ${process.env.HARVEST_ACCESS_TOKEN}`,
        'Harvest-Account-ID': process.env.HARVEST_ACCOUNT_ID,
        'User-Agent': 'Stealth AI Ops Assistant (support@example.com)'
      },
      params: {
        status
      }
    });
    
    return response.data.invoices;
  } catch (error) {
    console.error('Error in fetchInvoices:', error);
    throw error;
  }
}

module.exports = router;