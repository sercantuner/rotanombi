
# Veri İsteği Havuzu (Field Pool) - Sayfa Bazlı Tek Sorgu Optimizasyonu

## Mevcut Durum (Problem)

Bir sayfada ayni veri kaynagini (ornegin `scf_fatura_listele`) kullanan 5 widget varsa:

```text
Widget A: requiredFields = [tarih, net, turu]         --> 1 RPC sorgusu (44K kayit)
Widget B: requiredFields = [tarih, toplam, __cariunvan] --> 1 RPC sorgusu (44K kayit)
Widget C: requiredFields = [tarih, net, kdv]           --> 1 RPC sorgusu (44K kayit)
Widget D: requiredFields = [turu, net]                 --> 1 RPC sorgusu (44K kayit)
Widget E: (custom code, no requiredFields)             --> 1 full SELECT (44K kayit)

Toplam: 5 ayri veritabani sorgusu = ~220K satir isleniyor
```

## Hedef

```text
Havuz: UNION(tum requiredFields) = [tarih, net, turu, toplam, __cariunvan, kdv]
--> 1 RPC sorgusu (44K kayit, 6 alan)

Toplam: 1 veritabani sorgusu = ~44K satir isleniyor (5x azalma)
```

## Teknik Degisiklikler

### 1. useDataSourceLoader.tsx - Alan Havuzu Olusturma

`findUsedDataSources` fonksiyonu zaten sayfa widgetlarinin `builder_config`'lerini cekerken `dataSourceId` topluyor. Bu adima ek olarak:

- Her widget'in `builder_config.requiredFields` dizisini de topla
- Ayni veri kaynagini kullanan widgetlarin alanlarini birlestir (Set union)
- Eger herhangi bir widget `requiredFields` tanimlamadiysa (null/bos), o kaynak icin projeksiyon uygulanmaz (geri uyumluluk: tum veri cekilir)

Fonksiyonun donusu degisir:

```typescript
// Oncesi:
async function findUsedDataSources(): Promise<string[]>

// Sonrasi:
interface DataSourceFieldPool {
  dataSourceId: string;
  // null = projeksiyon yok, tum veri cekilecek (en az 1 widget requiredFields tanimlamadiysa)
  pooledFields: string[] | null;
}
async function findUsedDataSources(): Promise<DataSourceFieldPool[]>
```

### 2. useDataSourceLoader.tsx - loadDataSourceFromDatabase Guncelleme

`loadDataSourceFromDatabase` fonksiyonu zaten `requiredFields` parametresi alabilir. `loadAllDataSources` icinde her veri kaynagi yuklenirken havuzdaki birlesmis alan listesi (`pooledFields`) gecilecek:

```typescript
// loadAllDataSources icinde:
for (const pool of fieldPools) {
  const dataSource = getDataSourceById(pool.dataSourceId);
  // Havuzdaki birlesmis alanlarla tek sorgu
  const dbResult = await loadDataSourceFromDatabase(dataSource, pool.pooledFields);
  // Sonuc memory cache'e kaydedilir - tum widgetlar buradan okur
}
```

### 3. useDynamicWidgetData.tsx - DB Sorgusunu Atla, Cache Kullan

`useDynamicWidgetData` icindeki `fetchDataForSource` fonksiyonu zaten once memory cache'i kontrol ediyor. Havuz sistemi sayesinde:

1. `useDataSourceLoader` sayfa yuklenmesinde havuzlanmis veriyi cekip memory cache'e koyar
2. Her widget `fetchDataForSource` cagirildiginda memory cache'de veriyi bulur
3. Widget kendi `requiredFields` icinde olmayan alanlar da havuzda olacak (baska widgetlardan) - bu sorun degil cunku fazla alan widget kodunu bozmaz

**Kritik**: `useDynamicWidgetData` icindeki `fetchFromDatabase` cagrisi artik gereksiz hale gelir (cunku veri zaten `useDataSourceLoader` tarafindan memory cache'e yuklenmis olacak). Ancak geri uyumluluk icin kalir - cache miss durumunda yedek olarak calisir.

### 4. Ozel Durum: requiredFields Olmayan Widget

Bir sayfada ayni veri kaynagini kullanan widgetlardan biri bile `requiredFields` tanimlamadiysa, o kaynak icin projeksiyon yapilmaz ve tum veri cekilir. Bu, custom code widgetlarin beklenmedik alan eksikliginden etkilenmesini engeller.

### 5. Ozel Durum: Multi-Query Widgetlar

Bir widget birden fazla veri kaynagi kullaniyorsa (multi-query), her veri kaynaginin alanlari ayri havuzlara eklenir. Ornegin:
- Widget X: query1 = fatura[tarih, net], query2 = cari[carikodu, bakiye]
- Widget Y: query1 = fatura[tarih, turu]

Sonuc:
- fatura havuzu: [tarih, net, turu]
- cari havuzu: [carikodu, bakiye]

## Degisecek Dosyalar

| Dosya | Degisiklik |
|-------|------------|
| `src/hooks/useDataSourceLoader.tsx` | `findUsedDataSources` donus tipini genislet, `loadAllDataSources` icinde havuzlanmis alanlari `loadDataSourceFromDatabase`'e gecir |
| `src/hooks/useDynamicWidgetData.tsx` | Degisiklik yok - mevcut memory cache onceligi zaten dogru calisiyor |

## Beklenen Kazanim

| Senaryo | Oncesi | Sonrasi |
|---------|--------|---------|
| 5 fatura widgeti olan sayfa | 5 RPC sorgusu | 1 RPC sorgusu |
| 3 farkli kaynak, 10 widget | 10 sorgu | 3 sorgu |
| DB islem suresi | ~5x tekrar | 1x |
| Bellek | Her widget ayri kopyalar | Tek kopya paylasilir |
