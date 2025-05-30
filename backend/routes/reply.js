const express = require('express');
const router = express.Router();
const axios = require('axios');
const logger = require('../utils/logger');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with service role
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY; // Despite the name, this is a service role key
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  global: {
    headers: {
      'X-Client-Info': 'stealth-ai-ops-assistant'
    }
  }
});

/**
 * @route POST /api/reply/:service
 * @desc Send a reply to a specific service (Slack, Zendesk, Email)
 * @access Private (Admin)
 */
router.post('/:service', async (req, res) => {
  try {
    const { service } = req.params;
    const replyData = req.body;
    
    if (!replyData || !replyData.message) {
      return res.status(400).json({
        success: false,
        error: 'Invalid reply data. Message is required.'
      });
    }
    
    // Store the reply in Supabase for tracking
    const { data: storedReply, error: storeError } = await supabase
      .from('replies')
      .insert({
        service,
        message: replyData.message,
        recipient: replyData.recipient || null,
        thread_id: replyData.threadId || null,
        ticket_id: replyData.ticketId || null,
        email_id: replyData.emailId || null,
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (storeError) {
      logger.warn(`Error storing reply to ${service}:`, storeError);
      // Continue even if storage fails
    }
    
    // For MVP, we don't actually send the reply, just store it for review
    // In a production version, this would integrate with the respective APIs
    
    logger.info(`Reply to ${service} stored for review:`, {
      recipient: replyData.recipient,
      messagePreview: replyData.message.substring(0, 50) + (replyData.message.length > 50 ? '...' : '')
    });
    
    // Update the reply status to 'ready'
    if (storedReply) {
      await supabase
        .from('replies')
        .update({ status: 'ready' })
        .eq('id', storedReply.id);
    }
    
    res.json({
      success: true,
      message: `Reply to ${service} stored for review`,
      replyId: storedReply?.id || null,
      note: 'In this MVP, replies are only stored for review and not automatically sent'
    });
  } catch (error) {
    logger.error(`Error in POST /reply/${req.params.service}:`, error);
    res.status(500).json({
      success: false,
      error: `Failed to process reply to ${req.params.service}`,
      details: error.message
    });
  }
});

/**
 * @route GET /api/reply
 * @desc Get all pending replies
 * @access Private (Admin)
 */
router.get('/', async (req, res) => {
  try {
    const { data: replies, error } = await supabase
      .from('replies')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      logger.error('Error fetching replies:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch replies',
        details: error.message
      });
    }
    
    res.json({
      success: true,
      replies: replies || []
    });
  } catch (error) {
    logger.error('Error in GET /reply:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch replies',
      details: error.message
    });
  }
});

module.exports = router;