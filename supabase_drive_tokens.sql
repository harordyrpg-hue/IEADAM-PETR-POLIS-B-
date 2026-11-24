-- Tabela somente-servidor para armazenar o refresh token do Google Drive da igreja.
-- RLS ativado sem políticas públicas: somente a chave service_role (usada no backend Express) tem acesso.

CREATE TABLE IF NOT EXISTS public.google_drive_tokens (
  id TEXT PRIMARY KEY DEFAULT 'church_drive',
  refresh_token TEXT NOT NULL,
  access_token TEXT,
  access_token_expires_at TIMESTAMPTZ,
  account_email TEXT,
  account_name TEXT,
  folder_id TEXT,
  folder_name TEXT DEFAULT 'PT-B Mídia',
  thumbs_folder_id TEXT,
  scope TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.google_drive_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.google_drive_tokens FROM anon, authenticated;
GRANT ALL ON TABLE public.google_drive_tokens TO service_role;

