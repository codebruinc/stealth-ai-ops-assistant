import { useState, useEffect, useCallback } from 'react';
import apiService from '../utils/api';

const useChat = () => {
  const [messages, setMessages] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeServices, setActiveServices] = useState(['slack', 'zendesk', 'harvest', 'email']);

  // Fetch initial summaries
  useEffect(() => {
    fetchSummaries();
  }, []);

  // Fetch summaries from the API
  const fetchSummaries = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await apiService.getSummaries();
      
      // Process summaries into messages and suggestions
      const newMessages = [];
      const newSuggestions = [];
      
      data.forEach(summary => {
        // Add the summary as a message
        newMessages.push({
          id: summary.id,
          type: 'summary',
          source: summary.source,
          content: null,
          summary: summary.summary,
          timestamp: summary.created_at,
        });
        
        // Add any suggested messages to the suggestions array
        if (summary.suggested_messages && summary.suggested_messages.length > 0) {
          summary.suggested_messages.forEach(suggestion => {
            newSuggestions.push({
              id: suggestion.id,
              summaryId: summary.id,
              type: suggestion.type || 'reply',
              service: summary.source,
              text: suggestion.text,
              confidence: suggestion.confidence,
              replyData: suggestion.reply_data,
            });
          });
        }
      });
      
      setMessages(prev => [...newMessages, ...prev]);
      setSuggestions(prev => [...newSuggestions, ...prev]);
    } catch (err) {
      console.error('Error fetching summaries:', err);
      setError('Failed to load summaries. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refresh data by fetching new summaries from all services
  const refreshData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Call the summarize all endpoint
      const result = await apiService.summarizeAll();
      
      if (result.success) {
        // Fetch the updated summaries
        await fetchSummaries();
      } else {
        setError('Failed to refresh data. Please try again.');
      }
    } catch (err) {
      console.error('Error refreshing data:', err);
      setError('Failed to refresh data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [fetchSummaries]);

  // Handle user message input
  const sendMessage = useCallback(async (text) => {
    if (!text.trim()) return;
    
    // Add user message to the chat
    const userMessage = {
      id: Date.now().toString(),
      type: 'user_message',
      content: text,
      timestamp: new Date().toISOString(),
    };
    
    setMessages(prev => [userMessage, ...prev]);
    
    // TODO: Implement API call to process user message
    // This would be expanded in future versions
  }, []);

  // Handle suggestion actions (approve/reject/edit)
  const handleSuggestionAction = useCallback((suggestionId, action) => {
    // Remove the suggestion from the list
    setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
    
    // If approved or edited, could add a system message confirming the action
    if (action === 'approved' || action === 'edited') {
      const message = {
        id: Date.now().toString(),
        type: 'system',
        content: `Suggestion ${action} and sent.`,
        timestamp: new Date().toISOString(),
      };
      
      setMessages(prev => [message, ...prev]);
    }
  }, []);

  // Toggle service filter
  const toggleService = useCallback((serviceId) => {
    setActiveServices(prev => {
      if (prev.includes(serviceId)) {
        return prev.filter(id => id !== serviceId);
      } else {
        return [...prev, serviceId];
      }
    });
  }, []);

  // Filter messages by active services
  const filteredMessages = messages.filter(message => 
    !message.source || activeServices.includes(message.source.toLowerCase())
  );

  // Filter suggestions by active services
  const filteredSuggestions = suggestions.filter(suggestion => 
    !suggestion.service || activeServices.includes(suggestion.service.toLowerCase())
  );

  return {
    messages: filteredMessages,
    suggestions: filteredSuggestions,
    isLoading,
    error,
    activeServices,
    sendMessage,
    refreshData,
    handleSuggestionAction,
    toggleService,
  };
};

export default useChat;