
# Widget Marketplace - Info Butonu Görünürlüğü ve Mock Data ile Önizleme Görseli Oluşturma

## Hedef
1. **Info butonu**: Widget kartlarındaki detay (info) butonunu her zaman görünür yap
2. **Mock data ile görsel oluşturma**: Widget Builder'da önizleme görseli oluştururken tutarlı mock data kullan

---

## Plan Özeti

### Bölüm 1: Info Butonu Görünürlüğü

Widget kartlarındaki "i" (info) butonu şu an sadece hover durumunda görünüyor. Kullanıcıların bu butonu fark edememesi sorun yaratıyor.

**Değişiklikler:**

| Dosya | Değişiklik |
|-------|------------|
| `WidgetMarketplace.tsx` | Info butonu stilini güncelleyerek her zaman görünür ve belirgin yap |
| `WidgetMarketplacePage.tsx` | Aynı değişikliği tam sayfa Marketplace'e uygula |

**Yeni Stil:**
- Buton her zaman görünür (`opacity-100`)
- Arka plan rengi: `bg-primary/10` 
- Hover durumunda: `hover:bg-primary/20`
- Icon rengi: `text-primary`
- Border radius: `rounded-full`

---

### Bölüm 2: Mock Data ile Görsel Oluşturma

Mevcut durumda preview görseli gerçek verilerle oluşturuluyor. Ancak veri olmadığında veya hassas veriler olduğunda sorun yaratıyor.

**Çözüm Mimarisi:**

```text
+-------------------+     +------------------+     +-------------------+
|  Önizleme Görseli |---->| getMockPreviewData|---->| html2canvas       |
|  Oluştur Butonu   |     | (widget tipine    |     | (mock data ile    |
+-------------------+     |  göre mock data)  |     |  görsel yakala)   |
                          +------------------+     +-------------------+
```

**Yeni Fonksiyon - `getMockPreviewData()`:**
- Widget tipine (KPI, chart, table, list) göre örnek veri üretir
- Gerçekçi ve tutarlı görselleştirme için standart değerler içerir
- Mevcut `mockData.ts` altyapısını kullanır

**Değişiklik Akışı:**

1. `CustomCodeWidgetBuilder.tsx`'e `getMockPreviewData` helper fonksiyonu ekle
2. `capturePreviewImage` fonksiyonunu güncelle:
   - Önce mock data ile widget'ı render et
   - Görseli yakala
   - Sonra tekrar gerçek veriye dön

---

## Teknik Detaylar

### Dosya 1: `src/components/dashboard/WidgetMarketplace.tsx`

**Satır 290-302** - Info butonu stilini güncelle:
```tsx
// Önceki (gizli):
className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"

// Sonraki (görünür):
className="h-7 w-7 bg-primary/10 hover:bg-primary/20 text-primary rounded-full"
```

### Dosya 2: `src/pages/WidgetMarketplacePage.tsx`

**Satır 331-343** - Aynı stil güncellemesi:
```tsx
className="h-8 w-8 bg-primary/10 hover:bg-primary/20 text-primary rounded-full"
```

### Dosya 3: `src/components/admin/CustomCodeWidgetBuilder.tsx`

**Yeni helper fonksiyon ekle (yaklaşık satır 430):**
```tsx
const getMockPreviewData = (widgetType: string) => {
  // Widget tipine göre tutarlı mock veri
  const mockRecords = [
    { label: 'Kategori A', value: 125000, percentage: 35 },
    { label: 'Kategori B', value: 98000, percentage: 27 },
    { label: 'Kategori C', value: 76000, percentage: 21 },
    { label: 'Kategori D', value: 61000, percentage: 17 },
  ];
  
  // Ek alanlar (cariler, stoklar vb için)
  return mockRecords.map((r, i) => ({
    ...r,
    cariAdi: ['ABC Ltd.', 'XYZ A.Ş.', 'Delta San.', 'Omega Tic.'][i],
    bakiye: r.value,
    toplambakiye: r.value,
    tarih: new Date(Date.now() - i * 86400000).toISOString(),
    miktar: Math.floor(r.value / 1000),
  }));
};
```

**`capturePreviewImage` fonksiyonunu güncelle (satır 2460-2486):**
```tsx
const capturePreviewImage = async () => {
  const previewElement = document.getElementById('widget-preview-container');
  if (!previewElement) {
    toast.error('Önizleme alanı bulunamadı');
    return;
  }
  
  setIsCapturingPreview(true);
  
  // Mevcut veriyi sakla
  const originalData = sampleData;
  
  // Mock data ile geçici render
  const mockData = getMockPreviewData(widgetType);
  setSampleData(mockData);
  
  // DOM güncellenmesini bekle
  await new Promise(resolve => setTimeout(resolve, 100));
  
  try {
    const canvas = await html2canvas(previewElement, {
      backgroundColor: null,
      scale: 0.5,
      logging: false,
      useCORS: true,
    });
    
    const imageData = canvas.toDataURL('image/png');
    setPreviewImage(imageData);
    toast.success('Önizleme görseli oluşturuldu (mock data)');
  } catch (err) {
    console.error('Preview capture error:', err);
    toast.error('Görsel oluşturulamadı');
  } finally {
    // Orijinal veriyi geri yükle
    setSampleData(originalData);
    setIsCapturingPreview(false);
  }
};
```

---

## Uygulama Adımları

| # | Adım | Dosya |
|---|------|-------|
| 1 | Info butonu stilini güncelle | `WidgetMarketplace.tsx` |
| 2 | Info butonu stilini güncelle (full page) | `WidgetMarketplacePage.tsx` |
| 3 | `getMockPreviewData` helper ekle | `CustomCodeWidgetBuilder.tsx` |
| 4 | `capturePreviewImage` fonksiyonunu güncelle | `CustomCodeWidgetBuilder.tsx` |

---

## Beklenen Sonuç

**Info Butonu:**
- Her widget kartında mavi arka planlı, yuvarlak info butonu görünür olacak
- Hover durumunda renk koyulaşacak
- Kullanıcılar widget detaylarına kolayca erişebilecek

**Mock Data Preview:**
- Widget oluştururken "Önizleme Görseli Oluştur" butonuna basıldığında:
  - Tutarlı mock veri ile widget render edilecek
  - Görsel yakalandıktan sonra orijinal veri geri yüklenecek
  - Marketplace'de tüm widget'lar benzer görsel kalitede olacak
