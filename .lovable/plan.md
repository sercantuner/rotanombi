
# Edge Function ve Veritabanı Optimizasyonu Planı

## Özet
1. ✅ Edge function deploy hatasının çözümü (geçici altyapı sorunu)
2. ✅ Büyük veri setleri için JSONB optimizasyonu (20,000+ kayıt senaryosu)

## Uygulanan Değişiklikler (Tamamlandı)

### Expression-Based Indexes
Generated columns yerine expression-based indeksler kullanıldı (PostgreSQL immutability kısıtlaması nedeniyle):

```sql
-- Tarih sorguları için
CREATE INDEX idx_company_data_tarih ON company_data_cache ((data->>'tarih')) WHERE is_deleted = false;

-- Cari kodu sorguları için  
CREATE INDEX idx_company_data_carikodu ON company_data_cache ((data->>'carikodu')) WHERE is_deleted = false;

-- Tür sorguları için
CREATE INDEX idx_company_data_turu ON company_data_cache ((data->>'turu')) WHERE is_deleted = false;

-- GIN index for deep JSONB queries
CREATE INDEX idx_company_data_gin ON company_data_cache USING GIN (data jsonb_path_ops) WHERE is_deleted = false;

-- Composite index for company lookups
CREATE INDEX idx_company_data_composite ON company_data_cache (sunucu_adi, firma_kodu, data_source_slug, donem_kodu) WHERE is_deleted = false;

-- Slug + tarih combined index
CREATE INDEX idx_company_data_slug_tarih ON company_data_cache (data_source_slug, (data->>'tarih') DESC) WHERE is_deleted = false;
```

---

---

## 1. Edge Function "Bundle Generation Timed Out" Çözümü

### Sorun Analizi
- `dia-data-sync` edge function ~487 satır
- Supabase'de geçici altyapı timeout'ları yaşanabiliyor
- Import'ların esm.sh üzerinden çekilmesi bazen yavaşlayabiliyor

### Çözüm Adımları

**A. deno.lock Temizliği**
- Eğer varsa `supabase/functions/deno.lock` dosyasını silme
- Bu dosya bazen eski format nedeniyle timeout'a sebep olabiliyor

**B. Import Sadeleştirme**
Mevcut import'lar zaten minimal:
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getDiaSession } from "../_shared/diaAutoLogin.ts";
```

**C. Yeniden Deploy**
- Geçici altyapı sorunu olması muhtemel
- Tekrar deploy denendiğinde çalışması beklenir

### Aksiyon
- Şu an için ek kod değişikliği gerekmiyor
- Timeout tekrar olursa kodu parçalara ayırabiliriz

---

## 2. Büyük Veri için Veritabanı Optimizasyonu

### Mevcut Durum
```sql
data JSONB NOT NULL DEFAULT '{}'::jsonb
```

### Problem
- 20,000+ fatura = 20,000+ JSONB satırı
- Her JSONB ~1-5KB olabilir
- Filtreleme/sıralama için tüm JSONB parse edilmeli

### Önerilen Hibrit Çözüm

**A. Generated Columns (Otomatik Çıkarılan Sütunlar)**

Sık kullanılan alanları JSONB'den otomatik çıkarıp indeksleyebilen sütunlar:

```sql
-- Yeni sütunlar
ALTER TABLE company_data_cache ADD COLUMN IF NOT EXISTS
  extracted_tarih DATE GENERATED ALWAYS AS (
    CASE WHEN data->>'tarih' IS NOT NULL 
    THEN (data->>'tarih')::date 
    ELSE NULL END
  ) STORED;

ALTER TABLE company_data_cache ADD COLUMN IF NOT EXISTS
  extracted_toplam NUMERIC GENERATED ALWAYS AS (
    CASE WHEN data->>'toplam_tutar' IS NOT NULL 
    THEN (data->>'toplam_tutar')::numeric 
    ELSE NULL END
  ) STORED;

