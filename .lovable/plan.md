

## Widget Bazli Dinamik Selected Columns

### Problem
Suanda `data_sources` tablosundaki `selected_columns` alani statik olarak saklanmaktadir. Bu alan eski veya gecersiz kolon isimleri icerdiginde DIA API "Veri Hatasi" dondurmektedir (ornegin `scf_kasaislemleri_listele`). Ayrica bu alan manuel yonetim gerektirmektedir.

### Cozum
DIA API'ye gonderilen `selectedcolumns` parametresini `data_sources` tablosundan degil, **widget'larin `builder_config.requiredFields`** alanlarindan dinamik olarak hesaplamak.

### Mevcut Durum

```text
Widget Builder (kayit)
    |
    v
data_sources.selected_columns  <-- statik, hata riski
    |
    v
dia-data-sync / dia-api-test --> DIA API (selectedcolumns)
```

### Hedef Durum

```text
widgets.builder_config.requiredFields  (widget bazli)
    |
    v
Union(tum widget requiredFields)  <-- dinamik hesaplama
    |
    v
dia-data-sync / dia-api-test --> DIA API (selectedcolumns)
```

### Teknik Adimlar

#### 1. Edge Function: `dia-data-sync` - Widget Pool Hesaplama (Server-Side)

`syncChunk`, `incrementalSync` ve `cronSync` akislarinda, DIA API'ye istek atmadan once:

- `widgets` tablosundan `builder_config` alanlarini sorgula
- `builder_config.dataSourceId` veya `builder_config.multiQuery.queries[].dataSourceId` uzerinden ilgili veri kaynagini kullanan widget'lari bul
- Her widget'in `builder_config.requiredFields` dizisini birlestir (union)
- Eger herhangi bir widget `requiredFields` tanimlamadiysa, projeksiyon yapma (tum veri)
- Sonucu `selectedcolumns` olarak DIA API'ye gonder

Yeni helper fonksiyonu:
```typescript
async function getPooledColumnsForSource(sb, dataSourceId: string): Promise<string[] | null> {
  // widgets tablosundan bu dataSourceId'yi kullanan tum widget'lari cek
  // requiredFields union'i hesapla
  // null = projeksiyon yapma (en az 1 widget requiredFields tanimlamadi)
}
```

#### 2. Edge Function: `dia-api-test` - Ayni Mantik

`dia-api-test` edge function'inda da `data_sources.selected_columns` fallback'i yerine widget pool hesaplamasi kullanilacak:

- Mevcut kod (satir 557-573): `data_sources.selected_columns` okuyor
- Yeni kod: `widgets` tablosundan `requiredFields` union'i hesaplayacak
- Request'te `selectedColumns` gonderilmisse (widget builder test modunda) onu kullan

#### 3. Frontend: `loadDataSourceFromApi` - Pool Fields Aktarimi

`useDataSourceLoader.tsx` icinde `loadDataSourceFromApi` fonksiyonu suanda `dataSource.selected_columns` gonderiyor (satir 517). Bu degistirilecek:

- `loadAllDataSources` icerisinde zaten `pool.pooledFields` hesaplaniyor
- `loadDataSource` ve `loadDataSourceFromApi` fonksiyonlarina `pooledFields` parametresi eklenecek
- API cagirisinda `selectedColumns: pooledFields || undefined` gonderilecek (`data_sources.selected_columns` yerine)

#### 4. `data_sources.selected_columns` Alaninin Rolu

Bu alan artik DIA API cagrilarinda kullanilmayacak. Ancak:
- Widget Builder'daki `autoRequiredFields` sistemi bu alani guncellemeye devam edecek (metadata amacli)
- Ileriye donuk uyumluluk icin alan silinmeyecek
- Sadece DIA API iletisiminde widget pool'u kullanilacak

### Etkilenen Dosyalar

| Dosya | Degisiklik |
|---|---|
| `supabase/functions/dia-data-sync/index.ts` | `getPooledColumnsForSource` helper + `streamChunk`/`incrementalSync` entegrasyonu |
| `supabase/functions/dia-api-test/index.ts` | `selected_columns` fallback yerine widget pool |
| `src/hooks/useDataSourceLoader.tsx` | `loadDataSourceFromApi`'ye `pooledFields` parametresi |

### Onemli Notlar

- Widget'larin hicbiri `requiredFields` tanimlamadiysa, `selectedcolumns` gonderilmez (tum veri gelir - mevcut guvenli davranis)
- `cronSync` icin de ayni mantik gecerli - her veri kaynagi icin widget pool hesaplanacak
- Widget Builder test modunda (kullanicinin secttigi kolonlar) mevcut davranis korunur

