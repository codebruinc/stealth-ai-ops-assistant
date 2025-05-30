const express = require('express');
const router = express.Router();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
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
      'X-Client-Info': 'stealth-ai-ops-assistant-summarize'
    }
  }
});

// Import memory modules
const contextStore = require('../memory/contextStore');
const feedbackHandler = require('../memory/feedbackHandler');

/**
 * @route POST /api/summarize/slack
 * @desc Summarize Slack data
 * @access Private (Admin)
 */
router.post('/slack', async (req, res) => {
  try {
    const { messages, days = 1 } = req.body;
    
    // If messages not provided, fetch them
    const slackMessages = messages || await fetchSlackMessages(days, req);
    
    if (!slackMessages || slackMessages.length === 0) {
      return res.json({
        success: true,
        summary: "No recent Slack messages to summarize.",
        action_items: [],
        suggested_messages: []
      });
    }
    
    // Get client context
    const clientContext = await contextStore.getRelevantClientContext(slackMessages);
    
    // Load the Slack summary prompt
    const promptTemplate = await loadPromptTemplate('slack-summary.txt');
    
    // Process with AI
    const result = await processWithAI(promptTemplate, {
      messages: slackMessages,
      context: clientContext
    });
    
    // Store the summary in Supabase
    await storeSummary('slack', result);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error summarizing Slack data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to summarize Slack data',
      details: error.message
    });
  }
});

/**
 * @route POST /api/summarize/zendesk
 * @desc Summarize Zendesk data
 * @access Private (Admin)
 */
router.post('/zendesk', async (req, res) => {
  try {
    const { tickets, days = 7 } = req.body;
    
    // If tickets not provided, fetch them
    const zendeskTickets = tickets || await fetchZendeskTickets(days, req);
    
    if (!zendeskTickets || zendeskTickets.length === 0) {
      return res.json({
        success: true,
        summary: "No recent Zendesk tickets to summarize.",
        action_items: [],
        suggested_messages: []
      });
    }
    
    // Get client context
    const clientContext = await contextStore.getRelevantClientContext(zendeskTickets);
    
    // Load the Zendesk summary prompt
    const promptTemplate = await loadPromptTemplate('zendesk-summary.txt');
    
    // Process with AI
    const result = await processWithAI(promptTemplate, {
      tickets: zendeskTickets,
      context: clientContext
    });
    
    // Store the summary in Supabase
    await storeSummary('zendesk', result);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error summarizing Zendesk data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to summarize Zendesk data',
      details: error.message
    });
  }
});

/**
 * @route POST /api/summarize/harvest
 * @desc Summarize Harvest data
 * @access Private (Admin)
 */
router.post('/harvest', async (req, res) => {
  try {
    const { timeEntries, invoices, days = 7 } = req.body;
    
    // If data not provided, fetch it
    const harvestTimeEntries = timeEntries || await fetchHarvestTimeEntries(days, req);
    const harvestInvoices = invoices || await fetchHarvestInvoices(req);
    
    if ((!harvestTimeEntries || harvestTimeEntries.length === 0) && 
        (!harvestInvoices || harvestInvoices.length === 0)) {
      return res.json({
        success: true,
        summary: "No recent Harvest data to summarize.",
        action_items: [],
        suggested_messages: []
      });
    }
    
    // Get client context
    const clientContext = await contextStore.getRelevantClientContext([
      ...harvestTimeEntries,
      ...harvestInvoices
    ]);
    
    // Load the Harvest summary prompt
    const promptTemplate = await loadPromptTemplate('harvest-summary.txt');
    
    // Process with AI
    const result = await processWithAI(promptTemplate, {
      timeEntries: harvestTimeEntries,
      invoices: harvestInvoices,
      context: clientContext
    });
    
    // Store the summary in Supabase
    await storeSummary('harvest', result);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error summarizing Harvest data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to summarize Harvest data',
      details: error.message
    });
  }
});

/**
 * @route POST /api/summarize/email
 * @desc Summarize email data
 * @access Private (Admin)
 */
router.post('/email', async (req, res) => {
  try {
    const { emails, days = 3 } = req.body;
    
    // If emails not provided, fetch them
    const gmailMessages = emails || await fetchGmailMessages(days, req);
    
    if (!gmailMessages || gmailMessages.length === 0) {
      return res.json({
        success: true,
        summary: "No recent emails to summarize.",
        action_items: [],
        suggested_messages: []
      });
    }
    
    // Get client context
    const clientContext = await contextStore.getRelevantClientContext(gmailMessages);
    
    // Load the email summary prompt
    const promptTemplate = await loadPromptTemplate('email-summary.txt');
    
    // Process with AI
    const result = await processWithAI(promptTemplate, {
      emails: gmailMessages,
      context: clientContext
    });
    
    // Store the summary in Supabase
    await storeSummary('email', result);
    
    // Update suggested replies in the emails table
    if (result.suggested_messages && result.suggested_messages.length > 0) {
      await updateEmailSuggestedReplies(gmailMessages, result.suggested_messages);
    }
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error summarizing email data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to summarize email data',
      details: error.message
    });
  }
});

