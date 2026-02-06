
# Vade Yaşlandırma ve Veri Yönetimi Düzeltme Planı

## Tespit Edilen Sorunlar

### Sorun 1: Vade Yaşlandırma Widget'ı Çalışmıyor
- **Sebep:** `Cari_vade_bakiye_listele` veri kaynağı `company_data_cache` tablosunda YOK
- Cache'de hiç kayıt bulunmuyor
- `data_sources` tablosunda `last_record_count: 75` yazıyor ama bu veriler cache'e hiç yazılmamış

### Sorun 2: Veri Yönetimi'nde Yanlış Kayıt Sayısı
- **Sebep:** Sayfa `data_sources.last_record_count` kolonunu okuyor
- Bu kolon sync sırasında güncelleniyor ama cache'deki gerçek sayıyı yansıtmıyor
- Örnek: Cari Kart için cache'de 610 kayıt var, ama `last_record_count` 100 gösteriyor

### Sorun 3: CRM Sayfası Düzgün Çalışıyor
- CRM sayfası `useDataSourceLoader` hook'u ile `company_data_cache` tablosundan veri çekiyor
- Cache'de 610 kayıt olduğu için düzgün çalışıyor
- Ayarlar sayfasındaki "100" değeri sadece yanlış metadata gösterimi

---

## Çözüm Planı

### Adım 1: Veri Yönetimi Sayfasında Gerçek Kayıt Sayısını Göster
**Dosya:** `src/components/settings/DataManagementTab.tsx`

Mevcut durum: `data_sources.last_record_count` değeri gösteriliyor (yanlış olabilir)

Yeni yaklaşım: Her veri kaynağı için `company_data_cache` tablosundan gerçek kayıt sayısını çek

```typescript
// Yeni hook: useCacheRecordCounts
const useCacheRecordCounts = () => {
  const { sunucuAdi, firmaKodu, donemKodu } = useDiaProfile();
  
  return useQuery({
    queryKey: ['cache-record-counts', sunucuAdi, firmaKodu],
    queryFn: async () => {
      const { data } = await supabase
        .from('company_data_cache')
        .select('data_source_slug')
        .eq('sunucu_adi', sunucuAdi)
        .eq('firma_kodu', firmaKodu)
        .eq('is_deleted', false);
      
      // Slug bazlı sayım
      const counts: Record<string, number> = {};
      data?.forEach(row => {
        counts[row.data_source_slug] = (counts[row.data_source_slug] || 0) + 1;
      });
      return counts;
    }
  });
};
```

Veya daha performanslı: RPC fonksiyonu ile SQL COUNT

### Adım 2: Sync Sonrası Kayıt Sayısını Düzelt
**Dosya:** `supabase/functions/dia-data-sync/index.ts`

`last_record_count` güncelleme mantığını düzelt:
- Sync sonrası cache'e yazılan gerçek kayıt sayısını kullan
- `written` değişkeni zaten doğru sayıyı içeriyor

Mevcut durum (satır ~323):
```typescript
// Burada r.fetched API'dan çekilen sayı, r.written cache'e yazılan sayı
await sb.from('sync_history').update({ 
  records_fetched: r.fetched, 
  records_inserted: r.written 
});
```

Düzeltme: `data_sources.last_record_count` güncellemesi ekle

### Adım 3: Cache Kayıt Sayısı için SQL Fonksiyonu (Opsiyonel)
Performans için veritabanı fonksiyonu:

```sql
CREATE OR REPLACE FUNCTION get_cache_record_counts(
  p_sunucu_adi TEXT,
  p_firma_kodu TEXT
)
RETURNS TABLE (data_source_slug TEXT, record_count BIGINT)
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT 
    data_source_slug,
    COUNT(*) as record_count
  FROM company_data_cache
  WHERE sunucu_adi = p_sunucu_adi
    AND firma_kodu = p_firma_kodu
    AND is_deleted = false
  GROUP BY data_source_slug;
$$;
```

---

## Teknik Değişiklikler

| Dosya | Değişiklik |
|-------|------------|
| `src/components/settings/DataManagementTab.tsx` | Cache'den gerçek kayıt sayısı çekme |
| `src/hooks/useSyncData.tsx` | Sync sonrası `last_record_count` güncelleme |
| `supabase/functions/dia-data-sync/index.ts` | `data_sources.last_record_count` güncelleme mantığı |

---

## Acil Eylem: Vade Verisi Sync

Vade Yaşlandırma widget'ının çalışması için `Cari_vade_bakiye_listele` veri kaynağının sync edilmesi gerekiyor.

Kullanıcı adımları:
1. Ayarlar > Veri Yönetimi sayfasına git
2. `Cari_vade_bakiye` satırındaki yenile butonuna tıkla
3. Sync tamamlandıktan sonra dashboard'a geri dön

---

## Test Planı
1. Veri Yönetimi sayfasında gerçek kayıt sayılarının gösterildiğini doğrula
2. Sync işlemi sonrası kayıt sayılarının güncellenmesini kontrol et
3. Vade Yaşlandırma widget'ının veri gösterdiğini doğrula
