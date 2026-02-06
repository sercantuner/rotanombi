
# Dashboard "Failed to fetch" Hatasının Düzeltme Planı

## Tespit Edilen Sorun

Dashboard yüklendiğinde tüm veri kaynakları için "Failed to fetch" hatası alınıyor. Console loglarında şu hata görülüyor:

```
[DataSourceLoader] DB-FIRST: No profile config, skipping DB check for Çek Senet Listesi
[DataSourceLoader] DB-FIRST: No profile config, skipping DB check for Stok Listesi
```

### Kök Neden

`useDataSourceLoader` hook'u veri çekmeye başlarken `useDiaProfile` hook'u henüz veritabanından DIA profil bilgilerini (sunucuAdi, firmaKodu) yüklememiş oluyor.

**Akış:**
1. Dashboard yükleniyor
2. `useDiaProfile` async olarak profiles tablosundan veri çekmeye başlıyor
3. Aynı anda `useDataSourceLoader` veri yüklemeye başlıyor
4. `diaProfile.sunucuAdi = null` olduğu için DB kontrolü atlanıyor
5. Direkt API'ye istek atılıyor ama bu da başarısız oluyor

### Neden API de Başarısız?

DB'de aslında veri var (Cari_vade_bakiye_listele: 72 kayıt, cari_kart_listesi: 1220 kayıt vs.) ama profil yüklenmeden önce atılan istekler başarısız oluyor.

---

## Çözüm Planı

### Adım 1: DIA Profile Yüklenmesini Bekle
**Dosya:** `src/hooks/useDataSourceLoader.tsx`

`useDiaProfile()` hook'undan gelen `isLoading` durumunu kontrol ederek, profil tamamen yüklenene kadar veri çekme işlemini başlatmayacağız.

```typescript
// useDiaProfile hook'undan isLoading durumunu al
const diaProfile = useDiaProfile();
const isDiaProfileLoading = diaProfile.isLoading;

// loadAllDataSources içinde profil yüklenme kontrolü ekle
const loadAllDataSources = useCallback(async (forceRefresh: boolean = false) => {
  // DIA profili henüz yüklenmediyse bekle
  if (isDiaProfileLoading) {
    console.log('[DataSourceLoader] Waiting for DIA profile to load...');
    return;
  }
  
  // ... mevcut kod
}, [isDiaProfileLoading, /* diğer deps */]);
```

### Adım 2: Effect Dependency'e isLoading Ekle
**Dosya:** `src/hooks/useDataSourceLoader.tsx`

Sayfa ilk yüklendiğinde veri kaynakları yüklemesini tetikleyen effect'e profil loading durumunu ekleyeceğiz:

```typescript
useEffect(() => {
  // DIA profili yüklenene kadar başlatma
  if (isDiaProfileLoading) return;
  
  // ... mevcut başlatma mantığı
}, [pageId, dataSources.length, hasInitialized, isDataSourcesLoading, isDiaProfileLoading]);
```

### Adım 3: Loglama İyileştirmesi
Profil bekleme durumunu açıkça logla:

```typescript
if (!sunucuAdi || !firmaKodu) {
  console.log(`[DataSourceLoader] DB-FIRST: Profile not ready (sunucu: ${sunucuAdi || 'null'}, firma: ${firmaKodu || 'null'}), skipping DB check`);
  return null;
}
```

---

## Teknik Değişiklikler

| Dosya | Değişiklik |
|-------|------------|
| `src/hooks/useDataSourceLoader.tsx` | `isLoading` durumu kontrolü ve dependency güncellemesi |

---

## Değişiklik Özeti

1. **Line ~63**: `diaProfile.isLoading` değişkeni ayıkla
2. **Line ~432**: `loadAllDataSources` içinde profil yükleme kontrolü ekle
3. **Line ~617-666**: Effect dependency'e `isDiaProfileLoading` ekle

---

## Beklenen Sonuç

- Dashboard yüklendiğinde önce DIA profili yüklenecek
- Profil yüklendikten sonra DB-FIRST stratejisi düzgün çalışacak
- Cache'deki veriler kullanılacak, gereksiz API çağrıları önlenecek
- "Failed to fetch" hataları ortadan kalkacak
