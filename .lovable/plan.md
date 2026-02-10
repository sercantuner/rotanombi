

# Veritabanı Kilitlenmesini Kırma Planı

## Sorun
Dashboard her açıldığında yavaş RLS sorguları veritabanı bağlantı havuzunu dolduruyor. Migration uygulanamıyor çünkü veritabanı sürekli meşgul.

## Çözüm: 2 Aşamalı Yaklaşım

### Aşama 1: Frontend'den DB Sorgularını Geçici Olarak Durdur

`useDataSourceLoader.tsx` dosyasındaki `loadDataSourceFromDatabase` fonksiyonunun başına bir "kill switch" eklenecek. Bu sayede uygulama açılsa bile DB'ye sorgu gitmeyecek.

```
// Geçici kill switch - migration sonrası kaldırılacak
const DB_QUERIES_ENABLED = false;
```

`loadDataSourceFromDatabase` fonksiyonu `DB_QUERIES_ENABLED === false` ise hemen `null` dönecek. Böylece:
- Bağlantı havuzu boşalır
- Migration uygulanabilir hale gelir

### Aşama 2: Migration Uygula ve Kill Switch'i Kaldır

Bağlantı havuzu boşaldıktan sonra sırasıyla:

1. `get_user_company_scope()` SECURITY DEFINER fonksiyonunu oluştur
2. Eski RLS politikasını kaldır, yeni optimize politikayı ekle
3. `get_projected_cache_data` RPC'yi SECURITY DEFINER olarak güncelle
4. VACUUM ANALYZE çalıştır
5. Kill switch'i kaldır (`DB_QUERIES_ENABLED = true`)

## Teknik Detay

Değişecek dosya: `src/hooks/useDataSourceLoader.tsx`

`loadDataSourceFromDatabase` fonksiyonunun başına (satır ~137):
```typescript
// TEMPORARY: DB queries disabled for migration
const DB_KILL_SWITCH = false;
if (!DB_KILL_SWITCH) {
  return { data: null, resolvedDonem: 1 };
}
```

Migration SQL'leri (önceki plandaki gibi):
- `get_user_company_scope()` fonksiyonu
- Optimize RLS politikası
- SECURITY DEFINER `get_projected_cache_data`

Migration başarılı olduktan sonra kill switch satırları silinecek.

