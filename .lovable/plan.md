

# Landing Page Guncellemeleri

## 1. Dark Mode RotanomBI Logosu
Yuklenen `RotanomBI_dark.svg` dosyasi `src/assets/rotanombi-logo-dark.svg` olarak kaydedilecek. Header'da tema kontrolu eklenerek dark modda bu logo, light modda mevcut PNG logo kullanilacak.

## 2. Aktif Kullanici Sayisi Sorunu
Profiles tablosunda anonim kullanicilar icin SELECT izni yok (RLS). Bu nedenle count sorgusu 0/null donuyor ve fallback deger (7) kullaniliyor. Gercek veri icin iki secenek var:
- **Secilen Cozum**: Bir veritabani fonksiyonu (`get_landing_stats`) olusturulacak. Bu fonksiyon `SECURITY DEFINER` olarak calisip profiles ve widgets tablolarindan gercek sayilari dondurecek. Boylece anonim kullanicilar bile gercek istatistikleri gorebilecek.

## 3. AI Widget Uretici Ozelliginin Kaldirilmasi
Bu ozellik sadece super admin'lere acik oldugu icin landing page'deki "Ozellikler" bolumunden cikarilacak. Yerine kullanicilarin erisebilecegi bir ozellik eklenecek (ornegin "Ozel Raporlama").

## Teknik Detaylar

### Veritabani Degisikligi
Yeni bir `get_landing_stats()` fonksiyonu olusturulacak:
```sql
CREATE OR REPLACE FUNCTION public.get_landing_stats()
RETURNS TABLE(user_count bigint, widget_count bigint, ai_widget_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    (SELECT count(*) FROM profiles) as user_count,
    (SELECT count(*) FROM widgets WHERE is_active = true) as widget_count,
    (SELECT count(*) FROM widgets WHERE builder_config IS NOT NULL) as ai_widget_count;
$$;
```

### Dosya Degisiklikleri

| Dosya | Islem |
|---|---|
| `src/assets/rotanombi-logo-dark.svg` | Yeni - dark mode logosu |
| `src/pages/LandingPage.tsx` | Header'da tema bazli logo, `useLiveStats` RPC cagrisina gecis, AI Widget feature kaldirilip yerine "Ozel Raporlama" eklenmesi |

### LandingPage.tsx Detayli Degisiklikler
- **Import**: `rotanombiLogoDark` import'u eklenir
- **LandingHeader**: `useTheme()` ile dark/light logo secimi yapilir
- **useLiveStats**: `supabase.rpc('get_landing_stats')` kullanilarak gercek veriler cekilir
- **features dizisi**: "AI Widget Uretici" maddesi cikarilir, yerine "Ozel Raporlama" eklenir (5 ozellik kalir veya alternatif eklenir)

