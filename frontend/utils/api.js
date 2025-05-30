import axios from 'axios';
import Cookies from 'js-cookie';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to add auth token to all requests
api.interceptors.request.use(
  (config) => {
    const token = Cookies.get('admin_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// API service functions
const apiService = {
  // Auth
  login: async (token) => {
    // Store token in cookie
    Cookies.set('admin_token', token, { expires: 7 }); // 7 days
    return { success: true };
  },
  
  logout: () => {
    Cookies.remove('admin_token');
    return { success: true };
  },
  
  // Data fetching
  fetchSlackMessages: async () => {
    const response = await api.get('/slack/messages');
    return response.data;
  },
  
  fetchZendeskTickets: async () => {
    const response = await api.get('/zendesk/tickets');
    return response.data;
  },
  
  fetchHarvestTime: async () => {
    const response = await api.get('/harvest/time');
    return response.data;
  },
  
  fetchHarvestInvoices: async () => {
    const response = await api.get('/harvest/invoices');
    return response.data;
  },
  
  fetchEmailMessages: async () => {
    const response = await api.get('/email/messages');
    return response.data;
  },
  
  // Summarization
  getSummaries: async () => {
    const response = await api.get('/summarize/summaries');
    return response.data;
  },
  
  summarizeAll: async () => {
    const response = await api.post('/summarize/all');
    return response.data;
  },
  
  // Feedback and replies
  submitFeedback: async (feedbackData) => {
    const response = await api.post('/feedback', feedbackData);
    return response.data;
  },
  
  sendReply: async (service, replyData) => {
    const response = await api.post(`/reply/${service}`, replyData);
    return response.data;
  },
  
  // Client context
  getClients: async () => {
    const response = await api.get('/clients');
    return response.data;
  },
  
  updateClient: async (clientId, clientData) => {
    const response = await api.put(`/clients/${clientId}`, clientData);
    return response.data;
  },
};

export default apiService;