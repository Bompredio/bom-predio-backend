# Bom Prédio - Backend (MVP)

## Setup (via GitHub / Render / Railway)
1. Crie projeto e adicione variáveis de ambiente a partir de `.env.example`.
2. Deploy em Render ou Railway (ou outro host Node).
3. Endpoints principais:
   - GET /healthz
   - GET /condominios
   - POST /condominios
   - GET /condominios/:id/assembleias
   - POST /condominios/:id/assembleias
   - POST /assembleias/:id/votar
   - POST /docs/gerar-ata { assembleia_id, transcript }
   - GET /erp/:condominio_id/lancamentos
   - POST /erp/:condominio_id/lancamentos

## Observações
- Configure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_KEY`.
- Bucket: configure `SUPABASE_STORAGE_BUCKET` (ex.: `documents`).
