-- profiles tablosuna dönem yılı bilgisi ekle
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS donem_yili TEXT;