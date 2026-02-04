
## Problem Analizi: Grafiklerin Sürekli Yeniden Render Edilmesi

### Tespit Edilen Sorun

Console loglarında aynı widget'ın **20+ kez** render edildiği görülüyor:
```
[BuilderWidgetRenderer] Fatura Satış Grafiği (393666ee-...) {...}
[BuilderWidgetRenderer] Fatura Satış Grafiği (393666ee-...) {...}
... (20+ kez tekrar)
```

### Kök Neden: Sonsuz Render Döngüsü

Birden fazla kaynak bu soruna neden oluyor:

---

**1. `useDynamicWidgetData` Hook'undaki Dependency Array Sorunu (Satır 839)**

```typescript
}, [config, globalFilters, getCachedData, setCachedData, getDataSourceDataWithStale, 
    isDataSourceLoading, sharedData, incrementCacheHit, incrementCacheMiss]);
```

**Problem:** Her render'da bu dependency'ler yeni referans alıyor (özellikle `globalFilters` ve `sharedData` objeleri). Bu, `fetchData` fonksiyonunun sürekli yeniden oluşturulmasına neden oluyor.

---

**2. `useEffect` + `fetchData` Zincirleme Tetiklemesi (Satır 843-847)**

```typescript
useEffect(() => {
  if (isPageDataReady) {
    fetchData();
  }
}, [isPageDataReady, fetchData]);
```

**Problem:** 
- `fetchData` her render'da yeni referans alıyor (dependency array sorunu nedeniyle)
- `isPageDataReady` true olduğunda `fetchData` çağrılıyor
- `fetchData` state güncelliyor (`setData`, `setRawData`, `setIsFetching`)
- State güncellemesi yeni render tetikliyor
- Yeni render'da `fetchData` yeni referans alıyor
- useEffect tekrar çalışıyor = **SONSUZ DÖNGÜ**

---

**3. `globalFilters` Referans Kararsızlığı**

`GlobalFilterContext`'ten gelen `filters` objesi her render'da yeni referans alabilir. `useDynamicWidgetData` bu filtreleri dependency olarak alınca sürekli yeniden çalışıyor.

---

**4. Cache Context Fonksiyonları Referans Sorunu**

`DiaDataCacheContext`'ten gelen `getDataSourceDataWithStale`, `incrementCacheHit`, `incrementCacheMiss` fonksiyonları `useMemo` ile sarılsa da, context state değiştiğinde yeniden oluşturuluyorlar.

---

## Çözüm Planı

### Adım 1: fetchData Memoization Düzeltmesi
`useDynamicWidgetData.tsx` dosyasında `fetchData` dependency array'ini düzelt:

```typescript
// ÖNCE (sorunlu)
}, [config, globalFilters, getCachedData, setCachedData, ...]);

// SONRA (düzeltilmiş)
// 1. globalFilters'ı ref olarak tut
const globalFiltersRef = useRef(globalFilters);
globalFiltersRef.current = globalFilters;

// 2. config'i JSON string olarak karşılaştır
const configKey = useMemo(() => JSON.stringify(config), [config]);

// 3. fetchData dependency'lerini minimize et
}, [configKey]); // Sadece config değiştiğinde yeniden oluştur
```

### Adım 2: useEffect Tetikleyici Kontrolü
`isPageDataReady` değişikliğini kontrollü yönet:

```typescript
// Önceki isPageDataReady değerini takip et
const prevPageDataReadyRef = useRef(false);

useEffect(() => {
  // Sadece false -> true geçişinde çalış (ilk yükleme)
  if (isPageDataReady && !prevPageDataReadyRef.current) {
    fetchData();
  }
  prevPageDataReadyRef.current = isPageDataReady;
}, [isPageDataReady]); // fetchData'yı dependency'den ÇIKAR
```

### Adım 3: GlobalFilters Stabilizasyonu
`GlobalFilterContext.tsx` dosyasında filters objesini stabilize et:

```typescript
// filters state'ini memoize et
const memoizedFilters = useMemo(() => filters, [
  filters.searchTerm,
  filters.cariKartTipi.join(','),
  filters.satisTemsilcisi.join(','),
  // ... diğer alanlar
]);
```

### Adım 4: Cache Context Fonksiyonlarını Stabilize Et
`DiaDataCacheContext.tsx` dosyasında callback'leri `useCallback` ile doğru şekilde memoize et:

```typescript
// Fonksiyonları cache state'inden bağımsız yap
const incrementCacheHitRef = useRef(() => {
  setStats(prev => ({ ...prev, cacheHits: prev.cacheHits + 1 }));
});

const incrementCacheHit = useCallback(() => {
  incrementCacheHitRef.current();
}, []); // Boş dependency - asla değişmez
```

### Adım 5: BuilderWidgetRenderer Console Log Temizliği
Debug loglarını production'da devre dışı bırak:

```typescript
// Her render'da log yazmayı durdur
if (process.env.NODE_ENV === 'development') {
  console.log(`[BuilderWidgetRenderer] ${widgetName}...`);
}
```

---

## Teknik Detaylar

### Etkilenen Dosyalar
1. `src/hooks/useDynamicWidgetData.tsx` - Ana düzeltme
2. `src/contexts/GlobalFilterContext.tsx` - Filters stabilizasyonu
3. `src/contexts/DiaDataCacheContext.tsx` - Callback stabilizasyonu
4. `src/components/dashboard/BuilderWidgetRenderer.tsx` - Log temizliği

### Beklenen Sonuç
- Widget'lar sayfa yüklendiğinde 1 kez render edilecek
- Filtre değişikliğinde sadece 1 yeniden render olacak
- Console loglarında tekrar eden satırlar olmayacak
- Kullanıcı arayüzü daha akıcı/performanslı olacak

### Risk Analizi
- **Düşük Risk:** Değişiklikler sadece render optimizasyonu içeriyor
- **Geriye Uyumluluk:** Mevcut widget davranışı korunacak
- **Test Gerekliliği:** Tüm grafik widget'larının doğru render edildiği doğrulanmalı
