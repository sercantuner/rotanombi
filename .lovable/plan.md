

# Satış Hunisi Widget - Teklif Verisi Sorunu Analiz ve Çözüm Planı

## Sorun Özeti

"Cari Dönüşüm Hunisi" widget'ı, Teklif ve Sipariş verilerini göstermiyor. Sadece Cari Kart verileri (568 kayıt) görüntüleniyor.

## Kök Neden Analizi

### 1. Veri Kaynağı Yapılandırması (✅ DOĞRU)

Widget'ın multiQuery yapısı doğru konfigüre edilmiş:

| Sıra | Sorgu Adı | Veri Kaynağı ID | Metot | Kayıt Sayısı (DB) |
|------|-----------|-----------------|-------|-------------------|
| 0 | Ana Sorgu | 11e5348f... | carikart_listele | 610 |
| 1 | Teklif | 4cc3fd6d... | teklif_listele | 245 |
| 2 | Sipariş | 83065325... | siparis_listele | 10 |

### 2. Widget Kodundaki Veri Erişimi (✅ DOĞRU)

Widget kodu `multiData` scope değişkeninden doğru sırayla veri okuyor:

```javascript
var cariler   = toArray(multiData[0]); // Cari Kart
var teklifler = toArray(multiData[1]); // Teklif
var siparisler = toArray(multiData[2]); // Sipariş
```

### 3. CustomCodeWidgetBuilder Önizleme Sorunu (❌ SORUN)

**Sorunlu Akış:**

```text
┌─────────────────────────────────────────────────────────────────┐
│ useEffect (widget açıldığında)                                  │
│   ↓                                                             │
│ loadMultiQueryData(config.multiQuery) çağrılır                  │
│   ↓                                                             │
│ getDataSourceById(query.dataSourceId) → ❌ undefined            │
│   ↓                                                             │
│ Neden? → dataSources henüz React Query'den yüklenmemiş!         │
│   ↓                                                             │
│ mergedQueryData = {} (BOŞ)                                      │
│   ↓                                                             │
│ previewMultiData = [[], [], []] (BOŞ DİZİLER)                   │
│   ↓                                                             │
│ Widget: teklifler.length = 0, siparisler.length = 0             │
└─────────────────────────────────────────────────────────────────┘
```

**Sorunun Nedeni:**

`CustomCodeWidgetBuilder.tsx` satır 540-543'te:

```typescript
if (config?.multiQuery) {
  setIsMultiQueryMode(true);
  setMultiQuery(config.multiQuery);
  loadMultiQueryData(config.multiQuery);  // ← BURADA SORUN
}
```

`loadMultiQueryData` fonksiyonu (satır 583-613), `getDataSourceById` kullanıyor. Bu fonksiyon `dataSources` state'ine bağımlı ve `useDataSources()` hook'u React Query ile asenkron olarak veri yüklüyor.

Widget builder açıldığında `dataSources` henüz yüklenmemiş olabilir → `getDataSourceById` undefined döner → `mergedQueryData` boş kalır.

### 4. Dashboard Render Sorunu (❌ SORUN)

**Sorunlu Akış:**

```text
┌─────────────────────────────────────────────────────────────────┐
│ DataSourceLoader: Sayfadaki widget'ların veri kaynaklarını bul  │
│   ↓                                                             │
│ multiQuery.queries[].dataSourceId → 3 veri kaynağı tespit       │
│   ↓                                                             │
│ Her veri kaynağı için DIA API çağrısı yap ve cache'e yaz        │
│   ↓                                                             │
│ useDynamicWidgetData: Cache'den multiQueryData oluştur          │
│   ↓                                                             │
│ Eğer cache henüz dolmadıysa → multiQueryData = [[], [], []]     │
│   ↓                                                             │
│ Widget boş veri ile render edilir                               │
└─────────────────────────────────────────────────────────────────┘
```

**Ek Sorun:** Edge function loglarında Teklif verisi çekilmiş (245 kayıt) ancak widget'a ulaşmamış. Bu, cache senkronizasyon sorunu olabilir.

---

## Çözüm Planı

### Adım 1: CustomCodeWidgetBuilder - dataSources Yüklenme Beklemesi

**Dosya:** `src/components/admin/CustomCodeWidgetBuilder.tsx`

`loadMultiQueryData` fonksiyonunu `dataSources` yüklenene kadar bekletmek için:

1. `useDataSources()` hook'undan `isLoading` state'ini al
2. `useEffect` dependency'lerine `dataSources` veya `isLoading` ekle
3. `dataSources` yüklendikten SONRA `loadMultiQueryData` çağır

