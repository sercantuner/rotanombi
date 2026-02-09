

## Grafik Render Duzeltme - Geri Alma ve Absolute Position Yontemi

### Sorunun Kaynagi

Son yapilan degisiklikler height zincirini kirdi. Ozellikle ContainerRenderer'daki `[&>*]:h-full` kuralinin kaldirilmasi, grid item'larin cocuk elemanlarina yukseklik aktarmasini durdurdu. Eklenen `style={{ height: '100%' }}` ve `style={{ minHeight: '200px' }}` ise flex layout icerisinde calismiyor cunku CSS'te `height: 100%` hesaplamasi icin ust elemanin "acik" (explicit) bir height degerine sahip olmasi gerekir - `flex-1` bunu saglamaz.

### Cozum

Iki dosyada degisiklik yapilacak:

**1. `src/components/pages/ContainerRenderer.tsx`**

`[&>*]:h-full` kuralini geri ekle. Bu kural grid item'larin cocuklarinin tam yukseklikte olmasini saglar.

Mevcut (satir 536):
```
'grid gap-1 md:gap-2 items-stretch',
```

Yeni:
```
'grid gap-1 md:gap-2 items-stretch [&>*]:h-full',
```

`gridAutoRows` stil blogu kaldirilacak (gereksiz karmasiklik, `items-stretch` + `min-h` yeterli).

**2. `src/components/dashboard/BuilderWidgetRenderer.tsx`**

`CardContent` ve ic wrapper div icin "absolute positioning" yaklasimi uygulanacak. Bu, CSS yuzde yukseklik hesaplamasi sorununu tamamen ortadan kaldirir:

Mevcut (satir 791):
```tsx
<CardContent className="flex-1 flex flex-col p-4 pt-3" style={{ minHeight: '200px' }}>
```
Yeni:
```tsx
<CardContent className="flex-1 flex flex-col p-4 pt-3 min-h-0">
```

Mevcut (satir 799):
```tsx
<div className="flex-1 min-h-[200px] flex flex-col [&_.leaflet-container]:min-h-[350px]" style={{ height: '100%' }}>
```
Yeni:
```tsx
<div className="flex-1 relative min-h-[200px] [&_.leaflet-container]:min-h-[350px]">
  <div className="absolute inset-0 flex flex-col">
```

Widget icerigi artik absolute-positioned bir div icerisinde render edilecek. Bu div, relative parent'in boyutlarini otomatik olarak alir - `height: 100%` hesaplamasi gerekmez.

### Neden Bu Yaklasim Calisir

```text
ContainerRenderer grid item    -> min-h-[280px] + h-full (GERi EKLENDI)
  Card                         -> h-full flex flex-col
    CardContent                -> flex-1 min-h-0 (flex alanini doldurur)
      Wrapper div              -> flex-1 relative min-h-[200px]
        Absolute div           -> absolute inset-0 (parent boyutlarini alir)
          Widget kodu           -> flex-1
            ResponsiveContainer -> height="100%" = absolute div yuksekligi
```

### Beklenen Sonuc
- Pasta grafikleri (Kaynak Dagilimi, Sektor Dagilimi), bar/line chartlar render edilecek
- Nivo grafikleri (Radar, Funnel, Sankey) dogru yukseklikte gorunecek
- Harita widget'lari arka plan haritasini gosterecek
- Mevcut filtre mantigi korunacak (onceki degisikliklerdeki dinamik filtre destegi devam edecek)
- heightMultiplier (1x-3x) ayarlari dogru calisacak

