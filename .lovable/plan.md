

# DIA Cache Durumu İyileştirmesi - İstatistik ve Son Yükleme Zamanı

## Tespit Edilen Sorunlar

### Sorun 1: Gerçek API Çağrıları Sayılmıyor
`useDynamicWidgetData` içindeki `backgroundRevalidate` fonksiyonu `dia-data-sync` edge function'ı çağırıyor ama `recordApiCall()` fonksiyonunu çağırmıyor. Bu yüzden:
- "Gerçek API: 0" gösteriyor ama aslında API çağrıları yapılıyor
- DIA kontör harcaması takip edilemiyor

### Sorun 2: Son Yüklenme Zamanı Gösterilmiyor
`DiaQueryStats` panelinde yüklenmiş veri kaynakları listeleniyor ama:
- Her kaynağın ne zaman yüklendiği görünmüyor
- Kullanıcı verinin ne kadar güncel olduğunu anlayamıyor

## Çözüm Planı

### 1. recordApiCall() Ekleme
`backgroundRevalidate` fonksiyonuna `recordApiCall()` çağrısı eklenecek:

```typescript
// backgroundRevalidate içinde, sync başarılı olduğunda:
const { recordApiCall } = cacheContextRef.current;
// ...
if (result.success || freshDbResult.data.length > 0) {
  recordApiCall(); // Gerçek API çağrısı sayılsın
}
```

### 2. Veri Kaynağı Sync Zamanı Takibi
DiaDataCacheContext'e her veri kaynağının son sync zamanını tutan yapı eklenecek:

```typescript
// Context'e yeni state:
const [dataSourceSyncTimes, setDataSourceSyncTimes] = 
  useState<Map<string, Date>>(new Map());

// Yeni fonksiyonlar:
const setDataSourceSyncTime = (dataSourceId: string, time: Date) => {...}
const getDataSourceSyncTime = (dataSourceId: string) => Date | null
```

### 3. DiaQueryStats UI Güncellemesi
Yüklenmiş veri kaynakları listesinde son sync zamanı gösterilecek:

```text
┌──────────────────────────────────────┐
│ ✓ Cari Kart Listesi                  │
│   scf/carikart_listele               │
│   ⏱️ 5 dakika önce                   │  ← YENİ
├──────────────────────────────────────┤
│ ✓ Fatura Listesi                     │
│   scf/fatura_listele                 │
│   ⏱️ 2 saat önce                     │  ← YENİ
└──────────────────────────────────────┘
```

## Teknik Değişiklikler

### Dosya: `src/contexts/DiaDataCacheContext.tsx`

| Değişiklik | Açıklama |
|------------|----------|
| `dataSourceSyncTimes` state | Her veri kaynağının son sync zamanı (Map) |
| `setDataSourceSyncTime()` | Sync zamanını kaydet |
| `getDataSourceSyncTime()` | Sync zamanını oku |
| `getAllDataSourceSyncTimes()` | Tüm sync zamanlarını döndür |

### Dosya: `src/hooks/useDynamicWidgetData.tsx`

| Değişiklik | Açıklama |
|------------|----------|
| `recordApiCall` import | Context'ten recordApiCall çek |
| backgroundRevalidate | Başarılı sync sonrası `recordApiCall()` çağır |
| backgroundRevalidate | Başarılı sync sonrası `setDataSourceSyncTime()` çağır |

### Dosya: `src/components/dashboard/DiaQueryStats.tsx`

| Değişiklik | Açıklama |
|------------|----------|
| `getAllDataSourceSyncTimes` import | Context'ten sync zamanlarını çek |
| Veri kaynağı listesi | Her satırda son sync zamanını göster |
| Format | "5 dakika önce", "2 saat önce" gibi relative time |

## Kullanıcı Deneyimi

**Önceki:**
```
Gerçek API: 0       ← Yanlış - aslında çağrı yapıldı
...
✓ Cari Kart Listesi
  scf/carikart_listele   ← Zaman bilgisi yok
```

**Sonraki:**
```
Gerçek API: 3       ← Doğru sayı
...
✓ Cari Kart Listesi
  scf/carikart_listele
  ⏱️ 5 dakika önce  ← Zaman bilgisi var
```

## Güvenlik ve Performans

- Sync zamanları sadece memory'de tutulur (DB sorgusu yapmaz)
- Sayfa yenilemesinde sıfırlanır (kabul edilebilir)
- Minimal state değişikliği (Map yapısı)

