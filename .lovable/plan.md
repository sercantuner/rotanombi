
# Genişletilmiş AI Widget Sistemi - Kapsamlı Standartlaştırma Planı

## Genel Bakış
Bu plan, widget oluşturma sistemini sadeleştirip yalnızca AI tabanlı kod üretimine geçişi, katı standartların belirlenmesini ve talep edilen yeni özelliklerin eklenmesini kapsar.

---

## Bölüm 1: Dark Mode Antrasit Gri Tema

### Mevcut Durum
Şu an dark mode `220 15% 8%` (hue:220, saturation:15%, lightness:8%) kullanıyor. Bu zaten antrasit tonuna yakın ama daha belirgin hale getirilebilir.

### Yapılacak Değişiklikler

| CSS Değişkeni | Mevcut | Yeni (Antrasit) |
|---------------|--------|-----------------|
| `--background` | `220 15% 8%` | `220 10% 10%` |
| `--card` | `220 15% 10%` | `220 10% 13%` |
| `--muted` | `220 12% 13%` | `220 10% 16%` |
| `--secondary` | `220 12% 15%` | `220 10% 18%` |
| `--border` | `220 12% 18%` | `220 10% 22%` |
| `--sidebar-background` | `220 15% 6%` | `220 10% 8%` |

Saturation düşürülerek (15% → 10%) daha "gri" ve kurumsal görünüm elde edilecek.

**Dosya:** `src/index.css`

---

## Bölüm 2: Birleşik Widget Yapıları (Composite Widgets)

### Desteklenecek Birleşik Yapılar

```text
┌─────────────────────────────────────────────────────────────┐
│  COMPOSITE WIDGET TİPLERİ                                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. KPI + Liste                                             │
│     ┌──────────────────────────────────────┐                │
│     │  Toplam: ₺2.5M              📊       │ ← KPI Header   │
│     │  12 hesap                            │                │
│     ├──────────────────────────────────────┤                │
│     │  🏦 Garanti    ₺850K    TRY         │ ← Liste        │
│     │  🏦 İş Bank    $120K    USD         │                │
│     │  🏦 Yapı Kredi ₺450K    TRY         │                │
│     └──────────────────────────────────────┘                │
│                                                             │
│  2. Grafik + Tablo                                          │
│     ┌──────────────────────────────────────┐                │
│     │  [====  BAR CHART  ====]            │ ← Grafik       │
│     ├──────────────────────────────────────┤                │
│     │  Kategori  |  Değer  |  %           │ ← Tablo        │
│     │  90+ Gün   |  ₺150K  |  45%         │                │
│     │  60-90     |  ₺80K   |  24%         │                │
│     └──────────────────────────────────────┘                │
│                                                             │
│  3. Multi-KPI + Grafik                                      │
│     ┌──────────────────────────────────────┐                │
│     │  Satış   Tahsilat   Ödeme           │ ← KPI Row      │
│     │  ₺85K    ₺42K       ₺18K            │                │
│     ├──────────────────────────────────────┤                │
│     │  [====  LINE CHART  ====]           │ ← Grafik       │
│     └──────────────────────────────────────┘                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### AI Prompt'a Eklenecek Şablon Talimatları

AI, birleşik widget isteklerini tanıyacak ve uygun yapıyı üretecek:
- "üstte grafik altta tablo" → Chart + Table composite
- "KPI ve liste" → KPI Header + List composite  
- "özet kartları ve detay grafiği" → Multi-KPI + Chart composite

---

## Bölüm 3: Çoklu Para Birimi Desteği

### Para Birimi Sistemi

```javascript
// AI'ın kullanacağı para birimi formatlayıcı
var CURRENCY_SYMBOLS = {
  TRY: '₺', TL: '₺',
  USD: '$',
  EUR: '€',
  GBP: '£',
  CHF: 'Fr.',
  JPY: '¥',
  CNY: '¥',
  RUB: '₽',
  AED: 'د.إ',
  SAR: '﷼'
};

