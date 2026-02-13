
# Cron Senkronizasyon Sistemini Yeniden Yapılandırma

## Sorunun Kök Nedeni

Edge function'dan `cronSync` ve `manageCronSchedules` aksiyonları tamamen eksik. pg_cron job'ları her gün zamanında HTTP isteklerini gonderiyor, ancak edge function "Unknown action" hatasi donduruyor. pg_cron bunu basarili olarak raporluyor cunku sadece HTTP isteginin gonderilip gonderilmedigini kontrol ediyor, yanitini degil.

## Cozum Plani

### Adim 1: Edge Function'a `cronSync` Aksiyonu Ekleme

`supabase/functions/dia-data-sync/index.ts` dosyasina yeni bir `cronSync` handler eklenecek:

- Kimlik dogrulama: `x-cron-secret` header'i veya `cronSecret` body parametresi ile CRON_SECRET kontrolu (kullanici auth'u gerektirmez)
- `targetServer` ve `targetFirma` parametreleri ile hangi sunucunun senkronize edilecegini belirler
- Parametre yoksa: `cron_schedules` tablosundan aktif tum sunuculari bulur ve sirayla isler
- Her sunucu icin:
  1. O sunucuya ait bir kullaniciyi `profiles` tablosundan bulur (DIA credentials icin)
  2. `sync_locks` kontrolu yapar (zaten calisan varsa atlar)
  3. Aktif `data_sources` listesini ceker
  4. `firma_periods` tablosundan donemleri alir
  5. Her veri kaynagi + donem icin incremental sync yapar (daha once full sync yapilmissa)
  6. Full sync yapilmamissa atlar (ilk full sync manuel tetiklenmeli)
  7. Sonuclari `sync_history` tablosuna yazar

Cron sync akisi:
```text
pg_cron tetikler
  --> dia-data-sync?action=cronSync&targetServer=X&targetFirma=Y
    --> profiles'dan kullanici bul (DIA credentials)
    --> sync_locks kontrolu
    --> data_sources listesi
    --> her kaynak icin incrementalSync calistir
    --> sync_history'ye kaydet
```

### Adim 2: Edge Function'a `manageCronSchedules` Aksiyonu Ekleme

UI'dan zamanlama kaydetme isleminin pg_cron'a yansimasi icin:

- `cron_schedules` tablosundaki kayitlari okur
- Aktif olanlar icin `cron.schedule()` SQL komutu calistirir
- Deaktif olanlar icin `cron.unschedule()` calistirir
- Her cron job'un body'sine `targetServer` ve `targetFirma` ekler (sunucu bazli tetikleme)
- Basarili olursa `pg_cron_jobid` alanini gunceller

### Adim 3: Mevcut pg_cron Job'larini Temizleme

Eski calismayen genel `cronSync` job'lari (dia-sync-00utc, dia-sync-06utc vb.) kaldirilacak. Sadece sunucu bazli job'lar (`dia-sync-corlugrup-1-sync-1` gibi) kalacak ve dogru formatta guncellenecek.

SQL migration ile:
- Eski 4 genel job'u (`dia-sync-00utc` vb.) `cron.unschedule()` ile kaldir
- Mevcut sunucu bazli job'larin body formatini `cronSync` + `targetServer` + `targetFirma` + dogru secret ile guncelle

### Adim 4: UI Iyilestirmeleri (CronManagement.tsx)

- Yesil/kirmizi nokta: `sync_history` yerine `cron.job_run_details` + edge function log sonuclarina gore goster
- Cron calisma gecmisinde: Sadece ilgili sunucunun job'larini filtrele
- Zamanlama kaydedildiginde `manageCronSchedules` basarili olursa `pg_cron_jobid` guncelle ve UI'da goster

### Teknik Detaylar

**cronSync handler yapisi:**
```text
1. Secret dogrula (CRON_SECRET)
2. targetServer/targetFirma'yi al
3. profiles'dan kullanici bul
4. sync_locks kontrol et (varsa atla)
5. Kilit al (30dk TTL)
6. data_sources listele (is_active=true, is_non_dia=false)
7. firma_periods'dan donemleri al
8. Her kaynak+donem icin:
   - period_sync_status kontrol et
   - last_full_sync varsa -> incrementalSync
   - yoksa -> atla (log birak)
9. Kilidi birak
10. sync_history'ye "cron" tipiyle kaydet
```

**manageCronSchedules handler yapisi:**
```text
1. Auth kontrolu (super_admin)
2. schedules dizisini al
3. Her schedule icin:
   - is_enabled=true: cron.schedule() calistir
   - is_enabled=false: cron.unschedule() calistir
4. pg_cron_jobid'leri cron_schedules tablosuna kaydet
```

**Edge function timeout sorunu:** Cron sync birden fazla veri kaynagini sirayla isleyecegi icin 60 saniyelik edge function limitine dikkat edilmeli. Her veri kaynagi icin ayri bir `incrementalSync` cagrisi yapilacak, timeout riski olursa sonraki cron tetiklemesinde devam edilecek.

### Dosya Degisiklikleri

1. `supabase/functions/dia-data-sync/index.ts` - cronSync ve manageCronSchedules aksiyonlari ekleme
2. `src/components/admin/CronManagement.tsx` - Yesil nokta mantigi ve calisma gecmisi iyilestirmesi
3. SQL migration - Eski genel cron job'larini temizleme ve mevcut job'lari guncelleme
