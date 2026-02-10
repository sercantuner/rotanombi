

## Artimsal Senkronizasyon Mimarisi (Guncellenmiis Plan)

### Temel Strateji: 3 Asamali Senkronizasyon

```text
ASAMA 1: Ilk Tam Cekme (Initial Full Sync)
  DIA'dan donem bilgilerini cek (tarih araliklari dahil)
  Her donem icin baslangic-bitis tarihleri arasindaki veriyi
  kucuk parcalar halinde (chunk) cek ve veritabanina yaz
  Tamamlaninca donem kilitlenir (is_locked = true)

ASAMA 2: Gece Cron (03:00 TR - Otomatik)
  Tum kayitli sunucularda calisir
  Sadece aktif (kilitli olmayan) donemler icin:
    _cdate >= bugun  -> yeni eklenen kayitlar
    _date >= son_sync -> degistirilen kayitlar
  Upsert ile veritabanina yaz

ASAMA 3: Gun Ici Anlik Guncelleme (On-Demand)
  Kullanici "Guncelle" dediginde veya otomatik olarak:
    _cdate >= bugun  -> bugun eklenen yeni kayitlar
    _date >= son_sync -> son sync'ten beri degisen kayitlar
  Sonuc: En guncel veriye saniyeler icinde erisim
```

### Neden Sadece `_cdate` Yeterli?

Kullanicinin belirttigi gibi: Bir kaydin isleem tarihi 2 ay oncesi olsa bile, o kayit bugun girilmisse `_cdate` (olusturma tarihi) bugun olacaktir. Dolayisiyla:

- `_cdate >= bugun` -> O gun eklenen TUM yeni kayitlari getirir (islem tarihi ne olursa olsun)
- `_date >= son_sync` -> Son sync'ten bu yana DEGISTIRILEN mevcut kayitlari getirir
- 2 aylik tampon gerekmez, cunku `_cdate` zaten kaydin sisteme giris tarihidir

### Detayli Degisiklikler

#### 1. Edge Function: `dia-data-sync/index.ts`

**Yeni Action: `incrementalSync`**

Bu action, `_cdate` ve `_date` filtreli DIA sorgulari atar:

```text
Mantik:
1. period_sync_status'tan last_incremental_sync tarihini al
2. Eger last_incremental_sync bos ise -> fullSync yap (ilk seferde)
3. Eger dolu ise:
   a. Sorgu 1: _cdate >= bugun (yeni kayitlar)
   b. Sorgu 2: _date >= last_incremental_sync (degisen kayitlar)
   c. Iki sonucu birlestir (_key bazli deduplicate)
   d. Upsert ile veritabanina yaz
4. last_incremental_sync tarihini guncelle
```

`fetchPage` fonksiyonuna `filters` parametresi eklenir:
```text
fetchPageWithFilters(sess, mod, met, dk, off, filters)
  -> DIA payload'ina filters dizisini ekler
  -> Ornek filters: [
       { field: "_cdate", operator: ">=", value: "2026-02-10" }
     ]
```

**Yeni Action: `cronSync`**

Cron job tarafindan tetiklenir. `CRON_SECRET` header'i ile dogrulanir.

```text
Mantik:
1. profiles tablosundan DISTINCT dia_sunucu_adi, firma_kodu ciftlerini cek
   (su an 6 sunucu: corlugrup, eguncel, genisdepo, omnitek, pakun, rotayazilim)
2. Her sunucu icin:
   a. O sunucuya bagli bir kullanicinin user_id'sini bul (session acmak icin)
   b. firma_periods tablosundan aktif donemleri al
   c. data_sources tablosundan aktif kaynaklari al
   d. Her kaynak icin:
      - Kilitli donem -> atla
      - Aktif donem -> incrementalSync cagir (_cdate/_date filtreli)
   e. Hata olursa logla, diger kaynaklara/sunuculara devam et
```

**Ilk Tam Cekme Mantigi (fullSync icinde)**

