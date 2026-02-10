

## Timezone Duzeltmesi ve Kasa Verisi Guncellik Sorunu

### Sorun Analizi

**1. Kasa verisi 5 gun eski:**
- Veritabanindaki MERKEZ KASA TL bakiyesi: **125.920,60 TL** (Donem 2) ve **123.569,45 TL** (Donem 3)
- Gercek deger DIA'da: **105.754,79 TL**
- Son sync: **5 Subat 2026** - 5 gundur yeni veri cekilmemis
- 9 Subat'ta girilen hareketler hic senkronize edilmemis

**2. Timezone sorunu:**
- Tum edge function'larda `new Date()` kullaniliyor (UTC)
- `getToday()` fonksiyonu `new Date().toISOString().split("T")[0]` ile tarih hesapliyor - bu UTC'de gece yarisi sonrasi Turkiye saatiyle sabah 03:00'e kadar bir onceki gunu dondurur
- Vade hesaplamalari, tarih filtreleri ve "son guncelleme" gosterimleri 3 saat kaymali

### Cozum Plani

#### 1. Turkiye Saat Dilimi Yardimci Fonksiyonu (Yeni Dosya)
`supabase/functions/_shared/turkeyTime.ts` dosyasi olusturulacak:
- `getTurkeyNow()`: UTC+3 olarak simdi
- `getTurkeyToday()`: UTC+3'e gore bugunun tarihini (YYYY-MM-DD) dondurur
- `getTurkeyMonthStart()`: Ayin ilk gunu (UTC+3)
- `toTurkeyDate(date)`: Herhangi bir Date objesini Turkiye saatine cevirir

#### 2. Edge Function Guncellemeleri
Asagidaki dosyalardaki `getToday()`, `new Date()` ve vade hesaplamalarindaki tarih kullanimi duzeltilecek:

**supabase/functions/dia-genel-rapor/index.ts:**
- `getToday()` -> `getTurkeyToday()` kullanacak
- `hesaplaGunFarki()` ve `hesaplaGecikme()` fonksiyonlarindaki `new Date()` -> `getTurkeyNow()` olacak
- Yaslandirma hesaplarindaki `bugun` degiskenleri Turkiye saati kullanacak

**supabase/functions/dia-finans-rapor/index.ts:**
- `getToday()` -> `getTurkeyToday()`
- Yaslandirma hesaplarindaki `bugun` -> `getTurkeyNow()`

**supabase/functions/dia-satis-rapor/index.ts:**
- `getToday()` -> `getTurkeyToday()`
- `getMonthStart()` -> `getTurkeyMonthStart()`

**supabase/functions/dia-api-test/index.ts:**
- `tarihreferans` parametresindeki `new Date().toISOString().split('T')[0]` -> `getTurkeyToday()`

#### 3. Frontend "Son Guncelleme" Gosterimi
`src/components/sync/SyncButton.tsx` dosyasindaki `formatDistanceToNow` cagirisi zaten dogru calisiyor (UTC timestamp'i local'e cevirir). Ancak DIA verilerinden gelen `sonGuncelleme` alanlari da Turkiye saatiyle uretilecek.

#### 4. Kasa Verisi Icin Aninda Cozum
Kasa verisi sync yapildiginda guncel bakiye gelecektir. Timezone duzeltmesi sayesinde `tarihreferans` parametresi dogru gunu gonderecek ve DIA dogru bakiyeyi dondurecek.

### Degistirilecek Dosyalar
- `supabase/functions/_shared/turkeyTime.ts` (YENI)
- `supabase/functions/dia-genel-rapor/index.ts`
- `supabase/functions/dia-finans-rapor/index.ts`
- `supabase/functions/dia-satis-rapor/index.ts`
- `supabase/functions/dia-api-test/index.ts`

### Etki Alani
- Vade yaslandirma hesaplari dogru gune gore yapilacak
- `tarihreferans` parametresi Turkiye saatine gore dogru tarihi gonderecek
- Gunluk/aylik satis hesaplari dogru tarih araligini kullanacak
- Gece 00:00-03:00 UTC arasindaki 3 saatlik kayma sorunu ortadan kalkacak
