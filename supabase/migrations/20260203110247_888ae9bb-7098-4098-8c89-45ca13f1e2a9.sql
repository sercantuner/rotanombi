-- Update user_teams RLS policy to allow team admins (profiles.is_team_admin = true)
DROP POLICY IF EXISTS "Admins can manage their team" ON user_teams;

CREATE POLICY "Team admins can manage their team" ON user_teams
FOR ALL
TO authenticated
USING (
  admin_id = auth.uid() 
  OR is_admin(auth.uid())
  OR is_team_admin(auth.uid())
)
WITH CHECK (
  admin_id = auth.uid()
  OR is_admin(auth.uid())
  OR is_team_admin(auth.uid())
);