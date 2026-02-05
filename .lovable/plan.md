
# DIA Veri Depolama ve Senkronizasyon Sistemi Planı

## Özet
DIA API'den çekilen verilerin Supabase veritabanında kalıcı olarak saklanması, şirket bazlı izolasyon ve akıllı artımlı güncelleme mekanizması.

---

## Mevcut Durum Analizi

### Şu Anda Nasıl Çalışıyor
```text
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Widget    │ ──► │  Cache      │ ──► │  DIA API    │
│             │     │  (Memory)   │     │  (Her def)  │
└─────────────┘     └─────────────┘     └─────────────┘
                         │
                    10 dk TTL
                    Sayfa yenilenince
                    veri kaybı
```

- Veriler sadece bellek (RAM) cache'inde tutuluyor
- Her oturumda DIA API tekrar sorgulanıyor (kontör harcaması)
- Kullanıcı bazlı cache izolasyonu var ama kalıcı değil

### Hedef Mimari
```text
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Widget    │ ──► │  Supabase   │ ◄── │  DIA Sync   │
│             │     │  (Kalıcı)   │     │  (Zamanlı)  │
└─────────────┘     └─────────────┘     └─────────────┘
                         │
                    Şirket bazlı RLS
                    Dönem bazlı partition
                    Artımlı güncelleme
```

---

## Yeni Veritabanı Tabloları

### 1. `company_data_cache` - Ana Veri Tablosu

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | uuid | Primary key |
| sunucu_adi | text | DIA sunucu adı (genisdepo, demo vb.) |
| firma_kodu | text | Şirket kodu |
| donem_kodu | integer | Dönem (1, 2, 3...) |
| data_source_slug | text | Veri kaynağı (cari_kart_listesi, fatura_listesi vb.) |
| dia_key | bigint | DIA'daki `_key` değeri (unique identifier) |
| data | jsonb | Tüm veri alanları |
| created_at | timestamptz | İlk kayıt tarihi |
| updated_at | timestamptz | Son güncelleme |
| is_deleted | boolean | Soft delete flag |

**Unique Constraint:** `(sunucu_adi, firma_kodu, donem_kodu, data_source_slug, dia_key)`

### 2. `sync_history` - Senkronizasyon Geçmişi

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | uuid | Primary key |
| sunucu_adi | text | DIA sunucu |
| firma_kodu | text | Şirket |
| donem_kodu | integer | Dönem |
| data_source_slug | text | Veri kaynağı |
| sync_type | text | 'full' veya 'incremental' |
| records_fetched | integer | Çekilen kayıt sayısı |
| records_inserted | integer | Eklenen kayıt |
| records_updated | integer | Güncellenen kayıt |
| started_at | timestamptz | Başlangıç |
| completed_at | timestamptz | Bitiş |
| triggered_by | uuid | Tetikleyen kullanıcı |
| error | text | Hata mesajı (varsa) |

### 3. `period_sync_status` - Dönem Kilit Durumu

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | uuid | Primary key |
| sunucu_adi | text | DIA sunucu |
| firma_kodu | text | Şirket |
| donem_kodu | integer | Dönem |
| data_source_slug | text | Veri kaynağı |
| is_locked | boolean | Dönem kilitli mi (tamamlandı) |
| last_full_sync | timestamptz | Son tam senkronizasyon |
| last_incremental_sync | timestamptz | Son artımlı sync |

**Dönem Kilitleme Mantığı:**
- Geçmiş dönemler (örn: 2024) bir kez çekilir, `is_locked = true` yapılır
- Kilitli dönemler tekrar sorgulanmaz → kontör tasarrufu

---

## RLS Politikaları (Şirket İzolasyonu)

```sql
-- company_data_cache için RLS
CREATE POLICY "Users can view their company data"
ON company_data_cache FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid()
      AND p.dia_sunucu_adi = company_data_cache.sunucu_adi
      AND p.firma_kodu = company_data_cache.firma_kodu
  )
);
```

