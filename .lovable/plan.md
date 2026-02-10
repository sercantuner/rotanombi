

# Corlugrup Sync Iyilestirmeleri - Master Plan

## Uygulanan Ozellikler

### 1. Sunucu Bazli Sync Kilidi (sync_locks) ✅

**Problem**: Ayni sunucu/firma icin birden fazla kullanici ayni anda sync baslatabiliyordu.

**Cozum**: `sync_locks` tablosu ile atomic kilit mekanizmasi.

- `acquireLock` action: Kilit almaya calisir, suresi dolmuslari otomatik temizler
- `releaseLock` action: Sync bitince (basarili/basarisiz) kilidi serbest birakir
- UNIQUE(sunucu_adi, firma_kodu) constraint ile race condition onlenir
- 30 dakika TTL: Tarayici kapansa bile kilit sonsuza kadar kalmaz
- UI geri bildirimi: "Senkronizasyon zaten devam ediyor (kullanici@email.com)"
- Farkli sunucular birbirini etkilemez, paralel calisir

### 2. DIA'da Silinen Kayitlarin Tespiti (reconcileKeys) ✅

**Problem**: Artimli sync ve kilitli donemler silinen kayitlari yakalayamiyordu.

**Cozum**: Key Reconciliation - sadece `_key` listesi cekilerek hafif karsilastirma.

- `reconcileKeys` action: DIA'dan `selectedcolumns: ["_key"]` ile sadece key listesi cekilir
- DB'deki `is_deleted: false` key'lerle karsilastirilir
- DB'de olup DIA'da olmayanlar `is_deleted: true` isaretlenir
- Full sync, incremental sync ve kilitli donemlerde calisir
- Cache kayit sayisi otomatik guncellenir

**Akis**:
```
Full Sync tamamlandi → reconcileKeys calistir
Incremental Sync tamamlandi → reconcileKeys calistir
Kilitli Donem → sync atla AMA reconcileKeys calistir
```

### 3. Frontend Orchestrator Entegrasyonu ✅

- `SyncTask` interface'ine `deleted` alani ve `reconcile` tipi eklendi
- `SyncProgress`'e `totalDeleted` alani eklendi
- Tum sync akislarinda (full, incremental, quick) otomatik reconcileKeys
- Kilitli donemlerde `type: 'reconcile'` olarak sadece silme kontrolu
- Toast mesajlarinda silinen kayit sayisi gosterilir

### 4. markFullSyncComplete Action ✅

- Full sync tamamlandiginda `period_sync_status` tablosuna `last_full_sync` yazar
- `get_cache_record_counts` RPC ile gercek kayit sayisi guncellenir
- `data_sources.last_record_count` ve `last_fetched_at` guncellenir

## Onceki Iyilestirmeler

### PAGE_SIZE Optimizasyonu ✅
- Tum kaynaklar 50'serlik parcalarla cekilir (CancelledError onlenir)
- Frontend orchestrator `pageSize: 50` gonderir

### Hata Toleransi ✅
- Lisanssiz moduller (gts) ve yetkisiz donemler otomatik atlanir
- `SKIP_ERROR_PATTERNS` ile bilinen hatalar handle edilir

## Veritabani Degisiklikleri

### sync_locks tablosu
```sql
CREATE TABLE public.sync_locks (
  id UUID PK,
  sunucu_adi TEXT NOT NULL,
  firma_kodu TEXT NOT NULL,
  locked_by UUID NOT NULL,
  locked_by_email TEXT,
  locked_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  sync_type TEXT DEFAULT 'full',
  UNIQUE(sunucu_adi, firma_kodu)
);
```

## Edge Function Action'lari

| Action | Amac | Input |
|--------|------|-------|
| acquireLock | Sync kilidi al | syncType |
| releaseLock | Kilidi birak | lockId |
| reconcileKeys | Silinen kayit tespiti | dataSourceSlug, periodNo |
| markFullSyncComplete | Full sync bitisini kaydet | dataSourceSlug, periodNo, totalRecords |
| syncChunk | Chunk bazli veri cekme | dataSourceSlug, periodNo, offset, chunkSize, pageSize |
| incrementalSync | Artimli guncelleme | dataSourceSlug, periodNo |
| lockPeriod | Donemi kilitle | periodNo, dataSourceSlug |
| getSyncStatus | Sync durumu sorgula | - |

## Bilinen Kisitlamalar

- `selectedcolumns: ["_key"]` bazi DIA modullerinde calismayabilir (test gerekli)
- Cok buyuk tablolarda (100.000+) reconcileKeys suresi uzayabilir
- Cron job henuz kilit mekanizmasiyla entegre degil (gelecek iyilestirme)
