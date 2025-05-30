import React, { useState } from 'react';
import { CheckIcon, XMarkIcon, PencilIcon, PaperAirplaneIcon } from '@heroicons/react/24/solid';
import apiService from '../utils/api';

const SuggestionCard = ({ suggestion, onActionComplete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(suggestion.text);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleApprove = async () => {
    setIsLoading(true);
    setError('');
    try {
      await apiService.submitFeedback({
        summaryId: suggestion.summaryId,
        suggestionId: suggestion.id,
        action: 'approved',
        originalText: suggestion.text,
        modifiedText: suggestion.text
      });
      
      if (suggestion.service && suggestion.replyData) {
        await apiService.sendReply(suggestion.service, {
          ...suggestion.replyData,
          text: suggestion.text
        });
      }
      
      onActionComplete && onActionComplete('approved');
    } catch (err) {
      setError('Failed to approve suggestion');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    setIsLoading(true);
    setError('');
    try {
      await apiService.submitFeedback({
        summaryId: suggestion.summaryId,
        suggestionId: suggestion.id,
        action: 'rejected',
        originalText: suggestion.text,
        modifiedText: ''
      });
      
      onActionComplete && onActionComplete('rejected');
    } catch (err) {
      setError('Failed to reject suggestion');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!editedText.trim()) {
      setError('Reply cannot be empty');
      return;
    }
    
    setIsLoading(true);
    setError('');
    try {
      await apiService.submitFeedback({
        summaryId: suggestion.summaryId,
        suggestionId: suggestion.id,
        action: 'edited',
        originalText: suggestion.text,
        modifiedText: editedText
      });
      
      if (suggestion.service && suggestion.replyData) {
        await apiService.sendReply(suggestion.service, {
          ...suggestion.replyData,
          text: editedText
        });
      }
      
      setIsEditing(false);
      onActionComplete && onActionComplete('edited');
    } catch (err) {
      setError('Failed to save edit');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedText(suggestion.text);
    setIsEditing(false);
    setError('');
  };

  return (
    <div className="suggestion-card">
      <div className="flex items-start justify-between mb-2">
        <div className="text-sm font-medium text-gray-500">
          Suggested {suggestion.type || 'Reply'}
          {suggestion.service && ` for ${suggestion.service}`}
        </div>
        {suggestion.confidence && (
          <div className={`text-xs px-2 py-1 rounded-full ${
            suggestion.confidence > 0.8 ? 'bg-green-100 text-green-800' : 
            suggestion.confidence > 0.5 ? 'bg-yellow-100 text-yellow-800' : 
            'bg-red-100 text-red-800'
          }`}>
            {Math.round(suggestion.confidence * 100)}% confidence
          </div>
        )}
      </div>
      
      {isEditing ? (
        <div className="mb-3">
          <textarea
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
            rows={4}
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            disabled={isLoading}
          />
        </div>
      ) : (
        <div className="mb-3 text-gray-800 whitespace-pre-wrap">
          {suggestion.text}
        </div>
      )}
      
      {error && (
        <div className="text-red-600 text-sm mb-3">{error}</div>
      )}
      
      <div className="flex justify-end space-x-2">
        {isEditing ? (
          <>
            <button
              onClick={handleCancelEdit}
              disabled={isLoading}
              className="btn btn-secondary flex items-center text-sm"
            >
              <XMarkIcon className="h-4 w-4 mr-1" />
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={isLoading}
              className="btn btn-primary flex items-center text-sm"
            >
              <PaperAirplaneIcon className="h-4 w-4 mr-1" />
              {isLoading ? 'Saving...' : 'Save & Send'}
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleReject}
              disabled={isLoading}
              className="btn btn-secondary flex items-center text-sm"
            >
              <XMarkIcon className="h-4 w-4 mr-1" />
              Reject
            </button>
            <button
              onClick={handleEdit}
              disabled={isLoading}
              className="btn btn-secondary flex items-center text-sm"
            >
              <PencilIcon className="h-4 w-4 mr-1" />
              Edit
            </button>
            <button
              onClick={handleApprove}
              disabled={isLoading}
              className="btn btn-primary flex items-center text-sm"
            >
              <CheckIcon className="h-4 w-4 mr-1" />
              {isLoading ? 'Sending...' : 'Approve & Send'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default SuggestionCard;