Her kullanıcı sadece kendi şirketinin (sunucu_adi + firma_kodu) verilerini görebilir.

---

## Senkronizasyon Mantığı

### Akış Diyagramı
```text
                    ┌─────────────────────┐
                    │   Sync Tetikleme    │
                    │  (Manuel/Zamanlı)   │
                    └──────────┬──────────┘
                               │
               ┌───────────────┼───────────────┐
               ▼               ▼               ▼
        ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
        │ Geçmiş Dönem │ │ Mevcut Dönem │ │ Gelecek Dönem│
        │ (Kilitli)    │ │ (Aktif)      │ │ (Yok)        │
        └──────┬───────┘ └──────┬───────┘ └──────────────┘
               │                │
               ▼                ▼
        ┌──────────────┐ ┌──────────────┐
        │ is_locked?   │ │ Son 2 ay     │
        │ → SKIP       │ │ çekilecek    │
        └──────────────┘ └──────┬───────┘
                                │
                                ▼
                         ┌──────────────┐
                         │ _key bazlı   │
                         │ UPSERT       │
                         └──────────────┘
```

### Senkronizasyon Kuralları

1. **Geçmiş Dönemler (Kilitli)**
   - `period_sync_status.is_locked = true` ise atla
   - Hiç sync yapılmadıysa → tam sync yap, sonra kilitle

2. **Aktif Dönem (Mevcut Yıl)**
   - Son 2 aylık tarih aralığı filtresi ile çek
   - `_key` bazlı karşılaştırma: INSERT/UPDATE

3. **Artımlı Güncelleme Algoritması**
   ```
   DIA'dan gelen veri: { _key: 12345, ... }
   
   IF _key var → UPDATE (sadece farklı alanları)
   IF _key yok → INSERT
   
   DB'de olup DIA'da olmayan → is_deleted = true
   ```

---

## Yeni Edge Function: `dia-data-sync`

```typescript
// Endpoint: /functions/v1/dia-data-sync
// Methods:
//   POST { action: 'sync', dataSourceSlug: 'cari_kart_listesi', forceRefresh: false }
//   POST { action: 'syncAll', forceRefresh: false }
//   POST { action: 'lockPeriod', periodNo: 1 }

interface SyncRequest {
  action: 'sync' | 'syncAll' | 'lockPeriod';
  dataSourceSlug?: string;
  forceRefresh?: boolean;  // Kilitli dönemleri de yenile
  periodNo?: number;       // Belirli dönem için
}
```

### Sync Akışı (Pseudo-code)
```
1. Kullanıcı profilinden sunucu_adi, firma_kodu, donem_kodu al
2. period_sync_status kontrol et
3. Eğer kilitli değilse veya forceRefresh ise:
   a. Aktif dönem için: tarih_filter = son 2 ay
   b. DIA API çağır
   c. Her kayıt için:
      - _key ile DB'de ara
      - Varsa UPDATE, yoksa INSERT
   d. sync_history'ye kaydet
4. Sonucu döndür
```

---

## Widget Veri Okuma Değişiklikleri

### Önce (DIA API'den)
```typescript
// useDynamicWidgetData.tsx
const response = await fetch('/functions/v1/dia-api-test', { ... });
```

### Sonra (Supabase'den)
```typescript
// Yeni: useCompanyData hook
const { data, isLoading } = useQuery({
  queryKey: ['companyData', dataSourceSlug, filters],
  queryFn: async () => {
    const { data } = await supabase
      .from('company_data_cache')
      .select('data')
      .eq('data_source_slug', dataSourceSlug)
      .eq('is_deleted', false);
    return data.map(row => row.data);
  }
});
```

---

## Kullanıcı Arayüzü Değişiklikleri

