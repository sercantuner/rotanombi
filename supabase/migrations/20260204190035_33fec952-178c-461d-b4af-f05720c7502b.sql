-- Yeni harita container tiplerini ekle
ALTER TYPE public.container_type ADD VALUE IF NOT EXISTS 'map_full';
ALTER TYPE public.container_type ADD VALUE IF NOT EXISTS 'map_half';