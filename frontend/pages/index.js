import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import MessageBubble from '../components/MessageBubble';
import SuggestionCard from '../components/SuggestionCard';
import ServiceFilter from '../components/ServiceFilter';
import LoadingSpinner from '../components/LoadingSpinner';
import useChat from '../hooks/useChat';
import { ArrowPathIcon, PaperAirplaneIcon } from '@heroicons/react/24/solid';

export default function Home() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef(null);
  
  const {
    messages,
    suggestions,
    isLoading,
    error,
    activeServices,
    sendMessage,
    refreshData,
    handleSuggestionAction,
    toggleService,
  } = useChat();

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputMessage.trim()) {
      sendMessage(inputMessage);
      setInputMessage('');
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <LoadingSpinner size="large" text="Loading dashboard..." />
      </div>
    );
  }

  return (
    <Layout>
      <div className="chat-container">
        {/* Header with service filters */}
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
            <button
              onClick={refreshData}
              disabled={isLoading}
              className="btn btn-primary flex items-center text-sm"
            >
              <ArrowPathIcon className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
          
          <ServiceFilter 
            activeServices={activeServices} 
            onToggleService={toggleService} 
          />
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 m-4">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Suggestions section */}
        {suggestions.length > 0 && (
          <div className="bg-gray-50 border-b border-gray-200 p-4 space-y-4">
            <h2 className="text-lg font-medium text-gray-900">Suggested Actions</h2>
            <div className="space-y-4">
              {suggestions.map((suggestion) => (
                <SuggestionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  onActionComplete={(action) => handleSuggestionAction(suggestion.id, action)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Chat messages */}
        <div className="chat-messages">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <p className="mb-2">No messages yet</p>
              <button
                onClick={refreshData}
                className="btn btn-primary flex items-center text-sm"
              >
                <ArrowPathIcon className="h-4 w-4 mr-1" />
                Refresh Data
              </button>
            </div>
          ) : (
            messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isAI={message.type !== 'user_message'}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat input */}
        <div className="chat-input">
          <form onSubmit={handleSubmit} className="flex space-x-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ask a question about your services..."
              className="input"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim()}
              className="btn btn-primary flex items-center"
            >
              <PaperAirplaneIcon className="h-5 w-5" />
              <span className="sr-only">Send</span>
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}