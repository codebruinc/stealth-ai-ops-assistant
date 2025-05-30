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
        'X-Client-Info': 'stealth-ai-ops-assistant-context-store'
      }
    }
  });
  logger.info('Supabase client initialized successfully');
} catch (error) {
  logger.error('Failed to initialize Supabase client:', error);
  // Create a mock client for fallback
  supabase = {
    from: () => ({
      select: () => ({ data: null, error: new Error('Supabase client not initialized') }),
      insert: () => ({ data: null, error: new Error('Supabase client not initialized') }),
      update: () => ({ data: null, error: new Error('Supabase client not initialized') }),
      delete: () => ({ data: null, error: new Error('Supabase client not initialized') }),
      eq: () => ({ data: null, error: new Error('Supabase client not initialized') }),
      in: () => ({ data: null, error: new Error('Supabase client not initialized') }),
      single: () => ({ data: null, error: new Error('Supabase client not initialized') })
    })
  };
}

// In-memory cache configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 100; // Maximum number of clients to cache

// In-memory cache for short-term context
const shortTermCache = {
  clients: new Map(),
  lastUpdated: Date.now(),
  projects: new Map(),
  projectsLastUpdated: Date.now()
};

/**
 * Context Store module for managing client and project context
 */
const contextStore = {
  /**
   * Get relevant client context based on input data
   * @param {Array} data Array of data objects that might contain client references
   * @returns {Promise<Object>} Object containing relevant client context
   */
  async getRelevantClientContext(data) {
    try {
      if (!data || data.length === 0) {
        logger.debug('No data provided for client context extraction');
        return { clients: [] };
      }
      
      // Extract potential client names from the data
      const clientNames = extractClientNames(data);
      
      if (clientNames.length === 0) {
        logger.debug('No client names extracted from data');
        return { clients: [] };
      }
      
      logger.debug(`Extracted ${clientNames.length} potential client names: ${clientNames.join(', ')}`);
      
      // Check cache first
      const cachedClients = getCachedClients(clientNames);
      
      // If all clients are in cache and cache is fresh, return cached data
      if (cachedClients.length === clientNames.length &&
          Date.now() - shortTermCache.lastUpdated < CACHE_TTL) {
        logger.debug(`Using cached data for all ${clientNames.length} clients`);
        return { clients: cachedClients };
      }
      
      // Get missing client names (not in cache or cache expired)
      const missingClientNames = clientNames.filter(name =>
        !cachedClients.some(client => client.name === name) ||
        Date.now() - shortTermCache.lastUpdated >= CACHE_TTL
      );
      
      let dbClients = [];
      
      if (missingClientNames.length > 0) {
        logger.debug(`Fetching ${missingClientNames.length} clients from database`);
        
        // Get clients from database
        const { data: clients, error } = await supabase
          .from('clients')
          .select('*')
          .in('name', missingClientNames);
        
        if (error) {
          logger.error('Error fetching client context:', error);
        } else if (clients) {
          dbClients = clients;
          // Update cache
          updateClientCache(clients);
          
          // Update last_mentioned timestamp for these clients
          await updateClientLastMentioned(clients.map(client => client.id));
        }
      }
      
      // Combine cached and database clients, prioritizing db results
      const allClients = [...dbClients];
      
      // Add cached clients that weren't fetched from db
      for (const cachedClient of cachedClients) {
        if (!allClients.some(client => client.id === cachedClient.id)) {
          allClients.push(cachedClient);
        }
      }
      
      logger.debug(`Returning ${allClients.length} clients (${dbClients.length} from DB, ${cachedClients.length} from cache)`);
      return { clients: allClients };
    } catch (error) {
      logger.error('Error in getRelevantClientContext:', error);
      return { clients: [] };
    }
  },
  
  /**
   * Get a specific client's context by ID
   * @param {string} clientId The client ID
   * @returns {Promise<Object|null>} The client context or null if not found
   */
  async getClientById(clientId) {
    try {
      if (!clientId) {
        logger.warn('getClientById called with null or undefined clientId');
        return null;
      }
      
      // Check cache first
      if (shortTermCache.clients.has(clientId) &&
          Date.now() - shortTermCache.lastUpdated < CACHE_TTL) {
        logger.debug(`Client ${clientId} found in cache`);
        return shortTermCache.clients.get(clientId);
      }
      
      logger.debug(`Fetching client ${clientId} from database`);
      
      // Get from database
      const { data: client, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();
      
      if (error) {
        logger.error(`Error fetching client ${clientId}:`, error);
        return null;
      }
      
      if (!client) {
        logger.warn(`Client ${clientId} not found in database`);
        return null;
      }
      
      // Update cache
      shortTermCache.clients.set(clientId, client);
      
      return client;
    } catch (error) {
      logger.error(`Error in getClientById for ${clientId}:`, error);
      return null;
    }
  },
  
  /**
   * Update a client's context
   * @param {string} clientId The client ID
   * @param {Object} updates The updates to apply
   * @returns {Promise<boolean>} Success status
   */
  async updateClientContext(clientId, updates) {
    try {
      if (!clientId) {
        logger.warn('updateClientContext called with null or undefined clientId');
        return false;
      }
      
      if (!updates || Object.keys(updates).length === 0) {
        logger.warn(`No updates provided for client ${clientId}`);
        return false;
      }
      
      logger.debug(`Updating client ${clientId} with ${Object.keys(updates).length} fields`);
      
      // Add updated_at timestamp if the column exists
      let updatesWithTimestamp = { ...updates };
      
      try {
        // Check if the updated_at column exists
        updatesWithTimestamp.updated_at = new Date().toISOString();
      } catch (error) {
        logger.warn('updated_at column might not exist in clients table, continuing without it');
      }
      
      const { error } = await supabase
        .from('clients')
        .update(updatesWithTimestamp)
        .eq('id', clientId);
      
      if (error) {
        logger.error(`Error updating client ${clientId}:`, error);
        return false;
      }
      
      // Update cache if client is in cache
      if (shortTermCache.clients.has(clientId)) {
        const client = shortTermCache.clients.get(clientId);
        shortTermCache.clients.set(clientId, { ...client, ...updatesWithTimestamp });
      }
      
      logger.debug(`Client ${clientId} updated successfully`);
      return true;
    } catch (error) {
      logger.error(`Error in updateClientContext for ${clientId}:`, error);
      return false;
    }
  },
  
  /**
   * Create a new client
   * @param {Object} clientData The client data
   * @returns {Promise<Object|null>} The created client or null if failed
   */
  async createClient(clientData) {
    try {
      if (!clientData || !clientData.name) {
        logger.warn('createClient called with invalid client data');
        return null;
      }
      
      logger.debug(`Creating new client: ${clientData.name}`);
      
      const now = new Date().toISOString();
      
      // Create client data object without updated_at first
      const clientInsertData = {
        name: clientData.name,
        profile: clientData.profile || {},
        last_mentioned: now,
        created_at: now
      };
      
      // Try to add updated_at if the column exists
      try {
        clientInsertData.updated_at = now;
      } catch (error) {
        logger.warn('updated_at column might not exist in clients table, continuing without it');
      }
      
      const { data: client, error } = await supabase
        .from('clients')
        .insert([clientInsertData])
        .select()
        .single();
      
      if (error) {
        // Check if it's a duplicate name error
        if (error.code === '23505') { // PostgreSQL unique constraint violation
          logger.warn(`Client with name "${clientData.name}" already exists`);
          
          // Try to fetch the existing client
          const { data: existingClient, error: fetchError } = await supabase
            .from('clients')
            .select('*')
            .eq('name', clientData.name)
            .single();
            
          if (!fetchError && existingClient) {
            logger.debug(`Retrieved existing client with name "${clientData.name}"`);
            
            // Update cache
            shortTermCache.clients.set(existingClient.id, existingClient);
            
            return existingClient;
          }
        }
        
        logger.error('Error creating client:', error);
        return null;
      }
      
      if (!client) {
        logger.warn('Client created but no data returned');
        return null;
      }
      
      // Update cache
      shortTermCache.clients.set(client.id, client);
      
      logger.debug(`Client created successfully with ID: ${client.id}`);
      return client;
    } catch (error) {
      logger.error('Error in createClient:', error);
      return null;
    }
  },
  
  /**
   * Clear the context cache
   */
  /**
   * Get project context by ID
   * @param {string} projectId The project ID
   * @returns {Promise<Object|null>} The project context or null if not found
   */
  async getProjectById(projectId) {
    try {
      if (!projectId) {
        logger.warn('getProjectById called with null or undefined projectId');
        return null;
      }
      
      // Check cache first
      if (shortTermCache.projects.has(projectId) &&
          Date.now() - shortTermCache.projectsLastUpdated < CACHE_TTL) {
        logger.debug(`Project ${projectId} found in cache`);
        return shortTermCache.projects.get(projectId);
      }
      
      logger.debug(`Fetching project ${projectId} from database`);
      
      // Get from database (assuming a projects table exists)
      const { data: project, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
      
      if (error) {
        // If the error is that the table doesn't exist, log it differently
        if (error.code === '42P01') { // PostgreSQL undefined_table error
          logger.warn('Projects table does not exist in the database');
        } else {
          logger.error(`Error fetching project ${projectId}:`, error);
        }
        return null;
      }
      
      if (!project) {
        logger.warn(`Project ${projectId} not found in database`);
        return null;
      }
      
      // Update cache
      shortTermCache.projects.set(projectId, project);
      shortTermCache.projectsLastUpdated = Date.now();
      
      return project;
    } catch (error) {
      logger.error(`Error in getProjectById for ${projectId}:`, error);
      return null;
    }
  },
  
  /**
   * Get relevant projects for a client
   * @param {string} clientId The client ID
   * @returns {Promise<Array>} Array of projects
   */
  async getProjectsForClient(clientId) {
    try {
      if (!clientId) {
        logger.warn('getProjectsForClient called with null or undefined clientId');
        return [];
      }
      
      logger.debug(`Fetching projects for client ${clientId}`);
      
      // Get from database (assuming a projects table with client_id field exists)
      const { data: projects, error } = await supabase
        .from('projects')
        .select('*')
        .eq('client_id', clientId);
      
      if (error) {
        // If the error is that the table doesn't exist, log it differently
        if (error.code === '42P01') { // PostgreSQL undefined_table error
          logger.warn('Projects table does not exist in the database');
        } else {
          logger.error(`Error fetching projects for client ${clientId}:`, error);
        }
        return [];
      }
      
      if (!projects || projects.length === 0) {
        logger.debug(`No projects found for client ${clientId}`);
        return [];
      }
      
      // Update cache
      for (const project of projects) {
        shortTermCache.projects.set(project.id, project);
      }
      shortTermCache.projectsLastUpdated = Date.now();
      
      logger.debug(`Found ${projects.length} projects for client ${clientId}`);
      return projects;
    } catch (error) {
      logger.error(`Error in getProjectsForClient for ${clientId}:`, error);
      return [];
    }
  },
  
  /**
   * Clear the context cache
   * @param {string} cacheType Optional - specify which cache to clear ('clients', 'projects', or all if not specified)
   */
  clearCache(cacheType) {
    if (!cacheType || cacheType === 'clients') {
      shortTermCache.clients.clear();
      shortTermCache.lastUpdated = Date.now();
      logger.debug('Cleared clients cache');
    }
    
    if (!cacheType || cacheType === 'projects') {
      shortTermCache.projects.clear();
      shortTermCache.projectsLastUpdated = Date.now();
      logger.debug('Cleared projects cache');
    }
  },
  
  /**
   * Prune the cache to prevent memory leaks
   */
  pruneCache() {
    try {
      // Prune clients cache if it exceeds the maximum size
      if (shortTermCache.clients.size > MAX_CACHE_SIZE) {
        logger.debug(`Pruning clients cache (current size: ${shortTermCache.clients.size})`);
        
        // Convert to array for sorting
        const clientEntries = Array.from(shortTermCache.clients.entries());
        
        // Sort by last_mentioned (oldest first)
        clientEntries.sort((a, b) => {
          const aDate = new Date(a[1].last_mentioned || 0);
          const bDate = new Date(b[1].last_mentioned || 0);
          return aDate - bDate;
        });
        
        // Remove oldest entries until we're under the limit
        const entriesToRemove = clientEntries.slice(0, clientEntries.length - MAX_CACHE_SIZE);
        for (const [id] of entriesToRemove) {
          shortTermCache.clients.delete(id);
        }
        
        logger.debug(`Removed ${entriesToRemove.length} entries from clients cache`);
      }
      
      // Prune projects cache if it exceeds the maximum size
      if (shortTermCache.projects.size > MAX_CACHE_SIZE) {
        logger.debug(`Pruning projects cache (current size: ${shortTermCache.projects.size})`);
        
        // Convert to array for sorting
        const projectEntries = Array.from(shortTermCache.projects.entries());
        
        // Sort by updated_at (oldest first)
        projectEntries.sort((a, b) => {
          const aDate = new Date(a[1].updated_at || 0);
          const bDate = new Date(b[1].updated_at || 0);
          return aDate - bDate;
        });
        
        // Remove oldest entries until we're under the limit
        const entriesToRemove = projectEntries.slice(0, projectEntries.length - MAX_CACHE_SIZE);
        for (const [id] of entriesToRemove) {
          shortTermCache.projects.delete(id);
        }
        
        logger.debug(`Removed ${entriesToRemove.length} entries from projects cache`);
      }
    } catch (error) {
      logger.error('Error in pruneCache:', error);
    }
  }
};

/**
 * Extract potential client names from data
 * @param {Array} data Array of data objects
 * @returns {Array<string>} Array of potential client names
 */
function extractClientNames(data) {
  const clientNames = new Set();
  
  for (const item of data) {
    // Extract from different data sources based on their structure
    
    // Slack messages
    if (item.text) {
      extractNamesFromText(item.text).forEach(name => clientNames.add(name));
    }
    
    // Zendesk tickets
    if (item.subject) {
      extractNamesFromText(item.subject).forEach(name => clientNames.add(name));
    }
    
    // Harvest time entries
    if (item.client_details && item.client_details.name) {
      clientNames.add(item.client_details.name);
    }
    
    // Emails
    if (item.subject) {
      extractNamesFromText(item.subject).forEach(name => clientNames.add(name));
    }
    if (item.body) {
      extractNamesFromText(item.body).forEach(name => clientNames.add(name));
    }
  }
  
  return Array.from(clientNames);
}

/**
 * Extract potential client names from text
 * @param {string} text The text to extract from
 * @returns {Array<string>} Array of potential client names
 */
function extractNamesFromText(text) {
  // This is a simplified implementation
  // In a real system, this would use NLP or a more sophisticated approach
  
  // For now, just look for capitalized words that might be company names
  const words = text.split(/\s+/);
  const potentialNames = [];
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i].replace(/[^\w\s]/g, '');
    
    // If word starts with capital letter and is not a common word, consider it a potential name
    if (word.length > 1 && /^[A-Z]/.test(word) && !isCommonWord(word)) {
      // Check if it's part of a multi-word name
      let name = word;
      let j = i + 1;
      
      while (j < words.length) {
        const nextWord = words[j].replace(/[^\w\s]/g, '');
        if (nextWord.length > 1 && /^[A-Z]/.test(nextWord) && !isCommonWord(nextWord)) {
          name += ' ' + nextWord;
          j++;
        } else {
          break;
        }
      }
      
      potentialNames.push(name);
      i = j - 1; // Skip the words we've already included
    }
  }
  
  return potentialNames;
}

