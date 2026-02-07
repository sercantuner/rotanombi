
# Widget Veri Yükleme Stratejisi: Stale-While-Revalidate + Durum Göstergesi

## Mevcut Durum Analizi

Şu anda sistem şöyle çalışıyor:
1. Widget açıldığında `useDynamicWidgetData` hook'u çağrılıyor
2. Önce Memory Cache → sonra Supabase DB (`company_data_cache`) kontrol ediliyor
3. DB'de veri varsa gösteriliyor, DIA API'ye gidilmiyor
4. DB boşsa veya Force Refresh yapılırsa DIA API'den veri çekiliyor

**Problem**: Kullanıcı hangi verinin gösterildiğini bilmiyor (cache mi, taze mi, ne zaman güncellendi).

## Önerilen Çözüm: Stale-While-Revalidate + Durum Badge'i

### Yeni Veri Akışı

```text
Widget Açılır
     │
     ▼
┌─────────────────────────┐
│ 1. Supabase DB'den oku  │ ← Cache'deki veriyi ANINDA göster
│    (company_data_cache) │   Kullanıcı: "Önbellek verisi"
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 2. Arka planda DIA API  │ ← Sessizce yeni veri çek
│    sorgusunu başlat     │   Kullanıcı: "Güncelleniyor..."
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 3. Yeni veri gelince    │ ← DB güncelle + UI refresh
│    DB + Cache güncelle  │   Kullanıcı: "Güncel"
└─────────────────────────┘
```

### UI Veri Durumu Göstergesi

Widget header'ına küçük bir badge/indicator eklenecek:

| Durum | Renk | İkon | Açıklama |
|-------|------|------|----------|
| Güncel | Yeşil | ✓ | Son 5 dakika içinde senkronize edildi |
| Önbellek | Sarı | ⏱ | Cache'den gösteriliyor, arka planda güncelleniyor |
| Güncelleniyor | Mavi (animasyonlu) | ↻ | DIA'dan veri çekiliyor |
| Eski | Turuncu | ⚠ | Son güncelleme > 24 saat önce |
| Hata | Kırmızı | ✕ | Senkronizasyon başarısız |

## Teknik Değişiklikler

### 1. useDynamicWidgetData Hook Genişletmesi

`DynamicWidgetDataResult` interface'ine yeni alanlar eklenecek:

```typescript
interface DynamicWidgetDataResult {
  data: any;
  rawData: any[];
  multiQueryData?: any[][] | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  
  // YENİ: Veri durumu bilgisi
  dataStatus: {
    source: 'cache' | 'api' | 'pending';
    lastSyncedAt: Date | null;
    isStale: boolean;
    isRevalidating: boolean;  // Arka planda yenileniyor mu
  };
}
```

### 2. Arka Plan Senkronizasyonu

Widget açıldığında:
1. Önce DB'den veri göster (anında)
2. `backgroundRevalidate` fonksiyonu başlat
3. DIA API'den yeni veri çek
4. Yeni veriyi `company_data_cache`'e yaz
5. Memory cache'i ve UI'ı güncelle

```typescript
// Pseudo-kod
const backgroundRevalidate = async () => {
  setDataStatus(prev => ({ ...prev, isRevalidating: true }));
  
  try {
    const freshData = await fetchFromDiaApi(dataSourceId);
    await upsertToCompanyDataCache(freshData);
    setData(freshData);
    setDataStatus({ source: 'api', lastSyncedAt: new Date(), isStale: false, isRevalidating: false });
  } catch (err) {
    // Hata olsa bile eski veriyi göstermeye devam et
    setDataStatus(prev => ({ ...prev, isRevalidating: false }));
  }
};
```

### 3. BuilderWidgetRenderer Badge Bileşeni

Widget header'ına eklenecek durum badge'i:

```tsx
const DataStatusBadge = ({ status }: { status: DataStatus }) => {
  if (status.isRevalidating) {
    return (
      <Badge variant="secondary" className="text-xs animate-pulse">
        <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
        Güncelleniyor
      </Badge>
    );
  }
  
  if (status.source === 'cache' && status.isStale) {
    return (
      <Tooltip content={`Son güncelleme: ${formatRelative(status.lastSyncedAt)}`}>
        <Badge variant="outline" className="text-xs text-muted-foreground">
          <Clock className="h-3 w-3 mr-1" />
          Önbellek
        </Badge>
      </Tooltip>
    );
  }
  
  // Güncel veri - badge gösterme veya minimal göster
  return null;
};
```

### 4. Otomatik Revalidation Kuralları

Arka plan senkronizasyonu şu durumlarda tetiklenir:

1. **Widget ilk açıldığında**: DB'de veri varsa göster, arka planda DIA kontrolü yap
2. **Cache TTL dolduğunda**: 10 dakika sonra stale işaretle, arka planda yenile
3. **Manuel yenileme**: Kullanıcı refresh butonuna tıkladığında

**Otomatik tetikleme YAPMAYACAĞIMIZ durumlar** (mevcut kısıtlamaya uygun):
- Periyodik polling (kullanıcı eylemi olmadan DIA çağrısı YOK)
- Sayfa açık kaldığı sürece sürekli kontrol YOK

### 5. company_data_cache Timestamp Kullanımı

Mevcut `company_data_cache` tablosunda `updated_at` alanı var. Bu alan:
- Widget açıldığında kontrol edilecek
- "Son güncelleme" bilgisi olarak kullanıcıya gösterilecek
- Stale belirleme için (> 1 saat = stale) kullanılacak

## Dosya Değişiklikleri

| Dosya | İşlem | Açıklama |
|-------|-------|----------|
| `src/hooks/useDynamicWidgetData.tsx` | Güncelle | dataStatus state ve backgroundRevalidate mantığı |
| `src/components/dashboard/BuilderWidgetRenderer.tsx` | Güncelle | DataStatusBadge bileşeni ve header entegrasyonu |
| `src/components/dashboard/DataStatusBadge.tsx` | Yeni | Veri durumu gösterge bileşeni |
| `src/hooks/useDataSourceLoader.tsx` | Güncelle | lastSyncedAt bilgisi döndürme |
| `supabase/functions/dia-api-test/index.ts` | Güncelle | Sync sonrası timestamp döndürme |

## Kullanıcı Deneyimi Akışı

1. **Widget ilk açılış**:
   - DB'de veri varsa → Anında göster + "Önbellek" badge + arka planda yenile
   - DB boşsa → "Yükleniyor..." göster + DIA'dan çek

2. **Arka plan yenileme sırasında**:
   - Mevcut veri görünür kalır
   - Badge "Güncelleniyor..." (spinning icon)

3. **Yenileme tamamlandığında**:
   - Veri sessizce güncellenir (flicker yok)
   - Badge kaybolur veya "Güncel ✓" gösterir

4. **Yenileme başarısız olursa**:
   - Eski veri görünür kalır
   - Toast ile hata bildirimi
   - Badge "Eski veri" uyarısı

## Avantajlar

- Kullanıcı her zaman bilgilendirilir
- Anında içerik görünür (perceived performance)
- DIA hatalarında bile çalışmaya devam eder
- Mevcut "sürekli API çağrısı yapma" kısıtlamasına uygun
- Kullanıcı manuel refresh isterse güncel veri alabilir
