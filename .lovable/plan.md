
# Sayfa Açılışlarında Grafik Yenileme Animasyonunu Gizleme

## Mevcut Sorun

Sayfalar arasında geçiş yapılırken veya sayfa yenilendiğinde:
1. **DashboardLoadingScreen** - Tam ekran loading animasyonu gösteriliyor
2. **Widget Skeleton'ları** - Her widget tek tek skeleton animasyonu gösteriyor
3. **Container Loading** - Container'lar içindeki widget detayları yüklenirken skeleton

Bu durum kullanıcı deneyimini olumsuz etkiliyor çünkü:
- Cache'de zaten mevcut veriler için bile skeleton gösteriliyor
- Sayfa geçişlerinde sürekli "yenileniyor" hissi yaratılıyor
- Görsel çalkantı (visual jitter) meydana geliyor

## Çözüm Yaklaşımı

**"Önceki İçeriği Koru"** (Keep Previous Content) stratejisi uygulanacak:

1. **Cache'de veri varsa skeleton gösterme** - Eğer veri kaynağı cache'de mevcutsa, widget doğrudan veriyle render edilecek
2. **Loading screen threshold** - İlk yükleme ekranı sadece cache tamamen boşken gösterilecek
3. **Sessiz arka plan yenileme** - Stale veri varsa arka planda sessizce yenilenecek, UI değişmeyecek

## Teknik Değişiklikler

### Adım 1: BuilderWidgetRenderer - Skeleton Mantığını Değiştir

**Dosya:** `src/components/dashboard/BuilderWidgetRenderer.tsx`

Mevcut kod (satır 207-218):
```tsx
if (isLoading) {
  return (
    <Card className={isolatedClassName}>
      <CardHeader>
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-24 w-full" />
      </CardContent>
    </Card>
  );
}
```

Yeni yaklaşım:
```tsx
// Sadece İLK yüklemede VE veri yoksa skeleton göster
// Cache'den gelen veri varsa (stale bile olsa) skeleton gösterme
if (isLoading && (!data || data.length === 0)) {
  // Skeleton...
}
```

### Adım 2: useDynamicWidgetData Hook - Cache-First Yaklaşımı

**Dosya:** `src/hooks/useDynamicWidgetData.tsx`

Değişiklikler:
1. Cache'de veri varsa `isLoading: false` döndür
2. Arka plan yenileme için `isRefetching` state'i ekle (UI'da gösterilmeyecek)
3. `stale-while-revalidate` mantığını güçlendir

```tsx
// Mevcut: data || null
// Yeni: cachedData || null (her zaman önce cache'e bak)

const [isRefetching, setIsRefetching] = useState(false);

// Cache'de veri varsa loading false döner
const isLoading = !cachedData && isFetching;
```

### Adım 3: DashboardLoadingScreen - Sadece Gerçek İlk Yükleme

**Dosya:** `src/pages/DashboardPage.tsx` ve `src/components/pages/DynamicPage.tsx`

Mevcut koşul:
```tsx
const showLoadingScreen = dataSourcesInitialLoad && totalSources > 0 && loadedSources.length < totalSources;
```

Yeni koşul:
```tsx
// Cache tamamen boşken VE ilk yüklemeyse loading screen göster
// Sayfa geçişlerinde cache dolu olacağından loading screen görünmeyecek
const hasCachedData = loadedSources.length > 0 || totalSources === 0;
const showLoadingScreen = dataSourcesInitialLoad && !hasCachedData && totalSources > 0;
```

### Adım 4: ContainerRenderer - Widget Detay Skeleton'ını Optimize Et

**Dosya:** `src/components/pages/ContainerRenderer.tsx`

Değişiklik:
```tsx
// Widget var ama detayları henüz yüklenmedi
// SADECE gerçekten bekleme gerektiren durumlarda skeleton
if (slotWidget && !widgetDetail && !orphanSlots.has(slotWidget.id)) {
  // Kısa bir delay ile skeleton göster - çoğu durumda detaylar hemen gelir
  // 200ms'den kısa yüklemelerde skeleton görünmez
  return (
    <div key={slotIndex} className="h-full min-h-[80px] transition-opacity">
      {/* Skeleton yerine boş container - flicker önleme */}
      <div className="h-full w-full rounded bg-muted/20" />
    </div>
  );
}
```

### Adım 5: useDataSourceLoader - Cache Hit Durumunda Loading Skip

**Dosya:** `src/hooks/useDataSourceLoader.tsx`

Mevcut davranış: Her sayfa açılışında `isLoading: true` ile başlıyor

Yeni davranış:
```tsx
// Cache'de zaten veri varsa loading state'i skip et
useEffect(() => {
  // Sayfa geçişlerinde cache kontrol et
  const allSourcesCached = usedSourceIds.every(id => getDataSourceData(id)?.length > 0);
  
  if (allSourcesCached) {
    // Hemen ready - loading gösterme
    setIsLoading(false);
    setIsInitialLoad(false);
    setPageDataReady(true);
  }
}, [pageId]);
```

---

## Etkilenen Dosyalar

| Dosya | Değişiklik |
|-------|------------|
| `src/components/dashboard/BuilderWidgetRenderer.tsx` | Skeleton koşulu güncelleme |
| `src/hooks/useDynamicWidgetData.tsx` | Cache-first loading mantığı |
| `src/hooks/useDataSourceLoader.tsx` | Cache hit durumunda hızlı geçiş |
| `src/pages/DashboardPage.tsx` | Loading screen koşulu |
| `src/components/pages/DynamicPage.tsx` | Loading screen koşulu |
| `src/components/pages/ContainerRenderer.tsx` | Widget skeleton optimizasyonu |

---

## Kullanıcı Deneyimi Sonucu

| Senaryo | Önceki Davranış | Yeni Davranış |
|---------|-----------------|---------------|
| İlk uygulama açılışı | Loading screen + skeleton | Loading screen + skeleton (değişmez) |
| Sayfa geçişi (cache dolu) | Loading + skeleton | Anında render (loading yok) |
| Manuel yenileme | Loading + skeleton | Arka planda yenileme, UI değişmez |
| Yeni widget ekleme | Widget için skeleton | Widget için skeleton (değişmez) |

---

## Test Senaryoları

1. ✅ Dashboard'dan dinamik sayfaya geçişte loading/skeleton görünmemeli
2. ✅ Dinamik sayfadan Dashboard'a dönüşte loading/skeleton görünmemeli
3. ✅ İlk uygulama açılışında normal loading screen görünmeli
4. ✅ Manuel yenileme butonuna basıldığında arka planda yenileme yapılmalı
5. ✅ Yeni widget eklendiğinde sadece o widget için loading gösterilmeli
