

## Grafik Render Sorunlari Duzeltme Plani

### Temel Sorun
Recharts `ResponsiveContainer` bileseni `height="100%"` ile calistiginda, ust konteynerlarin yalnizca `min-height` degil, acik bir `height` degerine sahip olmasi gerekir. Mevcut durumda flex layout zinciri kirilmakta ve grafik alani 0px yukseklikte render edilmektedir. Bu sorun Nivo, Map ve Recharts tabanli tum widget'lari etkiler.

### Degisecek Dosyalar

**1. `src/components/dashboard/BuilderWidgetRenderer.tsx`**

Satir 799 civarindaki widget sarmalayici div'e acik yukseklik garantisi eklenmesi:

Mevcut:
```
<div className="flex-1 h-full min-h-0 flex flex-col [&_.leaflet-container]:min-h-[350px]">
```

Yeni:
```
<div className="flex-1 min-h-[200px] flex flex-col [&_.leaflet-container]:min-h-[350px]" style={{ height: '100%' }}>
```

Ayrica `CardContent` (satir 791) de guncellenmeli:

Mevcut:
```
<CardContent className="flex-1 flex flex-col min-h-0 p-4 pt-3">
```

Yeni:
```
<CardContent className="flex-1 flex flex-col p-4 pt-3" style={{ minHeight: '200px' }}>
```

**2. `src/components/pages/ContainerRenderer.tsx`**

Satir 535-548 civarindaki grid container'da grafik widget'lari icin daha guvenilir yukseklik zorunlulugu:

Mevcut `[&>*]:min-h-[280px]` kuralina ek olarak, grafik konteynerlarinin cocuk elemanlarinin `h-full` yerine sabit minimum yukseklik almasini garanti eden bir stil eklenmesi. Ayrica `items-stretch` kuralinin dogru calistiginin dogrulanmasi.

**3. Filtre Kaynakli "Veri Bulunamadi" Sorunu**

`Cari Finansal Risk Analizi` widget'i `cariKartTipi: ["AL"]` filtresiyle "Veri bulunamadi" gosteriyor (1227 kayit varken). `useDynamicWidgetData.tsx` icerisindeki `cariKartTipi` filtre mantiginda, veri alaninin (`carikarttip`) dogru eslesmesi kontrol edilecek. Eger veri alaninda farkli bir isimlendirme kullaniliyorsa (orn: `_key_sis_carikarttip` veya nested obje), esleme mantigi guncellenecek.

### Teknik Detaylar

ResponsiveContainer yukseklik zinciri:
```text
ContainerRenderer grid item    -> min-h-[280px] + h-full
  DynamicWidgetRenderer        -> (passthrough)
    BuilderWidgetRenderer Card -> h-full flex flex-col
      CardContent              -> flex-1 (SORUN: min-h-0 yuksekligi sifirliyor)
        Widget wrapper div     -> flex-1 h-full min-h-0
          Widget custom code   -> flex-1 + minHeight inline
            ResponsiveContainer-> height="100%" (SONUC: 0px)
```

Duzeltme sonrasi:
```text
ContainerRenderer grid item    -> min-h-[280px] + h-full
  DynamicWidgetRenderer        -> (passthrough)
    BuilderWidgetRenderer Card -> h-full flex flex-col
      CardContent              -> flex-1 minHeight:200px
        Widget wrapper div     -> flex-1 min-h-[200px] height:100%
          Widget custom code   -> flex-1 + minHeight inline
            ResponsiveContainer-> height="100%" (SONUC: 200px+)
```

### Beklenen Sonuc
- Tum Recharts grafikleri (PieChart, RadarChart, BarChart vb.) gorsel olarak render edilecek
- Nivo grafikleri (Funnel, Radar vb.) dogru yukseklikte gorunecek
- Harita widget'lari arka plan haritasini gosterecek
- Filtre uygulanmis widget'lar dogru veri gosterecek
