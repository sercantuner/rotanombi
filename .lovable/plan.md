
# Arka Plan Veri Güncelleme (Background Revalidate) Implementasyonu

## Mevcut Sorun

Widget'lar açıldığında:
1. DB'den (company_data_cache) veri okunuyor ve gösteriliyor
2. `lastSyncedAt` bilgisi alınıp badge gösteriliyor (örn: "Eski - > 24 saat")
3. **AMA**: Arka planda DIA'dan taze veri çekme işlemi hiç tetiklenmiyor
4. Kullanıcı sürekli eski veri görüyor, badge "Güncelleniyor" durumuna geçmiyor

## Çözüm Yaklaşımı

Widget açıldığında:
1. Önce DB'den veri göster (anında)
2. Veri 1 saatten eskiyse (isStale) → arka planda DIA API çağrısı başlat
3. DIA'dan veri gelince → DB'ye yaz → UI güncelle → badge "Güncel" olsun
4. Aynı veri kaynağı (A widget'ı için çekildiyse) B widget'ı için tekrar çekilmesin

```text
Widget Açılır
     │
     ▼
┌─────────────────────────┐
│ DB'den veri göster      │ Badge: "Önbellek" veya "Eski"
└───────────┬─────────────┘
            │ (lastSyncedAt > 1 saat)
            ▼
┌─────────────────────────┐
│ Arka planda DIA API     │ Badge: "Güncelleniyor..."
│ (dia-data-sync edge fn) │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ DB güncellendi          │ Badge: "Güncel ✓"
│ UI sessizce yenilendi   │
└─────────────────────────┘
```

## Teknik Değişiklikler

### 1. useDynamicWidgetData Hook Genişletmesi

Yeni `backgroundRevalidate` fonksiyonu eklenecek:

```typescript
// Arka planda veri güncelleme - UI'ı bloklamaz
const backgroundRevalidate = useCallback(async (dataSourceId: string, slug: string) => {
  // Aynı kaynak için zaten revalidate çalışıyorsa çık
  if (revalidatingSourcesRef.current.has(dataSourceId)) return;
  
  revalidatingSourcesRef.current.add(dataSourceId);
  setDataStatus(prev => ({ ...prev, isRevalidating: true }));
  
  try {
    // dia-data-sync edge function'ı çağır
    const response = await fetch(`${SUPABASE_URL}/functions/v1/dia-data-sync`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'syncSingleSource',
        dataSourceSlug: slug,
        periodNo: effectiveDonem,
      }),
    });
    
    if (response.ok) {
      // Sync tamamlandı - DB'den yeni veriyi çek
      const freshData = await fetchFromDatabase(slug, sunucuAdi, firmaKodu, effectiveDonem);
      
      // UI'ı güncelle
      setDataStatus({ source: 'api', lastSyncedAt: new Date(), isStale: false, isRevalidating: false });
      rawDataCacheRef.current = freshData.data;
      processVisualizationData(freshData.data, config);
    }
  } catch (err) {
    console.error('[Background Revalidate] Error:', err);
    setDataStatus(prev => ({ ...prev, isRevalidating: false, error: err.message }));
  } finally {
    revalidatingSourcesRef.current.delete(dataSourceId);
  }
}, [sunucuAdi, firmaKodu, effectiveDonem, processVisualizationData]);
```

### 2. Global Revalidation Tracker

Aynı veri kaynağının birden fazla widget tarafından aynı anda çekilmesini engellemek için:

```typescript
// DiaDataCacheContext'e eklenecek
const revalidatingSourcesRef = useRef(new Set<string>());

const isSourceRevalidating = (dataSourceId: string) => 
  revalidatingSourcesRef.current.has(dataSourceId);

const markSourceRevalidating = (dataSourceId: string, status: boolean) => {
  if (status) {
    revalidatingSourcesRef.current.add(dataSourceId);
  } else {
    revalidatingSourcesRef.current.delete(dataSourceId);
  }
};
```

### 3. Otomatik Revalidation Tetikleme

Widget veri yüklediğinde ve veri stale ise arka plan güncelleme başlatılacak:

```typescript
// fetchDataForSource içinde, DB'den veri çekildikten sonra:
if (dbResult.data.length > 0) {
  const hoursSinceSync = dbResult.lastSyncedAt 
    ? (Date.now() - dbResult.lastSyncedAt.getTime()) / (1000 * 60 * 60)
    : 999;
  
  // Veri 1 saatten eskiyse arka planda güncelle
  if (hoursSinceSync > 1 && !isSourceRevalidating(dataSourceId)) {
    backgroundRevalidate(dataSourceId, slug);
  }
}
```

### 4. Multi-Widget Koordinasyonu

A widget'ı için cari_kart çekildiyse B widget'ı tekrar çekmesin:

- `DiaDataCacheContext`'te global `revalidatingSourcesRef` tutulacak
- Widget'lar revalidate başlatmadan önce bu set'i kontrol edecek
- Revalidate tamamlanınca tüm widget'lar DB'den yeni veriyi otomatik görecek (cache invalidation)

## Dosya Değişiklikleri

| Dosya | Değişiklik |
|-------|-----------|
| `src/hooks/useDynamicWidgetData.tsx` | `backgroundRevalidate` fonksiyonu, stale kontrolü sonrası tetikleme |
| `src/contexts/DiaDataCacheContext.tsx` | Global revalidating sources tracker |
| `src/components/dashboard/DataStatusBadge.tsx` | Zaten mevcut, değişiklik yok |

## Kullanıcı Deneyimi

1. Sayfa açılır → Widget'lar anında DB'den veri gösterir ("Önbellek" veya "Eski" badge)
2. Eski veriler için arka planda DIA sync başlar ("Güncelleniyor..." badge)
3. Sync tamamlanınca badge "Güncel ✓" olur
4. Aynı veri kaynağı kullanan diğer widget'lar da otomatik güncellenir

## Güvenlik Kuralları

- Periyodik polling YOK - sadece sayfa açıldığında tetiklenir
- Manuel refresh butonu da tetikleyebilir
- Rate limit koruması: Aynı kaynak için eş zamanlı çoklu sync engellenir
- DIA kontör tasarrufu: Sadece stale (> 1 saat) veriler için sync yapılır
