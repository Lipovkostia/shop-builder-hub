-- Update the handle_new_user trigger to auto-create store for sellers
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_profile_id uuid;
  generated_subdomain text;
BEGIN
  -- Create profile
  INSERT INTO public.profiles (user_id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'customer')
  )
  RETURNING id INTO new_profile_id;
  
  -- If role = seller, automatically create a store
  IF COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'customer') = 'seller' THEN
    -- Generate unique subdomain from email
    generated_subdomain := lower(regexp_replace(
      split_part(NEW.email, '@', 1), 
      '[^a-z0-9]', '', 'g'
    )) || '-' || substr(md5(random()::text), 1, 4);
    
    INSERT INTO public.stores (owner_id, name, subdomain, status)
    VALUES (
      new_profile_id,
      'Мой магазин',
      generated_subdomain,
      'active'
    );
  END IF;
  
  RETURN NEW;
END;
$function$;