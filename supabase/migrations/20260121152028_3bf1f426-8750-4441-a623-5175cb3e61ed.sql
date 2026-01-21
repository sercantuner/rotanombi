-- Insert super_admin user (rotanombi@rotayazilim.net) 
-- Note: The actual auth.users creation will be done via signup, but we prepare the role assignment

-- First, ensure sercantuner@rotayazilim.net loses admin privileges (becomes regular user)
-- We'll update their role when they exist
UPDATE public.user_roles 
SET role = 'user' 
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'sercantuner@rotayazilim.net'
);

-- Create a function to auto-assign super_admin role to rotanombi@rotayazilim.net on signup
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-assign super_admin role
DROP TRIGGER IF EXISTS on_super_admin_signup ON auth.users;
CREATE TRIGGER on_super_admin_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_super_admin_signup();