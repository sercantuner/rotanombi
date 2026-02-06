
# Widget Builder Temizliği ve AI Metadata Entegrasyonu Planı

## Mevcut Durum Özeti

### Değişiklik Talepleri
| Talep | Açıklama |
|-------|----------|
| WidgetBuilder.tsx kaldır | Kullanılmayan 1344 satırlık no-code builder dosyası |
| Mock data kullan | Widget önizleme/görsel oluşturma kısmında gerçek veri yerine mock |
| Widget ismi otomatik | AI widget adını oluşturur, kelimelerin ilk harfi büyük |
| Önerilen etiketler yazılsın | AI'ın suggestedTags'i otomatik olarak widget_tags tablosuna kaydedilecek |
| Kısa açıklama kaydedilsin | AI'ın shortDescription'ı widget description alanına yazılsın |
| Kategori seçimi kaldırılsın | Manuel kategori seçimi yerine AI etiketleri kullanılacak |
| İkon seçimi kaldırılsın | AI widget için uygun ikon seçecek |

### Mevcut Kod Yapısı

**1. Kullanılmayan Dosya:**
- `src/components/admin/WidgetBuilder.tsx` (1344 satır) - Hiçbir yerde import edilmiyor

**2. CustomCodeWidgetBuilder.tsx - Widget Bilgileri Bölümü (renderStep1):**
- Satır 1311-1406: Widget Key, Ad, Açıklama, Boyut, Kategori, İkon seçimi mevcut
- Kategori seçimi: CategoryPickerModal ile modal olarak açılıyor (satır 1358-1384)
- İkon seçimi: 32 ikonluk grid gösterilir (satır 1388-1405)

**3. AI Edge Function (ai-code-generator/index.ts):**
- Tool calling ile metadata üretiliyor (satır 1723-1783)
- `suggestedTags`, `shortDescription`, `suggestedName`, `suggestedIcon` mevcut olabilir
- Ancak `suggestedName` ve `suggestedIcon` şu anda tool schema'sında YOK

**4. Widget Kaydetme (handleSave - satır 1098-1186):**
- `widgetName`, `widgetDescription`, `widgetIcon`, `widgetCategory` manuel girilen değerler kullanılıyor
- `aiSuggestedTags` şu anda sadece `ai_suggested_tags` kolonuna kaydediliyor
- `widget_tags` junction tablosuna yazılmıyor

---

## Değişiklikler

### 1. Kullanılmayan WidgetBuilder.tsx Silme

**Dosya:** `src/components/admin/WidgetBuilder.tsx`
**İşlem:** Dosyayı tamamen sil

### 2. AI Tool Schema Güncelleme

**Dosya:** `supabase/functions/ai-code-generator/index.ts`

Tool schema'ya yeni alanlar ekle (satır 1723-1783 civarı):

```typescript
// getWidgetMetadataTool() fonksiyonuna eklenecek properties:
suggestedName: {
  type: "string",
  description: "Widget için önerilen isim (her kelimenin ilk harfi büyük, Türkçe). Örnek: 'Cari Bakiye Özeti', 'Günlük Satış Trendi'"
},
suggestedIcon: {
  type: "string",
  description: "Widget için önerilen Lucide ikon adı. Finans: DollarSign, CreditCard, Wallet. Satış: ShoppingCart, TrendingUp. Stok: Package, Box. Cari: Users, Building. Performans: Target, Award. Grafik: BarChart2, PieChart, LineChart."
}

// required dizisine ekle:
required: ["code", "suggestedTags", "shortDescription", "suggestedName", "suggestedIcon", ...]
```

### 3. AI Metadata Response İşleme

**Dosya:** `supabase/functions/ai-code-generator/index.ts`

aiMetadata objesine yeni alanları ekle (satır 1922-1933):

```typescript
aiMetadata = {
  suggestedTags: args.suggestedTags || [],
  shortDescription: args.shortDescription || "",
  longDescription: args.longDescription || "",
  suggestedName: args.suggestedName || "",      // YENİ
  suggestedIcon: args.suggestedIcon || "Code",  // YENİ
  technicalNotes: { ... }
};
```

### 4. Frontend Metadata Uygulama

**Dosya:** `src/components/admin/CustomCodeWidgetBuilder.tsx`

AI yanıtını işleyen bölümde (generateCodeWithAI fonksiyonu, satır 900-1042):

