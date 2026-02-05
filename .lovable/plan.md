
## Power BI Benzeri Çapraz Filtreleme (Cross-Filter) Sistemi

### Problem Analizi

Mevcut sistemde global filtreler çalışmıyor çünkü:

1. **Render Optimizasyonu Kırıldı**: Son düzeltmede `fetchData` fonksiyonu sadece `isPageDataReady` false→true geçişinde çağrılıyor (satır 890-898). Filtre değişikliklerinde widget'lar yeniden veri işlemiyor.

2. **Bağımsız Veri Akışı Yok**: `globalFilters` değiştiğinde `fetchData` tetiklenmiyor - dependency array'den çıkarıldı.

3. **Power BI Mimarisi Eksik**: Mevcut yapı basit filtre-veri ilişkisi kullanıyor. Power BI'daki gibi **widget-to-widget cross-filtering** veya **veri kaynağı bazlı filtre alanı tanımlaması** yok.

---

### Çözüm Planı: Power BI Tarzı Filtreleme Mimarisi

---

#### Adım 1: `data_sources` Tablosuna Filtre Alan Tanımları Ekleme

Yeni bir sütun eklenmeli: `filterable_fields` (jsonb) - Bu veri kaynağının hangi alanlara göre filtrelenebileceğini tanımlar.

```sql
ALTER TABLE data_sources ADD COLUMN filterable_fields jsonb DEFAULT '[]';
```

Örnek yapı:
```json
[
  {
    "field": "carikarttipi",
    "globalFilterKey": "cariKartTipi",
    "label": "Cari Kart Tipi",
    "operator": "IN"
  },
  {
    "field": "satiselemani",
    "globalFilterKey": "satisTemsilcisi",
    "label": "Satış Temsilcisi",
    "operator": "IN"
  }
]
```

---

#### Adım 2: GlobalFilters Değişikliği Algılama Mekanizması

`useDynamicWidgetData.tsx` içinde filtre değişikliklerini izleyen yeni bir useEffect eklenmeli:

```typescript
// Filtre değişikliklerini izle (render döngüsü olmadan)
const prevFiltersRef = useRef<string>('');

useEffect(() => {
  const filtersKey = JSON.stringify(globalFiltersRef.current);
  
  // İlk render değilse VE filtre değiştiyse yeniden işle
  if (prevFiltersRef.current && prevFiltersRef.current !== filtersKey) {
    // Cache'deki veriyi al ve filtreleri yeniden uygula
    processDataWithFilters();
  }
  prevFiltersRef.current = filtersKey;
}, [globalFilters]); // Sadece filtre değişikliğinde çalış
```

---

#### Adım 3: Veri İşleme ve Filtreleme Ayırma

Mevcut `fetchData` iki ayrı fonksiyona bölünmeli:

1. **`loadRawData()`**: Cache'den veya API'den veri çeker (nadir çağrılır)
2. **`processDataWithFilters()`**: Raw veri üzerinde global filtreleri uygular ve görselleştirme verisini hazırlar (her filtre değişikliğinde çağrılır)

```typescript
// Raw veriyi tut (filtrelenmemiş)
const rawDataRef = useRef<any[]>([]);

const processDataWithFilters = useCallback(() => {
  const currentFilters = globalFiltersRef.current;
  let processedData = [...rawDataRef.current];
  
  // Global filtreleri uygula
  if (currentFilters) {
    processedData = applyGlobalFilters(processedData, currentFilters);
  }
  
  // Görselleştirme tipine göre işle ve setData
  processVisualization(processedData, config);
}, [configKey]);
```

---

#### Adım 4: Widget Builder'da Filtre Alanı Seçici

Widget oluşturulurken hangi global filtrelerin bu widget'ı etkileyeceği seçilebilmeli:

```typescript
// WidgetBuilderConfig'e eklenecek
interface WidgetBuilderConfig {
  // ...mevcut alanlar
  
  // Bu widget'ın etkileneceği global filtreler
  affectedByFilters?: {
    globalFilterKey: string;  // 'cariKartTipi', 'satisTemsilcisi', vb.
    dataField: string;        // Verideki alan adı
    operator: 'IN' | '=' | 'contains';
  }[];
  
  // Bu widget'ın oluşturacağı cross-filter (tıklanınca diğer widget'ları etkiler)
  crossFilterField?: {
    dataField: string;
    globalFilterKey: string;
    label: string;
  };
}
```

