---
title: Bom Prédio - Arquitetura MVP
---
flowchart TD
  subgraph FRONTEND
    A[Vercel (React SPA) - Netlify possible] 
  end

  subgraph BACKEND
    B(Railway / Render - Node + Express)
    B --> C[Supabase (Postgres + Auth + Storage) - Region: EU]
    B --> D[OpenAI (chat + audio placeholder) - Free Tier]
    B --> E[Jitsi (RTC embed)]
  end

  A -->|HTTP / REST / GraphQL| B
  A -->|Embed iFrame| E
  B -->|Signed URLs / Storage| C
  B -->|Transcription / Prompts| D
  C -->|Storage for documents (signed URLs)| A
  note right of C
    GDPR: DB + Storage in EU region.
  end
