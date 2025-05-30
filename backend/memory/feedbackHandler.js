const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

// Initialize Supabase client with error handling
let supabase;
try {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY; // Despite the name, this is a service role key
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
  }
  
  supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      headers: {
        'X-Client-Info': 'stealth-ai-ops-assistant-feedback-handler'
      }
    }
  });
  logger.info('Supabase client initialized successfully for feedback handler');
} catch (error) {
  logger.error('Failed to initialize Supabase client for feedback handler:', error);
  // Create a mock client for fallback
  supabase = {
    from: () => ({
      select: () => ({ data: null, error: new Error('Supabase client not initialized') }),
      insert: () => ({ data: null, error: new Error('Supabase client not initialized') }),
      update: () => ({ data: null, error: new Error('Supabase client not initialized') }),
      delete: () => ({ data: null, error: new Error('Supabase client not initialized') }),
      eq: () => ({ data: null, error: new Error('Supabase client not initialized') }),
      in: () => ({ data: null, error: new Error('Supabase client not initialized') }),
      single: () => ({ data: null, error: new Error('Supabase client not initialized') }),
      order: () => ({ data: null, error: new Error('Supabase client not initialized') }),
      gte: () => ({ data: null, error: new Error('Supabase client not initialized') })
    })
  };
}

// Feedback rating types
const RATING_TYPES = {
  APPROVED: 'approved',
  EDITED: 'edited',
  REJECTED: 'rejected'
};

// Cache for feedback patterns
const feedbackPatternsCache = {
  patterns: null,
  lastUpdated: 0,
  ttl: 5 * 60 * 1000 // 5 minutes
};

/**
 * Feedback Handler module for processing user feedback on AI suggestions
 */
