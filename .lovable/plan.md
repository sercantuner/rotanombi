
# AI Widget Builder - DIA Model Linkleri, Tarih Kuralları ve AI Zorunlulukları Yönetimi

## Özet
CustomCodeWidgetBuilder'ın AI Kod Üret (Step 2) sekmesine üç yeni özellik eklenecek:
1. **DIA Model Dokümantasyon Linkleri**: Kullanıcı veri modeli hakkında AI'ya bilgi vermek için DIA doc linkleri ekleyebilecek
2. **Tarih Kronolojisi Kuralı**: Grafikte tarih kullanılıyorsa eksik günlerin de 0 değeriyle gösterilmesi zorunluluğu
3. **AI Zorunlulukları Yönetimi**: Widget bazında AI'ın uyması gereken kuralları tanımlayabilme

---

## Bölüm 1: DIA Model Dokümantasyon Linkleri

### 1.1 UI Tasarımı

AI Prompt alanının üstüne yeni bir bölüm eklenecek:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  📚 DIA Model Referansları                                             [+]  │
├─────────────────────────────────────────────────────────────────────────────┤
│  Eklenen Linkler:                                                           │
│  [ScfCarikartListeViewModel ×]  [ScfVadeBakiyeModel ×]                      │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Link ekle: https://doc.dia.com.tr/doku.php?id=gelistirici:models:   │ [+]│
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Veri Yapısı

```typescript
interface DiaModelReference {
  url: string;
  modelName: string; // URL'den otomatik çıkarılacak
}

// State
const [diaModelLinks, setDiaModelLinks] = useState<DiaModelReference[]>([]);
```

### 1.3 AI Prompt'a Ekleme

DIA model linkleri AI'ya şu formatta gönderilecek:

```
📚 Referans DIA Modelleri:
- ScfCarikartListeViewModel: https://doc.dia.com.tr/doku.php?id=gelistirici:models:scf_carikart_liste_view_model
- ScfVadeBakiyeModel: https://doc.dia.com.tr/doku.php?id=gelistirici:models:scf_vade_bakiye_model

Bu modellerin alanlarını ve veri tiplerini dikkate al.
```

---

## Bölüm 2: Tarih Kronolojisi Kuralı

### 2.1 AI System Prompt Güncellemesi

`supabase/functions/ai-code-generator/index.ts` dosyasına yeni kural eklenecek:

```
═══════════════════════════════════════════════════════════════════════════════

📅 TARİH KRONOLOJİSİ KURALI (ZORUNLU!)
───────────────────────────────────────────────────────────────────────────────
Eğer grafikte tarih (X ekseni veya zaman serisi) kullanılıyorsa:

1. TÜM TARİHLER GÖSTERİLMELİ - Veri olmayan günler bile!
   - 30 günlük veri çekildiyse, grafikte 30 gün de gösterilmeli
   - Veri olmayan günler 0 değeriyle gösterilmeli
   
2. ZORUNLU HELPER FONKSİYON:
   var fillMissingDates = function(data, dateField, valueField, startDate, endDate) {
     var dateMap = {};
     data.forEach(function(item) {
       var d = new Date(item[dateField]);
       var key = d.toISOString().split('T')[0];
       dateMap[key] = parseFloat(item[valueField]) || 0;
     });
     
     var result = [];
     var current = new Date(startDate);
     var end = new Date(endDate);
     
     while (current <= end) {
       var key = current.toISOString().split('T')[0];
       result.push({
         [dateField]: key,
         [valueField]: dateMap[key] || 0
       });
       current.setDate(current.getDate() + 1);
     }
     
     return result;
   };

3. KRONOLOJİK SIRALAMA:
   - Tarihler her zaman kronolojik sırada (eskiden yeniye) gösterilmeli
   - data.sort(function(a, b) { return new Date(a.tarih) - new Date(b.tarih); })

❌ YANLIŞ: Sadece veri olan günleri göstermek
✅ DOĞRU: Tüm tarih aralığını, boş günleri 0 ile doldurup göstermek
```

### 2.2 Widget Builder'da Toggle

Kullanıcı bu kuralı aktif/pasif yapabilecek:

```
☑ Tarih Kronolojisi Zorunlu (eksik günleri 0 ile doldur)
```

---

## Bölüm 3: AI Zorunlulukları Yönetimi

### 3.1 UI Tasarımı - Collapsible Panel

