# DIA ERP Bağlantı Sistemi - Teknik Dokümantasyon

Bu dokümantasyon, DIA ERP sistemine bağlantı, oturum yönetimi, veri çekme ve önbellekleme stratejilerini açıklar.

---

## 1. Mimari Genel Bakış

### Bileşenler

| Bileşen | Konum | Görev |
|---------|-------|-------|
| `dia-login` | Edge Function | İlk giriş ve bağlantı kurma |
| `dia-api-test` | Edge Function | Veri sorgulama (ana endpoint) |
| `dia-sync-periods` | Edge Function | Dönem senkronizasyonu |
| `diaAutoLogin.ts` | Shared (_shared/) | Otomatik oturum yenileme |
| `diaRequestQueue.ts` | Frontend (lib/) | İstek kuyruğu yönetimi |
| `DiaDataCacheContext` | Frontend (contexts/) | Veri önbellekleme |

### Veri Akışı

```
[Widget] → [useDataSourceLoader] → [diaRequestQueue] → [dia-api-test Edge Function]
                                                              ↓
                                                    [diaAutoLogin.ts]
                                                              ↓
                                                    [DIA Web Service]
                                                              ↓
                                                    [Response Processing]
                                                              ↓
                                                    [DiaDataCacheContext]
```

---

## 2. Oturum Yönetimi

### İlk Giriş (dia-login)

**Endpoint:** `supabase/functions/dia-login/index.ts`

**İstek formatı:**
```typescript
{
  sunucuAdi: string,      // örn: "demo"
  apiKey: string,         // DIA API anahtarı
  wsKullanici: string,    // Web servis kullanıcısı
  wsSifre: string,        // Web servis şifresi
  firmaKodu?: number,     // Varsayılan: 1
  donemKodu?: number      // Varsayılan: 0 (güncel)
}
```

**DIA API isteği:**
```typescript
const diaUrl = `https://${sunucuAdi}.ws.dia.com.tr/api/v3/sis/json`;

const loginPayload = {
  login: {
    username: wsKullanici,
    password: wsSifre,
    disconnect_same_user: true,
    Lang: "tr",
    params: {
      apikey: apiKey,
    },
  },
};
```

**Başarılı yanıt:**
```json
{ "code": "200", "msg": "session_id_here", "warnings": [] }
```

### Otomatik Oturum Yenileme (diaAutoLogin)

**Konum:** `supabase/functions/_shared/diaAutoLogin.ts`

**Mantık:**
```typescript
const bufferMs = 2 * 60 * 1000; // 2 dakika buffer
const sessionValid = profile.dia_session_id && 
  profile.dia_session_expires && 
  new Date(profile.dia_session_expires).getTime() > Date.now() + bufferMs;

if (sessionValid) {
  // Mevcut oturumu kullan
  return { success: true, session: existingSession };
} else {
  // Otomatik yeniden giriş yap
  return await performAutoLogin();
}
```

### Oturum Kurtarma

**INVALID_SESSION hatası alındığında:**
1. Veritabanındaki oturum bilgilerini temizle
2. Otomatik yeniden giriş yap
3. İsteği tekrar dene (1 kez)

```typescript
if (diaData.hata?.kod === "INVALID_SESSION") {
  await supabase.from("profiles").update({
    dia_session_id: null,
    dia_session_expires: null,
  }).eq("user_id", userId);
  
  // Retry logic...
}
```

---

## 3. Veri Çekme (dia-api-test)

### Endpoint Yapısı

```
https://{sunucu}.ws.dia.com.tr/api/v3/{modul}/json
```

**Modüller:**
- `sis` - Sistem (login, dönem listesi)
- `scf` - Stok/Cari/Fatura
- `bcs` - Banka/Cari/Stok
- `fat` - Fatura

### İstek Formatı

```typescript
interface DiaApiRequest {
  dataSource: string;      // örn: "scf.cari_listele"
  module?: string;         // örn: "scf" (otomatik parse edilir)
  method?: string;         // örn: "cari_listele"
  filters?: DiaFilter[];
  sortBy?: SortConfig[];
  columns?: string[];
  limit?: number;
  offset?: number;
  periodConfig?: PeriodConfig;
  targetUserId?: string;   // Impersonation için
}
```

### Filtre Mapping

**Frontend → DIA operatör dönüşümü:**

```typescript
const operatorMap: Record<string, string> = {
  "equals": "",
  "not_equals": "!",
  "contains": "*",
  "not_contains": "!",
  "starts_with": "",
  "ends_with": "",
  "greater_than": ">",
  "less_than": "<",
  "greater_equal": ">=",
  "less_equal": "<=",
  "is_null": "",
  "is_not_null": "!",
};
```

**Filtre payload oluşturma:**
```typescript
// Frontend filter
{ field: "bakiye", operator: "greater_than", value: 1000 }

