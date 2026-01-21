-- Fix function search path security issue
CREATE OR REPLACE FUNCTION public.handle_super_admin_signup()
RETURNS TRIGGER AS $$
BEGIN
  -- If the new user is rotanombi@rotayazilim.net, assign super_admin role
  IF NEW.email = 'rotanombi@rotayazilim.net' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;