# 🤖 Stealth AI Ops Assistant — MVP Version

A private, mobile-first AI assistant that helps solo founders monitor Slack, Zendesk, and Harvest — and privately suggests responses, actions, and insights in a clean chat interface. Built to feel like a "human assistant" while staying fully silent and internal.

This is the **lean MVP** for open-source release, with a clear path to full autonomy and enterprise-grade functionality.

---

## 🚀 MVP Goals (Phase 1 Only)

This MVP is focused only on the **core foundation**. RooCode should not implement Phase 2 or 3 features yet.

### 🔑 What to Build Now (Phase 1 MVP)
- **Private chat interface** (mobile-friendly)
- **Slack + Zendesk + Harvest integration**
- **AI summaries using GPT-4o**
- **Suggested replies with Approve/Edit/Send**
- **Basic memory layer in Supabase**
- **Simple token-based auth (ADMIN_ACCESS_TOKEN)**

---

## 🔒 Future Phases (Not for MVP)

These are already planned but **not** part of this MVP build. See `phase2-planning.md` and `phase3-additions.md`.

**Future Features:**
- Role-based AI (CTO/COO/CMO)
- Calendar + task system integration
- Anomaly detection, inbound routing, email handling
- Modular agents, full autonomy

---

## 🧱 Tech Stack

| Layer     | Stack                             |
|----------|------------------------------------|
| Backend  | Node.js + Express                  |
| Frontend | Next.js + Tailwind (mobile-first)  |
| DB       | Supabase                           |
| AI       | OpenAI GPT-4o via OpenRouter       |
| Auth     | Simple token via .env for admin use only |

---

## 📦 MVP Features

### ✅ 1. Data Fetching
- Slack: Pull latest messages from selected or all channels
- Zendesk: Pull recent ticket updates
- Harvest: Pull recent time entries and invoices

### ✅ 2. AI Summarization
- Summarize changes and activity from each platform
- Combine into a single digest per session

### ✅ 3. Action Suggestions
- Suggest:
  - Replies to Slack questions
  - Nudge messages for overdue tickets or blocked devs
  - Invoicing follow-ups

### ✅ 4. Chat Interface
- View summaries + messages
- Approve/Edit/Send suggested replies
- Ask questions like "How is Project X doing?"

### ✅ 5. Supabase Context Storage
- Save summary results
- Save feedback on AI suggestions
- Store basic client/project metadata

---

## 🔐 Authentication

```env
ADMIN_ACCESS_TOKEN=changeme123
```

- All routes require this token in `Authorization: Bearer` header.
- MVP is single-user only.

---

## 🔁 Slack Auto-Join Setup

To allow the bot to monitor **all Slack channels now and in future**:

1. **Set these Bot Token Scopes**:
```
channels:read
channels:history
groups:read
groups:history
conversations.join
```

2. **Run auto-join logic** every few hours:
   - Call `conversations.list`
   - For each channel, call `conversations.join` if needed
   - Fetch messages with `conversations.history`

⚠️ For **private channels**, you must manually invite the bot with:
```
/invite @botname
```

---

## 📁 Suggested File Layout

```
/backend
  routes/
    fetchSlack.js
    fetchZendesk.js
    fetchHarvest.js
    summarize.js

/frontend
  pages/chat.tsx
  components/MessageBubble.tsx
  components/SuggestionCard.tsx

/ai/prompts
  slack-summary.txt
  zendesk-summary.txt
  harvest-summary.txt

/docs
  scaffold.md
  phase2-planning.md
  phase3-additions.md
  supabase.sql
  .env.example
```

---

## ✅ MVP Deliverables

- Working system with chat UI, Slack/Zendesk/Harvest integration
- Summaries and suggested replies via GPT
- Admin-only dashboard access
- No other advanced features unless specified

---

## 🚀 Installation and Setup

### Prerequisites
- Node.js (v16+)
- npm or yarn
- Supabase account (for database)
- API keys for Slack, Zendesk, and Harvest

