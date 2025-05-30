# 🧠 Stealth AI Assistant — Project Scaffold

This document outlines the project structure and key components for the MVP build of the AI assistant. The system monitors Slack, Zendesk, Harvest, and Gmail, providing private summaries, suggested replies, and a mobile-first chat interface.

---

## 📁 Directory Structure

```
/backend
  - index.js                      # Express app entry point
  /routes
    - fetchSlack.js              # Pull Slack messages + channel logic
    - fetchZendesk.js            # Pull Zendesk tickets
    - fetchHarvest.js            # Pull Harvest time + invoices
    - fetchEmail.js              # Pull Gmail inbox messages
    - summarize.js               # Route that sends all data to GPT

  /memory
    - contextStore.js            # Supabase client/project memory
    - feedbackHandler.js         # Handles user feedback on AI suggestions

/frontend
  /pages
    - chat.tsx                   # Chat interface (mobile-first)
  /components
    - MessageBubble.tsx
    - SuggestionCard.tsx

/ai/prompts
  - slack-summary.txt            # Prompt to summarize Slack messages
  - zendesk-summary.txt          # Prompt to summarize support tickets
  - harvest-summary.txt          # Prompt to analyze time + invoices
  - email-summary.txt            # Prompt to summarize and reply to emails

/test-data
  - slack.json
  - zendesk.json
  - harvest.json
  - emails.json

/docs
  - README.md
  - scaffold.md
  - phase2-planning.md
  - phase3-additions.md
  - supabase.sql
  - supabase-emails.sql
  - .env.example
```

---

## 🧠 Core Features in This MVP

- 🔒 Private-only access (admin via token)
- 📥 Pulls Slack, Zendesk, Harvest, Gmail
- 🧠 Summarizes updates via GPT-4o (OpenRouter)
- ✅ Suggests actions/replies
- 💬 Clean mobile-first UI
- 📚 Supabase stores memory, feedback, and emails
- 🗂 Project and client context included in summaries

---

## ⚠️ Out of Scope for MVP

See `phase2-planning.md` and `phase3-additions.md` for these future features:
- Role-based agents (CTO, CMO, COO)
- Calendar integration
- Inbound message handling
- Task and notification system
- Multi-user accounts

---

## ✅ RooCode Build Order

1. Setup Supabase schema (run `supabase.sql` + `supabase-emails.sql`)
2. Implement `/routes` fetchers + `summarize.js`
3. Add GPT prompt files to `/ai/prompts`
4. Build chat UI in `/pages/chat.tsx`
5. Wire frontend to backend with feedback + approval workflow

---

## ✅ Ready for One-Shot Build
This structure is designed to be followed linearly and kept lean. All long-term enhancements are scoped for later phases.