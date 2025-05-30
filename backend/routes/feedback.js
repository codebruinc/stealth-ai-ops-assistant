const express = require('express');
const router = express.Router();
const feedbackHandler = require('../memory/feedbackHandler');
const logger = require('../utils/logger');

/**
 * @route POST /api/feedback
 * @desc Submit feedback on AI suggestions
 * @access Private (Admin)
 */
router.post('/', async (req, res) => {
  try {
    const feedbackData = req.body;
    
    if (!feedbackData || !feedbackData.type) {
      return res.status(400).json({
        success: false,
        error: 'Invalid feedback data. Type is required.'
      });
    }
    
    // Extract parameters from feedbackData
    const { summaryId, rating, comment, userId } = feedbackData;
    
    if (!summaryId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid feedback data. Summary ID is required.'
      });
    }
    
    // Store the feedback using the feedbackHandler
    const result = await feedbackHandler.storeFeedback(summaryId, rating || feedbackData.type, comment || feedbackData.content, userId);
    
    if (!result) {
      return res.status(500).json({
        success: false,
        error: 'Failed to store feedback'
      });
    }
    
    res.json({
      success: true,
      message: 'Feedback stored successfully',
      feedbackId: result.id
    });
  } catch (error) {
    logger.error('Error in POST /feedback:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process feedback',
      details: error.message
    });
  }
});

/**
 * @route GET /api/feedback
 * @desc Get feedback history
 * @access Private (Admin)
 */
router.get('/', async (req, res) => {
  try {
    const summaryId = req.query.summaryId;
    
    if (summaryId) {
      const feedbackHistory = await feedbackHandler.getFeedbackHistory(summaryId);
      return res.json({
        success: true,
        feedback: feedbackHistory
      });
    } else {
      const feedbackStats = await feedbackHandler.getFeedbackStats();
      return res.json({
        success: true,
        stats: feedbackStats
      });
    }
  } catch (error) {
    logger.error('Error in GET /feedback:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch feedback',
      details: error.message
    });
  }
});

module.exports = router;