```typescript
// AI metadata alındığında otomatik olarak form alanlarını doldur
if (aiMetadata) {
  // Widget adı
  if (aiMetadata.suggestedName) {
    setWidgetName(aiMetadata.suggestedName);
    // Widget key'i de addan oluştur
    setWidgetKey('ai_' + aiMetadata.suggestedName
      .toLowerCase()
      .replace(/[^a-z0-9ğüşıöçĞÜŞİÖÇ\s]/g, '')
      .replace(/[ğ]/g, 'g').replace(/[ü]/g, 'u').replace(/[ş]/g, 's')
      .replace(/[ı]/g, 'i').replace(/[ö]/g, 'o').replace(/[ç]/g, 'c')
      .replace(/\s+/g, '_') + '_' + Date.now().toString(36)
    );
  }
  
  // Widget ikonu
  if (aiMetadata.suggestedIcon) {
    setWidgetIcon(aiMetadata.suggestedIcon);
  }
  
  // Kısa açıklama
  if (aiMetadata.shortDescription) {
    setShortDescription(aiMetadata.shortDescription);
    setWidgetDescription(aiMetadata.shortDescription); // description alanına da yaz
  }
  
  // Önerilen etiketler (mevcut satır 988-1001'i güncelle)
  setAiSuggestedTags(aiMetadata.suggestedTags || []);
}
```

### 5. Widget Bilgileri UI Basitleştirme

**Dosya:** `src/components/admin/CustomCodeWidgetBuilder.tsx`

renderStep1 fonksiyonundaki Widget Bilgileri kartı (satır 1304-1407):

**Kaldırılacaklar:**
- Kategori seçimi butonu ve modal (satır 1357-1385)
- İkon seçim grid'i (satır 1387-1405)

**Sadeleştirilecek Form:**
```typescript
// Widget Bilgileri kartı - minimal versiyon
<CardContent className="space-y-3">
  <div className="grid grid-cols-2 gap-3">
    <div className="space-y-1.5">
      <Label className="text-xs">Widget Key</Label>
      <Input
        value={widgetKey}
        onChange={(e) => setWidgetKey(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
        placeholder="ai_widget_key"
        className="h-9"
        disabled // AI tarafından oluşturulacak
      />
      <span className="text-[10px] text-muted-foreground">AI tarafından oluşturulur</span>
    </div>
    <div className="space-y-1.5">
      <Label className="text-xs">Widget Adı</Label>
      <Input
        value={widgetName}
        onChange={(e) => setWidgetName(e.target.value)}
        placeholder="AI tarafından oluşturulacak"
        className="h-9"
      />
      <span className="text-[10px] text-muted-foreground">AI tarafından önerilir</span>
    </div>
  </div>

  <div className="space-y-1.5">
    <Label className="text-xs">Açıklama</Label>
    <Input
      value={widgetDescription}
      onChange={(e) => setWidgetDescription(e.target.value)}
      placeholder="AI tarafından oluşturulacak"
      className="h-9"
    />
    <span className="text-[10px] text-muted-foreground">AI kısa açıklama üretir</span>
  </div>

  {/* Boyut seçimi kalıyor */}
  <div className="space-y-1.5">
    <Label className="text-xs">Boyut</Label>
    <Select value={widgetSize} onValueChange={(v: any) => setWidgetSize(v)}>
      ...
    </Select>
  </div>
  
  {/* AI Önerilen Etiketler gösterimi */}
  {aiSuggestedTags.length > 0 && (
    <div className="p-2 bg-muted/30 rounded-lg">
      <Label className="text-xs text-muted-foreground">AI Önerilen Etiketler</Label>
      <div className="flex flex-wrap gap-1 mt-1">
        {aiSuggestedTags.map((tag, idx) => (
          <Badge key={idx} variant="secondary" className="text-xs">{tag}</Badge>
        ))}
      </div>
    </div>
  )}
  
  {/* AI Önerilen İkon gösterimi */}
  {widgetIcon && widgetIcon !== 'Code' && (
    <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
      <DynamicIcon iconName={widgetIcon} className="h-5 w-5" />
      <span className="text-xs text-muted-foreground">AI Önerilen İkon: {widgetIcon}</span>
    </div>
  )}
</CardContent>
```

### 6. handleSave Güncelleme - Etiketleri widget_tags'e Kaydet

**Dosya:** `src/components/admin/CustomCodeWidgetBuilder.tsx`

handleSave fonksiyonu (satır 1098-1186):

