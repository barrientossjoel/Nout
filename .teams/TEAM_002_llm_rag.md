# TEAM_002 LLM RAG Panel

## Goal
Implement a modular chat panel to connect various AI/LLM services (Gemini, ChatGPT) using the user's personal API keys. The keys will be managed in the Settings UI and stored locally (`localStorage`) for maximum privacy (Local First). The panel acts as an agent/RAG, reading the entire vault contextually without exhausting tokens. It must transparently show billing/token usage estimates.

## Planned Approach
1. **Frontend / UI**:
   - Utilize existing `react-resizable-panels` and `@hello-pangea/dnd` to add the AI Chat Panel.
   - Create an AI Settings section to manage API keys (stored in `localStorage`).
   - Add a UI element in the chat to display exact token usage / estimated cost per request.
2. **Local-First RAG Pipeline**:
   - **Embeddings**: To keep costs at $0 and maximize privacy, use a local in-browser model (like `@xenova/transformers.js` or simply leverage Gemini's free tier if preferred) to generate vector embeddings of documents.
   - **Vector Search**: Use local JavaScript cosine similarity or local IndexedDB/SQLite (via libSQL local sync) to find relevant documents without sending the whole vault to an external DB.
   - **Generation**: Send the relevant context + user prompt to the selected LLM (OpenAI or Gemini) using the API keys from `localStorage`.

## Status
- [x] Initial analysis.
- [x] Confirmed architectural decisions (LocalStorage for keys, local-first RAG, use existing panel libraries).
- [x] Implement AI Settings UI with Cost & Usage Transparency.
- [x] Implement AI Chat Panel UI with Screaming Architecture + Clean Architecture.
- [x] Implement RAG logic with token tracking, remaining quota counters, and zero-if/else strategy maps.
- [x] Registered project-wide architecture standards in `AGENTS.md`.
