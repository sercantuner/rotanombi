

# Widget Ekle → Tam Sayfa Yönlendirme Planı

## Mevcut Durum

Şu anda iki ayrı widget marketplace bileşeni var:

| Bileşen | Konum | Davranış |
|---------|-------|----------|
| `WidgetMarketplace` | `src/components/dashboard/WidgetMarketplace.tsx` | **Modal** olarak açılır |
| `WidgetMarketplacePage` | `src/pages/WidgetMarketplacePage.tsx` | **Tam sayfa** (`/marketplace`) |

Dashboard'daki boş slotlara tıklandığında `WidgetSlotPicker` → `WidgetMarketplace` (modal) açılıyor.

## Çözüm

Boş slot tıklamasını ve "Widget Ekle" aksiyonlarını `/marketplace` rotasına yönlendireceğiz.

---

## Değişiklikler

### 1. ContainerRenderer.tsx

**Boş slot tıklaması** → `/marketplace?page=SAYFA&container=CONTAINER_ID&slot=SLOT_INDEX` yönlendirmesi

```text
Mevcut (satır 354-368):
  onClick={() => handleSlotClick(slotIndex)}
  → WidgetSlotPicker modal açar

Yeni:
  onClick={() => navigate(`/marketplace?page=${pageId}&container=${container.id}&slot=${slotIndex}`)}
  → Tam sayfa marketplace'e yönlendir
```

### 2. WidgetMarketplacePage.tsx

- URL parametrelerini oku: `page`, `container`, `slot`
- Widget seçildiğinde:
  - `container` ve `slot` parametresi varsa → `container_widgets` tablosuna ekle
  - Parametreler yoksa → eski davranış (sayfa layout'una ekle)
- İşlem sonrası geri dön

```typescript
// Yeni parametreler
const targetPage = searchParams.get('page') || 'dashboard';
const containerId = searchParams.get('container');
const slotIndex = searchParams.get('slot');

// Widget ekleme mantığı
const handleAddWidget = async (widgetKey: string) => {
  if (containerId && slotIndex !== null) {
    // Container slot'una ekle
    await addWidgetToContainer(containerId, widgetId, parseInt(slotIndex));
  } else {
    // Sayfa layout'una ekle (eski davranış)
    await addWidgetToPage(widgetKey, targetPage);
  }
  navigate(-1);
};
```

### 3. WidgetSlotPicker.tsx Kaldırma/Basitleştirme

`WidgetSlotPicker` artık doğrudan navigasyon için kullanılabilir veya tamamen kaldırılabilir.

---

## URL Yapısı

```text
/marketplace                           → Genel marketplace (dashboard'a ekler)
/marketplace?page=dashboard            → Dashboard için marketplace
/marketplace?page=satis                → Satış sayfası için marketplace
/marketplace?container=UUID&slot=0     → Container slot'una eklemek için
```

---

## Etkilenen Dosyalar

| Dosya | Değişiklik |
|-------|------------|
| `ContainerRenderer.tsx` | Boş slot tıklaması → navigasyon |
| `WidgetMarketplacePage.tsx` | Container/slot parametreleri, ekleme mantığı |
| `useUserPages.tsx` (opsiyonel) | Container'a widget ekleme fonksiyonu export |

---

## Teknik Detaylar

### Container Widget Ekleme

```typescript
// useContainerWidgets hook'undaki addWidget fonksiyonu zaten mevcut
const { addWidget } = useContainerWidgets(containerId);

// WidgetMarketplacePage'de kullanım
const handleAddWidget = async (widgetKey: string, widgetId: string) => {
  if (containerId && slotIndex !== null) {
    // Doğrudan supabase insert
    await supabase.from('container_widgets').insert({
      container_id: containerId,
      widget_id: widgetId,
      slot_index: parseInt(slotIndex)
    });
  }
  navigate(-1);
};
```

---

## Özet

1. Boş slota tıkla → `/marketplace?container=X&slot=Y` rotasına git
2. Marketplace tam sayfa açılır
3. Widget seç → `container_widgets` tablosuna ekle
4. Otomatik geri dön

Bu sayede tüm widget ekleme işlemleri tam sayfa marketplace üzerinden yapılacak.

