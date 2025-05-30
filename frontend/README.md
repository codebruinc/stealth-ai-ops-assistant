# Stealth AI Ops Assistant - Frontend

This is the frontend for the Stealth AI Ops Assistant, a mobile-first chat interface that helps solo founders monitor Slack, Zendesk, and Harvest.

## Features

- **Authentication**: Token-based authentication using the `ADMIN_ACCESS_TOKEN`
- **Mobile-first Dashboard**: Clean, modern UI using Tailwind CSS
- **Chat Interface**: View summaries and suggested replies
- **Service Filters**: Show/hide specific service summaries
- **Feedback Mechanism**: Approve, edit, or reject suggested replies

## Tech Stack

- **Next.js**: React framework for the frontend
- **Tailwind CSS**: Utility-first CSS framework
- **Axios**: HTTP client for API requests
- **date-fns**: Date utility library

## Getting Started

### Prerequisites

- Node.js 14.x or higher
- npm or yarn
- Backend server running on port 3000

### Installation

1. Install dependencies:

```bash
npm install
# or
yarn install
```

2. Run the development server:

```bash
npm run dev
# or
yarn dev
```

The frontend will be available at [http://localhost:3001](http://localhost:3001).

### Build for Production

```bash
npm run build
npm run start
# or
yarn build
yarn start
```

## Project Structure

- **/pages**: Next.js pages
  - **index.js**: Main dashboard/chat interface
  - **login.js**: Authentication page
  - **settings.js**: Settings page
- **/components**: Reusable UI components
  - **Layout.jsx**: Main layout with sidebar
  - **MessageBubble.jsx**: Chat message component
  - **SuggestionCard.jsx**: Card for displaying and acting on suggestions
  - **ServiceFilter.jsx**: Filter for toggling service visibility
  - **LoadingSpinner.jsx**: Loading indicator
- **/context**: React context providers
  - **AuthContext.js**: Authentication state management
- **/hooks**: Custom React hooks
  - **useChat.js**: Chat state management
- **/utils**: Utility functions
  - **api.js**: API service for backend communication
  - **dateUtils.js**: Date formatting utilities
- **/styles**: CSS styles
  - **globals.css**: Global styles and Tailwind imports

## Authentication

The frontend uses a simple token-based authentication system. The token is stored in a cookie and sent with each API request. To log in, enter the `ADMIN_ACCESS_TOKEN` from the backend `.env` file.

## API Integration

The frontend communicates with the backend API using the Axios HTTP client. All API requests include the authentication token in the `Authorization` header.

## Mobile-First Design

The UI is designed to be mobile-first, with responsive layouts that work well on all screen sizes. The sidebar collapses to a mobile menu on smaller screens.