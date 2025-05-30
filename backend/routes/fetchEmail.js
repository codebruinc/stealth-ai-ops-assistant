const express = require('express');
const router = express.Router();
const axios = require('axios');
const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * @route GET /api/email/messages
 * @desc Fetch Gmail messages
 * @access Private (Admin)
 */
router.get('/messages', async (req, res) => {
  try {
    const { days = 3, unreadOnly = 'true' } = req.query;
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(days));
    
    // Format date for Gmail API query (YYYY/MM/DD)
    const afterDate = daysAgo.toISOString().split('T')[0].replace(/-/g, '/');
    
    // Fetch emails
    const emails = await fetchEmails(afterDate, unreadOnly === 'true');
    
    // Store emails in Supabase
    if (emails.length > 0) {
      await storeEmailsInSupabase(emails);
    }
    
    res.json({
      success: true,
      count: emails.length,
      emails
    });
  } catch (error) {
    console.error('Error fetching Gmail messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Gmail messages',
      details: error.message
    });
  }
});

/**
 * Authenticate with Gmail API
 * @returns {Promise<OAuth2Client>} Authenticated OAuth2 client
 */
async function getGmailAuth() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground' // Redirect URI
  );
  
  oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN
  });
  
  return oauth2Client;
}

/**
 * Fetch emails from Gmail API
 * @param {string} afterDate Date string in YYYY/MM/DD format
 * @param {boolean} unreadOnly Whether to fetch only unread emails
 * @returns {Promise<Array>} Array of email messages
 */
async function fetchEmails(afterDate, unreadOnly) {
  try {
    const auth = await getGmailAuth();
    const gmail = google.gmail({ version: 'v1', auth });
    
    // Construct query
    let query = `after:${afterDate}`;
    if (unreadOnly) {
      query += ' is:unread';
    }
    
    // Get message IDs
    const res = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 50
    });
    
    if (!res.data.messages || res.data.messages.length === 0) {
      return [];
    }
    
    // Fetch full message details
    const emails = await Promise.all(
      res.data.messages.map(async (message) => {
        try {
          const msgRes = await gmail.users.messages.get({
            userId: 'me',
            id: message.id,
            format: 'full'
          });
          
          // Extract email details
          const headers = msgRes.data.payload.headers;
          const subject = headers.find(h => h.name === 'Subject')?.value || '(No Subject)';
          const from = headers.find(h => h.name === 'From')?.value || '';
          const to = headers.find(h => h.name === 'To')?.value || '';
          const date = headers.find(h => h.name === 'Date')?.value || '';
          
          // Extract thread ID
          const threadId = msgRes.data.threadId;
          
          // Extract body content
          let body = '';
          if (msgRes.data.payload.parts) {
            // Multipart message
            const textPart = msgRes.data.payload.parts.find(
              part => part.mimeType === 'text/plain'
            );
            
            if (textPart && textPart.body.data) {
              body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
            }
          } else if (msgRes.data.payload.body.data) {
            // Simple message
            body = Buffer.from(msgRes.data.payload.body.data, 'base64').toString('utf-8');
          }
          
          return {
            id: message.id,
            threadId,
            snippet: msgRes.data.snippet,
            subject,
            from,
            to,
            date,
            body,
            labelIds: msgRes.data.labelIds,
            isUnread: msgRes.data.labelIds.includes('UNREAD')
          };
        } catch (error) {
          console.error(`Error fetching message ${message.id}:`, error);
          return null;
        }
      })
    );
    
    // Filter out any null results from errors
    return emails.filter(email => email !== null);
  } catch (error) {
    console.error('Error in fetchEmails:', error);
    throw error;
  }
}

/**
 * Store emails in Supabase
 * @param {Array} emails Array of email messages
 */
async function storeEmailsInSupabase(emails) {
  try {
    // Prepare data for insertion
    const emailsForDb = emails.map(email => ({
      message_id: email.id,
      thread_id: email.threadId,
      sender: email.from,
      recipient: email.to,
      subject: email.subject,
      snippet: email.snippet,
      full_body: email.body,
      received_at: new Date(email.date).toISOString(),
      is_read: !email.isUnread,
      created_at: new Date().toISOString()
    }));
    
    // Insert into Supabase, ignoring duplicates
    const { data, error } = await supabase
      .from('emails')
      .upsert(emailsForDb, { onConflict: 'message_id' });
    
    if (error) {
      console.error('Error storing emails in Supabase:', error);
    }
  } catch (error) {
    console.error('Error in storeEmailsInSupabase:', error);
    // Don't throw, just log the error to avoid breaking the API response
  }
}

module.exports = router;