```typescript
// Satır 355'i güncelle
const { activeDataSources, getDataSourceById, isLoading: isDataSourcesLoading, dataSources } = useDataSources();

// Satır 540-543'ü güncelle
useEffect(() => {
  if (editingWidget && open && !isDataSourcesLoading && dataSources.length > 0) {
    const config = editingWidget.builder_config as any;
    if (config?.multiQuery) {
      setIsMultiQueryMode(true);
      setMultiQuery(config.multiQuery);
      loadMultiQueryData(config.multiQuery);
    }
  }
}, [editingWidget, open, isDataSourcesLoading, dataSources]);
```

### Adım 2: loadMultiQueryData - Cache Miss Durumunda DIA'dan Çekme

**Dosya:** `src/components/admin/CustomCodeWidgetBuilder.tsx`

`loadMultiQueryData` fonksiyonunu geliştir - `last_sample_data` yoksa DIA API'den çek:

```typescript
const loadMultiQueryData = async (config: MultiQueryConfig) => {
  if (!config?.queries?.length) return;
  
  setIsLoadingData(true);
  const dataMap: Record<string, any[]> = {};
  
  try {
    for (const query of config.queries) {
      if (query.dataSourceId) {
        const ds = getDataSourceById(query.dataSourceId);
        
        if (ds?.last_sample_data && ds.last_sample_data.length > 0) {
          // Cache'den oku
          dataMap[query.id] = ds.last_sample_data;
        } else if (ds) {
          // Cache boş, DIA'dan çek
          const response = await supabase.functions.invoke('dia-api-test', {
            body: {
              module: ds.module,
              method: ds.method,
              filters: ds.filters || [],
              limit: 100,
              ...(isImpersonating && impersonatedUserId ? { targetUserId: impersonatedUserId } : {}),
            },
          });
          
          if (response.data?.data) {
            dataMap[query.id] = response.data.data;
          }
        }
      }
    }
    
    setMergedQueryData(dataMap);
    // ... rest of function
  } catch (err: any) {
    toast.error('Veri yükleme hatası: ' + err.message);
  } finally {
    setIsLoadingData(false);
  }
};
```

### Adım 3: useDynamicWidgetData - multiQueryData Güncelleme Sorunu

**Dosya:** `src/hooks/useDynamicWidgetData.tsx`

`multiQueryDataRef.current` bir ref olduğu için değişiklikler React'i yeniden render'a tetiklemiyor. Bu sorunu çözmek için:

1. `multiQueryDataRef` yerine state kullan veya
2. multiQueryData değiştiğinde bir counter artır

```typescript
// multiQueryDataRef yerine state kullan
const [multiQueryData, setMultiQueryData] = useState<any[][] | null>(null);

// fetchData fonksiyonunda
setMultiQueryData(config.multiQuery.queries.map((q) => queryResults[q.id] || []));

// Return'de
return { data, rawData, multiQueryData, isLoading, error, refetch: fetchData };
```

### Adım 4: Memory Dokümantasyonu Güncelleme

`.lovable/memory/technical/widget-rendering-scopes.md` dosyasını güncelle:
- multiData'nın nasıl çalıştığını detaylandır
- dataSources yüklenme zamanlaması hakkında not ekle

---

## Teknik Uygulama Detayları

### Değiştirilecek Dosyalar

| Dosya | Değişiklik |
|-------|------------|
| `src/components/admin/CustomCodeWidgetBuilder.tsx` | dataSources yüklenme beklemesi + loadMultiQueryData güçlendirme |
| `src/hooks/useDynamicWidgetData.tsx` | multiQueryDataRef → state dönüşümü |
| `.lovable/memory/technical/widget-rendering-scopes.md` | multiData dokümantasyonu |

### Test Senaryoları

1. **Widget Builder Önizleme:** Widget Builder'da Satış Hunisi widget'ını aç → Teklif ve Sipariş sayılarının doğru görüntülendiğini doğrula
2. **Dashboard Görünümü:** Dashboard'a widget ekle → Tüm aşamaların (Cari, Potansiyel, Teklif, Satış) doğru veriyi gösterdiğini kontrol et
3. **Drill-down:** Her hungi aşamasına tıkla → İlgili kayıtların popup'ta listelendiğini doğrula

---

## Özet

Sorun, asenkron veri yükleme ve timing ile ilgili. `dataSources` React Query ile yüklenirken `loadMultiQueryData` çağrılıyor ve boş dönüyor. Çözüm:

1. Veri kaynakları yüklenene kadar bekle
2. Cache miss durumunda DIA'dan veri çek
3. multiQueryData'yı reactive state olarak yönet

