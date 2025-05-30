const express = require('express');
const router = express.Router();
const contextStore = require('../memory/contextStore');
const logger = require('../utils/logger');

/**
 * @route GET /api/clients
 * @desc Get all clients
 * @access Private (Admin)
 */
router.get('/', async (req, res) => {
  try {
    // Use the Supabase client with service role
    const { data: clients, error } = await require('@supabase/supabase-js')
      .createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        global: {
          headers: {
            'X-Client-Info': 'stealth-ai-ops-assistant-clients'
          }
        }
      })
      .from('clients')
      .select('*')
      .order('last_mentioned', { ascending: false });
    
    if (error) {
      logger.error('Error fetching clients:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch clients',
        details: error.message
      });
    }
    
    res.json({
      success: true,
      clients: clients || []
    });
  } catch (error) {
    logger.error('Error in GET /clients:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch clients',
      details: error.message
    });
  }
});

/**
 * @route GET /api/clients/:id
 * @desc Get a specific client by ID
 * @access Private (Admin)
 */
router.get('/:id', async (req, res) => {
  try {
    const clientId = req.params.id;
    const client = await contextStore.getClientById(clientId);
    
    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Client not found'
      });
    }
    
    res.json({
      success: true,
      client
    });
  } catch (error) {
    logger.error(`Error in GET /clients/${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch client',
      details: error.message
    });
  }
});

/**
 * @route PUT /api/clients/:id
 * @desc Update a client
 * @access Private (Admin)
 */
router.put('/:id', async (req, res) => {
  try {
    const clientId = req.params.id;
    const updates = req.body;
    
    const success = await contextStore.updateClientContext(clientId, updates);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Failed to update client'
      });
    }
    
    // Get the updated client
    const client = await contextStore.getClientById(clientId);
    
    res.json({
      success: true,
      client
    });
  } catch (error) {
    logger.error(`Error in PUT /clients/${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to update client',
      details: error.message
    });
  }
});

/**
 * @route POST /api/clients
 * @desc Create a new client
 * @access Private (Admin)
 */
router.post('/', async (req, res) => {
  try {
    const clientData = req.body;
    
    if (!clientData.name) {
      return res.status(400).json({
        success: false,
        error: 'Client name is required'
      });
    }
    
    const client = await contextStore.createClient(clientData);
    
    if (!client) {
      return res.status(500).json({
        success: false,
        error: 'Failed to create client'
      });
    }
    
    res.status(201).json({
      success: true,
      client
    });
  } catch (error) {
    logger.error('Error in POST /clients:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create client',
      details: error.message
    });
  }
});

module.exports = router;