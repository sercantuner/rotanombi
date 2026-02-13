

## Widget Bazli Dinamik Selected Columns - ✅ TAMAMLANDI

### Problem
`data_sources` tablosundaki `selected_columns` alani statik olarak saklaniyordu. Gecersiz kolon isimleri DIA API "Veri Hatasi" donduruyordu.

### Cozum (Uygulandı)
DIA API'ye gonderilen `selectedcolumns` parametresi artik **widget'larin `builder_config.requiredFields`** alanlarindan dinamik olarak hesaplaniyor.

### Degisiklikler

| Dosya | Degisiklik |
|---|---|
| `supabase/functions/_shared/widgetFieldPool.ts` | YENİ: `getAllPooledColumns`, `getPooledColumnsForSource`, `getPooledColumnsForSlug` helper fonksiyonlari |
| `supabase/functions/dia-data-sync/index.ts` | `selected_columns` yerine widget pool kullaniliyor (syncChunk, incrementalSync, cronSync) |
| `supabase/functions/dia-api-test/index.ts` | `data_sources.selected_columns` fallback yerine widget pool hesaplamasi |
| `src/hooks/useDataSourceLoader.tsx` | `loadDataSourceFromApi` ve `loadDataSource` fonksiyonlarina `pooledFields` parametresi eklendi |

### Davranis
- Widget'larin hicbiri `requiredFields` tanimlamadiysa → projeksiyon yapilmaz (tum veri gelir)
- Widget Builder test modunda (kullanicinin sectigi kolonlar) → mevcut davranis korunur
- `data_sources.selected_columns` alani metadata amacli korunur, DIA API'de kullanilmaz
