-- Add chart_color_palette column to app_settings table
ALTER TABLE public.app_settings 
ADD COLUMN chart_color_palette TEXT DEFAULT 'corporate';