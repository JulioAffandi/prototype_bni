DROP TABLE IF EXISTS public.idempotency_keys CASCADE;

CREATE TABLE public.idempotency_keys (
  key                 uuid NOT NULL,
  endpoint            text NOT NULL,
  actor_user_id       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  request_fingerprint text NOT NULL,
  response_snapshot   jsonb,
  response_status     smallint,
  status              text NOT NULL DEFAULT 'PROCESSING',
  created_at          timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz,
  expires_at          timestamptz NOT NULL DEFAULT (now() + interval '48 hours'),
  CONSTRAINT pk_idempotency PRIMARY KEY (endpoint, key)
);

ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;
