
# AI Widget Oluşturucusu Zenginleştirme Planı

## Genel Bakış

AI widget oluşturucusunun aşağıdaki yeteneklerle genişletilmesi:

1. **Etiket Önerisi** - AI'nın widget için uygun etiketleri önermesi
2. **Teknik Açıklama** - Kullanılan alanlar ve hesaplamaların açıklanması
3. **Kısa Açıklama** - Widget için özet açıklama önerisi
4. **Uzun Açıklama** - Detaylı dokümantasyon
5. **Önizleme Görseli** - Marketplace'de görünecek widget thumbnail'i

## Veritabanı Değişiklikleri

### Yeni Kolonlar (`widgets` Tablosu)

| Kolon Adı | Tip | Açıklama |
|-----------|-----|----------|
| `short_description` | TEXT | Kısa açıklama (Marketplace kart başlığı) |
| `long_description` | TEXT | Detaylı açıklama (Markdown destekli) |
| `technical_notes` | JSONB | Kullanılan alanlar, hesaplamalar, veri akışı |
| `preview_image` | TEXT | Base64 veya URL - widget önizleme görseli |
| `ai_suggested_tags` | TEXT[] | AI tarafından önerilen etiketler |

```text
+----------------------------+
| widgets (yeni kolonlar)    |
+----------------------------+
| short_description  TEXT    |
| long_description   TEXT    |
| technical_notes    JSONB   |
| preview_image      TEXT    |
| ai_suggested_tags  TEXT[]  |
+----------------------------+
```

### `technical_notes` JSONB Yapısı

```json
{
  "usedFields": [
    { "name": "bakiye", "type": "number", "usage": "Y ekseni değeri" },
    { "name": "unvan", "type": "string", "usage": "X ekseni etiketi" }
  ],
  "calculations": [
    { "name": "Toplam Bakiye", "formula": "sum(bakiye)", "description": "Tüm bakiyelerin toplamı" },
    { "name": "Kâr Marjı", "formula": "(satis - maliyet) / satis * 100", "description": "Yüzde olarak kâr oranı" }
  ],
  "dataFlow": "Cari kart listesinden bakiye > 0 olan kayıtlar filtrelenir, ünvana göre gruplanır",
  "chartType": "bar",
  "generatedAt": "2026-02-06T14:00:00Z"
}
```

---

## AI Edge Function Değişiklikleri

### Dosya: `supabase/functions/ai-code-generator/index.ts`

**1. Yeni Çıktı Formatı**

AI artık sadece kod değil, yapılandırılmış bir JSON döndürecek:

```typescript
// Yanıt formatı
{
  "code": "function Widget({ data, colors }) {...} return Widget;",
  "metadata": {
    "suggestedTags": ["finans", "bakiye", "cari"],
    "shortDescription": "Cari hesap bakiyelerinin sektör bazlı dağılımı",
    "longDescription": "Bu widget, aktif cari hesapların toplam bakiyelerini sektör koduna göre gruplandırarak bar grafiği ile gösterir...",
    "technicalNotes": {
      "usedFields": [...],
      "calculations": [...],
      "dataFlow": "..."
    }
  }
}
```

**2. Tool Calling ile Yapılandırılmış Çıktı**

Mevcut prompt'a ek olarak, AI'dan yapılandırılmış metadata almak için tool calling kullanılacak:

```typescript
// ai-code-generator/index.ts - Yeni tool tanımı
body.tools = [{
  type: "function",
  function: {
    name: "generate_widget_with_metadata",
    description: "Widget kodu ve metadata bilgilerini döndür",
    parameters: {
      type: "object",
      properties: {
        code: { type: "string", description: "Widget JavaScript kodu" },
        suggestedTags: { 
          type: "array", 
          items: { type: "string" },
          description: "Widget için önerilen etiketler (maks 5)" 
        },
        shortDescription: { 
          type: "string", 
          description: "Widget'ın kısa açıklaması (maks 100 karakter)" 
        },
        longDescription: { 
          type: "string", 
          description: "Widget'ın detaylı açıklaması (Markdown destekli)" 
        },
        usedFields: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              type: { type: "string" },
              usage: { type: "string" }
            }
          }
        },
        calculations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              formula: { type: "string" },
              description: { type: "string" }
            }
          }
        },
        dataFlow: { type: "string" }
      },
      required: ["code", "suggestedTags", "shortDescription"]
    }
  }
}];
body.tool_choice = { type: "function", function: { name: "generate_widget_with_metadata" } };
```

**3. System Prompt Güncellemesi**

