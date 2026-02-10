

## Kasa Verisi Donem Sorunu Duzeltmesi

### Sorun
Profildeki `donem_kodu = 2` (2025 yili) ama DIA'daki aktif donem 3 (2026 yili). Donem bagimsiz kaynaklar (kasa, cari, stok vb.) senkronizasyonda sadece profildeki `curDon` kullaniliyor. Bu yuzden kasa bakiyesi 2025 yilindan geliyor, 105.754,79 TL yerine eski 125.920,60 TL gozukuyor.

### Cozum

#### 1. Profildeki donem kodunu guncelle
Profilinizde `donem_kodu` 2 olarak kayitli ama aktif donem 3. Bunu 3 olarak guncelleyecegiz.

#### 2. Senkronizasyon motorunda donem bagimsiz kaynaklar icin `is_current` donemi kullan
`dia-data-sync/index.ts` dosyasinda, donem bagimsiz kaynaklar icin `curDon` (profildeki donem) yerine `firma_periods` tablosundaki `is_current = true` olan donemi kullanacagiz. Boylece profil guncellenmese bile donem bagimsiz veriler her zaman en guncel donemden cekilir.

Mevcut mantik:
```
const srcPeriods = src.is_period_independent ? [curDon] : periods;
```

Yeni mantik:
```
// Donem bagimsiz kaynaklar icin is_current donemi bul
const currentPeriod = firmaPeriods.find(p => p.is_current)?.period_no || curDon;
const srcPeriods = src.is_period_independent ? [currentPeriod] : periods;
```

#### 3. Frontend okuma tarafinda da ayni mantik
`useCompanyData` hook'unda donem bagimsiz kaynaklar icin `findBestPeriodForSource` zaten var ama `effectiveDonem` her zaman profildeki degeri kullaniyor. Donem bagimsiz kaynaklarda `is_current` donemi tercih edecek sekilde guncellenecek.

### Degistirilecek Dosyalar
- `supabase/functions/dia-data-sync/index.ts` - Donem bagimsiz kaynaklarda `is_current` donemi kullan
- Profil `donem_kodu` degeri 3 olarak guncellenecek (SQL)

### Etki
- Kasa, cari, stok gibi donem bagimsiz veriler her zaman en guncel donemden cekilecek
- Profildeki donem kodu ile aktif donem uyumsuzlugu sorun yaratmayacak
- Sync sonrasi MERKEZ KASA TL 105.754,79 TL olarak gorunecek
