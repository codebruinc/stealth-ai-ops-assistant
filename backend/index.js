require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createClient } = require('@supabase/supabase-js');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(express.json()); // Parse JSON bodies
app.use(morgan('dev')); // Logging

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN format
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication token required' });
  }
  
  if (token !== process.env.ADMIN_ACCESS_TOKEN) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
  
  next();
};

// Apply authentication middleware to all routes
app.use(authenticateToken);

// Import routes
const fetchSlackRouter = require('./routes/fetchSlack');
const fetchZendeskRouter = require('./routes/fetchZendesk');
const fetchHarvestRouter = require('./routes/fetchHarvest');
const fetchEmailRouter = require('./routes/fetchEmail');
const summarizeRouter = require('./routes/summarize');
const clientsRouter = require('./routes/clients');
const feedbackRouter = require('./routes/feedback');
const replyRouter = require('./routes/reply');

// Register routes
app.use('/api/slack', fetchSlackRouter);
app.use('/api/zendesk', fetchZendeskRouter);
app.use('/api/harvest', fetchHarvestRouter);
app.use('/api/email', fetchEmailRouter);
app.use('/api/summarize', summarizeRouter);
app.use('/api/clients', clientsRouter);
app.use('/api/feedback', feedbackRouter);
app.use('/api/reply', replyRouter);

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'Stealth AI Ops Assistant API' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', message: 'The requested resource does not exist' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;