/**
 * Check if a word is a common word that shouldn't be considered a name
 * @param {string} word The word to check
 * @returns {boolean} Whether it's a common word
 */
function isCommonWord(word) {
  const commonWords = [
    'The', 'A', 'An', 'And', 'But', 'Or', 'For', 'Nor', 'As', 'At',
    'By', 'For', 'From', 'In', 'Into', 'Near', 'Of', 'On', 'To', 'With',
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
    'January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December',
    'I', 'You', 'He', 'She', 'It', 'We', 'They'
  ];
  
  return commonWords.includes(word);
}

/**
 * Get cached clients by name
 * @param {Array<string>} clientNames Array of client names
 * @returns {Array<Object>} Array of cached clients
 */
function getCachedClients(clientNames) {
  const cachedClients = [];
  
  for (const client of shortTermCache.clients.values()) {
    if (clientNames.includes(client.name)) {
      cachedClients.push(client);
    }
  }
  
  return cachedClients;
}

/**
 * Check if the cache is stale
 * @returns {boolean} Whether the cache is stale
 */
function isCacheStale() {
  return Date.now() - shortTermCache.lastUpdated >= CACHE_TTL;
}

/**
 * Update the client cache with new client data
 * @param {Array<Object>} clients Array of client objects
 */
function updateClientCache(clients) {
  if (!clients || clients.length === 0) return;
  
  for (const client of clients) {
    if (client && client.id) {
      shortTermCache.clients.set(client.id, client);
    }
  }
  
  shortTermCache.lastUpdated = Date.now();
  
  // Prune cache if it gets too large
  if (shortTermCache.clients.size > MAX_CACHE_SIZE) {
    contextStore.pruneCache();
  }
}