AI Prompt alanının altına yeni bir collapsible bölüm eklenecek:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ⚙️ AI Zorunlulukları                                                   [▼] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Aktif Kurallar:                                                            │
│  ☑ Renk sistemi (CSS değişkenleri zorunlu)           [Varsayılan - Kilitli] │
│  ☑ Para birimi formatı (₺, K, M, B)                  [Varsayılan - Kilitli] │
│  ☑ React.createElement kullan (JSX yasak)            [Varsayılan - Kilitli] │
│  ☑ Tarih kronolojisi (eksik günleri 0 ile doldur)    [Seçilebilir]          │
│  ☐ Trend çizgisi ekle                                [Seçilebilir]          │
│  ☐ Ortalama çizgisi ekle                             [Seçilebilir]          │
│  ☐ Min/Max işaretleri                                [Seçilebilir]          │
│                                                                             │
│  Özel Kural Ekle:                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Örn: "Tüm değerleri yüzde olarak göster"                            │ [+]│
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  Eklenen Özel Kurallar:                                                     │
│  [Negatif değerleri kırmızı göster ×]  [Toplam satırı ekle ×]               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Veri Yapısı

```typescript
interface AIRequirement {
  id: string;
  label: string;
  description: string;
  isDefault: boolean;  // Varsayılan ve değiştirilemez
  isActive: boolean;
  promptAddition: string;  // AI prompt'a eklenecek metin
}

const DEFAULT_AI_REQUIREMENTS: AIRequirement[] = [
  {
    id: 'color_system',
    label: 'Renk sistemi',
    description: 'CSS değişkenleri zorunlu (text-foreground, bg-card vb.)',
    isDefault: true,
    isActive: true,
    promptAddition: 'Renk için sadece CSS değişkenlerini kullan (text-foreground, bg-card, text-success, text-destructive).'
  },
  {
    id: 'currency_format',
    label: 'Para birimi formatı',
    description: '₺, K, M, B formatında göster',
    isDefault: true,
    isActive: true,
    promptAddition: 'Para değerlerini formatCurrency fonksiyonu ile ₺, K, M, B formatında göster.'
  },
  {
    id: 'no_jsx',
    label: 'React.createElement kullan',
    description: 'JSX syntax yasak',
    isDefault: true,
    isActive: true,
    promptAddition: 'JSX KULLANMA! Sadece React.createElement kullan.'
  },
  {
    id: 'date_chronology',
    label: 'Tarih kronolojisi',
    description: 'Eksik günleri 0 ile doldur',
    isDefault: false,
    isActive: false,
    promptAddition: 'Tarih bazlı grafiklerde eksik günleri 0 değeriyle doldur. Tüm tarih aralığını göster.'
  },
  {
    id: 'trend_line',
    label: 'Trend çizgisi',
    description: 'Linear regression trend çizgisi ekle',
    isDefault: false,
    isActive: false,
    promptAddition: 'Grafiğe linear regression trend çizgisi ekle (kesikli çizgi olarak).'
  },
  {
    id: 'average_line',
    label: 'Ortalama çizgisi',
    description: 'Yatay ortalama çizgisi ekle',
    isDefault: false,
    isActive: false,
    promptAddition: 'Grafiğe ortalama değerini gösteren yatay çizgi ekle.'
  },
  {
    id: 'min_max_markers',
    label: 'Min/Max işaretleri',
    description: 'Minimum ve maksimum noktaları işaretle',
    isDefault: false,
    isActive: false,
    promptAddition: 'Grafikte minimum ve maksimum noktaları özel işaretlerle göster.'
  }
];

// State
const [aiRequirements, setAiRequirements] = useState<AIRequirement[]>(DEFAULT_AI_REQUIREMENTS);
const [customRules, setCustomRules] = useState<string[]>([]);
```

### 3.3 AI Prompt Oluşturma

```typescript
const buildAIPrompt = () => {
  let prompt = aiPrompt;
  
  // DIA Model linkleri ekle
  if (diaModelLinks.length > 0) {
    prompt += '\n\n📚 Referans DIA Modelleri:\n';
    diaModelLinks.forEach(link => {
      prompt += `- ${link.modelName}: ${link.url}\n`;
    });
  }
  
  // Aktif zorunlulukları ekle
  const activeRules = aiRequirements.filter(r => r.isActive);
  if (activeRules.length > 0 || customRules.length > 0) {
    prompt += '\n\n⚙️ ZORUNLU KURALLAR:\n';
    activeRules.forEach(rule => {
      prompt += `- ${rule.promptAddition}\n`;
    });
    customRules.forEach(rule => {
      prompt += `- ${rule}\n`;
    });
  }
  
  return prompt;
};
```

