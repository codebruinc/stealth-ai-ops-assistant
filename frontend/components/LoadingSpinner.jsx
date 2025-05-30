import React from 'react';

const LoadingSpinner = ({ size = 'medium', text = 'Loading...' }) => {
  const sizeClasses = {
    small: 'h-4 w-4 border-2',
    medium: 'h-8 w-8 border-2',
    large: 'h-12 w-12 border-t-2 border-b-2',
  };

  const spinnerSize = sizeClasses[size] || sizeClasses.medium;

  return (
    <div className="flex flex-col items-center justify-center">
      <div className={`animate-spin rounded-full ${spinnerSize} border-primary-600 mx-auto`}></div>
      {text && <p className="mt-2 text-sm text-gray-600">{text}</p>}
    </div>
  );
};

export default LoadingSpinner;