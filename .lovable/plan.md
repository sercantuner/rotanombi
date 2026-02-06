
# Nivo ve Recharts Eksik Grafik Türlerini Ekleme Planı

## 1. Genel Bakış

Mevcut sistem bazı grafik türlerini destekliyor ancak kullanıcının listesindeki birçok Nivo ve Recharts grafik türü eksik. Bu plan, eksik grafik türlerinin eklenmesini detaylandırır.

## 2. Mevcut Durum Analizi

### Recharts (Mevcut)
| Grafik Türü | Durum |
|-------------|-------|
| AreaChart | ✅ Mevcut |
| BarChart | ✅ Mevcut |
| LineChart | ✅ Mevcut |
| ComposedChart | ✅ Mevcut |
| PieChart | ✅ Mevcut |
| RadarChart | ✅ Mevcut |
| ScatterChart | ✅ Mevcut |
| FunnelChart | ✅ Mevcut |
| Treemap | ✅ Mevcut |
| **RadialBarChart** | ❌ Eksik |

### Nivo (Mevcut Paketler)
| Paket | Durum |
|-------|-------|
| @nivo/chord | ✅ Mevcut |
| @nivo/core | ✅ Mevcut |
| @nivo/funnel | ✅ Mevcut |
| @nivo/geo | ✅ Mevcut |
| @nivo/radar | ✅ Mevcut |
| @nivo/sankey | ✅ Mevcut |
| @nivo/sunburst | ✅ Mevcut |

### Nivo (Eksik Paketler)
| Paket | Grafik Türü |
|-------|-------------|
| @nivo/bar | Bar (Çubuk Grafik) |
| @nivo/line | Line (Çizgi Grafik) |
| @nivo/pie | Pie (Pasta Grafik) |
| @nivo/scatterplot | ScatterPlot (Serpili Grafik) |
| @nivo/calendar | Calendar (Takvim Grafiği) |
| @nivo/circle-packing | CirclePacking (Daire Paketleme) |
| @nivo/heatmap | HeatMap (Isı Haritası) |
| @nivo/marimekko | Marimekko (Mekko Grafiği) |
| @nivo/network | Network (Ağ Diyagramı) |
| @nivo/parallel-coordinates | ParallelCoordinates (Paralel Koordinatlar) |
| @nivo/radial-bar | RadialBar (Radyal Çubuk Grafik) |
| @nivo/stream | Stream (Akış Grafiği) |
| @nivo/swarmplot | SwarmPlot (Sürü Grafiği) |
| @nivo/treemap | TreeMap (Ağaç Haritası) |
| @nivo/voronoi | Voronoi (Voronoi Diyagramı) |
| @nivo/waffle | Waffle (Waffle Grafik) |
| @nivo/bump | Bump (Sıralama Değişim Grafiği) |
| @nivo/bullet | Bullet (Mermi Grafiği) |

## 3. Uygulama Planı

### Adım 1: Recharts Eksik Bileşen Ekleme
**Dosya:** `src/components/dashboard/BuilderWidgetRenderer.tsx`

Recharts import satırına eklenecek:
```typescript
import { 
  // Mevcut bileşenler...
  RadialBarChart, RadialBar  // EKLENİCEK
} from 'recharts';
```

RechartsScope'a eklenecek:
```typescript
const RechartsScope = {
  // Mevcut bileşenler...
  RadialBarChart, RadialBar  // EKLENİCEK
};
```

**Dosya:** `src/components/admin/CustomCodeWidgetBuilder.tsx`
Aynı değişiklikler uygulanacak.

### Adım 2: Nivo Paketlerini Yükleme
Aşağıdaki Nivo paketleri projeye eklenecek:
```
@nivo/bar
@nivo/line
@nivo/pie
@nivo/scatterplot
@nivo/calendar
@nivo/circle-packing
@nivo/heatmap
@nivo/marimekko
@nivo/network
@nivo/parallel-coordinates
@nivo/radial-bar
@nivo/stream
@nivo/swarmplot
@nivo/treemap
@nivo/voronoi
@nivo/waffle
@nivo/bump
@nivo/bullet
```

