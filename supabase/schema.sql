-- UTFRide: Schema das tabelas ativas no Supabase, índices, RLS e RPCs seguras
-- Referência arquitetural: docs/architecture.md (§2.1, §2.2 e §6)

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;

-- 1. Tabelas principais
CREATE TABLE public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) > 0),
  email text NOT NULL,
  registration_number text NOT NULL DEFAULT '',
  whatsapp text NOT NULL DEFAULT '',
  is_email_confirmed boolean NOT NULL DEFAULT true,
  role text NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'support')),
  is_blocked boolean NOT NULL DEFAULT false,
  rating_average numeric(3, 2) NOT NULL DEFAULT 0 CHECK (rating_average >= 0 AND rating_average <= 5),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_email_lower_uidx
  ON public.users (lower(email));

CREATE UNIQUE INDEX users_registration_number_uidx
  ON public.users (registration_number)
  WHERE char_length(trim(registration_number)) > 0;

CREATE TABLE public.rides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  origin text NOT NULL CHECK (char_length(trim(origin)) > 0),
  destination text NOT NULL CHECK (char_length(trim(destination)) > 0),
  departure_time timestamptz NOT NULL,
  available_seats integer NOT NULL CHECK (available_seats >= 0 AND available_seats <= total_seats),
  total_seats integer NOT NULL CHECK (total_seats BETWEEN 1 AND 4),
  price_per_seat numeric(10, 2) NOT NULL CHECK (price_per_seat >= 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'full', 'completed', 'cancelled')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX rides_driver_id_idx ON public.rides (driver_id);
CREATE INDEX rides_status_departure_idx ON public.rides (status, departure_time);

CREATE TABLE public.ride_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  passenger_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ride_requests_ride_id_idx ON public.ride_requests (ride_id);
CREATE INDEX ride_requests_passenger_id_idx ON public.ride_requests (passenger_id);
CREATE UNIQUE INDEX ride_requests_active_pair_uidx
  ON public.ride_requests (ride_id, passenger_id)
  WHERE status IN ('pending', 'accepted');

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  ride_id uuid NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  message text NOT NULL CHECK (char_length(trim(message)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notifications_recipient_id_idx ON public.notifications (recipient_id);
CREATE INDEX notifications_ride_id_idx ON public.notifications (ride_id);

-- 2. Privilégios mínimos na Data API
REVOKE ALL ON public.users, public.rides, public.ride_requests, public.notifications FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rides TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ride_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;

-- 3. Funções auxiliares privadas para RLS (schema private não exposto na API REST)
CREATE OR REPLACE FUNCTION private.is_active_student()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = (SELECT auth.uid())
      AND is_blocked = false
      AND role <> 'support'
  );
$$;

CREATE OR REPLACE FUNCTION private.is_ride_driver(p_ride_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.rides
    WHERE id = p_ride_id
      AND driver_id = (SELECT auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION private.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role FROM public.users WHERE id = (SELECT auth.uid());
$$;

CREATE OR REPLACE FUNCTION private.current_user_is_blocked()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT is_blocked FROM public.users WHERE id = (SELECT auth.uid());
$$;

REVOKE ALL ON FUNCTION private.is_active_student() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_active_student() TO authenticated;

REVOKE ALL ON FUNCTION private.is_ride_driver(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_ride_driver(uuid) TO authenticated;

REVOKE ALL ON FUNCTION private.current_user_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.current_user_role() TO authenticated;

REVOKE ALL ON FUNCTION private.current_user_is_blocked() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.current_user_is_blocked() TO authenticated;

-- Impede reatribuição de colunas imutáveis em UPDATE
CREATE OR REPLACE FUNCTION private.prevent_immutable_ride_request_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.ride_id IS DISTINCT FROM OLD.ride_id OR NEW.passenger_id IS DISTINCT FROM OLD.passenger_id THEN
    RAISE EXCEPTION 'Cannot change ride_id or passenger_id on ride_requests';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ride_requests_immutable_fields
  BEFORE UPDATE ON public.ride_requests
  FOR EACH ROW
  EXECUTE FUNCTION private.prevent_immutable_ride_request_fields();

-- 4. Habilitar RLS em todas as tabelas
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Políticas: users (dono: id)
CREATE POLICY users_select_own ON public.users
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = id);

CREATE POLICY users_insert_own ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = id
    AND role = 'student'
    AND is_blocked = false
  );

CREATE POLICY users_update_own ON public.users
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK (
    (SELECT auth.uid()) = id
    AND role = (SELECT private.current_user_role())
    AND is_blocked = (SELECT private.current_user_is_blocked())
  );

-- Políticas: rides (dono: driver_id)
CREATE POLICY rides_select_authenticated ON public.rides
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY rides_insert_driver ON public.rides
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = driver_id
    AND (SELECT private.is_active_student())
  );

CREATE POLICY rides_update_driver ON public.rides
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = driver_id)
  WITH CHECK ((SELECT auth.uid()) = driver_id);

