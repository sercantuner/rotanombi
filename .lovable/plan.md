
# Performans Optimizasyonu ve Cron Senkronizasyon Planı

## Tespit Edilen 3 Sorun

### 1. Cron Senkronizasyon Hiç Calismiyordu
`pg_cron` ve `pg_net` extension'ları aktif ancak `cron.job` tablosu tamamen bos. Yani cron job **hic olusturulmamis**. `handleCronSync` fonksiyonu hazir ama onu tetikleyecek zamanlanmis gorev yok. Bu yuzden veriler 138 saattir otomatik guncellenmedi.

**Cozum:** `pg_cron` ile `dia-data-sync` edge function'a `cronSync` action'i gonderen bir zamanlanmis gorev olusturulacak. Gece 03:00 (TR saati, UTC 00:00) calisan bir cron job eklenecek.

### 2. scf_fatura_listele Timeout Sorunu
30,000+ kayitli fatura tablosu statement timeout veriyor. `useCompanyData` ve `useDataSourceLoader` icerisindeki `fetchPeriodData` fonksiyonu 1000'lik PAGE_SIZE ile sayfalama yapiyor ama buyuk JSONB veri setlerinde bu yeterli degil.

**Cozum:**
- `fetchPeriodData` icerisinde `scf_fatura_listele` icin `get_invoice_summary` RPC'si zaten kullaniliyor (MV optimizasyonu). Ancak MV bos oldugunda fallback olarak full JSONB sorgusu yapiliyor ve bu timeout'a neden oluyor.
- Fallback sorgusunda PAGE_SIZE'i 1000'den 200'e dusurulecek.
- Ayrica `useCompanyData`'daki period-batched fetching'de de ayni PAGE_SIZE optimizasyonu uygulanacak.

### 3. Period-Independent Kaynaklar Gereksiz Cok Donem Cekiyor
`Kasa Kart Listesi`, `Banka_Hesap_listesi`, `cari_kart_listesi`, `Stok_listesi`, `kullanici_listele`, `Görev Listesi`, `sis_kayit_listele`, `Cari_vade_bakiye_listele` gibi kaynaklar `is_period_independent: true` olarak isaretli.

**Veri okuma katmaninda (useDataSourceLoader + useCompanyData):** Period-independent kaynaklar tum donemlerdeki veriyi cekip birlestiriyor. Bu "Kasa Kart Listesi" gibi masterdata icin gereksiz - sadece aktif donemdeki guncel veriyi almak yeterli.

**Senkronizasyon katmaninda (useSyncOrchestrator):** Period-independent kaynaklar zaten sadece `currentPeriod`'dan senkronize ediliyor (dogru). Ancak daha once eski donemlere de senkronize edilmis veriler veritabaninda kaldigindan, okuma katmani bunlari da cekiyor.

**Cozum:**
- `is_period_independent` kaynaklar icin "masterdata" ve "transaction" ayrimi yapilacak:
  - **Masterdata kaynaklari** (Kasa Kart, Banka Hesap, Stok, Cari Kart, Kullanici, Gorev): Sadece aktif donemden okunacak, period-batched fetching bypass edilecek.
  - **Transaction kaynaklari** (scf_fatura_listele, Cari_vade_bakiye): Tum donemleri birlestirmeye devam edecek (yillar arasi karsilastirma icin).
- Bunu ayirt etmek icin `data_sources` tablosuna `period_read_mode` kolonu eklenecek: `'current_only'` veya `'all_periods'`. Default: `'all_periods'` (mevcut davranis korunur).

---

## Teknik Uygulama Detaylari