### Environment Setup
1. Clone the repository
2. Copy `env.example` to `.env` in the backend directory
3. Fill in your API keys and credentials:
   ```
   # Supabase
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   
   # Slack
   SLACK_BOT_TOKEN=your_slack_bot_token
   SLACK_MODE=all
   
   # Zendesk
   ZENDESK_SUBDOMAIN=your_zendesk_subdomain
   ZENDESK_EMAIL=your_zendesk_email
   ZENDESK_API_TOKEN=your_zendesk_api_token
   
   # Harvest
   HARVEST_ACCOUNT_ID=your_harvest_account_id
   HARVEST_ACCESS_TOKEN=your_harvest_access_token
   
   # AI (OpenRouter)
   OPENROUTER_API_KEY=your_openrouter_api_key
   AI_MODEL=gpt-4o
   
   # App Auth
   ADMIN_ACCESS_TOKEN=your_admin_access_token
   
   # Server Config
   PORT=3000
   NODE_ENV=development
   ```

### Running the Application
1. Install backend dependencies:
   ```
   cd backend
   npm install
   ```

2. Start the backend server:
   ```
   npm run dev
   ```

3. Install frontend dependencies:
   ```
   cd frontend
   npm install
   ```

4. Start the frontend development server:
   ```
   npm run dev
   ```

5. Access the application at `http://localhost:3000`

### Authentication
Use the `ADMIN_ACCESS_TOKEN` from your `.env` file to log in to the application.

---

## 📚 API Documentation

### Authentication
All API endpoints require authentication using the `Authorization: Bearer <token>` header.

### Data Fetching Endpoints
- `GET /api/slack/messages` - Fetch recent Slack messages
  - Query parameters:
    - `days` (optional): Number of days to look back (default: 1)
    - `channels` (optional): Comma-separated list of channel IDs

- `GET /api/zendesk/tickets` - Fetch recent Zendesk tickets
  - Query parameters:
    - `days` (optional): Number of days to look back (default: 7)

- `GET /api/harvest/time` - Fetch Harvest time entries
  - Query parameters:
    - `days` (optional): Number of days to look back (default: 7)

- `GET /api/harvest/invoices` - Fetch Harvest invoices

- `GET /api/email/messages` - Fetch Gmail messages
  - Query parameters:
    - `days` (optional): Number of days to look back (default: 3)

### Summarization Endpoints
- `POST /api/summarize/slack` - Summarize Slack data
  - Body parameters:
    - `messages` (optional): Array of Slack messages to summarize
    - `days` (optional): Number of days to look back (default: 1)

- `POST /api/summarize/zendesk` - Summarize Zendesk data
  - Body parameters:
    - `tickets` (optional): Array of Zendesk tickets to summarize
    - `days` (optional): Number of days to look back (default: 7)

- `POST /api/summarize/harvest` - Summarize Harvest data
  - Body parameters:
    - `timeEntries` (optional): Array of Harvest time entries to summarize
    - `invoices` (optional): Array of Harvest invoices to summarize
    - `days` (optional): Number of days to look back (default: 7)

- `POST /api/summarize/email` - Summarize email data
  - Body parameters:
    - `emails` (optional): Array of email messages to summarize
    - `days` (optional): Number of days to look back (default: 3)

- `POST /api/summarize/all` - Generate comprehensive summary from all sources

### Interaction Endpoints
- `GET /api/summaries` - Get recent summaries

- `POST /api/feedback` - Submit feedback on suggestions
  - Body parameters:
    - `summaryId`: ID of the summary
    - `suggestionId`: ID of the suggestion
    - `action`: Action taken (approved, edited, rejected)
    - `originalText`: Original suggestion text
    - `modifiedText`: Modified text (for edited suggestions)

- `POST /api/reply/slack` - Send approved Slack reply
  - Body parameters:
    - `channel`: Channel ID
    - `text`: Message text
    - `thread_ts` (optional): Thread timestamp for replies

- `POST /api/reply/zendesk` - Send approved Zendesk reply
  - Body parameters:
    - `ticketId`: Zendesk ticket ID
    - `text`: Reply text

- `POST /api/reply/email` - Send approved email reply
  - Body parameters:
    - `messageId`: Email message ID
    - `text`: Reply text
    - `subject` (optional): Email subject

### Context Management Endpoints
- `GET /api/clients` - Get client context information

- `PUT /api/clients/:id` - Update client context
  - Body parameters:
    - `name`: Client name
    - `profile`: Client profile data