### Adım 3: Nivo Scope Güncelleme
**Dosya:** `src/components/dashboard/BuilderWidgetRenderer.tsx`

`initNivoScope` fonksiyonunu güncelleyerek tüm Nivo bileşenlerini lazy-load edeceğiz:

```typescript
const initNivoScope = async () => {
  if (NivoScope) return NivoScope;
  
  try {
    const [
      nivoSankey, nivoSunburst, nivoChord, nivoRadar, nivoGeo, nivoFunnel, 
      nivoBar, nivoLine, nivoPie, nivoScatterplot, nivoCalendar,
      nivoCirclePacking, nivoHeatmap, nivoMarimekko, nivoNetwork,
      nivoParallelCoordinates, nivoRadialBar, nivoStream, nivoSwarmplot,
      nivoTreemap, nivoVoronoi, nivoWaffle, nivoBump, nivoBullet,
      _nivoCore
    ] = await Promise.all([
      import('@nivo/sankey'),
      import('@nivo/sunburst'),
      import('@nivo/chord'),
      import('@nivo/radar'),
      import('@nivo/geo'),
      import('@nivo/funnel'),
      import('@nivo/bar'),
      import('@nivo/line'),
      import('@nivo/pie'),
      import('@nivo/scatterplot'),
      import('@nivo/calendar'),
      import('@nivo/circle-packing'),
      import('@nivo/heatmap'),
      import('@nivo/marimekko'),
      import('@nivo/network'),
      import('@nivo/parallel-coordinates'),
      import('@nivo/radial-bar'),
      import('@nivo/stream'),
      import('@nivo/swarmplot'),
      import('@nivo/treemap'),
      import('@nivo/voronoi'),
      import('@nivo/waffle'),
      import('@nivo/bump'),
      import('@nivo/bullet'),
      import('@nivo/core')
    ]);
    
    NivoScope = {
      // Mevcut bileşenler
      ResponsiveSankey: nivoSankey.ResponsiveSankey,
      ResponsiveSunburst: nivoSunburst.ResponsiveSunburst,
      ResponsiveChord: nivoChord.ResponsiveChord,
      ResponsiveRadar: nivoRadar.ResponsiveRadar,
      ResponsiveFunnel: nivoFunnel.ResponsiveFunnel,
      ResponsiveChoropleth: nivoGeo.ResponsiveChoropleth,
      ResponsiveGeoMap: nivoGeo.ResponsiveGeoMap,
      
      // Yeni bileşenler
      ResponsiveBar: nivoBar.ResponsiveBar,
      ResponsiveLine: nivoLine.ResponsiveLine,
      ResponsivePie: nivoPie.ResponsivePie,
      ResponsiveScatterPlot: nivoScatterplot.ResponsiveScatterPlot,
      ResponsiveCalendar: nivoCalendar.ResponsiveCalendar,
      ResponsiveCirclePacking: nivoCirclePacking.ResponsiveCirclePacking,
      ResponsiveHeatMap: nivoHeatmap.ResponsiveHeatMap,
      ResponsiveMarimekko: nivoMarimekko.ResponsiveMarimekko,
      ResponsiveNetwork: nivoNetwork.ResponsiveNetwork,
      ResponsiveParallelCoordinates: nivoParallelCoordinates.ResponsiveParallelCoordinates,
      ResponsiveRadialBar: nivoRadialBar.ResponsiveRadialBar,
      ResponsiveStream: nivoStream.ResponsiveStream,
      ResponsiveSwarmPlot: nivoSwarmplot.ResponsiveSwarmPlot,
      ResponsiveTreeMap: nivoTreemap.ResponsiveTreeMap,
      ResponsiveVoronoi: nivoVoronoi.ResponsiveVoronoi,
      ResponsiveWaffle: nivoWaffle.ResponsiveWaffle,
      ResponsiveBump: nivoBump.ResponsiveBump,
      ResponsiveAreaBump: nivoBump.ResponsiveAreaBump,
      ResponsiveBullet: nivoBullet.ResponsiveBullet,
      
      // Tema oluşturucu
      getTheme: (isDark: boolean) => ({...})
    };
    
    return NivoScope;
  } catch (e) {
    console.warn('Nivo yüklenemedi:', e);
    return null;
  }
};
```

