
# Kompakt Veri Durumu Göstergesi - Sağ Alt Köşe Üçgen Tasarımı

## Mevcut Durum

Şu anda `DataStatusBadge`:
- Widget header'da sol tarafta bir `Badge` bileşeni olarak yer alıyor
- "Güncel", "Önbellek", "Güncelleniyor" gibi metinler gösteriyor
- Yer kaplıyor ve mevcut padding/layout'u bozuyor

## Önerilen Yeni Tasarım

Widget'ın sağ alt köşesinde minimal üçgen şeklinde gösterge:

```text
┌─────────────────────────────────────┐
│                                     │
│      [CHART / WIDGET CONTENT]       │
│                                     │
│                                     │
│                                 ◢━━━│ ← Sağ alt köşe üçgen
└─────────────────────────────────────┘
```

### Üçgen Renk Kodlaması
- Yeşil üçgen → Güncel (son 5 dk)
- Sarı üçgen → Önbellek / Stale  
- Mavi üçgen (animasyonlu) → Güncelleniyor
- Turuncu üçgen → Eski (> 24 saat)
- Kırmızı üçgen → Hata

### Tooltip ile Detay
Üçgene hover yapınca tooltip gösterilir:
- "Güncel - Son güncelleme: 2 dakika önce"
- "Güncelleniyor - DIA'dan veri çekiliyor..."
- "Eski - Son güncelleme: 2 gün önce"

## Teknik Değişiklikler

### 1. DataStatusBadge Bileşeni Yeniden Tasarımı

Badge yerine absolut konumlandırılmış üçgen:

```tsx
// Köşe üçgen bileşeni
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <div 
        className={cn(
          "absolute bottom-0 right-0 w-0 h-0",
          "border-l-[16px] border-l-transparent",
          "border-b-[16px]",
          statusColorClass, // border-b-green-500, border-b-yellow-500 vb.
          isRevalidating && "animate-pulse"
        )}
      />
    </TooltipTrigger>
    <TooltipContent>...</TooltipContent>
  </Tooltip>
</TooltipProvider>
```

### 2. BuilderWidgetRenderer'da Konumlandırma

ChartHeader'dan badge'i kaldırıp widget container'a overlay olarak ekleme:

```tsx
<Card className="relative overflow-visible">
  {/* Mevcut içerik */}
  <CardContent>...</CardContent>
  
  {/* Sağ alt köşe durum göstergesi - overlay */}
  <DataStatusIndicator status={dataStatus} />
</Card>
```

### 3. Padding/Layout Korunması

- Header'dan badge kaldırılacak → Mevcut padding korunacak
- Üçgen `absolute` + `bottom-0 right-0` ile konumlandırılacak
- Grafik içeriğini etkilemeyecek (overlay)

## Dosya Değişiklikleri

| Dosya | Değişiklik |
|-------|-----------|
| `src/components/dashboard/DataStatusBadge.tsx` | Üçgen tasarımına dönüştür |
| `src/components/dashboard/BuilderWidgetRenderer.tsx` | Header'dan badge'i kaldır, Card'a overlay olarak ekle |

## Görsel Karşılaştırma

**Önceki (Badge):**
```
┌──────────────────────────────────┐
│ [🔄 Güncelleniyor] [Tarih ▼]    │  ← Header'da yer kaplıyor
├──────────────────────────────────┤
│                                  │
│         CHART CONTENT            │
└──────────────────────────────────┘
```

**Yeni (Üçgen):**
```
┌──────────────────────────────────┐
│                        [Tarih ▼] │  ← Sadece tarih filtresi (varsa)
├──────────────────────────────────┤
│                                  │
│         CHART CONTENT            │
│                                ◢━│  ← Minimal üçgen gösterge
└──────────────────────────────────┘
```

## Avantajlar

- Mevcut layout ve padding'i bozmaz
- Minimal ve non-invasive
- Hover'da tam bilgi sağlar
- Mobil uyumlu (üçgen küçük)
- Animasyon ile güncelleme durumu anlaşılır
