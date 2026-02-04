
# Harita Widget Yükseklik Sorunu Düzeltmesi

## Problem Analizi

Harita widget'ları container'lar içinde render edilemiyor. Bunun 3 ana nedeni var:

1. **CSS max-height sınırlaması**: `ContainerRenderer.tsx` satır 443'te grafik container'ları için `[&>*]:max-h-[400px]` uygulanıyor. Bu haritalar için yetersiz ve esnek değil.

2. **Yükseklik zinciri kırılması**: Leaflet haritaları `height: 100%` kullanıyor, ancak parent elementlerde sabit piksel yüksekliği olmadığı için `100%` değeri `0px` olarak hesaplanıyor.

3. **Harita için özel container tipi yok**: `chart_half`, `chart_full` gibi container'lar standart grafikler için tasarlanmış, haritaların ihtiyacı olan daha büyük ve esnek yükseklik desteklenmiyor.

## Çözüm Planı

### Adım 1: Yeni Harita Container Tipi Ekle

**Dosya: `src/lib/pageTypes.ts`**

Yeni container tipleri:
```text
map_full    → Tam genişlik harita (1 slot)
map_half    → 2 harita yan yana (2 slot)
```

Bu container'lar daha büyük minimum yüksekliğe sahip olacak (400px+).

### Adım 2: ContainerRenderer'da Harita Yükseklik Kurallarını Güncelle

**Dosya: `src/components/pages/ContainerRenderer.tsx`**

Satır 437-446 arasındaki grid class tanımını güncelle:

- Harita container'ları için: `[&>*]:min-h-[400px]` (max-h kaldırılır - haritalar esnek olmalı)
- Normal grafik container'ları için: mevcut `min-h-[280px] max-h-[400px]` kalır
- Harita container'larında `max-h` sınırlaması OLMAYACAK

### Adım 3: BuilderWidgetRenderer'da Harita Wrapper Düzeltmesi

**Dosya: `src/components/dashboard/BuilderWidgetRenderer.tsx`**

Custom widget render bölümünde (satır 446-461):

CardContent içindeki div'e harita widget'ları için özel class ekle:
```text
Mevcut: <div className="flex-1 h-full min-h-0 flex flex-col">
Yeni:   <div className="flex-1 h-full min-h-0 flex flex-col [&_.leaflet-container]:min-h-[350px]">
```

Bu sayede Leaflet container'ı mutlaka minimum 350px yüksekliğe sahip olacak.

## Teknik Detaylar

### pageTypes.ts Değişikliği
```typescript
// Yeni container tipleri ekleniyor
{
  id: 'map_full',
  name: 'Tam Genişlik Harita',
  description: 'Tek harita, tam genişlik',
  icon: 'Map',
  slots: 1,
  gridClass: 'grid-cols-1 gap-0.5',
},
{
  id: 'map_half',
  name: '2 Harita Yan Yana',
  description: '2 harita yan yana',
  icon: 'MapPin',
  slots: 2,
  gridClass: 'grid-cols-1 md:grid-cols-2 gap-0.5 md:gap-1',
}
```

### ContainerRenderer.tsx Değişikliği (Satır 437-446)
```typescript
<div className={cn(
  'grid gap-1 md:gap-2 items-stretch [&>*]:h-full',
  template.gridClass,
  // Harita container'ları - max-h yok, daha büyük min-h
  (container.container_type === 'map_full' || 
   container.container_type === 'map_half') && '[&>*]:min-h-[400px]',
  // Grafik container'ları için min ve max yükseklik
  (container.container_type === 'chart_full' || 
   container.container_type === 'chart_half' || 
   container.container_type === 'chart_third') && '[&>*]:min-h-[280px] [&>*]:max-h-[400px]',
  // Info kartları
  (container.container_type === 'info_cards_2' ||
   container.container_type === 'info_cards_3') && '[&>*]:min-h-[200px]'
)}>
```

### BuilderWidgetRenderer.tsx Değişikliği (Satır 456)
Leaflet container'ına özel minimum yükseklik:
```typescript
<div className="flex-1 h-full min-h-0 flex flex-col [&_.leaflet-container]:min-h-[350px]">
```

## Beklenen Sonuç

1. Harita widget'ları `map_full` veya `map_half` container'ına eklendiğinde düzgün render edilecek
2. Mevcut `chart_*` container'larına eklenen haritalar da çalışacak (Leaflet'e doğrudan min-h verildiği için)
3. Haritalar zoom/pan/scroll işlemlerini düzgün yapabilecek
4. Popup'lar ve marker'lar doğru çalışacak
