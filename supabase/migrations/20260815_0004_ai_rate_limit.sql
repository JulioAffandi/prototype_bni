-- migrations/20260815_0004_ai_rate_limit.sql
BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_ai_consume_rate_limit(
  p_profile uuid, p_max_req int, p_window_minutes int
)
RETURNS TABLE (diizinkan boolean, sisa_request int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_window timestamptz := date_trunc('hour', now());
  v_count  int;
BEGIN
  INSERT INTO public.ai_rate_limit_counters (actor_profile_id, window_start, request_count)
  VALUES (p_profile, v_window, 1)
  ON CONFLICT (actor_profile_id, window_start)
  DO UPDATE SET request_count = public.ai_rate_limit_counters.request_count + 1
  RETURNING request_count INTO v_count;

  DELETE FROM public.ai_rate_limit_counters
  WHERE window_start < now() - make_interval(mins => p_window_minutes * 4);

  RETURN QUERY SELECT v_count <= p_max_req, greatest(0, p_max_req - v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_ai_consume_rate_limit(uuid, int, int) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_ai_consume_rate_limit(uuid, int, int) TO service_role;

COMMIT;