// DIA payload
{ "bakiye>": 1000 }
```

### Kritik Kurallar

1. **firma_kodu her zaman integer olmalı:**
```typescript
firma_kodu: parseInt(session.firmaKodu) || 1
```

2. **Metot adında modül prefix'i kullanılmamalı:**
```typescript
// YANLIŞ
{ "scf_cari_listele": { ... } }

// DOĞRU
{ "cari_listele": { ... } }
```

3. **Modül URL'de belirtilmeli:**
```typescript
const url = `https://${sunucu}.ws.dia.com.tr/api/v3/scf/json`;
```

---

## 4. Dönem Loop Mekanizması

### Kullanım Senaryosu

Geçmiş yıllara sarkan veriler için (örn: son 3 yılın nakit akışı)

### PeriodConfig Yapısı

```typescript
interface PeriodConfig {
  enabled: boolean;
  historicalCount: number;  // Kaç dönem geriye git
  mergeResults: boolean;    // Sonuçları birleştir
}
```

### Uygulama

```typescript
if (periodConfig?.enabled && periodConfig.historicalCount > 0) {
  // Mevcut dönemden geriye doğru dönemleri al
  const periods = await fetchAvailablePeriods(supabase, userId);
  
  for (const period of periods.slice(0, periodConfig.historicalCount)) {
    const result = await fetchDataForPeriod(period);
    // Her kayda dönem bilgisi ekle
    result.forEach(row => row._fetched_period = period.donem_adi);
    allResults.push(...result);
  }
}
```

---

## 5. Önbellekleme Stratejisi

### DiaDataCacheContext

**Konum:** `src/contexts/DiaDataCacheContext.tsx`

**Cache yapısı:**
```typescript
interface CacheEntry {
  data: any[];
  timestamp: number;
  isStale: boolean;
}

interface DiaDataCache {
  [cacheKey: string]: CacheEntry;
}
```

### TTL ve Stale Mantığı

```typescript
const CACHE_TTL = 10 * 60 * 1000;        // 10 dakika
const STALE_THRESHOLD = 0.8;              // TTL'nin %80'i

const isExpired = Date.now() - entry.timestamp > CACHE_TTL;
const isStale = Date.now() - entry.timestamp > CACHE_TTL * STALE_THRESHOLD;
```

### Cache Key Oluşturma

```typescript
const cacheKey = `${dataSource}_${userId}_${JSON.stringify(filters)}_${JSON.stringify(sortBy)}`;
```

### Kullanıcı Değişiminde Cache Temizleme

```typescript
useEffect(() => {
  if (userId !== previousUserId) {
    // Farklı firmanın verilerini göstermeyi engelle
    clearCache();
    clearSharedData();
    clearFetchRegistry();
  }
}, [userId]);
```

---

## 6. İstek Kuyruğu (Request Queue)

### Konum

`src/lib/diaRequestQueue.ts`

### Özellikler

```typescript
const MAX_CONCURRENT = 2;      // Maksimum eşzamanlı istek
const RATE_LIMIT_PAUSE = 30000; // 429 hatasında bekleme süresi
```

### Rate Limiting Yönetimi

```typescript
if (response.status === 429) {
  queue.pause();
  setTimeout(() => queue.resume(), RATE_LIMIT_PAUSE);
}
```

---

## 7. Impersonation (Kullanıcı Görüntüleme)

### Kullanım

Super Admin, başka bir kullanıcının verilerini görüntüleyebilir.

### Güvenlik Kontrolü

```typescript
// Edge function içinde
if (targetUserId && targetUserId !== user.id) {
  const { data: roleCheck } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'super_admin')
    .single();

  if (!roleCheck) {
    throw new Error("Bu işlem için Super Admin yetkisi gerekli");
  }
}

