# Questionnaire: LLM RAG Panel Configuration

1. **Draggable/Repositionable Panels**: Is there an existing library in the project being used for draggable windows/panels (e.g., `react-rnd`, `dnd-kit`), or should I introduce one for this AI Assistant panel?
2. **Vector/Embeddings Database**: The database currently has `embedding` fields in `documents` and `messages`. Does your Turso LibSQL setup have the Vector search extension enabled, or should I implement an application-level cosine similarity search in JS to find relevant RAG context?
3. **LLM APIs**: We will start with Gemini and ChatGPT. Should the RAG embeddings generation also be handled by one of these LLMs (e.g., OpenAI's text-embedding-ada-002 or Gemini's embedding model), or locally via something like `transformers.js` to save API costs?
4. **Data Privacy**: Where should the API keys be stored? Should we create a new `ai_configurations` table in the database to store encrypted API keys per user, or should they be stored locally in the browser's `localStorage` to avoid saving user keys on the server?