---

## Bölüm 4: Dosya Değişiklikleri

### 4.1 Güncellenecek Dosyalar

| Dosya | Değişiklik |
|-------|------------|
| `src/components/admin/CustomCodeWidgetBuilder.tsx` | DIA linkleri UI, AI zorunlulukları panel, tarih toggle |
| `supabase/functions/ai-code-generator/index.ts` | Tarih kronolojisi kuralını system prompt'a ekle |
| `src/lib/widgetBuilderTypes.ts` | `AIRequirement` ve `DiaModelReference` tipleri |

### 4.2 Yeni State'ler (CustomCodeWidgetBuilder)

```typescript
// DIA Model Referansları
const [diaModelLinks, setDiaModelLinks] = useState<DiaModelReference[]>([]);
const [newModelLink, setNewModelLink] = useState('');

// AI Zorunlulukları
const [aiRequirements, setAiRequirements] = useState<AIRequirement[]>(DEFAULT_AI_REQUIREMENTS);
const [customRules, setCustomRules] = useState<string[]>([]);
const [newCustomRule, setNewCustomRule] = useState('');

// Panel açık/kapalı durumu
const [showAiRequirements, setShowAiRequirements] = useState(false);
const [showModelLinks, setShowModelLinks] = useState(false);
```

---

## Bölüm 5: AI Code Generator System Prompt Güncellemesi

`supabase/functions/ai-code-generator/index.ts` dosyasına eklenecek yeni bölüm:

```
═══════════════════════════════════════════════════════════════════════════════

📅 TARİH KRONOLOJİSİ KURALI (ÖNEMLİ!)
───────────────────────────────────────────────────────────────────────────────
Eğer grafikte tarih/zaman serisi kullanılıyorsa ve kullanıcı "tarih kronolojisi" 
veya "eksik günleri göster" isterse:

var fillMissingDates = function(data, dateField, valueField, dayCount) {
  dayCount = dayCount || 30;
  var today = new Date();
  var dateMap = {};
  
  data.forEach(function(item) {
    var d = new Date(item[dateField]);
    var key = d.toISOString().split('T')[0];
    dateMap[key] = (dateMap[key] || 0) + (parseFloat(item[valueField]) || 0);
  });
  
  var result = [];
  for (var i = dayCount - 1; i >= 0; i--) {
    var d = new Date(today);
    d.setDate(d.getDate() - i);
    var key = d.toISOString().split('T')[0];
    result.push({
      tarih: key,
      label: d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }),
      [valueField]: dateMap[key] || 0
    });
  }
  
  return result;
};

// Kullanım:
var chartData = fillMissingDates(data, 'tarih', 'tutar', 30);
```

---

## Bölüm 6: Builder Config'e Kaydetme

Widget kaydedilirken bu ayarlar `builder_config` içine kaydedilecek:

```typescript
builderConfig = {
  ...builderConfig,
  // Mevcut alanlar...
  
  // Yeni alanlar
  diaModelLinks: diaModelLinks,
  aiRequirements: aiRequirements.filter(r => r.isActive && !r.isDefault),
  customAiRules: customRules,
};
```

---

## Bölüm 7: Uygulama Adımları

1. **Tip Tanımları**: `widgetBuilderTypes.ts` dosyasına `AIRequirement` ve `DiaModelReference` tipleri ekle
2. **AI Generator Güncelleme**: System prompt'a tarih kronolojisi kuralını ekle
3. **CustomCodeWidgetBuilder Güncelleme**:
   - DIA Model Linkleri bölümü (collapsible)
   - AI Zorunlulukları paneli (collapsible)
   - Tarih kronolojisi toggle
   - Prompt oluşturma fonksiyonunu güncelle
4. **Edge Function Deploy**: ai-code-generator'ı yeniden deploy et

---

## Bölüm 8: Örnek Kullanım Senaryosu

Kullanıcı:
1. Veri kaynağı olarak "Cari Vade Bakiye" seçer
2. DIA Model linki ekler: `https://doc.dia.com.tr/doku.php?id=gelistirici:models:scf_carikart_vade_bakiye_view_model`
3. AI Zorunluluklarından "Tarih kronolojisi" ve "Trend çizgisi" seçer
4. Prompt yazar: "Son 30 günün vade tutarlarını gösteren çizgi grafik yap"
5. AI, eksik günleri dolduran ve trend çizgisi içeren kod üretir
