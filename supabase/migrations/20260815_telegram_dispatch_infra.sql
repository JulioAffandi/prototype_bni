-- Tracks consecutive delivery failures per chat so the Settings UI can warn the user
-- and so we stop wasting Telegram API calls on dead chat IDs.
CREATE TABLE IF NOT EXISTS public.telegram_link_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type varchar NOT NULL CHECK (entity_type IN ('parent','merchant','school')),
  entity_id uuid NOT NULL,
  chat_id text NOT NULL,
  consecutive_failures int NOT NULL DEFAULT 0,
  last_error_code int,
  last_attempt_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id)
);

-- Single-round-trip recipient resolution for the canteen tap hook.
-- Returns every guardian's chat id (array) + the merchant's chat id in one call.
CREATE OR REPLACE FUNCTION public.fn_get_telegram_targets(
  p_student_id uuid,
  p_merchant_id uuid
)
RETURNS TABLE (
  parent_chat_ids text[],
  merchant_chat_id text,
  student_full_name varchar,
  merchant_name varchar
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT array_agg(p.telegram_chat_id) FILTER (WHERE p.telegram_chat_id IS NOT NULL)
       FROM public.guardian_student_map gsm
       JOIN public.parents p ON p.id = gsm.parent_id
      WHERE gsm.student_id = p_student_id) AS parent_chat_ids,
    (SELECT m.telegram_chat_id FROM public.merchants m WHERE m.id = p_merchant_id) AS merchant_chat_id,
    (SELECT s.full_name FROM public.students s WHERE s.id = p_student_id) AS student_full_name,
    (SELECT m.name FROM public.merchants m WHERE m.id = p_merchant_id) AS merchant_name;
$$;
