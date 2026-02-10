

# JSONB Alan Projeksiyonu ile Veritabanı Sorgu Optimizasyonu

## Problem

Fatura tablosu gibi buyuk veri kaynaklarinda her kayit ortalama **3.3 KB** ve **100+ alan** iceriyor. 44.000 kayit cekildiginde ~145 MB veri transfer ediliyor, oysa bir grafik genellikle sadece 5-6 alan kullaniyor (ornegin: `tarih`, `net`, `__cariunvan`, `turu`).

## Cozum Yaklasimi

Veritabaninda bir **RPC fonksiyonu** olusturulacak. Bu fonksiyon, istenen JSONB alanlarini filtreleyerek sadece gerekli veriyi dondurur. Widget'lar hangi alanlara ihtiyac duydugunu belirtecek ve sorgu bu alanlara daraltilacak.

```text
Oncesi:  SELECT data FROM company_data_cache  -->  3.3 KB x 44,000 = ~145 MB
Sonrasi: SELECT projected_data              -->  ~0.3 KB x 44,000 = ~13 MB  (10x azalma)
```

## Teknik Degisiklikler

### 1. Veritabani: RPC Fonksiyonu Olustur

`get_projected_cache_data` adinda bir PostgreSQL fonksiyonu olusturulacak:

```sql
CREATE OR REPLACE FUNCTION get_projected_cache_data(
  p_data_source_slug text,
  p_sunucu_adi text,
  p_firma_kodu text,
  p_donem_kodu integer DEFAULT NULL,
  p_fields text[] DEFAULT NULL,
  p_limit integer DEFAULT 1000,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(data jsonb, updated_at timestamptz) AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE 
      WHEN p_fields IS NOT NULL THEN
        (SELECT jsonb_object_agg(key, value)
         FROM jsonb_each(c.data)
         WHERE key = ANY(p_fields))
      ELSE c.data
    END as data,
    c.updated_at
  FROM company_data_cache c
  WHERE c.data_source_slug = p_data_source_slug
    AND c.sunucu_adi = p_sunucu_adi
    AND c.firma_kodu = p_firma_kodu
    AND c.is_deleted = false
    AND (p_donem_kodu IS NULL OR c.donem_kodu = p_donem_kodu)
  ORDER BY c.dia_key
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
```

- `p_fields` NULL olursa tum veri doner (geri uyumluluk).
- `p_donem_kodu` NULL ise period-independent calisir.
- RLS politikasina uyumlu (SECURITY DEFINER + icinde sunucu/firma kontrolu).

### 2. Widget Yapilandirmasi: `requiredFields` Alani

`WidgetBuilderConfig` tipine yeni bir opsiyonel alan eklenecek:

```typescript
// widgetBuilderTypes.ts
export interface WidgetBuilderConfig {
  // ... mevcut alanlar
  requiredFields?: string[];  // Widget'in ihtiyac duydugu JSONB alanlari
}
```

Widget Builder (Step 3) icinde veya AI tarafindan widget olusturulurken, widgetin kullandigi alanlar `requiredFields` olarak belirtilebilecek.

### 3. Veri Cekme Katmani: `fetchFromDatabase` Guncelleme

`useDynamicWidgetData.tsx` icindeki `fetchFromDatabase` fonksiyonu:

- `requiredFields` parametresi alacak.
- Eger `requiredFields` varsa, dogrudan tablo sorgusu yerine `supabase.rpc('get_projected_cache_data', {...})` cagrisini kullanacak.
- Ayni sayfalama mantigi korunacak (offset ile dongu).

```typescript
async function fetchFromDatabase(
  dataSourceSlug: string,
  sunucuAdi: string,
  firmaKodu: string,
  donemKodu: number,
  isPeriodIndependent: boolean = false,
  requiredFields?: string[]  // YENi
): Promise<DbFetchResult> {
  // requiredFields varsa -> RPC kullan
  // yoksa -> mevcut .select('data') mantigi (geri uyumluluk)
}
```

### 4. Diger Hook'lara Yayginlastirma

- `useDataSourceLoader.tsx`: Ayni RPC mantigi eklenecek (preview/test icin).
- `useCompanyData.tsx`: Opsiyonel `requiredFields` parametresi eklenecek.

### 5. Widget Builder UI (Opsiyonel Ama Onerilen)

Widget Builder Step 3'te, AI tarafindan uretilen koddan hangi alanlarin kullanildigini otomatik parse eden bir mekanizma. Ornegin `data.tarih`, `data.net`, `item.__cariunvan` gibi referanslardan `requiredFields` listesini cikarabilen bir yardimci fonksiyon.

## Geri Uyumluluk

- `requiredFields` tanimlanmamis widget'lar icin mevcut davranis aynen devam eder (tum alanlar cekilir).
- Yeni widget'lar veya guncellenen widget'lar icin alan listesi belirlendiginde otomatik optimizasyon devreye girer.
- RPC fonksiyonu `p_fields = NULL` oldugunda tum datayi dondurur.

## Beklenen Performans Kazanimi

| Metrik | Oncesi | Sonrasi |
|--------|--------|---------|
| Fatura verisi (44K kayit) | ~145 MB | ~13 MB |
| Sorgu suresi | ~3-5 sn | ~0.5-1 sn |
| Bellek kullanimi (frontend) | Yuksek | ~10x dusuk |