```text
KOD ÜRETİMİ SONRASI META VERİ:
───────────────────────────────────────────────────────────────────────────────
Widget kodunu ürettikten sonra aşağıdaki metadata bilgilerini de sağla:

📌 ETİKET ÖNERİLERİ (suggestedTags):
   - Widget'ın içeriğine uygun 3-5 etiket öner
   - Mevcut kategorilerden seç: finans, satis, cari, stok, performans, rapor...

📝 KISA AÇIKLAMA (shortDescription):
   - Widget'ın ne yaptığını tek cümlede özetle (max 100 karakter)
   - Örnek: "Müşteri bazlı satış performansı karşılaştırması"

📖 UZUN AÇIKLAMA (longDescription):
   - Widget'ın detaylı açıklaması (Markdown destekli)
   - Ne gösterdiği, nasıl kullanılacağı, dikkat edilecek noktalar

🔧 TEKNİK NOTLAR:
   usedFields: Kullanılan veri alanları ve rolleri
     Örnek: [{ name: "bakiye", type: "number", usage: "Y ekseni değeri" }]
   
   calculations: Yapılan hesaplamalar
     Örnek: [{ name: "Toplam", formula: "sum(bakiye)", description: "Bakiye toplamı" }]
   
   dataFlow: Verinin işlenme akışı
     Örnek: "Cari kartlar bakiyeye göre filtrelenir, sektör koduna göre gruplandırılır"
```

---

## Widget Builder UI Değişiklikleri

### Dosya: `src/components/admin/CustomCodeWidgetBuilder.tsx`

**1. Yeni State Değişkenleri**

```typescript
// AI'dan gelen metadata
const [aiSuggestedTags, setAiSuggestedTags] = useState<string[]>([]);
const [shortDescription, setShortDescription] = useState('');
const [longDescription, setLongDescription] = useState('');
const [technicalNotes, setTechnicalNotes] = useState<{
  usedFields: { name: string; type: string; usage: string }[];
  calculations: { name: string; formula: string; description: string }[];
  dataFlow: string;
} | null>(null);
const [previewImage, setPreviewImage] = useState<string | null>(null);
```

**2. AI Yanıt İşleme Güncellemesi**

```typescript
// generateCodeWithAI fonksiyonunda
const generatedCode = response.data?.code;
const metadata = response.data?.metadata;

if (generatedCode) {
  setCustomCode(generatedCode);
  
  // Metadata'yı state'lere aktar
  if (metadata?.suggestedTags) setAiSuggestedTags(metadata.suggestedTags);
  if (metadata?.shortDescription) setShortDescription(metadata.shortDescription);
  if (metadata?.longDescription) setLongDescription(metadata.longDescription);
  if (metadata?.technicalNotes) setTechnicalNotes(metadata.technicalNotes);
}
```

**3. Step 4 (Önizle & Kaydet) UI Güncellemesi**

Mevcut özet paneline yeni alanlar eklenir:

```text
+------------------------------------------+
| Widget Özeti                             |
+------------------------------------------+
| Key: custom_widget_123                   |
| Ad: Sektör Bazlı Bakiye                  |
| Boyut: lg                                |
+------------------------------------------+
| Kısa Açıklama:                           |
| [______________________________]         |
+------------------------------------------+
| Önerilen Etiketler:                      |
| [finans] [cari] [bakiye] [+]             |
+------------------------------------------+
| Teknik Notlar:                           |
| > Kullanılan Alanlar (Collapsible)       |
|   - bakiye (number): Y ekseni değeri     |
|   - sektorkodu (string): Gruplama alanı  |
| > Hesaplamalar (Collapsible)             |
|   - Toplam: sum(bakiye)                  |
| > Veri Akışı                             |
|   Cari kartlar filtrele -> grupla -> ...  |
+------------------------------------------+
| [Önizleme Görseli Oluştur]               |
+------------------------------------------+
```

**4. Önizleme Görseli Oluşturma**

html2canvas kütüphanesi ile widget'ın ekran görüntüsünü al:

```typescript
import html2canvas from 'html2canvas';

const capturePreviewImage = async () => {
  const previewElement = document.getElementById('widget-preview-container');
  if (!previewElement) return;
  
  try {
    const canvas = await html2canvas(previewElement, {
      backgroundColor: null,
      scale: 0.5, // Düşük çözünürlük (thumbnail)
      logging: false,
    });
    
    const imageData = canvas.toDataURL('image/png');
    setPreviewImage(imageData);
    toast.success('Önizleme görseli oluşturuldu');
  } catch (err) {
    toast.error('Görsel oluşturulamadı');
  }
};
```

**5. handleSave Güncellemesi**