Mevcut `syncAll` mantigi korunur ama tamamlaninca donem kilitlenir:
```text
Bir donem icin tum kaynaklar basariyla cekildikten sonra:
  period_sync_status.is_locked = true
  period_sync_status.last_full_sync = now()
```

Aktif donem (is_current = true) HICBIR ZAMAN kilitlenmez, her zaman incremental guncelleme alir.

#### 2. `fetchPageSimple` -> `fetchPageWithFilters`

Mevcut `fetchPageSimple` fonksiyonu genisletilerek opsiyonel `filters` parametresi alir:

```text
fetchPageWithFilters(sess, mod, met, dk, off, filters?)
  -> filters varsa DIA payload'ina eklenir:
     pl[fm].filters = filters
  -> filters yoksa mevcut davranis (tum veri)
```

Bu sayede ayni fonksiyon hem full sync hem incremental sync icin kullanilir.

#### 3. Veritabani: `pg_cron` Job

```text
pg_cron ve pg_net extension'lari aktif edilir
Cron job: Her gece 00:00 UTC (03:00 TR)
  -> dia-data-sync edge function'ina POST
  -> body: { action: 'cronSync' }
  -> header: x-cron-secret: CRON_SECRET
```

#### 4. Secret: `CRON_SECRET`

Yeni bir secret eklenir. Cron job'un edge function'a yetkili erisimi icin.

#### 5. Frontend: `useSyncOrchestrator.tsx` (Yeni Hook)

Buyuk veri setleri icin frontend orkestrasyon hook'u:

```text
Mantik:
1. Aktif kaynaklari ve donemleri listele
2. Her (kaynak, donem) cifti icin:
   a. Donem kilitli mi? -> Atla
   b. Ilk sync mi? -> syncChunk (full, chunk bazli)
   c. Sonraki sync'ler -> incrementalSync (_cdate/_date filtreli)
3. Hata durumunda 3 kez retry (2s, 4s, 8s backoff)
4. Kaynak bazinda ilerleme goster
5. Bir kaynakta hata olursa digerlerine devam et
```

Ilerleme bilgisi:
- Hangi kaynak isleniyor
- Kac kayit cekildi
- Genel yuzde

#### 6. Frontend: SyncButton ve DataManagementTab

- SyncButton: "Son otomatik guncelleme: ..." gosterir
- DataManagementTab: Kaynak bazinda son sync zamani, kayit sayisi, donem kilitleme durumu

### Performans Etkisi

| Senaryo | Full Sync | Incremental (_cdate/_date) |
|---------|-----------|----------------------------|
| 50K fatura - gunluk | 50K kayit | ~50-200 kayit |
| 250K fatura (5x) - gunluk | 250K kayit | ~250-1000 kayit |
| Edge fn suresi | 30-60sn (timeout riski) | 1-3sn |
| DIA kontor | Cok yuksek | Minimum |
| Gun ici guncelleme | Imkansiz | Anlik |

### Donem Yonetimi

```text
corlugrup ornegi:
  Donem 1 (2024-01-01 / 2024-12-31): Full sync -> kilitle -> bir daha cekilmez
  Donem 2 (2025-01-01 / 2025-12-31): Full sync -> kilitle -> bir daha cekilmez  
  Donem 3 (2026-01-01 / 2026-12-31, aktif): Incremental -> her gece _cdate/_date
```

### Degistirilecek/Olusturulacak Dosyalar

1. **supabase/functions/dia-data-sync/index.ts** - `incrementalSync`, `cronSync` action'lari, `fetchPageWithFilters` fonksiyonu
2. **src/hooks/useSyncOrchestrator.tsx** - Yeni frontend orkestrasyon hook'u
3. **src/components/sync/SyncButton.tsx** - Ilerleme gostergesi ve son sync bilgisi
4. **src/components/settings/DataManagementTab.tsx** - Donem kilitleme UI, kaynak bazinda durum
5. **SQL Migration** - pg_cron job olusturma
6. **Secret** - CRON_SECRET ekleme

