
# Cron Yonetimi Sayfasi

## Ozet
Super Admin paneline yeni bir "Cron Yonetimi" sekmesi eklenecek. Bu sekme, tum sunucularin otomatik senkronizasyon zamanlamalarini yonetmeye, cron calisma gecmisini izlemeye ve hatalari goruntulemeye olanak taniyacak.

## Mevcut Durum
- Sistemde 4 adet cron job tanimli (UTC 00, 06, 12, 18 - Turkiye saatiyle 03, 09, 15, 21)
- Tum sunucular ayni cron ile tetikleniyor (tek bir `cronSync` action'i tum sunucu/firma ciftlerini sirayla isliyor)
- `sync_history` tablosunda her senkronizasyonun detayli kaydi tutuluyor (basari/hata, kayit sayilari, sure)
- `cron.job` ve `cron.job_run_details` tablolari pg_cron tarafindan yonetiliyor

## Plan

### 1. Veritabani: Sunucu Bazli Cron Yapilandirma Tablosu (Migration)

Yeni bir `cron_schedules` tablosu olusturulacak. Her sunucu/firma cifti icin bagimsiz cron zamanlama yapilandirmasi tutacak:

```sql
CREATE TABLE public.cron_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sunucu_adi text NOT NULL,
  firma_kodu text NOT NULL,
  schedule_name text NOT NULL,        -- "sync-1", "sync-2" gibi
  cron_expression text NOT NULL,       -- "0 0 * * *" (cron syntax)
  turkey_time_label text,             -- "03:00" (gosterim icin)
  is_enabled boolean DEFAULT true,
  pg_cron_jobid bigint,              -- cron.job tablosundaki gercek job id
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(sunucu_adi, firma_kodu, schedule_name)
);
```

RLS: Sadece super_admin erisebilir.

Ayrica bir `get_cron_run_history` RPC fonksiyonu:
- `cron.job_run_details` tablosundan son calismalari dondurur (SECURITY DEFINER)

### 2. Edge Function: Cron CRUD Islemleri

`dia-data-sync` edge function'a yeni action'lar eklenecek:
- `manageCronSchedules`: Cron zamanlama olusturma/guncelleme/silme
- Bu action, `cron.schedule()` ve `cron.unschedule()` SQL fonksiyonlarini cagirarak pg_cron job'larini yonetecek
- Her sunucu icin ayri cron job'lar olusturulacak (body'de `targetServer` parametresi ile)

### 3. Frontend: CronManagement Bileseni

Yeni `src/components/admin/CronManagement.tsx` bileseni:

**Sol Panel - Sunucu Listesi:**
- Tum sunucu/firma ciftleri listelenir
- Her sunucunun yaninda aktif cron sayisi ve son calisma durumu (yesil/kirmizi dot)

**Sag Panel - Secili Sunucu Detaylari:**

**a) Cron Zamanlamalari Karti:**
- Varsayilan 4 zaman dilimi gosterilir (03:00, 09:00, 15:00, 21:00 TR)
- Her zamanlama icin: acma/kapama switch'i, saat degistirme (select/input)
- "Zamanlama Ekle" butonu (yeni saat eklemek icin)
- "Zamanlama Sil" butonu
- Degisiklikleri kaydet butonu

**b) Son Calisma Gecmisi Karti:**
- `sync_history` tablosundan son 50 kayit (secili sunucu icin)
- Her satir: tarih, veri kaynagi, tip (cron/manual/single), durum (basari/hata), cekilen/yazilan kayit sayilari
- Hatali satirlar kirmizi vurgulanir, hata mesaji tooltip ile gosterilir
- Filtre: Sadece hatalar, sadece cron, tum kayitlar

**c) Cron Calisma Durumu Karti:**
- `cron.job_run_details`'den son 10 cron tetiklemesi
- Her biri icin: calisma zamani, sonuc (succeeded/failed), sure

### 4. Super Admin Panel Entegrasyonu

`SuperAdminPanel.tsx`'e yeni sidebar item eklenir:
```
{ key: 'cron', label: 'Cron Yonetimi', icon: Clock }
```

---

## Teknik Detaylar

### Cron Expression Donusumu
Kullanicinin sectigi Turkiye saati UTC'ye cevrilir:
- TR 03:00 -> UTC 00:00 -> `0 0 * * *`
- TR 09:00 -> UTC 06:00 -> `0 6 * * *`

### Sunucu Bazli Cron Job'lar
Mevcut tek cron yerine, her sunucu icin ayri job'lar olusturulacak. Body'de `targetServer` parametresi gondererek `cronSync`'in sadece o sunucuyu islemesi saglanacak.

```sql
SELECT cron.schedule(
  'dia-sync-rotayazilim-03tr',
  '0 0 * * *',
  $$SELECT net.http_post(
    url := '...',
    body := '{"action":"cronSync","targetServer":"rotayazilim","targetFirma":"20"}'::jsonb
  )$$
);
```

### Varsayilan Yapilandirma
Yeni sunucu eklendiginde veya ilk acildiginda, sunucunun henuz cron'u yoksa "4 varsayilan zamanlama olustur" butonu gosterilir.

### Dosya Degisiklikleri
1. **Migration**: `cron_schedules` tablosu + RLS + `get_cron_run_history` RPC
2. **Edge Function**: `dia-data-sync/index.ts` - `manageCronSchedules` action + `cronSync`'e `targetServer` destegi
3. **Yeni Dosya**: `src/components/admin/CronManagement.tsx`
4. **Duzenleme**: `src/pages/SuperAdminPanel.tsx` - sidebar'a cron sekmesi ekleme
