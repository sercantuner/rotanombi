
# DIA Senkronizasyon Düzeltme Planı

## Tespit Edilen Sorunlar

### Sorun 1: BulkDataSyncManager Dönem Bağımsızlığını Görmezden Geliyor
Frontend kodu `is_period_independent` flag'ini veritabanından çekmiyor ve her kaynak için tüm dönemleri sorguluyorken, Edge Function bu mantığı uygulasa bile frontend her dönem için ayrı istek atıyor.

**Kanıt (Cache Verileri):**
| Kaynak | Dönem Bağımsız mı? | Çekilen Dönemler |
|--------|-------------------|------------------|
| Banka_Hesap_listesi | ✅ Evet | 9, 3, 2, 1 (hatalı) |
| cari_kart_listesi | ✅ Evet | 9, 8, 7, 6, 5, 3, 2, 1 (hatalı) |
| Kasa Kart Listesi | ✅ Evet | 9, 3, 2, 1 (hatalı) |
| scf_fatura_listele | ❌ Hayır | 9-1 arası tümü (doğru) |

### Sorun 2: Edge Function syncSingleSource Action'ında is_period_independent Kontrolü Yok
Edge function `syncSingleSource` action'ında sadece belirtilen dönem için veri çekiyor ve bu kontrol yok.

### Sorun 3: Stok Listesi Timeout Hataları
Büyük veri kaynakları için timeout hataları devam ediyor.

---

## Düzeltme Planı

### Değişiklik 1: BulkDataSyncManager.tsx - Dönem Bağımsız Kontrol

```typescript
interface DataSource {
  slug: string;
  name: string;
  module: string;
  method: string;
  is_period_independent: boolean; // Ekleniyor
  is_non_dia: boolean; // Ekleniyor
}

const fetchDataSources = async (): Promise<DataSource[]> => {
  const { data } = await supabase
    .from('data_sources')
    .select('slug, name, module, method, is_period_independent, is_non_dia')
    .eq('is_active', true);
  
  // DIA dışı kaynakları filtrele
  return (data || []).filter(ds => 
    !ds.is_non_dia && 
    !ds.slug.startsWith('_system')
  );
};
```

**Sync Döngüsü Güncellemesi:**
```typescript
// Her kaynak için dönem listesini belirle
const periodsForSource = source.is_period_independent 
  ? [periods[0]] // Sadece aktif dönem (en yüksek period_no)
  : periods; // Tüm dönemler

// Debug log
console.log(`[BulkSync] ${source.slug}: ${
  source.is_period_independent 
    ? 'dönem bağımsız (1 dönem)' 
    : `dönem bağımlı (${periodsForSource.length} dönem)`
}`);
```

### Değişiklik 2: Progress Map'te Kaynak Bazlı Dönem Gösterimi

Dönem bağımsız kaynaklar için sadece aktif dönem gösterilecek:

```typescript
for (const source of dataSources) {
  const periodsMap = new Map<number, SourcePeriodProgress>();
  
  // Dönem bağımsız kaynak sadece aktif dönemde çekilir
  const relevantPeriods = source.is_period_independent 
    ? [periods[0]] // İlk dönem (en yüksek no)
    : periods;
  
  for (const period of relevantPeriods) {
    periodsMap.set(period.period_no, { status: 'pending' });
  }
  
  sourcesMap.set(source.slug, { 
    slug: source.slug, 
    name: source.name, 
    periods: periodsMap,
    isPeriodIndependent: source.is_period_independent // UI badge için
  });
}
```

### Değişiklik 3: UI'da Dönem Bağımsız Badge Gösterimi

```tsx
{sourceProgress.isPeriodIndependent && (
  <Badge variant="outline" className="text-xs">
    <Calendar className="w-3 h-3 mr-1" />
    Dönem Bağımsız
  </Badge>
)}
```

---

## Dosya Değişiklikleri

| Dosya | Değişiklik |
|-------|------------|
| `src/components/admin/BulkDataSyncManager.tsx` | `is_period_independent` ve `is_non_dia` alanlarını fetch et, dönem listesini buna göre belirle |

---

## Beklenen Davranış

### Dönem Bağımsız Kaynaklar
- **cari_kart_listesi**: Sadece Dönem 9 için 1 istek
- **Stok_listesi**: Sadece Dönem 9 için 1 istek  
- **Kasa Kart Listesi**: Sadece Dönem 9 için 1 istek
- **Banka_Hesap_listesi**: Sadece Dönem 9 için 1 istek

### Dönem Bağımlı Kaynaklar
- **scf_fatura_listele**: Dönem 9, 8, 7... 1 için 9 istek
- **Çek Senet Listesi**: Tüm dönemler için ayrı istek
- **Sipariş Listesi**: Tüm dönemler için ayrı istek

---

## Ek: Hata Yönetimi İyileştirmeleri

### INSUFFICIENT_PRIVILEGES Hatası
Görev Listesi için yetki hatası alınıyor. Bu tür yetki hatalarını UI'da net göstermek önemli:

```typescript
// Hata mesajı parse
const getUserFriendlyError = (error: string) => {
  if (error.includes('INSUFFICIENT_PRIVILEGES')) {
    return 'DIA yetkisi eksik - Web servis kullanıcısı ayarlarını kontrol edin';
  }
  if (error.includes('Timeout')) {
    return 'Zaman aşımı - Veri çok büyük olabilir';
  }
  return error;
};
```