const effectiveUserId = targetUserId || user.id;
```

### Context Yapısı

```typescript
// ImpersonationContext
interface ImpersonatedProfile {
  user_id: string;
  dia_sunucu_adi: string | null;
  dia_ws_kullanici: string | null;
  dia_ws_sifre: string | null;
  dia_api_key: string | null;
  dia_session_id: string | null;
  dia_session_expires: string | null;
  firma_kodu: string | null;
  donem_kodu: string | null;
}
```

---

## 8. Hata Yönetimi

### Hata Tipleri

| Kod | Açıklama | Aksiyon |
|-----|----------|---------|
| `INVALID_SESSION` | Oturum süresi dolmuş | Otomatik yeniden giriş |
| `INVALID_PARAMETER` | Parametre hatası | Kullanıcıya bildir |
| `404` | Metot bulunamadı | Metot adını kontrol et |
| `429` | Rate limit | Kuyruk duraklat |
| `502` | DIA sunucu hatası | Retry veya kullanıcıya bildir |

### Hata Loglama

```typescript
console.error(`[DIA API] ${method} failed:`, {
  error: errorMessage,
  userId,
  dataSource,
  timestamp: new Date().toISOString()
});
```

---

## 9. Veritabanı Şeması

### profiles Tablosu (DIA alanları)

```sql
dia_sunucu_adi    TEXT,     -- örn: "demo"
dia_api_key       TEXT,     -- API anahtarı
dia_ws_kullanici  TEXT,     -- Web servis kullanıcısı
dia_ws_sifre      TEXT,     -- Web servis şifresi (şifreli saklanmalı)
dia_session_id    TEXT,     -- Aktif oturum ID
dia_session_expires TIMESTAMPTZ, -- Oturum bitiş zamanı
firma_kodu        TEXT,     -- Seçili firma
firma_adi         TEXT,     -- Firma adı
donem_kodu        TEXT,     -- Seçili dönem
donem_yili        TEXT      -- Dönem yılı
```

---

## 10. Kontör Optimizasyonu

DIA web servisi kontör harcayan bir sistemdir. Optimizasyon için:

1. **Agresif önbellekleme** - 10 dakika TTL
2. **Batch istekler** - Birden fazla widget aynı veriyi paylaşabilir
3. **Lazy loading** - Görünür widget'lar öncelikli
4. **Stale-while-revalidate** - Eski veriyi göster, arka planda güncelle
5. **Dönem bazlı sorgulama** - Sadece gerekli dönemleri çek

---

## 11. Edge Function Dosya Yapısı

```
supabase/functions/
├── _shared/
│   └── diaAutoLogin.ts      # Paylaşılan oturum yönetimi
├── dia-login/
│   └── index.ts             # İlk giriş endpoint'i
├── dia-api-test/
│   └── index.ts             # Ana veri çekme endpoint'i
├── dia-sync-periods/
│   └── index.ts             # Dönem senkronizasyonu
├── dia-genel-rapor/
│   └── index.ts             # Genel raporlar
├── dia-satis-rapor/
│   └── index.ts             # Satış raporları
└── dia-finans-rapor/
    └── index.ts             # Finans raporları
```

---

## 12. Frontend Dosya Yapısı

```
src/
├── contexts/
│   ├── DiaDataCacheContext.tsx    # Veri önbellekleme
│   └── ImpersonationContext.tsx   # Kullanıcı görüntüleme
├── hooks/
│   ├── useDataSourceLoader.tsx    # Veri kaynağı yükleme
│   ├── useDynamicWidgetData.tsx   # Widget veri hook'u
│   └── useDiaProfile.tsx          # Profil yönetimi
└── lib/
    ├── diaRequestQueue.ts         # İstek kuyruğu
    ├── diaClient.ts               # DIA istemci yardımcıları
    └── filterUtils.ts             # Filtre dönüşümleri
```

---

## 13. Örnek Kullanım Senaryoları

### Senaryo 1: Cari Listesi Çekme

```typescript
// Widget Builder config
{
  dataSource: "scf.cari_listele",
  filters: [
    { field: "bakiye", operator: "not_equals", value: 0 }
  ],
  columns: ["cari_kod", "cari_unvan", "bakiye"],
  limit: 100
}
```

### Senaryo 2: Dönemsel Satış Raporu

```typescript
// Son 3 yılın satış verileri
{
  dataSource: "scf.fatura_listele",
  filters: [
    { field: "fatura_tipi", operator: "equals", value: "S" }
  ],
  periodConfig: {
    enabled: true,
    historicalCount: 3,
    mergeResults: true
  }
}
```

### Senaryo 3: Impersonation ile Veri Çekme

```typescript
// Super Admin olarak başka kullanıcının verilerini gör
const { data } = await supabase.functions.invoke('dia-api-test', {
  body: {
    dataSource: "scf.cari_listele",
    targetUserId: "target-user-uuid"
  }
});
```

---

## 14. Troubleshooting

### Sık Karşılaşılan Hatalar

| Hata | Olası Sebep | Çözüm |
|------|-------------|-------|
| 404 Not Found | Yanlış metot adı | Modül prefix'i kaldır |
| INVALID_SESSION | Oturum süresi dolmuş | Otomatik retry devrede |
| firma_kodu hatası | String gönderilmiş | parseInt() kullan |
| Boş veri | Yanlış dönem | periodConfig kontrol et |
| Rate limit | Çok fazla istek | Queue otomatik bekler |

### Debug Logları

```typescript
// Console'da DIA isteklerini izle
console.log('[DIA Request]', { dataSource, filters, timestamp });
console.log('[DIA Response]', { recordCount, duration });
console.log('[DIA Cache]', { hit: true, key: cacheKey });
```