CREATE POLICY rides_delete_driver ON public.rides
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = driver_id);

-- Políticas: ride_requests (dono: passenger_id; motorista da carona tem co-acesso para leitura e decisão)
CREATE POLICY ride_requests_select_involved ON public.ride_requests
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = passenger_id
    OR (SELECT private.is_ride_driver(ride_id))
  );

CREATE POLICY ride_requests_insert_passenger ON public.ride_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = passenger_id
    AND (SELECT private.is_active_student())
    AND NOT (SELECT private.is_ride_driver(ride_id))
    AND status = 'pending'
  );

CREATE POLICY ride_requests_update_involved ON public.ride_requests
  FOR UPDATE
  TO authenticated
  USING (
    ((SELECT auth.uid()) = passenger_id AND status = 'pending')
    OR (SELECT private.is_ride_driver(ride_id))
  )
  WITH CHECK (
    ((SELECT auth.uid()) = passenger_id AND status = 'cancelled')
    OR ((SELECT private.is_ride_driver(ride_id)) AND status IN ('accepted', 'rejected', 'cancelled'))
  );

CREATE POLICY ride_requests_delete_passenger ON public.ride_requests
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = passenger_id);

-- Políticas: notifications (dono: recipient_id)
CREATE POLICY notifications_select_recipient ON public.notifications
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = recipient_id);

CREATE POLICY notifications_insert_ride_driver ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT private.is_ride_driver(ride_id)));

CREATE POLICY notifications_update_recipient ON public.notifications
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = recipient_id)
  WITH CHECK ((SELECT auth.uid()) = recipient_id);

CREATE POLICY notifications_delete_recipient ON public.notifications
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = recipient_id);

-- 5. RPCs seguras expostas via /rest/v1/rpc/...
CREATE OR REPLACE FUNCTION public.check_registration_exists(
  p_email text,
  p_registration_number text DEFAULT ''
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE lower(email) = lower(trim(coalesce(p_email, '')))
       OR (
         char_length(trim(coalesce(p_registration_number, ''))) > 0
         AND registration_number = trim(p_registration_number)
       )
  );
$$;

REVOKE ALL ON FUNCTION public.check_registration_exists(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_registration_exists(text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_driver_summaries(p_driver_ids uuid[])
RETURNS TABLE (
  id uuid,
  name text,
  rating_average numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT u.id, u.name, u.rating_average
  FROM public.users u
  WHERE u.id = ANY(coalesce(p_driver_ids, ARRAY[]::uuid[]));
END;
$$;

REVOKE ALL ON FUNCTION public.get_driver_summaries(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_driver_summaries(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_passenger_trip_summaries()
RETURNS TABLE (
  id uuid,
  status text,
  ride jsonb,
  driver jsonb,
  whatsapp text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    rr.id,
    rr.status,
    jsonb_build_object(
      'origin', r.origin,
      'destination', r.destination,
      'departureTime', r.departure_time,
      'pricePerSeat', r.price_per_seat,
      'status', r.status
    ) AS ride,
    jsonb_build_object(
      'name', d.name,
      'ratingAverage', d.rating_average
    ) AS driver,
    CASE
      WHEN rr.status = 'accepted'
       AND r.status IN ('active', 'full')
       AND char_length(trim(d.whatsapp)) > 0
      THEN trim(d.whatsapp)
      ELSE NULL
    END AS whatsapp
  FROM public.ride_requests rr
  JOIN public.rides r ON r.id = rr.ride_id
  JOIN public.users d ON d.id = r.driver_id
  WHERE rr.passenger_id = v_uid
  ORDER BY rr.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_passenger_trip_summaries() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_passenger_trip_summaries() TO authenticated;