/**
 * @route POST /api/summarize/all
 * @desc Generate comprehensive summary from all sources
 * @access Private (Admin)
 */
router.post('/all', async (req, res) => {
  try {
    // Fetch recent summaries from each source
    const { data: recentSummaries, error } = await supabase
      .from('summaries')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) {
      throw new Error(`Supabase error: ${error.message}`);
    }
    
    if (!recentSummaries || recentSummaries.length === 0) {
      return res.json({
        success: true,
        summary: "No recent data to summarize.",
        action_items: [],
        suggested_messages: []
      });
    }
    
    // Group summaries by source
    const summariesBySource = recentSummaries.reduce((acc, summary) => {
      if (!acc[summary.source]) {
        acc[summary.source] = [];
      }
      acc[summary.source].push(summary);
      return acc;
    }, {});
    
    // Get the most recent summary from each source
    const latestSummaries = Object.keys(summariesBySource).map(source => {
      return summariesBySource[source][0];
    });
    
    // Combine all action items and suggested messages
    const allActionItems = latestSummaries.flatMap(summary => summary.action_items || []);
    const allSuggestedMessages = latestSummaries.flatMap(summary => summary.suggested_messages || []);
    
    // Create a comprehensive summary
    const comprehensiveSummary = {
      summary: latestSummaries.map(s => `${s.source.toUpperCase()}: ${s.summary}`).join('\n\n'),
      action_items: allActionItems,
      suggested_messages: allSuggestedMessages
    };
    
    // Store the comprehensive summary
    await storeSummary('all', comprehensiveSummary);
    
    res.json({
      success: true,
      ...comprehensiveSummary
    });
  } catch (error) {
    console.error('Error generating comprehensive summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate comprehensive summary',
      details: error.message
    });
  }
});

/**
 * @route GET /api/summaries
 * @desc Get recent summaries from all sources
 * @access Private (Admin)
 */
router.get('/summaries', async (req, res) => {
  try {
    // Fetch recent summaries from each source
    const { data: recentSummaries, error } = await supabase
      .from('summaries')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (error) {
      throw new Error(`Supabase error: ${error.message}`);
    }
    
    if (!recentSummaries || recentSummaries.length === 0) {
      return res.json({
        success: true,
        summaries: []
      });
    }
    
    res.json({
      success: true,
      summaries: recentSummaries
    });
  } catch (error) {
    console.error('Error fetching summaries:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch summaries',
      details: error.message
    });
  }
});

/**
 * Load a prompt template from the prompts directory
 * @param {string} filename The prompt template filename
 * @returns {Promise<string>} The prompt template content
 */
async function loadPromptTemplate(filename) {
  try {
    const promptPath = path.join(__dirname, '../../ai/prompts', filename);
    return fs.readFileSync(promptPath, 'utf8');
  } catch (error) {
    console.error(`Error loading prompt template ${filename}:`, error);
    throw new Error(`Failed to load prompt template: ${error.message}`);
  }
}

/**
 * Process data with AI using OpenRouter
 * @param {string} promptTemplate The prompt template
 * @param {Object} data The data to process
 * @returns {Promise<Object>} The AI processing result
 */