/**
 * Update the last_mentioned timestamp for clients
 * @param {Array<string>} clientIds Array of client IDs
 */
async function updateClientLastMentioned(clientIds) {
  if (!clientIds || clientIds.length === 0) return;
  
  try {
    const now = new Date().toISOString();
    const updates = {
      last_mentioned: now,
      updated_at: now
    };
    
    // Batch update for better performance
    if (clientIds.length === 1) {
      // Single update
      const { error } = await supabase
        .from('clients')
        .update(updates)
        .eq('id', clientIds[0]);
      
      if (error) {
        logger.error(`Error updating last_mentioned for client ${clientIds[0]}:`, error);
      } else {
        // Update cache
        if (shortTermCache.clients.has(clientIds[0])) {
          const client = shortTermCache.clients.get(clientIds[0]);
          shortTermCache.clients.set(clientIds[0], { ...client, ...updates });
        }
      }
    } else {
      // Batch update using IN clause
      const { error } = await supabase
        .from('clients')
        .update(updates)
        .in('id', clientIds);
      
      if (error) {
        logger.error(`Error batch updating last_mentioned for ${clientIds.length} clients:`, error);
      } else {
        // Update cache for all updated clients
        for (const clientId of clientIds) {
          if (shortTermCache.clients.has(clientId)) {
            const client = shortTermCache.clients.get(clientId);
            shortTermCache.clients.set(clientId, { ...client, ...updates });
          }
        }
      }
    }
  } catch (error) {
    logger.error('Error in updateClientLastMentioned:', error);
  }
}

module.exports = contextStore;