
# Kapsamlı Kod Temizliği ve Optimizasyon Planı

## Keşif Özeti

Kod tabanı detaylıca incelendi. Aşağıdaki kategorilerde temizlik ve optimizasyon yapılacak:

## 1. SİLİNECEK DOSYALAR - Kullanılmayan Bileşenler

### Dashboard Bileşenleri
| Dosya | Durum | Neden |
|-------|-------|-------|
| `src/components/dashboard/DataStatusBadge.tsx` | SİL | DataStatusIndicator ile değiştirildi. Sadece interface için import ediliyor - interface DataStatusIndicator'a taşınacak |
| `src/components/dashboard/DonutChart.tsx` | SİL | Custom code widget'ları ile render ediliyor, hiçbir yerde import yok |
| `src/components/dashboard/ResponsiveLegend.tsx` | SİL | AI üretilen widget kodlarına gömüldü, hiçbir yerde import yok |
| `src/components/dashboard/DraggableWidgetGrid.tsx` | SİL | Container-based dashboard'a geçildi, hiçbir yerde import yok |
| `src/components/dashboard/WidgetUpdatesBadge.tsx` | SİL | Hiçbir yerde import edilmiyor |
| `src/components/dashboard/UserFeedbackPanel.tsx` | SİL | Hiçbir yerde import edilmiyor |

### Admin Bileşenleri
| Dosya | Durum | Neden |
|-------|-------|-------|
| `src/components/admin/PivotConfigBuilder.tsx` | SİL | Hiçbir yerde import yok |
| `src/components/admin/WidgetTemplates.tsx` | SİL | Hiçbir yerde import yok |
| `src/components/admin/WidgetPreviewRenderer.tsx` | SİL | Hiçbir yerde import yok (LiveWidgetPreview kullanılıyor) |
| `src/components/admin/CalculatedFieldBuilder.tsx` | SİL | Hiçbir yerde import yok |
| `src/components/admin/BulkDataSyncManager.tsx` | SİL | Hiçbir yerde import yok |
| `src/components/admin/PostFetchFilterBuilder.tsx` | SİL | Hiçbir yerde import yok |
| `src/components/admin/DateRangeConfig.tsx` | SİL | Hiçbir yerde import yok |

### Lib Dosyaları
| Dosya | Durum | Neden |
|-------|-------|-------|
| `src/lib/api.ts` | SİL | Eski mock API - hiçbir yerde import yok, diaClient kullanılıyor |
| `src/lib/types.ts` | SİL | Sadece api.ts tarafından kullanılıyor, o da kullanılmıyor |
| `src/lib/chartUtils.ts` | SİL | Hiçbir yerde import yok (AI widget'lar kendi chart utils'lerini içeriyor) |

### Hook'lar
| Dosya | Durum | Neden |
|-------|-------|-------|
| `src/hooks/useRelationshipAutoFill.tsx` | SİL | Hiçbir yerde import yok |

### Edge Functions
| Dosya | Durum | Neden |
|-------|-------|-------|
| `supabase/functions/dia-finans-rapor/` | DEĞERLENDİR | Sadece diaClient.ts'de tanımlı ama DashboardPage'de çağrılıyor |
| `supabase/functions/dia-genel-rapor/` | KORU | DashboardPage'de aktif kullanılıyor |
| `supabase/functions/dia-satis-rapor/` | DEĞERLENDİR | Tanımlı ama hiçbir yerde çağrılmıyor |

## 2. BİRLEŞTİRİLECEK / REFACTOR EDİLECEK

### DataStatus Interface Taşıma
`DataStatusBadge.tsx` silinmeden önce:
- `DataStatus` interface'ini `DataStatusIndicator.tsx` dosyasına taşı
- Import'ları güncelle

### Filter Bileşenleri Temizliği
`src/components/filters/` klasöründe:
- `FilterSidebar.tsx` - index.ts'de export var ama doğrudan kullanılmıyor
- `MultiSelectFilter.tsx` - index.ts'de export var ama doğrudan kullanılmıyor
- `index.ts` - Kullanılmayan export'ları kaldır