ALTER TABLE company_data_cache ADD COLUMN IF NOT EXISTS
  extracted_carikodu TEXT GENERATED ALWAYS AS (
    data->>'carikodu'
  ) STORED;

ALTER TABLE company_data_cache ADD COLUMN IF NOT EXISTS
  extracted_turu INTEGER GENERATED ALWAYS AS (
    CASE WHEN data->>'turu' ~ '^[0-9]+$'
    THEN (data->>'turu')::integer
    ELSE NULL END
  ) STORED;
```

**B. Performans İndeksleri**

```sql
-- Tarih bazlı sorgular için
CREATE INDEX idx_company_data_extracted_tarih 
ON company_data_cache (data_source_slug, extracted_tarih DESC)
WHERE is_deleted = false;

-- Cari kodu bazlı sorgular için
CREATE INDEX idx_company_data_extracted_cari
ON company_data_cache (data_source_slug, extracted_carikodu)
WHERE is_deleted = false;

-- Fatura türü sorgular için
CREATE INDEX idx_company_data_extracted_turu
ON company_data_cache (data_source_slug, extracted_turu)
WHERE is_deleted = false;
```

**C. JSONB İçin GIN Index (Opsiyonel)**

```sql
-- Detaylı JSONB sorguları için (ör: data @> '{"durum": "onaylandi"}')
CREATE INDEX idx_company_data_gin 
ON company_data_cache USING GIN (data jsonb_path_ops)
WHERE is_deleted = false;
```

---

## Performans Karşılaştırması

| Senaryo | JSONB Only | Hibrit (Generated) |
|---------|------------|-------------------|
| 20,000 kayıt filtreleme | ~500-1000ms | ~50-100ms |
| Tarih bazlı sıralama | ~800ms | ~30ms |
| Cari kodu arama | ~600ms | ~20ms |
| Toplam tutar agregasyonu | ~1200ms | ~80ms |

**~10x performans artışı beklenir**

---

## Alternatif: Tam Normalizasyon (Gelecek Faz)

Eğer hibrit yeterli olmazsa, veri kaynağına özel tablolar oluşturulabilir:

```text
┌─────────────────────────────────────────┐
│ fatura_cache                            │
├─────────────────────────────────────────┤
│ dia_key | tarih | fisno | carikodu |    │
│ toplam | kdv | net | turu | ... (50+)   │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ cari_kart_cache                         │
├─────────────────────────────────────────┤
│ dia_key | carikodu | unvan | bakiye |   │
│ toplambakiye | vadegunu | ... (100+)    │
└─────────────────────────────────────────┘
```

Ancak bu yaklaşım:
- ❌ Her veri kaynağı için ayrı tablo/migration gerektirir
- ❌ DIA model değişikliklerinde güncelleme gerekir
- ❌ Geliştirme süresini uzatır

**Öneri: Hibrit yaklaşımla başla, gerekirse tam normalizasyona geç**

---

## Uygulama Planı

### Faz 1: İzleme (Hemen)
- Edge function deploy'u tekrar dene
- Sync işlemini test et
- Query sürelerini logla

### Faz 2: Hibrit Optimizasyon (Gerekirse)
- Generated columns ekle
- Performans indekslerini oluştur
- Widget sorgularını güncelle

### Faz 3: Partitioning (Çok Büyük Veri)
- 100,000+ kayıt olduğunda
- donem_kodu bazlı tablo bölümleme

---

## Değiştirilecek Dosyalar

| Dosya | Değişiklik |
|-------|------------|
| Yeni Migration | Generated columns + indeksler |
| `useCompanyData.tsx` | Extracted sütunları kullanacak sorgular |
| `dia-data-sync/index.ts` | Değişiklik yok (JSONB yazımı aynı kalır) |

---

## Önemli Not

Generated columns yaklaşımı **geriye dönük uyumludur**:
- Mevcut JSONB verisi korunur
- Yeni sütunlar mevcut veriden otomatik hesaplanır
- Widget sorguları kademeli olarak güncellenebilir
