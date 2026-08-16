CREATE OR REPLACE FUNCTION public.digest(text, text)
RETURNS bytea
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT extensions.digest($1, $2);
$$;