async function processWithAI(promptTemplate, data) {
  try {
    // Replace placeholders in the prompt template
    let prompt = promptTemplate;
    
    // Add data as JSON
    prompt = prompt.replace('{{DATA}}', JSON.stringify(data, null, 2));
    
    // Get feedback patterns to improve AI responses
    const feedbackPatterns = await feedbackHandler.getFeedbackPatterns();
    
    // Create a system message that includes feedback patterns
    const systemMessage = `You are a helpful AI assistant that summarizes data and provides actionable insights.
    
Based on user feedback, please follow these guidelines:
- Tone: ${feedbackPatterns.patterns.tone}
- Length: ${feedbackPatterns.patterns.length}
- Style: ${feedbackPatterns.patterns.style}

Format your response as a JSON object with the following structure:
{
  "summary": "A concise summary of the key points",
  "action_items": ["Action item 1", "Action item 2", ...],
  "suggested_messages": [
    {
      "recipient": "The person to send the message to",
      "subject": "Optional subject line for emails",
      "message": "The suggested message content"
    },
    ...
  ]
}`;

    console.log(`Making AI request with model: ${process.env.AI_MODEL || 'gpt-4o'}`);
    
    // Call OpenRouter API with timeout and retry logic
    let response;
    let retries = 0;
    const maxRetries = 3;
    
    while (retries < maxRetries) {
      try {
        response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
          model: process.env.AI_MODEL || 'gpt-4o',
          messages: [
            { role: 'system', content: systemMessage },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 1500,
          response_format: { type: "json_object" } // Request JSON format explicitly
        }, {
          headers: {
            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://stealth-ai-ops-assistant.com', // Identify your app
            'X-Title': 'Stealth AI Ops Assistant' // Name your app
          },
          timeout: 30000 // 30 second timeout
        });
        
        // If we get here, the request succeeded
        break;
      } catch (requestError) {
        retries++;
        console.error(`AI API request failed (attempt ${retries}/${maxRetries}):`, requestError.message);
        
        if (retries >= maxRetries) {
          throw new Error(`Failed to get AI response after ${maxRetries} attempts: ${requestError.message}`);
        }
        
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries)));
      }
    }
    
    // Log successful response
    console.log(`AI response received (${response.data.usage?.total_tokens || 'unknown'} tokens used)`);
    
    // Parse the response
    const aiResponse = response.data.choices[0].message.content;
    
    try {
      // Try to parse as JSON
      return JSON.parse(aiResponse);
    } catch (parseError) {
      console.warn('Failed to parse AI response as JSON, falling back to regex extraction:', parseError.message);
      
      // If not valid JSON, try to extract structured data
      const summary = aiResponse.match(/summary:(.*?)(?=action_items:|$)/is)?.[1]?.trim() || aiResponse;
      const actionItemsMatch = aiResponse.match(/action_items:(.*?)(?=suggested_messages:|$)/is);
      const suggestedMessagesMatch = aiResponse.match(/suggested_messages:(.*?)(?=$)/is);
      
      const actionItems = actionItemsMatch ?
        actionItemsMatch[1].split('\n').filter(item => item.trim()).map(item => item.trim().replace(/^-\s*/, '')) :
        [];
      
      const suggestedMessages = suggestedMessagesMatch ?
        suggestedMessagesMatch[1].split('\n').filter(item => item.trim()).map(item => item.trim().replace(/^-\s*/, '')) :
        [];
      
      const result = {
        summary,
        action_items: actionItems,
        suggested_messages: suggestedMessages
      };
      
      console.log('Extracted structured data from AI response:',
        `Summary length: ${summary.length}, ` +
        `Action items: ${actionItems.length}, ` +
        `Suggested messages: ${suggestedMessages.length}`
      );
      
      return result;
    }
  } catch (error) {
    console.error('Error in processWithAI:', error);
    // Add more context to the error
    throw new Error(`AI processing failed: ${error.message}`);
  }
}

/**
 * Store a summary in Supabase
 * @param {string} source The data source
 * @param {Object} summary The summary object
 */
async function storeSummary(source, summary) {
  try {
    const { error } = await supabase
      .from('summaries')
      .insert({
        source,
        summary: summary.summary,
        action_items: summary.action_items || [],
        suggested_messages: summary.suggested_messages || [],
        created_at: new Date().toISOString()
      });
    
    if (error) {
      console.error(`Error storing ${source} summary:`, error);
    }
  } catch (error) {
    console.error(`Error in storeSummary for ${source}:`, error);
    // Don't throw, just log the error to avoid breaking the API response
  }
}

/**
 * Update email suggested replies in Supabase
 * @param {Array} emails The email messages
 * @param {Array} suggestedReplies The suggested replies
 */
