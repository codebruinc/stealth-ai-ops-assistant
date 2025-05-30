import React from 'react';
import { formatDate } from '../utils/dateUtils';

const MessageBubble = ({ message, isAI = true }) => {
  const formattedTime = message.timestamp
    ? formatDate(message.timestamp)
    : formatDate(new Date());

  return (
    <div className={`flex ${isAI ? 'justify-start' : 'justify-end'} mb-4`}>
      <div className={`max-w-[85%] message-bubble ${isAI ? 'ai' : 'user'}`}>
        {message.content && (
          <div className="text-sm md:text-base">{message.content}</div>
        )}
        
        {message.summary && (
          <div className="text-sm md:text-base">
            <h3 className="font-medium mb-1">Summary:</h3>
            <p>{message.summary}</p>
          </div>
        )}
        
        {message.source && (
          <div className="text-xs opacity-70 mt-1">
            Source: {message.source}
          </div>
        )}
        
        <div className="text-xs opacity-70 text-right mt-1">
          {formattedTime}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;