### WidgetRegistry Modernizasyonu
`src/lib/widgetRegistry.ts`:
- Legacy grafik widget tanımları temizlenebilir (artık builder_config ile dinamik)
- Yorum satırındaki "Legacy chart widgets removed" açıklamaları temizlenebilir

## 3. OPTİMİZASYON GEREKTİREN ALANLAR

### DashboardPage.tsx
- `diaGetGenelRapor` ve `diaGetFinansRapor` çağrıları DB-First stratejisine uygun mu kontrol et
- Gereksiz legacy veri çekme kodları varsa temizle

### diaClient.ts
- `diaGetSatisRapor` fonksiyonu hiçbir yerde çağrılmıyor - sil veya yorum ekle
- Kullanılmayan export'ları temizle

### mockData.ts
- Demo modu için korunmalı ama gereksiz fonksiyonlar varsa değerlendir

## 4. KORUNACAK DOSYALAR (Aktif Kullanımda)

Aşağıdaki dosyalar aktif kullanımda ve KORUNMALI:
- Tüm UI bileşenleri (`src/components/ui/`)
- Auth context ve hook'lar
- DiaDataCacheContext ve GlobalFilterContext
- useDynamicWidgetData, useDataSourceLoader, useCompanyData
- BuilderWidgetRenderer, ContainerRenderer, DynamicPage
- CustomCodeWidgetBuilder, LiveWidgetPreview
- Tüm aktif edge function'lar (dia-api-test, dia-data-sync, dia-login, ai-code-generator)

## 5. TEMİZLİK SONRASI BEKLENEN KAZANIMLAR

| Metrik | Önceki | Sonrası |
|--------|--------|---------|
| Dashboard bileşen sayısı | 36 | 30 (-6) |
| Admin bileşen sayısı | 38 | 31 (-7) |
| Lib dosya sayısı | 17 | 14 (-3) |
| Hook sayısı | 24 | 23 (-1) |
| Toplam silinen dosya | - | ~17 dosya |

## 6. UYGULAMA SIRASI

1. **Faz 1 - Interface Taşıma**
   - DataStatus interface'ini DataStatusIndicator'a taşı
   - Import'ları güncelle

2. **Faz 2 - Kullanılmayan Dashboard Bileşenleri Silme**
   - DataStatusBadge.tsx
   - DonutChart.tsx
   - ResponsiveLegend.tsx
   - DraggableWidgetGrid.tsx
   - WidgetUpdatesBadge.tsx
   - UserFeedbackPanel.tsx

3. **Faz 3 - Admin Bileşenleri Silme**
   - PivotConfigBuilder.tsx
   - WidgetTemplates.tsx
   - WidgetPreviewRenderer.tsx
   - CalculatedFieldBuilder.tsx
   - BulkDataSyncManager.tsx
   - PostFetchFilterBuilder.tsx
   - DateRangeConfig.tsx

4. **Faz 4 - Lib ve Hook Temizliği**
   - api.ts, types.ts, chartUtils.ts sil
   - useRelationshipAutoFill.tsx sil
   - diaClient.ts'den kullanılmayan fonksiyonları temizle

5. **Faz 5 - Index ve Export Temizliği**
   - filters/index.ts güncelle
   - Diğer barrel export dosyalarını kontrol et

6. **Faz 6 - Test ve Doğrulama**
   - Build hatası kontrolü
   - Dashboard ve sayfa fonksiyonalite testi

## Notlar

- Edge function'lar (dia-finans-rapor, dia-satis-rapor) DashboardPage'de potansiyel olarak kullanılıyor - dikkatli değerlendirilmeli
- SortableWidget.tsx sadece DraggableWidgetGrid tarafından kullanılıyor - grid silinirse bu da silinebilir
- FieldWellBuilder ve FieldWellItem sadece LiveWidgetPreview tarafından import ediliyor ama tip tanımı için kullanılıyor - interface export ediliyorsa dikkat