var formatCurrency = function(value, currency) {
  currency = currency || 'TRY';
  var symbol = CURRENCY_SYMBOLS[currency] || currency + ' ';
  var absValue = Math.abs(value);
  var formatted;
  
  if (absValue >= 1000000000) {
    formatted = (value / 1000000000).toFixed(1) + 'B';
  } else if (absValue >= 1000000) {
    formatted = (value / 1000000).toFixed(1) + 'M';
  } else if (absValue >= 1000) {
    formatted = (value / 1000).toFixed(0) + 'K';
  } else {
    formatted = value.toLocaleString('tr-TR');
  }
  
  return symbol + formatted;
};
```

**AI System Prompt'a Eklenecek:**
- Para birimi alanı varsa (`doviz`, `currency`, `dovizCinsi`) otomatik kullan
- Varsayılan para birimi: TRY (₺)
- Çoklu para birimi listelerinde her satırda ilgili sembol göster

---

## Bölüm 4: Grafik Limit/Hedef ve Uyarı Sistemi

### 4.1 Yeni Veritabanı Alanları

`widgets.builder_config` içine yeni `alerts` konfigürasyonu eklenecek:

```typescript
interface AlertConfig {
  id: string;
  name: string;              // "Aylık Satış Hedefi"
  enabled: boolean;
  field: string;             // Hangi alanda kontrol edilecek
  aggregation: 'sum' | 'avg' | 'max' | 'count';
  condition: 'above' | 'below' | 'equals';
  threshold: number;         // 500000 (₺500K hedef)
  notificationType: 'critical' | 'warning' | 'info';
  showReferenceLine: boolean; // Grafikte çizgi göster
  referenceLineColor?: string;
  referenceLineLabel?: string; // "Hedef: ₺500K"
}

interface WidgetBuilderConfig {
  // ... mevcut alanlar
  alerts?: AlertConfig[];
}
```

### 4.2 Görsel Gösterim (ReferenceLine)

```text
     ₺
     │
 600K├────────────────────────────────
     │          ██
 500K├─────────────── HEDEF ───────── (Kırmızı kesikli çizgi)
     │    ██    ██         ██
 400K├─   ██    ██    ██   ██
     │    ██    ██    ██   ██
     └────┴─────┴─────┴────┴─────────► Ay
         Oca   Şub   Mar  Nis
```

### 4.3 Bildirim Tetikleme Akışı

```text
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Widget Render  │ ──► │  Alert Check    │ ──► │  Notification   │
│  (veri geldi)   │     │  (threshold?)   │     │  Create         │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  Koşul: value > 500K │
                    │  Sonuç: TRUE         │
                    │  → Bildirim oluştur  │
                    └─────────────────────┘
```

**Bildirim Örneği:**
```json
{
  "title": "Satış Hedefi Aşıldı! 🎉",
  "message": "Ali Yılmaz Ocak ayında ₺520K satış yaparak ₺500K hedefini aştı.",
  "type": "info",
  "category": "widget_alert",
  "data": {
    "widget_id": "xyz",
    "alert_id": "sales_target",
    "actual_value": 520000,
    "threshold": 500000
  }
}
```

### 4.4 AI Prompt'a Eklenecek Talimatlar

```text
HEDEF/LİMİT ÇİZGİSİ KULLANIMI:
- Kullanıcı hedef veya limit belirtirse ReferenceLine kullan
- ReferenceLine için: stroke: 'hsl(var(--destructive))' veya getColor(index)
- Label için: strokeDasharray="5 5", label={{ value: 'Hedef', position: 'right' }}