const feedbackHandler = {
  /**
   * Store feedback on a summary or suggestion
   * @param {string} summaryId The ID of the summary
   * @param {string} rating The rating (approved, edited, rejected)
   * @param {string} comment Optional comment or edited text
   * @returns {Promise<Object|null>} The stored feedback or null if failed
   */
  async storeFeedback(summaryId, rating, comment = '', userId = null) {
    try {
      if (!summaryId) {
        logger.warn('storeFeedback called with null or undefined summaryId');
        return null;
      }
      
      if (!Object.values(RATING_TYPES).includes(rating)) {
        logger.warn(`Invalid rating type: ${rating}. Using 'approved' as default.`);
        rating = RATING_TYPES.APPROVED;
      }
      
      logger.debug(`Storing feedback for summary ${summaryId}: ${rating}`);
      
      const now = new Date().toISOString();
      
      const feedbackData = {
        summary_id: summaryId,
        rating,
        comment: comment || '',
        created_at: now
      };
      
      // Add user_id if provided
      if (userId) {
        feedbackData.user_id = userId;
      }
      
      const { data: feedback, error } = await supabase
        .from('feedback')
        .insert([feedbackData])
        .select()
        .single();
      
      if (error) {
        logger.error('Error storing feedback:', error);
        return null;
      }
      
      // Update feedback patterns for future suggestions
      await this.updateFeedbackPatterns(summaryId, rating, comment);
      
      // Invalidate the feedback patterns cache
      feedbackPatternsCache.patterns = null;
      
      // Track analytics for this feedback
      await this.trackFeedbackAnalytics(summaryId, rating, comment);
      
      logger.debug(`Feedback stored successfully with ID: ${feedback.id}`);
      return feedback;
    } catch (error) {
      logger.error('Error in storeFeedback:', error);
      return null;
    }
  },
  
  /**
   * Get feedback history for a summary
   * @param {string} summaryId The ID of the summary
   * @returns {Promise<Array>} Array of feedback objects
   */
  async getFeedbackHistory(summaryId) {
    try {
      if (!summaryId) {
        logger.warn('getFeedbackHistory called with null or undefined summaryId');
        return [];
      }
      
      logger.debug(`Fetching feedback history for summary ${summaryId}`);
      
      const { data: feedbackHistory, error } = await supabase
        .from('feedback')
        .select('*')
        .eq('summary_id', summaryId)
        .order('created_at', { ascending: false });
      
      if (error) {
        logger.error(`Error fetching feedback history for summary ${summaryId}:`, error);
        return [];
      }
      
      logger.debug(`Retrieved ${feedbackHistory.length} feedback entries for summary ${summaryId}`);
      return feedbackHistory;
    } catch (error) {
      logger.error(`Error in getFeedbackHistory for ${summaryId}:`, error);
      return [];
    }
  },
  
  /**
   * Get feedback statistics
   * @param {number} days Number of days to look back (default: 30)
   * @returns {Promise<Object>} Feedback statistics
   */
  async getFeedbackStats(days = 30) {
    try {
      logger.debug(`Fetching feedback stats for the last ${days} days`);
      
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - days);
      
      const { data: feedback, error } = await supabase
        .from('feedback')
        .select('*')
        .gte('created_at', daysAgo.toISOString());
      
      if (error) {
        logger.error('Error fetching feedback stats:', error);
        return {
          total: 0,
          approved: 0,
          edited: 0,
          rejected: 0,
          approvalRate: 0,
          sources: {},
          timeDistribution: {}
        };
      }
      
      if (!feedback || feedback.length === 0) {
        logger.debug('No feedback data found for the specified period');
        return {
          total: 0,
          approved: 0,
          edited: 0,
          rejected: 0,
          approvalRate: 0,
          sources: {},
          timeDistribution: {}
        };
      }
      
      // Basic stats
      const approved = feedback.filter(f => f.rating === RATING_TYPES.APPROVED).length;
      const edited = feedback.filter(f => f.rating === RATING_TYPES.EDITED).length;
      const rejected = feedback.filter(f => f.rating === RATING_TYPES.REJECTED).length;
      const total = feedback.length;
      
      // Get source distribution
      const sources = {};
      
      // Get time distribution (by day)
      const timeDistribution = {};
      
      // Process each feedback to get additional stats
      for (const f of feedback) {
        // Get the summary to determine the source
        if (f.summary_id) {
          try {
            const { data: summary } = await supabase
              .from('summaries')
              .select('source')
              .eq('id', f.summary_id)
              .single();
            
            if (summary && summary.source) {
              sources[summary.source] = (sources[summary.source] || 0) + 1;
            }
          } catch (summaryError) {
            logger.warn(`Error fetching summary for feedback ${f.id}:`, summaryError);
          }
        }
        
        // Add to time distribution
        if (f.created_at) {
          const date = new Date(f.created_at).toISOString().split('T')[0]; // YYYY-MM-DD
          timeDistribution[date] = (timeDistribution[date] || 0) + 1;
        }
      }
      
      logger.debug(`Feedback stats calculated: ${approved} approved, ${edited} edited, ${rejected} rejected`);
      
      return {
        total,
        approved,
        edited,
        rejected,
        approvalRate: total > 0 ? (approved / total) * 100 : 0,
        editRate: total > 0 ? (edited / total) * 100 : 0,
        rejectionRate: total > 0 ? (rejected / total) * 100 : 0,
        sources,
        timeDistribution
      };
    } catch (error) {
      logger.error('Error in getFeedbackStats:', error);
      return {
        total: 0,
        approved: 0,
        edited: 0,
        rejected: 0,
        approvalRate: 0,
        sources: {},
        timeDistribution: {}
      };
    }
  },
  
  /**
   * Update feedback patterns based on user feedback
   * @param {string} summaryId The ID of the summary
   * @param {string} rating The rating (approved, edited, rejected)
   * @param {string} comment Optional comment or edited text
   * @returns {Promise<void>}
   */
  async updateFeedbackPatterns(summaryId, rating, comment) {
    try {
      if (!summaryId) {
        logger.warn('updateFeedbackPatterns called with null or undefined summaryId');
        return;
      }
      
      logger.debug(`Updating feedback patterns for summary ${summaryId} with rating: ${rating}`);
      
      // Get the original summary
      const { data: summary, error: summaryError } = await supabase
        .from('summaries')
        .select('*')
        .eq('id', summaryId)
        .single();
      
      if (summaryError) {
        logger.error(`Error fetching summary ${summaryId}:`, summaryError);
        return;
      }
      
      if (!summary) {
        logger.warn(`Summary ${summaryId} not found`);
        return;
      }
      
      // Store the feedback pattern in the database
      const now = new Date().toISOString();
      const { error: patternError } = await supabase
        .from('feedback_patterns')
        .insert([{
          summary_id: summaryId,
          rating,
          source: summary.source,
          pattern_type: rating === RATING_TYPES.EDITED ? 'edit' :
                        rating === RATING_TYPES.REJECTED ? 'rejection' : 'approval',
          content: summary.summary,
          user_edit: comment || null,
          created_at: now
        }]);
      
      if (patternError) {
        // If the table doesn't exist, log a different message
        if (patternError.code === '42P01') {
          logger.warn('feedback_patterns table does not exist. Skipping pattern storage.');
        } else {
          logger.error('Error storing feedback pattern:', patternError);
        }
      }
      
      // If the rating is 'edited', analyze the differences
      if (rating === RATING_TYPES.EDITED && comment) {
        await this.analyzeEdits(summary, comment);
      }
      
      // If the rating is 'rejected', note the rejection patterns
      if (rating === RATING_TYPES.REJECTED) {
        await this.analyzeRejection(summary);
      }
      
      // Invalidate the feedback patterns cache
      feedbackPatternsCache.patterns = null;
      
      logger.debug(`Feedback patterns updated for summary ${summaryId}`);
    } catch (error) {
      logger.error('Error in updateFeedbackPatterns:', error);
    }
  },
  
  /**
   * Analyze edits to understand user preferences
   * @param {Object} summary The original summary
   * @param {string} editedText The edited text
   * @returns {Promise<void>}
   */
  async analyzeEdits(summary, editedText) {
    try {
      if (!summary || !summary.id) {
        logger.warn('analyzeEdits called with invalid summary');
        return;
      }
      
      if (!editedText) {
        logger.warn(`analyzeEdits called with empty editedText for summary ${summary.id}`);
        return;
      }
      
      logger.debug(`Analyzing edits for summary ${summary.id}`);
      
      // Get the original text
      const originalText = summary.summary || '';
      
      // Basic analysis - compare length
      const originalLength = originalText.length;
      const editedLength = editedText.length;
      const lengthDifference = editedLength - originalLength;
      const lengthChangePercent = originalLength > 0 ? (lengthDifference / originalLength) * 100 : 0;
      
      // Analyze tone changes (simplified)
      const toneChange = this.analyzeToneChange(originalText, editedText);
      
      // Analyze style changes (simplified)
      const styleChange = this.analyzeStyleChange(originalText, editedText);
      
      // Store the analysis
      const analysisData = {
        summary_id: summary.id,
        original_length: originalLength,
        edited_length: editedLength,
        length_change_percent: lengthChangePercent,
        tone_change: toneChange,
        style_change: styleChange,
        created_at: new Date().toISOString()
      };
      
      // Store in the database if the table exists
      try {
        const { error } = await supabase
          .from('edit_analyses')
          .insert([analysisData]);
        
        if (error) {
          // If the table doesn't exist, log a different message
          if (error.code === '42P01') {
            logger.warn('edit_analyses table does not exist. Skipping analysis storage.');
          } else {
            logger.error('Error storing edit analysis:', error);
          }
        }
      } catch (dbError) {
        logger.error('Database error in analyzeEdits:', dbError);
      }
      
      logger.debug(`Edit analysis completed for summary ${summary.id}: Length change: ${lengthChangePercent.toFixed(2)}%, Tone: ${toneChange}, Style: ${styleChange}`);
    } catch (error) {
      logger.error('Error in analyzeEdits:', error);
    }
  },
  
  /**
   * Analyze tone changes between original and edited text
   * @param {string} originalText The original text
   * @param {string} editedText The edited text
   * @returns {string} The detected tone change
   */
  analyzeToneChange(originalText, editedText) {
    // This is a simplified implementation
    // In a real system, this would use NLP or sentiment analysis
    
    const toneIndicators = {
      formal: ['therefore', 'consequently', 'furthermore', 'thus', 'hence', 'regarding'],
      casual: ['hey', 'cool', 'awesome', 'great', 'thanks', 'cheers'],
      technical: ['implement', 'system', 'process', 'function', 'data', 'analysis'],
      friendly: ['please', 'appreciate', 'thank you', 'welcome', 'happy to']
    };
    
    // Count indicators in each text
    const originalCounts = {};
    const editedCounts = {};
    
    for (const [tone, words] of Object.entries(toneIndicators)) {
      originalCounts[tone] = words.filter(word =>
        originalText.toLowerCase().includes(word.toLowerCase())
      ).length;
      
      editedCounts[tone] = words.filter(word =>
        editedText.toLowerCase().includes(word.toLowerCase())
      ).length;
    }
    
    // Determine the dominant tone in each
    let originalTone = 'neutral';
    let editedTone = 'neutral';
    
    let maxOriginal = 0;
    let maxEdited = 0;
    
    for (const tone in originalCounts) {
      if (originalCounts[tone] > maxOriginal) {
        maxOriginal = originalCounts[tone];
        originalTone = tone;
      }
      
      if (editedCounts[tone] > maxEdited) {
        maxEdited = editedCounts[tone];
        editedTone = tone;
      }
    }
    
    // If the tone changed, return the change
    if (originalTone !== editedTone) {
      return `${originalTone} to ${editedTone}`;
    }
    
    return 'unchanged';
  },
  
  /**
   * Analyze style changes between original and edited text
   * @param {string} originalText The original text
   * @param {string} editedText The edited text
   * @returns {string} The detected style change
   */
  analyzeStyleChange(originalText, editedText) {
    // This is a simplified implementation
    // In a real system, this would use more sophisticated text analysis
    
    // Average sentence length
    const originalSentences = originalText.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const editedSentences = editedText.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    const originalAvgLength = originalSentences.length > 0
      ? originalSentences.reduce((sum, s) => sum + s.length, 0) / originalSentences.length
      : 0;
      
    const editedAvgLength = editedSentences.length > 0
      ? editedSentences.reduce((sum, s) => sum + s.length, 0) / editedSentences.length
      : 0;
    
    // Bullet points
    const originalBullets = (originalText.match(/[-*•]/g) || []).length;
    const editedBullets = (editedText.match(/[-*•]/g) || []).length;
    
    // Determine style changes
    const changes = [];
    
    // Sentence length changes
    const sentenceLengthDiff = editedAvgLength - originalAvgLength;
    if (Math.abs(sentenceLengthDiff) > 10) {
      changes.push(sentenceLengthDiff > 0 ? 'longer sentences' : 'shorter sentences');
    }
    
    // Bullet point changes
    if (editedBullets > originalBullets + 2) {
      changes.push('more bullet points');
    } else if (originalBullets > editedBullets + 2) {
      changes.push('fewer bullet points');
    }
    
    // More/less detailed
    if (editedText.length > originalText.length * 1.2) {
      changes.push('more detailed');
    } else if (originalText.length > editedText.length * 1.2) {
      changes.push('more concise');
    }
    
    return changes.length > 0 ? changes.join(', ') : 'unchanged';
  },
  
  /**
   * Analyze rejections to understand what to avoid
   * @param {Object} summary The rejected summary
   * @returns {Promise<void>}
   */
  async analyzeRejection(summary) {
    try {
      if (!summary || !summary.id) {
        logger.warn('analyzeRejection called with invalid summary');
        return;
      }
      
      logger.debug(`Analyzing rejection for summary ${summary.id}`);
      
      // Get recent rejections for this source type
      const { data: recentRejections, error } = await supabase
        .from('summaries')
        .select('*')
        .eq('source', summary.source)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) {
        logger.error(`Error fetching recent summaries for source ${summary.source}:`, error);
        return;
      }
      
      // For each recent summary, check if it was rejected
      const rejectionPatterns = [];
      
      for (const recentSummary of recentRejections) {
        if (recentSummary.id === summary.id) continue; // Skip the current summary
        
        const { data: feedback } = await supabase
          .from('feedback')
          .select('*')
          .eq('summary_id', recentSummary.id)
          .eq('rating', RATING_TYPES.REJECTED);
        
        if (feedback && feedback.length > 0) {
          rejectionPatterns.push({
            summary_id: recentSummary.id,
            content: recentSummary.summary,
            created_at: recentSummary.created_at
          });
        }
      }
      
      // Store the rejection analysis
      const analysisData = {
        summary_id: summary.id,
        source: summary.source,
        content: summary.summary,
        similar_rejections: rejectionPatterns.length,
        created_at: new Date().toISOString()
      };
      
      // Store in the database if the table exists
      try {
        const { error: insertError } = await supabase
          .from('rejection_analyses')
          .insert([analysisData]);
        
        if (insertError) {
          // If the table doesn't exist, log a different message
          if (insertError.code === '42P01') {
            logger.warn('rejection_analyses table does not exist. Skipping analysis storage.');
          } else {
            logger.error('Error storing rejection analysis:', insertError);
          }
        }
      } catch (dbError) {
        logger.error('Database error in analyzeRejection:', dbError);
      }
      
      logger.debug(`Rejection analysis completed for summary ${summary.id}: Found ${rejectionPatterns.length} similar rejections`);
    } catch (error) {
      logger.error('Error in analyzeRejection:', error);
    }
  },
  
  /**
   * Track analytics for feedback
   * @param {string} summaryId The summary ID
   * @param {string} rating The rating
   * @param {string} comment The comment
   */
  async trackFeedbackAnalytics(summaryId, rating, comment) {
    try {
      if (!summaryId) return;
      
      // Get the summary to determine the source
      const { data: summary } = await supabase
        .from('summaries')
        .select('source')
        .eq('id', summaryId)
        .single();
      
      if (!summary) return;
      
      // Store analytics data
      const analyticsData = {
        event_type: 'feedback',
        source: summary.source,
        rating,
        has_comment: comment && comment.length > 0,
        timestamp: new Date().toISOString()
      };
      
      // Store in the database if the table exists
      try {
        const { error } = await supabase
          .from('analytics')
          .insert([analyticsData]);
        
        if (error) {
          // If the table doesn't exist, log a different message
          if (error.code === '42P01') {
            logger.warn('analytics table does not exist. Skipping analytics tracking.');
          } else {
            logger.error('Error storing feedback analytics:', error);
          }
        }
      } catch (dbError) {
        logger.error('Database error in trackFeedbackAnalytics:', dbError);
      }
    } catch (error) {
      logger.error('Error in trackFeedbackAnalytics:', error);
    }
  },
  
  /**
   * Get feedback patterns to inform AI prompts
   * @returns {Promise<Object>} Feedback patterns
   */
  async getFeedbackPatterns() {
    try {
      // Check cache first
      if (feedbackPatternsCache.patterns &&
          Date.now() - feedbackPatternsCache.lastUpdated < feedbackPatternsCache.ttl) {
        logger.debug('Using cached feedback patterns');
        return feedbackPatternsCache.patterns;
      }
      
      logger.debug('Retrieving feedback patterns');
      
      // Get basic statistics
      const stats = await this.getFeedbackStats();
      
      // Get tone preferences from edit analyses
      let preferredTone = 'neutral';
      let preferredLength = 'medium';
      let preferredStyle = 'professional';
      
      try {
        // Check if edit_analyses table exists and get data
        const { data: editAnalyses, error } = await supabase
          .from('edit_analyses')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20);
        
        if (!error && editAnalyses && editAnalyses.length > 0) {
          // Analyze tone changes
          const toneChanges = editAnalyses
            .filter(a => a.tone_change && a.tone_change !== 'unchanged')
            .map(a => a.tone_change);
          
          if (toneChanges.length > 0) {
            // Count occurrences of each target tone
            const toneCounts = {};
            for (const change of toneChanges) {
              const targetTone = change.split(' to ')[1];
              if (targetTone) {
                toneCounts[targetTone] = (toneCounts[targetTone] || 0) + 1;
              }
            }
            
            // Find the most common target tone
            let maxCount = 0;
            for (const [tone, count] of Object.entries(toneCounts)) {
              if (count > maxCount) {
                maxCount = count;
                preferredTone = tone;
              }
            }
          }
          
          // Analyze length preferences
          const lengthChanges = editAnalyses
            .filter(a => a.style_change && (a.style_change.includes('concise') || a.style_change.includes('detailed')))
            .map(a => a.style_change);
          
          if (lengthChanges.length > 0) {
            const moreDetailed = lengthChanges.filter(c => c.includes('more detailed')).length;
            const moreConcise = lengthChanges.filter(c => c.includes('more concise')).length;
            
            if (moreDetailed > moreConcise) {
              preferredLength = 'detailed';
            } else if (moreConcise > moreDetailed) {
              preferredLength = 'concise';
            }
          }
          
          // Analyze style preferences
          const styleChanges = editAnalyses
            .filter(a => a.style_change && !a.style_change.includes('concise') && !a.style_change.includes('detailed'))
            .map(a => a.style_change);
          
          if (styleChanges.length > 0) {
            // Check for bullet point preferences
            const moreBullets = styleChanges.filter(c => c.includes('more bullet')).length;
            const fewerBullets = styleChanges.filter(c => c.includes('fewer bullet')).length;
            
            if (moreBullets > fewerBullets) {
              preferredStyle = 'bullet-points';
            }
            
            // Check for sentence length preferences
            const longerSentences = styleChanges.filter(c => c.includes('longer sentences')).length;
            const shorterSentences = styleChanges.filter(c => c.includes('shorter sentences')).length;
            
            if (longerSentences > shorterSentences) {
              preferredStyle = preferredStyle === 'bullet-points' ? 'bullet-points-with-longer-sentences' : 'longer-sentences';
            } else if (shorterSentences > longerSentences) {
              preferredStyle = preferredStyle === 'bullet-points' ? 'bullet-points-with-shorter-sentences' : 'shorter-sentences';
            }
          }
        }
      } catch (analysisError) {
        logger.warn('Error analyzing edit patterns:', analysisError);
      }
      
      // Create the patterns object
      const patterns = {
        approvalRate: stats.approvalRate,
        editRate: stats.editRate || (stats.total > 0 ? (stats.edited / stats.total) * 100 : 0),
        rejectionRate: stats.rejectionRate || (stats.total > 0 ? (stats.rejected / stats.total) * 100 : 0),
        patterns: {
          tone: preferredTone,
          length: preferredLength,
          style: preferredStyle
        },
        sources: stats.sources || {},
        timeDistribution: stats.timeDistribution || {}
      };
      
      // Update cache
      feedbackPatternsCache.patterns = patterns;
      feedbackPatternsCache.lastUpdated = Date.now();
      
      logger.debug(`Feedback patterns retrieved: tone=${preferredTone}, length=${preferredLength}, style=${preferredStyle}`);
      
      return patterns;
    } catch (error) {
      logger.error('Error in getFeedbackPatterns:', error);
      return {
        approvalRate: 0,
        editRate: 0,
        rejectionRate: 0,
        patterns: {
          tone: 'neutral',
          length: 'medium',
          style: 'professional'
        },
        sources: {},
        timeDistribution: {}
      };
    }
  }
};

module.exports = feedbackHandler;