**Dosya:** `src/components/admin/CustomCodeWidgetBuilder.tsx`
Aynı değişiklikler uygulanacak.

### Adım 4: EmptyNivoScope Güncelleme
Her iki dosyada da placeholder scope güncellenecek:

```typescript
const EmptyNivoScope = {
  // Mevcut
  ResponsiveSankey: () => null,
  ResponsiveSunburst: () => null,
  ResponsiveChord: () => null,
  ResponsiveRadar: () => null,
  ResponsiveFunnel: () => null,
  ResponsiveChoropleth: () => null,
  ResponsiveGeoMap: () => null,
  
  // Yeni
  ResponsiveBar: () => null,
  ResponsiveLine: () => null,
  ResponsivePie: () => null,
  ResponsiveScatterPlot: () => null,
  ResponsiveCalendar: () => null,
  ResponsiveCirclePacking: () => null,
  ResponsiveHeatMap: () => null,
  ResponsiveMarimekko: () => null,
  ResponsiveNetwork: () => null,
  ResponsiveParallelCoordinates: () => null,
  ResponsiveRadialBar: () => null,
  ResponsiveStream: () => null,
  ResponsiveSwarmPlot: () => null,
  ResponsiveTreeMap: () => null,
  ResponsiveVoronoi: () => null,
  ResponsiveWaffle: () => null,
  ResponsiveBump: () => null,
  ResponsiveAreaBump: () => null,
  ResponsiveBullet: () => null,
  
  useTheme: () => ({}),
  getTheme: () => ({})
};
```

## 4. Teknik Detaylar

### Paket Boyutu Etkisi
- Her Nivo paketi yaklaşık 50-150KB
- Lazy-loading kullanıldığı için sayfa yüklemesi etkilenmez
- Sadece grafik kullanıldığında yüklenir

### Grafik Kullanım Örnekleri (AI Kod Üretici için)

**Nivo Bar Chart:**
```javascript
return React.createElement(Nivo.ResponsiveBar, {
  data: data,
  keys: ['value'],
  indexBy: 'name',
  margin: { top: 50, right: 130, bottom: 50, left: 60 },
  theme: Nivo.getTheme(isDark)
});
```

**Nivo Calendar:**
```javascript
return React.createElement(Nivo.ResponsiveCalendar, {
  data: data,
  from: '2024-01-01',
  to: '2024-12-31',
  emptyColor: '#eeeeee',
  theme: Nivo.getTheme(isDark)
});
```

**Recharts RadialBarChart:**
```javascript
return React.createElement(Recharts.RadialBarChart, {
  width: 500, height: 300,
  innerRadius: '10%', outerRadius: '80%',
  data: data,
  startAngle: 180, endAngle: 0
}, [
  React.createElement(Recharts.RadialBar, {
    key: 'bar',
    minAngle: 15,
    background: true,
    clockWise: true,
    dataKey: 'value'
  })
]);
```

## 5. Dosya Değişiklik Özeti

| Dosya | Değişiklik |
|-------|------------|
| package.json | 18 yeni Nivo paketi ekleme |
| src/components/dashboard/BuilderWidgetRenderer.tsx | Recharts ve Nivo scope güncelleme |
| src/components/admin/CustomCodeWidgetBuilder.tsx | Recharts ve Nivo scope güncelleme |

## 6. Test Planı
1. Mevcut widget'ların çalıştığını doğrula
2. Yeni bir Calendar widget oluşturup test et
3. RadialBarChart widget oluşturup test et
4. HeatMap widget oluşturup test et