Örnek:
React.createElement(Recharts.ReferenceLine, {
  y: 500000,
  stroke: 'hsl(var(--warning))',
  strokeDasharray: '5 5',
  label: { value: 'Hedef: ₺500K', position: 'right', fill: 'hsl(var(--foreground))' }
})
```

---

## Bölüm 5: Trend Line ve İstatistiksel Özellikler

### 5.1 Trend Line Hesaplama

```javascript
// Linear Regression için basit hesaplama
var calculateTrendLine = function(data, xField, yField) {
  var n = data.length;
  if (n < 2) return null;
  
  var sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  
  data.forEach(function(item, i) {
    var x = i;
    var y = parseFloat(item[yField]) || 0;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  });
  
  var slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  var intercept = (sumY - slope * sumX) / n;
  
  return data.map(function(item, i) {
    return { x: item[xField], trend: intercept + slope * i };
  });
};
```

### 5.2 Desteklenecek İstatistiksel Özellikler

| Özellik | Açıklama | Recharts Bileşeni |
|---------|----------|-------------------|
| Trend Line | Lineer regresyon çizgisi | `<Line>` overlay |
| Average Line | Ortalama değer çizgisi | `<ReferenceLine y={avg}>` |
| Min/Max Markers | En düşük/yüksek nokta işaretleri | `<ReferenceDot>` |
| Target Line | Hedef/limit çizgisi | `<ReferenceLine y={target}>` |
| Confidence Band | Güven aralığı | `<Area>` (üst-alt) |

### 5.3 AI System Prompt Eklentisi

```text
TREND VE İSTATİSTİK ÖZELLİKLERİ:

1. TREND LINE (Eğilim Çizgisi):
   - Line/Area grafiklerde kullan
   - Noktalı çizgi ile göster: strokeDasharray="8 4"
   - Renk: getColor(1) veya 'hsl(var(--muted-foreground))'
   
2. ORTALAMA ÇİZGİSİ:
   React.createElement(Recharts.ReferenceLine, {
     y: ortalama,
     stroke: 'hsl(var(--accent))',
     strokeDasharray: '3 3',
     label: { value: 'Ort: ' + formatCurrency(ortalama), position: 'right' }
   })

3. MIN/MAX İŞARETLERİ:
   React.createElement(Recharts.ReferenceDot, {
     x: maxItem.name, y: maxItem.value,
     r: 6, fill: 'hsl(var(--success))',
     label: { value: 'Max', position: 'top' }
   })
