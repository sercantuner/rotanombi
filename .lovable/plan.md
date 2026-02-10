

# Veritabanı Sorgu Timeout Sorunu - Cozum Plani

## Sorunun Analizi

Dashboard acildiginda veriler `company_data_cache` tablosundan cekilmeye calisiyor ancak sorgular **statement timeout** hatasi veriyor. Bu nedenle sistem DB yerine DIA API'ye dusuyor (kontor harciyor) veya tamamen basarisiz oluyor.

### Kok Neden

Tablo 424,000+ satir iceriyor. Her sorgu icin RLS (Row Level Security) politikasi su kontrolu yapiyor:

```text
Her satir icin --> profiles tablosundan kullanicinin sunucu_adi ve firma_kodu eslestirilir
```

Bu, 424K satirin her biri icin ayri bir alt sorgu anlamina geliyor ve buyuk tablolarda timeout'a neden oluyor.

Ek olarak:
- 86K dead tuple (temizlenmemis silinen satirlar) performansi dusuruyor
- JSONB projeksiyon islemi (jsonb_each + jsonb_object_agg) agir
- Birden fazla veri kaynagi ayni anda sorgulanarak veritabani ek yuk altina giriyor

## Cozum Adimlari

### Adim 1: RLS Politikasini Optimize Et

Mevcut politikayi kaldirip, `auth.uid()` ile profil eslestirmesini onbellekleyen daha hizli bir politika ile degistir. `EXISTS` icindeki JOIN yerine, `profiles` tablosunu her satir icin sorgulamadan calistir:

```sql
-- Eski (yavas): Her satir icin profiles tablosuna bakiyor
EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND ...)

-- Yeni (hizli): auth.jwt() icindeki bilgiyi dogrudan kullan
-- VEYA profiles sorgusu icin fonksiyon + SECURITY DEFINER kullan
```

Strateji: `SECURITY DEFINER` bir SQL fonksiyon olusturarak kullanicinin sunucu_adi ve firma_kodu bilgisini tek seferde cekip RLS icinde kullanmak. Bu sayede 424K satir icin 424K alt sorgu yerine sadece 1 alt sorgu calisir.

### Adim 2: VACUUM Calistir

86K dead tuple temizlenerek tablo boyutu ve sorgu performansi iyilestirilir.

```sql
VACUUM ANALYZE company_data_cache;
```

### Adim 3: get_projected_cache_data RPC'yi Optimize Et

Mevcut RPC fonksiyonu RLS'den gectiginden ayni sorundan etkileniyor. Fonksiyonu `SECURITY DEFINER` olarak yeniden tanimlayip, icinde kullanici yetki kontrolu yaparak RLS bypass edecek sekilde guncelleyecegiz. Bu, performansi dramatik olarak arttirir.

### Adim 4: Frontend Seri Yukleme

Birden fazla veri kaynagini ayni anda sorgulamak yerine, sirayla (seri) yuklemeye devam et (mevcut kod zaten bunu yapiyor). Ancak timeout sonrasi gereksiz API cagrisi yapmamasi icin retry mantigi eklenmeli.

## Teknik Detaylar

### Yeni RLS Yardimci Fonksiyonu

```sql
CREATE OR REPLACE FUNCTION get_user_company_scope()
RETURNS TABLE(sunucu_adi TEXT, firma_kodu TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.dia_sunucu_adi, p.firma_kodu
  FROM profiles p
  WHERE p.user_id = auth.uid()
  LIMIT 1;
$$;
```

### Yeni RLS Politikasi

```sql
-- Eski politikayi kaldir
DROP POLICY "Users can view their company data" ON company_data_cache;

-- Yeni optimize politika
CREATE POLICY "Users can view their company data" ON company_data_cache
FOR SELECT USING (
  (sunucu_adi, firma_kodu) IN (SELECT * FROM get_user_company_scope())
);
```

### Optimize get_projected_cache_data

Fonksiyonu `SECURITY DEFINER` yapip iceride yetki kontrolu yaparak RLS'yi bypass et. Bu, sorgu suresini saniyelerden milisaniyelere dusurur.

## Beklenen Sonuc

- DB sorgulari timeout yerine 100ms-500ms icinde tamamlanir
- Dashboard acildiginda veri aninda DB'den yuklenir
- DIA API'ye dusme (kontor harcama) tamamen onlenir
- 424K satirlik tabloda bile hizli calisir

