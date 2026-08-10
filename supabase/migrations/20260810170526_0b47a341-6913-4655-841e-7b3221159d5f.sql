ALTER TABLE public.whatsapp_threads
  ADD COLUMN IF NOT EXISTS external_thread_id text,
  ADD COLUMN IF NOT EXISTS criteria_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS criteria_confirmed_by uuid REFERENCES public.profiles(id);

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_threads_external_uidx
  ON public.whatsapp_threads (org_id, external_thread_id)
  WHERE external_thread_id IS NOT NULL;

ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS external_message_id text,
  ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'received',
  ADD COLUMN IF NOT EXISTS failure_reason text;

ALTER TABLE public.whatsapp_messages
  DROP CONSTRAINT IF EXISTS whatsapp_messages_delivery_status_check;
ALTER TABLE public.whatsapp_messages
  ADD CONSTRAINT whatsapp_messages_delivery_status_check
  CHECK (delivery_status IN ('received','queued','sent','failed'));

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_messages_external_uidx
  ON public.whatsapp_messages (org_id, external_message_id)
  WHERE external_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS whatsapp_messages_thread_idx
  ON public.whatsapp_messages (thread_id, sent_at);

ALTER TABLE public.whatsapp_extracts
  ADD COLUMN IF NOT EXISTS serious_flag_reason text,
  ADD COLUMN IF NOT EXISTS reviewer_seriousness text,
  ADD COLUMN IF NOT EXISTS reviewer_decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewer_decided_by uuid REFERENCES public.profiles(id);

ALTER TABLE public.whatsapp_extracts
  DROP CONSTRAINT IF EXISTS whatsapp_extracts_reviewer_seriousness_check;
ALTER TABLE public.whatsapp_extracts
  ADD CONSTRAINT whatsapp_extracts_reviewer_seriousness_check
  CHECK (reviewer_seriousness IS NULL OR reviewer_seriousness IN ('Serious','Non-serious'));