### 1. Manuel Senkronizasyon Butonu (Header)
```text
┌────────────────────────────────────────────────────┐
│  🏠 Dashboard    📊 Raporlar    ⚙️ Ayarlar        │
│                                         [🔄 Sync]  │
└────────────────────────────────────────────────────┘
```

- Son sync tarihi tooltip olarak gösterilir
- Çalışırken spinner animasyonu
- Sync geçmişi dropdown menüsü

### 2. Ayarlar Sayfası - Veri Yönetimi Sekmesi
```text
┌─────────────────────────────────────────────────────┐
│ Veri Senkronizasyonu                                │
├─────────────────────────────────────────────────────┤
│ Son Güncelleme: 5 dakika önce                       │
│                                                     │
│ Veri Kaynakları:                                    │
│ ┌─────────────────────────────────────────────────┐ │
│ │ ✅ Cari Kart Listesi    │ 1,247 kayıt │ [Sync] │ │
│ │ ✅ Fatura Listesi       │   892 kayıt │ [Sync] │ │
│ │ ⏳ Stok Kartı           │ Senkronize... │      │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ [ 🔄 Tüm Verileri Senkronize Et ]                   │
└─────────────────────────────────────────────────────┘
```

---

## Değiştirilecek Dosyalar

| Dosya | Değişiklik |
|-------|------------|
| **Yeni Migration** | company_data_cache, sync_history, period_sync_status tabloları + RLS |
| **supabase/functions/dia-data-sync/index.ts** | Yeni edge function - senkronizasyon mantığı |
| **src/hooks/useCompanyData.tsx** | Yeni hook - veritabanından veri okuma |
| **src/hooks/useDynamicWidgetData.tsx** | Supabase'den okumaya geçiş |
| **src/hooks/useDataSourceLoader.tsx** | DIA API yerine Supabase |
| **src/components/layout/Header.tsx** | Sync butonu ekleme |
| **src/pages/SettingsPage.tsx** | Veri yönetimi sekmesi |
| **src/hooks/useSyncStatus.tsx** | Yeni hook - sync durumu takibi |

---

## Güvenlik Kontrolleri

1. **Şirket İzolasyonu**: RLS ile zorunlu
2. **Veri Sızıntısı**: profiles tablosundaki DIA credentials korunuyor
3. **Rate Limiting**: Sync işlemleri için dakikada max 5 istek
4. **Audit Trail**: sync_history tüm işlemleri logluyor

---

## Performans Optimizasyonları

1. **Toplu UPSERT**: 1000'er kayıtlık batch'ler
2. **İndeksleme**: 
   - `(sunucu_adi, firma_kodu, data_source_slug, dia_key)`
   - `(data_source_slug, updated_at)`
3. **JSONB Sıkıştırma**: Postgres otomatik sıkıştırma
4. **Stale Data Handling**: is_deleted soft-delete

---

## Uygulama Aşamaları

### Faz 1: Veritabanı Altyapısı
- [ ] Tabloları oluştur (migration)
- [ ] RLS politikaları
- [ ] İndeksler

### Faz 2: Sync Engine
- [ ] dia-data-sync edge function
- [ ] Dönem kilitleme mantığı
- [ ] Artımlı güncelleme

### Faz 3: Widget Entegrasyonu
- [ ] useCompanyData hook
- [ ] useDynamicWidgetData refactor
- [ ] Cache fallback (DB boşsa DIA'dan çek)

### Faz 4: UI
- [ ] Header sync butonu
- [ ] Ayarlar sayfası veri yönetimi
- [ ] Sync progress göstergesi

---

## Beklenen Faydalar

| Metrik | Önce | Sonra |
|--------|------|-------|
| DIA API çağrısı/gün | ~500 | ~20 (sadece sync) |
| Sayfa yüklenme | 3-5 sn | <1 sn |
| Veri tutarlılığı | Oturum bazlı | Kalıcı |
| Çoklu kullanıcı | Her biri ayrı çeker | Şirket bazlı paylaşım |