---

#### Adım 5: Çapraz Filtreleme (Cross-Filter) Mekanizması

Power BI'daki gibi bir grafik segmentine tıklandığında diğer widget'ları filtreleyen mekanizma:

```typescript
// GlobalFilterContext'e eklenecek
interface GlobalFilterContextType {
  // ...mevcut alanlar
  
  // Çapraz filtre (widget tıklamasından gelen geçici filtre)
  crossFilter: {
    sourceWidgetId: string;
    field: string;
    value: string | string[];
  } | null;
  
  setCrossFilter: (filter: CrossFilter | null) => void;
  clearCrossFilter: () => void;
}
```

Widget'lar tıklanabilir hale gelecek:

```typescript
// Grafik segmentine tıklandığında
const handleChartClick = (segment: { name: string; value: number }) => {
  if (config.crossFilterField) {
    setCrossFilter({
      sourceWidgetId: widgetId,
      field: config.crossFilterField.globalFilterKey,
      value: segment.name,
    });
  }
};
```

---

#### Adım 6: Data Source Düzeyinde Filtre Yapılandırması UI

Admin panelindeki DataSourceManager'a filtre alanı seçici eklenmeli:

```
┌─────────────────────────────────────────────────────────────┐
│ Veri Kaynağı: Cari Kart Listesi                            │
├─────────────────────────────────────────────────────────────┤
│ Filtrelenebilir Alanlar:                                   │
│  ☑ carikarttipi → Cari Kart Tipi (AL/AS/ST)               │
│  ☑ satiselemani → Satış Temsilcisi                        │
│  ☑ subekodu → Şube                                         │
│  ☐ depokodu → Depo                                         │
│  ☑ ozelkod1kod → Özel Kod 1                               │
└─────────────────────────────────────────────────────────────┘
```

---

### Teknik Değişiklikler

| Dosya | Değişiklik |
|-------|------------|
| `src/hooks/useDynamicWidgetData.tsx` | Filtre değişiklik izleme, veri işleme ayrıştırma |
| `src/contexts/GlobalFilterContext.tsx` | CrossFilter state ve setter'ları |
| `src/lib/filterTypes.ts` | CrossFilter type tanımları |
| `src/lib/widgetBuilderTypes.ts` | affectedByFilters, crossFilterField alanları |
| `src/components/admin/DataSourceManager.tsx` | Filterable fields UI |
| `src/components/admin/WidgetBuilder.tsx` | Filtre bağlama seçenekleri |
| Migration | filterable_fields sütunu |

---

### Beklenen Davranış

1. **Filtre Barından Seçim**: Kullanıcı "Alıcı" seçtiğinde, sadece `carikarttipi` alanı içeren veri kaynaklarını kullanan widget'lar filtrelenir.

2. **Çapraz Filtreleme**: Pasta grafiğinde "İstanbul" dilimini tıklamak, diğer tüm widget'ları şehir=İstanbul için filtreler.

3. **Akıllı Filtre Atlama**: Banka/Kasa widget'ları gibi `carikarttipi` alanı olmayan widget'lar bu filtreden etkilenmez.

4. **Anlık Güncelleme**: Filtre değişikliğinde widget'lar cache'deki veriyi yeniden işler (API çağrısı yapmadan).

---

### İlk Adım: Acil Düzeltme

Filtreler çalışsın diye hemen yapılması gereken: `globalFilters` değiştiğinde `processDataWithFilters()` çağrılmalı:

```typescript
// useDynamicWidgetData.tsx - Filtre değişikliği izleme
const globalFiltersKey = useMemo(() => 
  JSON.stringify(globalFilters), 
  [globalFilters]
);

useEffect(() => {
  if (rawDataRef.current.length > 0) {
    processDataWithFilters();
  }
}, [globalFiltersKey, processDataWithFilters]);
```

Bu plan onaylanırsa, önce acil düzeltmeyi yapıp filtrelerin çalışmasını sağlayacağım, ardından Power BI benzeri çapraz filtreleme özelliklerini aşamalı olarak ekleyeceğim.