### Adim 1: Cron Job Olusturma (SQL)
```sql
SELECT cron.schedule(
  'dia-nightly-sync',
  '0 0 * * *',  -- UTC 00:00 = TR 03:00
  $$
  SELECT net.http_post(
    url := 'https://sdlfeyxgojncjgayktfm.supabase.co/functions/v1/dia-data-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', current_setting('app.settings.cron_secret', true)
    ),
    body := '{"action":"cronSync"}'::jsonb
  ) AS request_id;
  $$
);
```
Not: `CRON_SECRET` zaten secrets'ta mevcut. Ancak pg_cron icerisinden secret'a erisim farkli calisir - body icerisinde gondermek gerekecek:
```sql
SELECT cron.schedule(
  'dia-nightly-sync',
  '0 0 * * *',
  $$
  SELECT net.http_post(
    url := 'https://sdlfeyxgojncjgayktfm.supabase.co/functions/v1/dia-data-sync',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"action":"cronSync","cronSecret":"ACTUAL_SECRET_VALUE"}'::jsonb
  ) AS request_id;
  $$
);
```

### Adim 2: data_sources Tablosuna period_read_mode Kolonu
```sql
ALTER TABLE data_sources 
ADD COLUMN period_read_mode TEXT DEFAULT 'all_periods' 
CHECK (period_read_mode IN ('current_only', 'all_periods'));

-- Masterdata kaynakları: sadece aktif dönemden okunacak
UPDATE data_sources SET period_read_mode = 'current_only' 
WHERE slug IN (
  'Kasa Kart Listesi', 'Banka_Hesap_listesi', 'cari_kart_listesi',
  'Stok_listesi', 'kullanici_listele', 'Görev Listesi', 'sis_kayit_listele'
);

-- Transaction kaynakları: tüm dönemlerden okunacak (mevcut davranış)
UPDATE data_sources SET period_read_mode = 'all_periods'
WHERE slug IN ('scf_fatura_listele', 'Cari_vade_bakiye_listele');
```

### Adim 3: useDataSourceLoader.tsx Degisiklikleri
`loadDataSourceFromDatabase` fonksiyonunda `isPeriodIndependent` kontrolune `period_read_mode` eklenmesi:

- `period_read_mode === 'current_only'`: Sadece `effectiveDonem` (aktif donem) icin tek sorgu atilir. Period-batched fetching atlanir.
- `period_read_mode === 'all_periods'` (veya undefined): Mevcut period-batched davranis korunur.

`useDataSources` hook'undan donen `DataSource` tipine `period_read_mode` alani eklenir.

### Adim 4: useCompanyData.tsx Degisiklikleri
Ayni mantik `useCompanyData`'ya da uygulanir:
- `filter.isPeriodIndependent && period_read_mode === 'current_only'` ise period discovery yerine dogrudan aktif donem sorgusu yapilir.

### Adim 5: scf_fatura_listele Timeout Icin PAGE_SIZE Optimizasyonu
`useDataSourceLoader.tsx` > `fetchPeriodData` icerisinde, fallback (MV bos oldugunda) sorgusunda PAGE_SIZE'i 200'e dusurme:
```typescript
const PAGE_SIZE = dataSource.slug === 'scf_fatura_listele' ? 200 : 1000;
```

---

## Degisecek Dosyalar

| Dosya | Degisiklik |
|-------|-----------|
| SQL (cron.schedule) | Cron job olusturma |
| SQL (migration) | `period_read_mode` kolonu ekleme + veri guncelleme |
| `src/hooks/useDataSources.tsx` | `DataSource` tipine `period_read_mode` ekleme |
| `src/hooks/useDataSourceLoader.tsx` | Period-independent okuma mantigi: `current_only` vs `all_periods` |
| `src/hooks/useCompanyData.tsx` | Ayni period-read-mode mantigi |

## Risk Degerlendirmesi
- Cron job eklenmesi sifir risk - mevcut altyapi hazir.
- `period_read_mode` default `'all_periods'` oldugundan mevcut davranis bozulmaz.
- PAGE_SIZE degisikligi sadece fallback senaryosunu etkiler (MV aktifse zaten MV kullanilir).