async function updateEmailSuggestedReplies(emails, suggestedReplies) {
  try {
    // Match suggested replies to emails based on thread ID or subject
    for (const reply of suggestedReplies) {
      if (reply.email_id || reply.thread_id || reply.subject) {
        const targetEmail = emails.find(email => 
          (reply.email_id && email.id === reply.email_id) ||
          (reply.thread_id && email.threadId === reply.thread_id) ||
          (reply.subject && email.subject.includes(reply.subject))
        );
        
        if (targetEmail) {
          const { error } = await supabase
            .from('emails')
            .update({ suggested_reply: reply.message })
            .eq('message_id', targetEmail.id);
          
          if (error) {
            console.error(`Error updating suggested reply for email ${targetEmail.id}:`, error);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error in updateEmailSuggestedReplies:', error);
    // Don't throw, just log the error to avoid breaking the API response
  }
}

/**
 * Helper function to fetch Slack messages
 * @param {number} days Number of days to look back
 * @returns {Promise<Array>} Array of Slack messages
 */
async function fetchSlackMessages(days, req) {
  try {
    const response = await axios.get(`${req.protocol}://${req.get('host')}/api/slack/messages`, {
      headers: {
        Authorization: req.headers.authorization
      },
      params: { days }
    });
    
    return response.data.messages;
  } catch (error) {
    console.error('Error fetching Slack messages:', error);
    return [];
  }
}

/**
 * Helper function to fetch Zendesk tickets
 * @param {number} days Number of days to look back
 * @returns {Promise<Array>} Array of Zendesk tickets
 */
async function fetchZendeskTickets(days, req) {
  try {
    const response = await axios.get(`${req.protocol}://${req.get('host')}/api/zendesk/tickets`, {
      headers: {
        Authorization: req.headers.authorization
      },
      params: { days }
    });
    
    return response.data.tickets;
  } catch (error) {
    console.error('Error fetching Zendesk tickets:', error);
    return [];
  }
}

/**
 * Helper function to fetch Harvest time entries
 * @param {number} days Number of days to look back
 * @returns {Promise<Array>} Array of Harvest time entries
 */
async function fetchHarvestTimeEntries(days, req) {
  try {
    const response = await axios.get(`${req.protocol}://${req.get('host')}/api/harvest/time`, {
      headers: {
        Authorization: req.headers.authorization
      },
      params: { days }
    });
    
    return response.data.timeEntries;
  } catch (error) {
    console.error('Error fetching Harvest time entries:', error);
    return [];
  }
}

/**
 * Helper function to fetch Harvest invoices
 * @returns {Promise<Array>} Array of Harvest invoices
 */
async function fetchHarvestInvoices(req) {
  try {
    const response = await axios.get(`${req.protocol}://${req.get('host')}/api/harvest/invoices`, {
      headers: {
        Authorization: req.headers.authorization
      }
    });
    
    return response.data.invoices;
  } catch (error) {
    console.error('Error fetching Harvest invoices:', error);
    return [];
  }
}

/**
 * Helper function to fetch Gmail messages
 * @param {number} days Number of days to look back
 * @returns {Promise<Array>} Array of Gmail messages
 */
async function fetchGmailMessages(days, req) {
  try {
    const response = await axios.get(`${req.protocol}://${req.get('host')}/api/email/messages`, {
      headers: {
        Authorization: req.headers.authorization
      },
      params: { days }
    });
    
    return response.data.emails;
  } catch (error) {
    console.error('Error fetching Gmail messages:', error);
    return [];
  }
}

/**
 * @route POST /api/summarize
 * @desc Summarize data from multiple services
 * @access Private (Admin)
 */
router.post('/', async (req, res) => {
  try {
    const {
      services = ['slack', 'zendesk', 'harvest', 'email'],
      days = { slack: 1, zendesk: 7, harvest: 7, email: 3 }
    } = req.body;
    
    // Initialize results object
    const results = {};
    const errors = [];
    
    // Process each requested service
    for (const service of services) {
      try {
        switch (service) {
          case 'slack':
            // Fetch Slack messages
            const slackDays = days.slack || days;
            const slackMessages = await fetchSlackMessages(slackDays, req);
            
            if (!slackMessages || slackMessages.length === 0) {
              results.slack = {
                success: true,
                summary: "No recent Slack messages to summarize.",
                action_items: [],
                suggested_messages: []
              };
              continue;
            }
            
            // Get client context
            const slackContext = await contextStore.getRelevantClientContext(slackMessages);
            
            // Load the Slack summary prompt
            const slackPrompt = await loadPromptTemplate('slack-summary.txt');
            
            // Process with AI
            const slackResult = await processWithAI(slackPrompt, {
              messages: slackMessages,
              context: slackContext
            });
            
            // Store the summary in Supabase
            await storeSummary('slack', slackResult);
            
            results.slack = {
              success: true,
              ...slackResult
            };
            break;
            
          case 'zendesk':
            // Fetch Zendesk tickets
            const zendeskDays = days.zendesk || days;
            const zendeskTickets = await fetchZendeskTickets(zendeskDays, req);
            
            if (!zendeskTickets || zendeskTickets.length === 0) {
              results.zendesk = {
                success: true,
                summary: "No recent Zendesk tickets to summarize.",
                action_items: [],
                suggested_messages: []
              };
              continue;
            }
            
            // Get client context
            const zendeskContext = await contextStore.getRelevantClientContext(zendeskTickets);
            
            // Load the Zendesk summary prompt
            const zendeskPrompt = await loadPromptTemplate('zendesk-summary.txt');
            
            // Process with AI
            const zendeskResult = await processWithAI(zendeskPrompt, {
              tickets: zendeskTickets,
              context: zendeskContext
            });
            
            // Store the summary in Supabase
            await storeSummary('zendesk', zendeskResult);
            
            results.zendesk = {
              success: true,
              ...zendeskResult
            };
            break;
            
          case 'harvest':
            // Fetch Harvest data
            const harvestDays = days.harvest || days;
            const harvestTimeEntries = await fetchHarvestTimeEntries(harvestDays, req);
            const harvestInvoices = await fetchHarvestInvoices(req);
            
            if ((!harvestTimeEntries || harvestTimeEntries.length === 0) &&
                (!harvestInvoices || harvestInvoices.length === 0)) {
              results.harvest = {
                success: true,
                summary: "No recent Harvest data to summarize.",
                action_items: [],
                suggested_messages: []
              };
              continue;
            }
            
            // Get client context
            const harvestContext = await contextStore.getRelevantClientContext([
              ...harvestTimeEntries,
              ...harvestInvoices
            ]);
            
            // Load the Harvest summary prompt
            const harvestPrompt = await loadPromptTemplate('harvest-summary.txt');
            
            // Process with AI
            const harvestResult = await processWithAI(harvestPrompt, {
              timeEntries: harvestTimeEntries,
              invoices: harvestInvoices,
              context: harvestContext
            });
            
            // Store the summary in Supabase
            await storeSummary('harvest', harvestResult);
            
            results.harvest = {
              success: true,
              ...harvestResult
            };
            break;
            
          case 'email':
            // Fetch Gmail messages
            const emailDays = days.email || days;
            const gmailMessages = await fetchGmailMessages(emailDays, req);
            
            if (!gmailMessages || gmailMessages.length === 0) {
              results.email = {
                success: true,
                summary: "No recent emails to summarize.",
                action_items: [],
                suggested_messages: []
              };
              continue;
            }
            
            // Get client context
            const emailContext = await contextStore.getRelevantClientContext(gmailMessages);
            
            // Load the email summary prompt
            const emailPrompt = await loadPromptTemplate('email-summary.txt');
            
            // Process with AI
            const emailResult = await processWithAI(emailPrompt, {
              emails: gmailMessages,
              context: emailContext
            });
            
            // Store the summary in Supabase
            await storeSummary('email', emailResult);
            
            // Update suggested replies in the emails table
            if (emailResult.suggested_messages && emailResult.suggested_messages.length > 0) {
              await updateEmailSuggestedReplies(gmailMessages, emailResult.suggested_messages);
            }
            
            results.email = {
              success: true,
              ...emailResult
            };
            break;
            
          default:
            errors.push(`Unknown service: ${service}`);
        }
      } catch (serviceError) {
        console.error(`Error processing ${service}:`, serviceError);
        errors.push(`Failed to process ${service}: ${serviceError.message}`);
        results[service] = {
          success: false,
          error: `Failed to process ${service}`,
          details: serviceError.message
        };
      }
    }
    
    // If all services were processed, generate a combined summary
    if (Object.keys(results).length > 0) {
      try {
        // Combine all action items and suggested messages
        const allActionItems = [];
        const allSuggestedMessages = [];
        const summaries = [];
        
        for (const [service, result] of Object.entries(results)) {
          if (result.success && result.summary) {
            summaries.push(`${service.toUpperCase()}: ${result.summary}`);
            
            if (result.action_items && result.action_items.length > 0) {
              allActionItems.push(...result.action_items.map(item => ({
                service,
                item
              })));
            }
            
            if (result.suggested_messages && result.suggested_messages.length > 0) {
              allSuggestedMessages.push(...result.suggested_messages.map(msg => ({
                service,
                ...msg
              })));
            }
          }
        }
        
        // Create a comprehensive summary
        const comprehensiveSummary = {
          summary: summaries.join('\n\n'),
          action_items: allActionItems,
          suggested_messages: allSuggestedMessages
        };
        
        // Store the comprehensive summary
        await storeSummary('combined', comprehensiveSummary);
        
        // Add the comprehensive summary to the results
        results.combined = {
          success: true,
          ...comprehensiveSummary
        };
      } catch (combineError) {
        console.error('Error generating combined summary:', combineError);
        errors.push(`Failed to generate combined summary: ${combineError.message}`);
      }
    }
    
    // Return the results
    res.json({
      success: true,
      results,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error in summarize route:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to summarize data',
      details: error.message
    });
  }
});

module.exports = router;