```

---

## Bölüm 6: Güncellenmiş AI System Prompt

### 6.1 Tam System Prompt Yapısı

```text
┌────────────────────────────────────────────────────────────────────┐
│  AI WIDGET GENERATOR - ZORUNLU KURALLAR v2.0                       │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  📋 KOD YAPISI                                                     │
│  ├── JavaScript only (TypeScript yasak)                           │
│  ├── React.createElement (JSX yasak)                               │
│  ├── function Widget({ data, colors }) formatı ZORUNLU             │
│  ├── React.useState, React.useMemo (import yok)                    │
│  └── return Widget; (en sonda)                                     │
│                                                                    │
│  🎨 RENK SİSTEMİ                                                   │
│  ├── Hardcoded renkler YASAK (#hex, rgb(), text-red-500)           │
│  ├── CSS değişkenleri ZORUNLU:                                     │
│  │   ├── Metin: text-foreground, text-muted-foreground             │
│  │   ├── Arka plan: bg-card, bg-background, bg-muted               │
│  │   ├── Pozitif: text-success                                     │
│  │   ├── Negatif: text-destructive                                 │
│  │   └── Vurgu: text-primary, text-accent                          │
│  └── Dark mode uyumu otomatik                                      │
│                                                                    │
│  📊 GRAFİK RENKLERİ (colors prop)                                  │
│  ├── var getColor = function(index) {                              │
│  │     return colors && colors[index % colors.length]              │
│  │       ? colors[index % colors.length]                           │
│  │       : 'hsl(var(--primary))';                                  │
│  │   };                                                            │
│  ├── Recharts'ta: fill: getColor(0), stroke: getColor(0)           │
│  └── PieChart Cell'lerinde: fill: getColor(idx)                    │
│                                                                    │
│  💰 PARA BİRİMİ                                                    │
│  ├── Varsayılan: ₺ (TRY)                                           │
│  ├── Desteklenen: $, €, £, ¥, ₽, Fr.                               │
│  ├── Format: K (bin), M (milyon), B (milyar)                       │
│  ├── Locale: tr-TR                                                 │
│  └── Çoklu para birimi: veri içindeki `doviz` alanını kullan       │
│                                                                    │
│  📈 TREND & HEDEF ÇİZGİLERİ                                        │
│  ├── ReferenceLine: hedef/limit gösterimi                          │
│  ├── Trend Line: lineer regresyon (Line overlay)                   │
│  ├── Average Line: ortalama çizgisi                                │
│  └── Min/Max Dot: uç nokta işaretleri                              │
│                                                                    │
│  🔗 BİRLEŞİK WIDGET YAPILARI                                       │
│  ├── KPI + Liste: Başlıkta özet, altta detay listesi               │
│  ├── Grafik + Tablo: Üstte görselleştirme, altta veri tablosu      │
│  └── Multi-KPI + Grafik: Üstte özet kartlar, altta grafik          │
│                                                                    │
│  ⚠️ YASAKLAR                                                       │
│  ├── text-white, text-black, bg-white, bg-black                    │
│  ├── text-red-500, bg-blue-600 vb. sabit Tailwind renkleri         │
│  ├── #RRGGBB hex kodları                                           │
│  ├── rgb(), rgba() değerleri                                       │
│  └── import/require ifadeleri                                      │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## Bölüm 7: Dosya Değişiklikleri Özeti

### Değiştirilecek Dosyalar

| Dosya | Değişiklik Tipi | Açıklama |
|-------|-----------------|----------|
| `src/index.css` | Güncelleme | Antrasit gri dark mode renkleri |
| `src/lib/widgetBuilderTypes.ts` | Güncelleme | AlertConfig interface ekleme |
| `supabase/functions/ai-code-generator/index.ts` | Güncelleme | Genişletilmiş system prompt |
| `src/components/admin/CustomCodeWidgetBuilder.tsx` | Güncelleme | Alert yapılandırma UI, kural özeti paneli |
| `src/components/dashboard/BuilderWidgetRenderer.tsx` | Güncelleme | Alert kontrolü ve bildirim tetikleme |
| `src/hooks/useChartColorPalette.tsx` | Güncelleme | Trend line renk desteği |

### Kaldırılacak/Gizlenecek Dosyalar

| Dosya | İşlem | Açıklama |
|-------|-------|----------|
| `src/components/admin/WidgetBuilder.tsx` | Gizle | No-code builder |
| `src/components/admin/FieldWellBuilder.tsx` | Gizle | Field wells |
| `src/components/admin/FieldWellItem.tsx` | Gizle | Field well item |
| `src/components/admin/WidgetTemplates.tsx` | Gizle | No-code şablonları |
| `src/components/admin/PivotConfigBuilder.tsx` | Gizle | Pivot konfigürasyonu |

---

## Bölüm 8: Uygulama Adımları

### Adım 1: Tema Güncellemesi
- `src/index.css` dosyasında dark mode renk değerlerini antrasit griye güncelle

### Adım 2: Alert Sistemi Altyapısı
- `widgetBuilderTypes.ts`'e `AlertConfig` interface ekle
- `WidgetBuilderConfig`'e `alerts?: AlertConfig[]` alanı ekle

### Adım 3: AI System Prompt Güncelleme
- `ai-code-generator/index.ts`'i tam kapsamlı kurallarla güncelle
- Para birimi, birleşik widget, trend line talimatlarını ekle

### Adım 4: Alert UI ve Tetikleme
- `CustomCodeWidgetBuilder.tsx`'e alert yapılandırma bölümü ekle
- `BuilderWidgetRenderer.tsx`'e alert kontrolü ve `createNotification` çağrısı ekle

### Adım 5: No-Code Builder Temizliği
- `SuperAdminWidgetManager.tsx`'den no-code builder linklerini kaldır
- İlgili dosyaları gizle veya sil

---

## Sonuç

Bu plan uygulandığında:
- ✅ Antrasit gri kurumsal dark mode
- ✅ Tek widget oluşturma yöntemi (AI tabanlı)
- ✅ Birleşik widget yapıları (KPI+Liste, Grafik+Tablo)
- ✅ Çoklu para birimi desteği (₺, $, €, £, vb.)
- ✅ Grafik hedef/limit çizgileri (ReferenceLine)
- ✅ Hedef aşımı/altında kalma bildirimleri
- ✅ Trend line ve istatistiksel göstergeler
- ✅ Katı ve belgelenmiş kod standartları
- ✅ Widget bazında renk paleti desteği (mevcut)
- ✅ Dark mode tam uyumluluk
