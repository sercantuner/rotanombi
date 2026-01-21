-- profiles tablosuna firma_adi ekle
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS firma_adi TEXT;