```typescript
const builderConfig: Record<string, any> = {
  customCode: customCode,
  // ... mevcut alanlar
  
  // Yeni metadata alanları
  shortDescription: shortDescription,
  longDescription: longDescription,
  technicalNotes: technicalNotes,
  aiSuggestedTags: aiSuggestedTags,
  previewImage: previewImage,
};

const formData: WidgetFormData = {
  // ... mevcut alanlar
  description: shortDescription || widgetDescription, // Kısa açıklamayı description olarak kullan
  // Yeni alanlar (tip tanımlarına eklenmeli)
};
```

---

## Marketplace UI Değişiklikleri

### Dosya: `src/components/dashboard/WidgetMarketplace.tsx`

**1. Genişletilmiş Widget Kartı**

```text
+----------------------------------------+
| [İkon] Widget Adı            [+ Ekle]  |
| [finans] [cari]                        |
+----------------------------------------+
| [Önizleme Görseli veya Placeholder]    |
| (150px yükseklik)                      |
+----------------------------------------+
| Kısa açıklama buraya gelir...          |
|                                        |
| [Detaylar] butonuna tıklayınca modal   |
+----------------------------------------+
| chart | lg                             |
+----------------------------------------+
```

**2. Detay Modal**

Widget kartına tıklandığında açılan detaylı bilgi modalı:

```text
+--------------------------------------------------+
| Widget Detayları                          [X]    |
+--------------------------------------------------+
| [Büyük Önizleme Görseli]                         |
+--------------------------------------------------+
| Sektör Bazlı Bakiye Analizi                      |
| [finans] [cari] [bakiye]                         |
+--------------------------------------------------+
| AÇIKLAMA                                         |
| Bu widget, aktif cari hesapların toplam          |
| bakiyelerini sektör koduna göre gruplandırarak   |
| bar grafiği ile gösterir...                      |
+--------------------------------------------------+
| TEKNİK BİLGİLER                                  |
| ▼ Kullanılan Alanlar                             |
|   • bakiye (number) - Y ekseni değeri            |
|   • sektorkodu (string) - Gruplama alanı         |
| ▼ Hesaplamalar                                   |
|   • Toplam: sum(bakiye)                          |
| ▼ Veri Akışı                                     |
|   Cari kartlar filtrelenir...                    |
+--------------------------------------------------+
| [Bu Widget'ı Ekle]                               |
+--------------------------------------------------+
```

**3. Yeni Bileşen: WidgetDetailModal**

```typescript
// src/components/dashboard/WidgetDetailModal.tsx
interface WidgetDetailModalProps {
  widget: Widget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddWidget: (widgetKey: string) => void;
}
```

---

## Tip Tanımı Değişiklikleri

### Dosya: `src/lib/widgetTypes.ts`

```typescript
export interface Widget {
  // ... mevcut alanlar
  
  // Yeni alanlar
  short_description?: string;
  long_description?: string;
  technical_notes?: {
    usedFields?: { name: string; type: string; usage: string }[];
    calculations?: { name: string; formula: string; description: string }[];
    dataFlow?: string;
    chartType?: string;
    generatedAt?: string;
  };
  preview_image?: string;
  ai_suggested_tags?: string[];
}

export interface WidgetFormData {
  // ... mevcut alanlar
  
  // Yeni alanlar
  short_description?: string;
  long_description?: string;
  technical_notes?: Record<string, any>;
  preview_image?: string;
  ai_suggested_tags?: string[];
}
```

---

## Bağımlılık Ekleme

### `package.json`

```json
{
  "dependencies": {
    "html2canvas": "^1.4.1"
  }
}
```

---

## Uygulama Adımları

### Aşama 1: Veritabanı
1. Migration ile yeni kolonları ekle
2. Mevcut widget'lar için null değerler

### Aşama 2: AI Edge Function
1. Tool calling ile yapılandırılmış çıktı
2. System prompt güncellemesi
3. Yanıt parsing mantığı

### Aşama 3: Widget Builder
1. Yeni state'ler ve UI alanları
2. AI yanıt işleme güncellemesi
3. html2canvas ile görsel yakalama
4. handleSave güncellemesi

### Aşama 4: Marketplace
1. Widget kartı tasarımı güncelleme
2. WidgetDetailModal bileşeni
3. Önizleme görseli gösterimi

### Aşama 5: Tip Tanımları
1. Widget interface güncelleme
2. WidgetFormData güncelleme

---

## Test Senaryoları

1. Yeni widget oluştur - AI'dan metadata geldiğini doğrula
2. Marketplace'de yeni widget kartının görünümünü kontrol et
3. Detay modalının açılıp içeriğin gösterildiğini test et
4. Önizleme görseli oluşturma butonunu test et
5. Mevcut widget'ları düzenlerken metadata'nın korunduğunu doğrula
