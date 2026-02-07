
# Widget Bazlı Loading Göstergesi - Full-Screen Loading Kaldırma

## Mevcut Durum

Şu anda iki farklı loading mekanizması var:

1. **DashboardLoadingScreen** (Full-Screen Overlay)
   - `fixed inset-0 z-50` ile tüm ekranı kaplıyor
   - Progress bar ve animasyonlu bar chart içeriyor
   - Veri kaynakları yüklenirken tüm dashboard'u engelliyor
   - Kullanıldığı yerler: `DashboardPage.tsx` ve `DynamicPage.tsx`

2. **BuilderWidgetRenderer Skeleton**
   - Her widget kendi içinde `Skeleton` bileşeni gösteriyor
   - Ancak mevcut skeleton basit ve minimal (sadece gri kutular)

## Önerilen Değişiklikler

### 1. DashboardLoadingScreen Kullanımını Kaldır
`DashboardPage.tsx` ve `DynamicPage.tsx` dosyalarından `showLoadingScreen` koşulunu ve `<DashboardLoadingScreen />` bileşenini kaldır.

### 2. Widget Bazlı Kompakt Loading Göstergesi Oluştur
Her widget için küçük, şık bir loading göstergesi:

```text
┌─────────────────────────────────────┐
│                                     │
│     ███  ██  ███  █  ████          │  ← Mini bar chart animasyonu
│          Yükleniyor...              │
│                                     │
└─────────────────────────────────────┘
```

### 3. Teknik Uygulama

**Yeni Bileşen: WidgetLoadingSkeleton**
- DashboardLoadingScreen'deki `BarChartAnimation` bileşenini küçülterek kullan
- Animasyonlu dikey çubuklar (mevcut animasyon)
- "Yükleniyor..." yazısı

**BuilderWidgetRenderer Güncellemesi**
- Mevcut basit `Skeleton` yerine yeni `WidgetLoadingSkeleton` kullan
- Widget boyutuna uygun responsive tasarım

## Dosya Değişiklikleri

| Dosya | Değişiklik |
|-------|-----------|
| `src/pages/DashboardPage.tsx` | `DashboardLoadingScreen` import ve kullanımını kaldır |
| `src/pages/DynamicPage.tsx` | `DashboardLoadingScreen` import ve kullanımını kaldır |
| `src/components/dashboard/BuilderWidgetRenderer.tsx` | Loading skeleton'u yeni animasyonlu bileşenle değiştir |
| `src/components/dashboard/DashboardLoadingScreen.tsx` | Dosyayı sil veya sadece `BarChartAnimation`'ı export et |

## Yeni Loading Görünümü

**Widget Loading State:**
```tsx
// Kompakt animasyonlu loading göstergesi
<Card className={isolatedClassName}>
  <CardContent className="flex flex-col items-center justify-center py-8 gap-3">
    {/* Mini bar chart animasyonu - 5 çubuk, küçük boyut */}
    <div className="flex items-end justify-center gap-0.5 h-8">
      {[0,1,2,3,4].map(i => (
        <div 
          key={i}
          className="w-1.5 bg-primary/60 rounded-t-sm animate-bar-bounce"
          style={{ animationDelay: `${i * 0.15}s`, height: '100%' }}
        />
      ))}
    </div>
    <span className="text-xs text-muted-foreground">Yükleniyor...</span>
  </CardContent>
</Card>
```

## Kullanıcı Deneyimi Karşılaştırması

**Önceki:**
- Sayfa açılıyor → Tüm ekran kapatılıyor → Loading animasyonu → Dashboard görünür

**Yeni:**
- Sayfa açılıyor → Dashboard layout anında görünür → Her widget kendi loading'ini gösterir → Widget'lar teker teker yüklenir

## Avantajlar

- Sayfa anında kullanılabilir
- Header, sidebar ve diğer UI öğeleri hemen erişilebilir
- Widget'lar bağımsız yüklenebilir
- Progressive loading deneyimi
- Mobil performans iyileşmesi
