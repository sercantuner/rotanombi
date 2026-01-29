
# İki Grafik Yan Yana Koyunca Büyüme Sorunu - Analiz ve Çözüm

## Teşhis Özeti

Ekran görüntüsünde **Cari Kaynak Dağılımı** (12 kaynak) ve **Sektörel Dağılım** (81 sektör) widget'ları yan yana konulduğunda her ikisinin de anormal şekilde büyüdüğü görülüyor.

### Kök Nedenler

```text
┌─────────────────────────────────────────────────────────────────┐
│                      chart_half Container                        │
│  ┌─────────────────────────┐  ┌─────────────────────────────┐   │
│  │   Cari Kaynak (12)      │  │   Sektör Dağılımı (81!)     │   │
│  │   ├── Header            │  │   ├── Header                │   │
│  │   ├── Donut (flex-1)    │  │   ├── Donut (flex-1)        │   │
│  │   └── Legend (shrink-0) │  │   └── Legend (shrink-0)     │   │
│  │       12 satır ~336px   │  │       81 satır ~2268px ❌   │   │
│  └─────────────────────────┘  └─────────────────────────────┘   │
│                                                                  │
│  [&>*]:h-full + items-stretch = Her iki slot aynı yüksekliğe    │
│  zorlanıyor, en büyük öğeye göre eşitleniyor!                   │
└─────────────────────────────────────────────────────────────────┘
```

| Sorun | Kaynak | Etki |
|-------|--------|------|
| **81 sektör legend** | Sektör Dağılımı widget'ı | Legend listeye göre container büyüyor |
| **CSS `items-stretch`** | ContainerRenderer satır 437 | İki slot birbirine eşitleniyor |
| **İlk render sorunu** | `hasEnoughSpace` effect | Başlangıçta legend gizlenmesi gecikmeli |
| **`flex-shrink-0`** | Widget customCode | Legend kendi boyutuna göre yer kaplıyor |

## Önerilen Çözüm

### 1. Widget Düzeyinde: Maksimum Görünür Kategori Limiti

Her iki widget'ın customCode'unda legend için sabit üst sınır:

```javascript
// Mevcut - Sınırsız legend
var LegendItems = function() {
  return chartData.map(function(entry, index) { ... });
};

// Yeni - İlk 8 kategori + "Diğerleri" butonu
var MAX_VISIBLE_LEGEND = 8;
var visibleData = chartData.slice(0, MAX_VISIBLE_LEGEND);
var hiddenCount = chartData.length - MAX_VISIBLE_LEGEND;

var LegendItems = function() {
  return [
    ...visibleData.map(function(entry, index) { ... }),
    hiddenCount > 0 && React.createElement('button', {
      onClick: function() { legendExpanded[1](true); },
      className: 'text-xs text-primary hover:underline'
    }, '+' + hiddenCount + ' daha...')
  ];
};
```

### 2. Widget Düzeyinde: İlk Render'da Legend Gizleme

```javascript
// Mevcut
var hasEnoughSpace = React.useState(true);

// Yeni - Çok fazla kategori varsa baştan gizle
var hasEnoughSpace = React.useState(chartData.length <= 12);
```

### 3. Widget Düzeyinde: Legend Container Max-Height

```javascript
// Legend listesi için sabit max-height ekle
React.createElement('div', { 
  className: 'w-full flex-shrink-0 overflow-y-auto',
  style: { maxHeight: '150px' }  // ~5-6 satır
}, ...)
```

### 4. ContainerRenderer: Slot'lara Max-Height Ekle (Opsiyonel)

```typescript
// Satır 436-445 civarı
<div className={cn(
  'grid gap-1 md:gap-2 items-stretch [&>*]:h-full',
  template.gridClass,
  // Grafik container'ları için min ve MAX yükseklik
  (container.container_type === 'chart_half' || 
   container.container_type === 'chart_third') && 
   '[&>*]:min-h-[280px] [&>*]:max-h-[400px]',  // ✅ max-h eklendi
)}>
```

---

## Uygulama Planı

### Adım 1: Sektör Dağılımı Widget Güncellemesi (SQL)
- İlk 10 kategoriyi göster, geri kalanı "Detaylar" butonuyla aç
- Legend başlangıçta gizli (chartData.length > 12 ise)
- Legend container'a `maxHeight: 150px` ekle

### Adım 2: Cari Kaynak Dağılımı Widget Güncellemesi (SQL)
- Aynı mantık uygulanacak (zaten 12 kaynak olduğu için daha az etkili)
- Tutarlılık için aynı yapı

### Adım 3: ContainerRenderer Güncellemesi
- `chart_half` ve `chart_third` container'lara `max-h-[400px]` ekle
- Bu, widgetların sonsuz büyümesini engelleyecek

### Adım 4: AI Kod Üretici Kuralı (Edge Function)
- Yeni widget'larda legend'ın max-height ile sınırlandırılması zorunlu kılınacak

---

## Teknik Değişiklikler

| Dosya | Değişiklik |
|-------|------------|
| `widgets` tablosu (SQL) | Sektör Dağılımı customCode: legend max-height + limit |
| `widgets` tablosu (SQL) | Cari Kaynak Dağılımı customCode: legend max-height |
| `ContainerRenderer.tsx` | chart_half/third için max-h-[400px] |
| `ai-code-generator/index.ts` | Legend sınırlama kuralı ekleme |

## Beklenen Sonuç

- İki grafik yan yana koyulduğunda her biri ~280-400px arasında kalacak
- Legend'lar scroll ile görüntülenecek (max 150px)
- Çok fazla kategori olduğunda "Detaylar" butonu ile açılabilir modal
