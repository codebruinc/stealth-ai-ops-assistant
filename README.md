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