```typescript
const formData: WidgetFormData = {
  widget_key: widgetKey,
  name: widgetName,
  description: shortDescription || widgetDescription, // AI kısa açıklaması tercih edilir
  category: aiSuggestedTags[0] || 'dashboard', // İlk etiket kategori olarak (geriye uyumluluk)
  type: 'chart',
  data_source: 'genel',
  size: widgetSize,
  icon: widgetIcon, // AI tarafından seçilmiş
  default_page: (aiSuggestedTags[0] || 'dashboard') as any, // İlk etiket
  default_visible: true,
  available_filters: [],
  default_filters: {},
  min_height: '',
  grid_cols: null,
  is_active: true,
  is_default: false,
  sort_order: 100,
  builder_config: builderConfig as any,
  // AI tarafından üretilen etiketler widget_tags tablosuna kaydedilecek
  tags: aiSuggestedTags.length > 0 ? aiSuggestedTags : ['dashboard'],
  // AI Metadata alanları
  short_description: shortDescription || undefined,
  long_description: longDescription || undefined,
  technical_notes: technicalNotes || undefined,
  preview_image: previewImage || undefined,
  ai_suggested_tags: aiSuggestedTags.length > 0 ? aiSuggestedTags : undefined,
};
```

### 7. Mock Data Kullanımı (Önizleme Görseli)

**Dosya:** `src/components/admin/CustomCodeWidgetBuilder.tsx`

capturePreviewImage fonksiyonu (satır 2330-2356) veya PreviewResult hesaplaması:

```typescript
// Mock data oluştur - önizleme görseli için
const getMockPreviewData = useCallback(() => {
  // Gerçek veriden birkaç kayıt al veya tamamen mock oluştur
  if (sampleData.length > 0) {
    // Gerçek veriden rastgele 5-10 kayıt seç
    return sampleData.slice(0, Math.min(10, sampleData.length));
  }
  
  // Tamamen mock data
  return [
    { name: 'Örnek A', value: 15000, bakiye: 15000 },
    { name: 'Örnek B', value: 12000, bakiye: 12000 },
    { name: 'Örnek C', value: 8500, bakiye: 8500 },
    { name: 'Örnek D', value: 6200, bakiye: 6200 },
    { name: 'Örnek E', value: 4100, bakiye: 4100 },
  ];
}, [sampleData]);

// Önizleme görseli yakalama - mock data ile
const capturePreviewImage = async () => {
  // PreviewResult'ı mock data ile yeniden hesapla
  const mockData = getMockPreviewData();
  // ... mevcut capture mantığı
};
```

### 8. State Temizliği

**Dosya:** `src/components/admin/CustomCodeWidgetBuilder.tsx`

Kaldırılacak state'ler:
```typescript
// Bu satırları kaldır veya yorum satırı yap:
// const [showCategoryModal, setShowCategoryModal] = useState(false); // Satır 467
```

Kaldırılacak import'lar:
```typescript
// CategoryPickerModal artık gerekli değil
// import { CategoryPickerModal } from './CategoryPickerModal';
```

---

## Teknik Detaylar

### AI Prompt Güncelleme

System prompt'a ikon önerileri için kılavuz ekle:

```text
📌 İKON ÖNERİSİ (suggestedIcon):
   Widget'ın içeriğine uygun Lucide ikon adı seç:
   
   | Kategori     | Önerilen İkonlar                           |
   |--------------|-------------------------------------------|
   | Finans       | DollarSign, CreditCard, Wallet, PiggyBank |
   | Satış        | ShoppingCart, TrendingUp, Store           |
   | Stok         | Package, Box, Archive                     |
   | Cari         | Users, Building, UserCheck                |
   | Performans   | Target, Award, Activity, Gauge            |
   | Grafik       | BarChart2, PieChart, LineChart, TrendingUp|
   | Uyarı        | AlertTriangle, AlertCircle, Bell          |
   | Zaman        | Clock, Calendar, Timer, History           |
   
📝 İSİM ÖNERİSİ (suggestedName):
   - Her kelimenin ilk harfi büyük (Title Case)
   - Türkçe karakterler kullan
   - Kısa ve açıklayıcı (2-5 kelime)
   - Örnekler: "Cari Bakiye Özeti", "Günlük Satış Trendi", "Stok Uyarıları"
```

### Dosya Değişiklikleri Özeti

| Dosya | İşlem |
|-------|-------|
| `src/components/admin/WidgetBuilder.tsx` | SİL (1344 satır) |
| `src/components/admin/CustomCodeWidgetBuilder.tsx` | GÜNCELLE |
| `supabase/functions/ai-code-generator/index.ts` | GÜNCELLE |

### Test Senaryoları

1. **AI Metadata Üretimi:**
   - AI ile yeni widget oluştur
   - Widget adı, ikon ve etiketlerin otomatik dolduğunu doğrula

2. **Etiket Kaydı:**
   - Widget kaydet
   - `widget_tags` tablosunda etiketlerin oluştuğunu kontrol et

3. **UI Basitleşme:**
   - Kategori ve ikon seçim alanlarının kaldırıldığını doğrula
   - AI önerilerinin görüntülendiğini kontrol et

4. **Geriye Uyumluluk:**
   - Mevcut widget'ların düzenleme modunda açıldığını test et
   - Manuel override yapılabildiğini doğrula
