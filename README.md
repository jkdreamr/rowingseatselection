# Lineup Builder

A touch-friendly, print-friendly lineup builder for Stanford rowing coaches.

## Run locally

```bash
npm install
npm run dev
```

The app stores roster and lineup data in browser local storage for now. The storage
adapter is intentionally isolated so it can be replaced with Supabase persistence
later without changing the UI or reducer.
