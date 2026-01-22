# DIA ERP Bağlantı ve Veri Yönetim Sistemi - Teknik Dokümantasyon (Master Reference v8)

Bu dokümantasyon, DIA ERP sistemine bağlantı, oturum yönetimi, veri okuma (listeleme), veri manipülasyonu (CRUD), detaylı veritabanı model yapısı, sistem tanımları ve raporlama servislerini "Uçtan Uca" açıklar.

**Ana Kaynaklar:**
- [DIA Web Servis API Dokümantasyonu](https://wshelp.dia.com.tr/v3/tr/api/fonks/session.html)
- [DIA Veritabanı Modelleri Ana Sayfası](https://wshelp.dia.com.tr/v3/tr/model/)

---

## 1. Mimari Genel Bakış

### 1.1 Bileşenler

| Bileşen | Konum | Görev |
|---------|-------|-------|
| `dia-login` | Edge Function | İlk giriş ve bağlantı kurma |
| `dia-api-test` | Edge Function | Veri sorgulama ve veri manipülasyonu (CRUD) |
| `dia-sync-periods` | Edge Function | Dönem senkronizasyonu |
| `diaAutoLogin.ts` | Shared (_shared/) | Otomatik oturum yenileme |
| `diaRequestQueue.ts` | Frontend (lib/) | İstek kuyruğu yönetimi |
| `DiaDataCacheContext` | Frontend (contexts/) | Veri önbellekleme (Sadece okuma için) |

### 1.2 Veri Akışı

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

**Kaynak:** [Session (Oturum) & API Key](https://wshelp.dia.com.tr/v3/tr/api/fonks/session.html)

### 2.1 İlk Giriş (dia-login)

**Endpoint:** `supabase/functions/dia-login/index.ts`

**İstek formatı:**
```json
{
  "sunucuAdi": "demo",
  "apiKey": "DIA_API_KEY",
  "wsKullanici": "ws_user",
  "wsSifre": "ws_pass",
  "firmaKodu": 1,
  "donemKodu": 0
}
```

**DIA API isteği mantığı:**
`sis/json` servisine login metodu ile istek atılır. Başarılı yanıtta dönen `session_id` veritabanına kaydedilir.

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

### 2.2 Otomatik Oturum Yenileme (diaAutoLogin)

**Konum:** `supabase/functions/_shared/diaAutoLogin.ts`

**Mantık:**
- Oturum süresinin bitmesine 2 dakika (buffer) kala sistem oturumu "geçersiz" sayar.
- Geçerli bir oturum yoksa `performAutoLogin()` fonksiyonu veritabanındaki şifreli bilgilerle yeni bir oturum açar.
- `INVALID_SESSION` hatası alınırsa veritabanındaki session temizlenir ve istek 1 kez tekrar denenir (Retry).

```typescript
const bufferMs = 2 * 60 * 1000; // 2 dakika buffer
const sessionValid = profile.dia_session_id && 
  profile.dia_session_expires && 
  new Date(profile.dia_session_expires).getTime() > Date.now() + bufferMs;

if (sessionValid) {
  return { success: true, session: existingSession };
} else {
  return await performAutoLogin();
}
```

---

## 3. Gelişmiş Veri Çekme (Listeleme API Detayları)

**Kaynak:** [Listeleme Servisleri](https://wshelp.dia.com.tr/v3/tr/api/fonks/listele.html)

DIA Listeleme servisleri (`_listele`), standart bir JSON yapısı kullanır. Bu yapı SQL sorgusuna benzer.

### 3.1 İstek Formatı (Full Payload)

```json
{
  "scf_cari_listele": {
    "session_id": "SESSION_ID",
    "firma_kodu": 1,
    "donem_kodu": 1,
    "filters": [
      { "field": "bakiye", "operator": ">", "value": "1000" },
      { "field": "cari_unvan", "operator": "*", "value": "LTD" }
    ],
    "sorts": [
      { "field": "bakiye", "sorttype": "DESC" }
    ],
    "params": {
      "cross_companys": [1, 2], 
      "cross_periods": [1, 2]
    },
    "limit": 100,
    "offset": 0
  }
}
```

### 3.2 Filtre Operatörleri (filters)

**Kaynak:** [Filtreleme (filters)](https://wshelp.dia.com.tr/v3/tr/api/fonks/listele.html#filters)

Frontend tarafındaki okunabilir operatörler DIA operatörlerine şu şekilde çevrilmelidir:

| Frontend Key | DIA Operatör | SQL Karşılığı | Açıklama |
|--------------|--------------|---------------|----------|
| `equals` | `""` (Boş String) | `=` | Tam eşitlik |
| `not_equals` | `!` | `<>` | Eşit değil |
| `contains` | `*` | `LIKE %...%` | İçerir |
| `starts_with` | `...%` | `LIKE ...%` | İle başlar (Value sonuna % eklenir) |
| `greater_than` | `>` | `>` | Büyüktür |
| `less_than` | `<` | `<` | Küçüktür |
| `greater_equal` | `>=` | `>=` | Büyük Eşittir |
| `less_equal` | `<=` | `<=` | Küçük Eşittir |
| `is_null` | `NULL` | `IS NULL` | Boş değerler |
| `is_not_null` | `!NULL` | `IS NOT NULL` | Dolu değerler |

### 3.3 Sıralama (sorts)

**Kaynak:** [Sıralama (sorts)](https://wshelp.dia.com.tr/v3/tr/api/fonks/listele.html#sorts)

Verinin hangi alana göre sıralanacağını belirler.
- `field`: Modeldeki alan adı (Örn: tarih, fisno).
- `sorttype`: `ASC` (Artan) veya `DESC` (Azalan).

### 3.4 Sayfalama (limit ve offset)

**Kaynak:** [Limit ve Offset](https://wshelp.dia.com.tr/v3/tr/api/fonks/listele.html#limit-offset)

- `limit`: Bir seferde çekilecek kayıt sayısı.
  - `0`: Limitsiz (Tüm veriyi çeker - **Dikkat:** Büyük tablolarda timeout'a neden olabilir).
  - Varsayılan genelde 10 veya 100'dür.
- `offset`: Kaçıncı kayıttan başlanacağı. (SQL OFFSET).
  - Sayfa 1: `limit: 50, offset: 0`
  - Sayfa 2: `limit: 50, offset: 50`

### 3.5 Çapraz Sorgular (params)

**Kaynak:** [Ek Parametreler (params)](https://wshelp.dia.com.tr/v3/tr/api/fonks/listele.html#params)

DIA'nın en güçlü özelliklerinden biri, tek sorguda birden fazla firma veya dönemden veri çekebilmesidir.
- `cross_companys: [1, 2, 5]` → 1, 2 ve 5 nolu firmaların verilerini birleştirip getirir.
- `cross_periods: [1, 2]` → 1 ve 2 nolu dönemlerin verilerini birleştirir.

**Dikkat:** Çapraz sorgularda dönen verinin hangi firmaya ait olduğunu anlamak için `_level1` (Firma Kodu) ve `_level2` (Dönem Kodu) alanlarına bakılır.

---

## 4. Dönem Loop Mekanizması

### 4.1 Kullanım Senaryosu

Geçmiş yıllara sarkan veriler için (örn: son 3 yılın ciro raporu) kullanılır.

### 4.2 Mantık

`PeriodConfig` aktifse, sistem `dia-sync-periods` ile mevcut dönemleri çeker. İstenen yıl sayısı kadar geriye giderek her dönem için ayrı sorgu atar ve sonuçları birleştirir (merge).

```typescript
interface PeriodConfig {
  enabled: boolean;
  historicalCount: number;  // Kaç dönem geriye git
  mergeResults: boolean;    // Sonuçları birleştir
}
```

---

## 5. Önbellekleme Stratejisi (Sadece Okuma)

### DiaDataCacheContext

**Konum:** `src/contexts/DiaDataCacheContext.tsx`

- **TTL (Yaşam Süresi):** 10 dakika.
- **Cache Key:** Veri kaynağı, kullanıcı ID'si ve filtrelerin kombinasyonundan oluşur.
- **Stale:** TTL'in %80'ine gelindiğinde veri "bayat" işaretlenir, arka planda yenilenir.
- **Temizleme:** Kullanıcı değiştiğinde veya açıkça `invalidate` çağrıldığında temizlenir.

```typescript
interface CacheEntry {
  data: any[];
  timestamp: number;
  isStale: boolean;
}

const CACHE_TTL = 10 * 60 * 1000;        // 10 dakika
const STALE_THRESHOLD = 0.8;              // TTL'nin %80'i

const cacheKey = `${dataSource}_${userId}_${JSON.stringify(filters)}`;
```

---

## 6. İstek Kuyruğu (Request Queue)

**Konum:** `src/lib/diaRequestQueue.ts`

- **Concurrency:** Aynı anda en fazla 2 istek işlenir.
- **Rate Limit (429):** DIA sunucusundan 429 hatası gelirse kuyruk 30 saniye duraklatılır.

```typescript
const MAX_CONCURRENT = 2;
const RATE_LIMIT_PAUSE = 30000;

if (response.status === 429) {
  queue.pause();
  setTimeout(() => queue.resume(), RATE_LIMIT_PAUSE);
}
```

---

## 7. Veri Manipülasyonu (CRUD - Ekleme, Güncelleme, Silme)

**Kaynak:** [Ekleme, Güncelleme, Silme](https://wshelp.dia.com.tr/v3/tr/api/fonks/crud.html)

### 7.1 Temel Kurallar

- **Metot Ekleri:** `_ekle`, `_guncelle`, `_sil`.
- **Zarf Yapısı:** Veriler `kart` objesi içinde gönderilir.
- **Primary Key:** Güncellemede `_key` alanı zorunludur.
- **Foreign Key:** İlişkiler `_key_` prefix'i ile kurulur.

### 7.2 Deep Insert (İç İçe Ekleme)

**Kaynak:** [Bağlantılı Alt Modeller](https://wshelp.dia.com.tr/v3/tr/api/fonks/crud.html#deep-insert)

Fatura gibi Master-Detail yapıdaki kayıtları eklerken, kalemleri ayrı bir istek olarak atmanıza gerek yoktur. `m_kalemler` dizisi içinde detayları gönderdiğinizde DIA transaction bütünlüğünü sağlar.

```json
{
  "scf_fatura_ekle": {
    "kart": {
      "tarih": "2024-05-28",
      "fisno": "SF0001",
      "_key_scf_carikart": { "carikodu": "120.01" },
      "m_kalemler": [
        { "_key_scf_stokkart": {"stokkodu": "URUN A"}, "miktar": 1, "fiyat": 100 },
        { "_key_scf_stokkart": {"stokkodu": "URUN B"}, "miktar": 2, "fiyat": 50 }
      ]
    }
  }
}
```

---

## 8. DIA Veri Tabanı Modelleri ve İlişkisel Yapı

**Model Ana Sayfası:** [DİA Model Dokümantasyonu](https://wshelp.dia.com.tr/v3/tr/model/)

DIA veritabanı, klasik SQL tabloları yerine JSON tabanlı nesne-ilişkisel (Object-Relational) bir yapı gibi davranır.

### 8.1 Temel Anahtar İlişkisi (_key ve Foreign Keys)

- **`_key` (Primary Key):** Integer64. Her kaydın benzersiz kimliğidir.
- **`_key_[model_adi]` (Foreign Key):** Başka bir modele referans.
  - **Okuma:** `{ "_key": "...", "unvan": "..." }` şeklinde obje döner.
  - **Yazma:** `"_key_sis_sube": "HASH_ID"` (ID ile) veya `"_key_sis_sube": { "subekodu": "01" }` (Match ile) gönderilir.

### 8.2 Standart Model Alanları

| Alan Adı | Veri Tipi | Açıklama |
|----------|-----------|----------|
| `_level1` | Integer32 | Firma Kodu |
| `_level2` | Integer32 | Dönem Kodu |
| `_key` | Integer64 | Tekil Anahtar |
| `_cdate` | DateTime | Oluşturma Tarihi |
| `_date` | DateTime | Son İşlem Tarihi |
| `_owner` | Integer64 | Oluşturan Kullanıcı |
| `_user` | Integer64 | Son İşlem Yapan |

### 8.3 Önemli Modeller ve Detayları

#### 8.3.1 Cari Hesap Fişi (scf_carihesap_fisi)

**Model Detayı:** [ScfCarihesapFisiModel](https://wshelp.dia.com.tr/v3/tr/model/scf/carihesap_fisi.html)

- Nakit, Dekont, Virman işlemleri.
- `fisno`, `tarih`, `turu`, `borc`, `alacak`, `_key_scf_carikart`.
- `_key_scf_fatura`: Eğer fatura kaynaklıysa faturanın ID'si buradadır.

#### 8.3.2 Fatura Modeli (scf_fatura)

**Model Detayı:** [ScfFaturaModel](https://wshelp.dia.com.tr/v3/tr/model/scf/fatura.html)

- Satış/Alım faturaları.
- **Header:** `turu` (1:Alım, 2:Perakende, 3:Toptan), `toplam_tutar`, `kdv_tutari`.
- **Lines (m_kalemler):** `scf_fatura_kalemi` listesi.

#### 8.3.3 Stok Kartı Modeli (scf_stokkart)

**Model Detayı:** [ScfStokkartModel](https://wshelp.dia.com.tr/v3/tr/model/scf/stokkart.html)

- **Sanal Alanlar (Sadece Okuma):** `mevcut`, `bakiye`, `depo_mevcutlari`. Bunlar insert/update'te gönderilmez.
- **Zorunlu:** `stokkod`, `aciklama`, `birim`.

---

## 9. Kritik Sistem (SIS) Modelleri

Tüm modüllerin referans aldığı temel tanımlar `sis` modülündedir.

### 9.1 Şube (sis_sube)

**Model Detayı:** [SisSubeModel](https://wshelp.dia.com.tr/v3/tr/model/sis/sube.html)

- Her işlem bir şubeye bağlıdır.
- **Kullanım:** `_key_sis_sube`
- **Alanlar:** `subekodu`, `subeadi`, `adres1`, `adres2`.

### 9.2 Depo (sis_depo)

**Model Detayı:** [SisDepoModel](https://wshelp.dia.com.tr/v3/tr/model/sis/depo.html)

- Stok hareketlerinin gerçekleştiği yerler.
- **Kullanım:** `_key_sis_depo`
- **Alanlar:** `depokodu`, `depoadi`, `_key_sis_sube` (Hangi şubeye bağlı).

### 9.3 Döviz (sis_doviz)

**Model Detayı:** [SisDovizModel](https://wshelp.dia.com.tr/v3/tr/model/sis/doviz.html)

- Para birimleri.
- **Kullanım:** `_key_sis_doviz`
- **Değerler:** Genellikle ID'leri sabittir ama `sis_doviz_listele` ile çekilmesi önerilir. "TL", "USD", "EUR".

### 9.4 Özel Kodlar (sis_ozelkod)

**Model Detayı:** [SisOzelkodModel](https://wshelp.dia.com.tr/v3/tr/model/sis/ozelkod.html)

- Kartlarda kullanılan gruplama kodları (Örn: Cari Grubu, Stok Markası).
- **Kullanım:** `_key_sis_ozelkod1`, `_key_sis_ozelkod2`...
- **Alanlar:** `kod`, `aciklama`, `tur` (Hangi modüle ait olduğu).

---

## 10. Dosya ve Resim İşlemleri

DIA'da resimler ve dosyalar genellikle Base64 formatında veya binary stream olarak yönetilir.

### 10.1 Stok Resmi Ekleme

**İlgili Örnek:** [Stok Karta Resim Eklenmesi](https://wshelp.dia.com.tr/v3/tr/api/fonks/crud.html#file-upload)

`scf_stokkart_resim` modeli kullanılır veya `scf_stokkart_resim_ekle` servisi çağrılır.

```json
{
  "scf_stokkart_resim_ekle": {
    "kart": {
      "_key_scf_stokkart": { "stokkodu": "URUN01" },
      "resim_data": "BASE64_STRING_HERE...",
      "resim_adi": "urun.jpg",
      "varsayilan": "t"
    }
  }
}
```

---

## 11. Hata Yönetimi ve Troubleshooting

**Kaynak:** [Hata Takibi](https://wshelp.dia.com.tr/v3/tr/api/fonks/errors.html)

| Hata Kodu | Açıklama | Olası Sebep | Çözüm |
|-----------|----------|-------------|-------|
| `INVALID_SESSION` | Oturum geçersiz | Oturum süresi dolmuş. | Sistem otomatik retry yapar. |
| `404 Not Found` | Metot bulunamadı | Yanlış metot adı. | dataSource adını kontrol et (modul.metot). |
| `429 Too Many Requests` | Rate limit | Çok fazla istek. | Request Queue 30sn bekler. |
| `500` | Veri hatası | Eksik veri/Yanlış tip. | Zorunlu alanları ve veri tiplerini kontrol et. |

### Debug Loglama

```typescript
console.error(`[DIA API] ${method} failed:`, {
  error: errorMessage,
  userId,
  dataSource,
  timestamp: new Date().toISOString()
});
```

---

## 12. Veritabanı Şeması (profiles Tablosu)

Supabase `profiles` tablosu:

```sql
dia_sunucu_adi    TEXT,
dia_api_key       TEXT,
dia_ws_kullanici  TEXT,
dia_ws_sifre      TEXT,
dia_session_id    TEXT,
dia_session_expires TIMESTAMPTZ,
firma_kodu        TEXT,
donem_kodu        TEXT
```

---

## 13. Sabit Tanımlar ve Enum Değerleri (Lookups)

Aşağıdaki kodlar integer olarak saklanır ancak arayüzde metin karşılıkları vardır.

### 13.1 Fatura Türleri (scf_fatura.turu)

| Kod | Açıklama |
|-----|----------|
| 1 | Alım Faturası |
| 2 | Perakende Satış Faturası |
| 3 | Toptan Satış Faturası |
| 4 | Alım İade Faturası |
| 5 | Perakende Satış İade Faturası |
| 6 | Toptan Satış İade Faturası |
| 11 | Müstahsil Makbuzu |

### 13.2 Cari Hesap Fiş Türleri (scf_carihesap_fisi.turu)

- `NT` (Nakit Tahsilat)
- `NÖ` (Nakit Ödeme)
- `BD` (Borç Dekontu)
- `AD` (Alacak Dekontu)

### 13.3 E-Fatura Tipleri (efa_fatura_tipi)

**Kaynak:** [E-Fatura Modülü](https://wshelp.dia.com.tr/v3/tr/model/efa/)

String gönderilmelidir: `SATIS`, `IADE`, `TEVKIFAT`, `ISTISNA`, `OZELMATRAH`.

### 13.4 Çek/Senet Pozisyonları (bcs_cek.pozisyon)

**Kaynak:** [Banka-Çek-Senet Modülü](https://wshelp.dia.com.tr/v3/tr/model/bcs/)

| Kod | Açıklama |
|-----|----------|
| 1 | Portföyde |
| 2 | Ciro Edildi |
| 3 | Tahsil Edildi |
| 4 | Teminata Verildi |
| 7 | Ödendi |
| 8 | Karşılıksız |

---

## 14. Raporlama Servisi (rpr Modülü)

**Kaynak:** [Web service ile raporlar nasıl alınır?](https://wshelp.dia.com.tr/v3/tr/api/fonks/report.html)

### 14.1 Rapor Çalıştırma

Listeleme servisleri ham veri dönerken, `rpr` servisleri işlenmiş (PDF/Excel) çıktı üretir.

```json
{
  "rpr_rapor_calistir": {
    "rapor_kodu": "RPR_001", 
    "tur": "pdf",
    "params": { "bastar": "2024-01-01", "bittar": "2024-12-31" }
  }
}
```

### 14.2 Rapor Sonucu

Base64 formatında dosya verisi döner. Frontend'de `atob()` ile çözülüp Blob'a çevrilmelidir.

```typescript
const byteCharacters = atob(base64Data);
// ... Blob dönüşümü ve download işlemi
```

---

## 15. Impersonation (Kullanıcı Görüntüleme)

### 15.1 Kullanım

Super Admin, başka bir kullanıcının verilerini görüntüleyebilir.

### 15.2 Güvenlik Kontrolü

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

### 15.3 Context Yapısı

```typescript
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

## 16. Uygulama İçi Kullanım Örnekleri

### 16.1 Cari Listesi Çekme

```typescript
const response = await supabase.functions.invoke('dia-api-test', {
  body: {
    dataSource: 'scf.carikart_listele',
    filters: [
      { field: 'bakiye', operator: 'greater_than', value: 0 }
    ],
    sortBy: [{ field: 'bakiye', direction: 'DESC' }],
    limit: 100
  }
});
```

### 16.2 Dönem Bazlı Satış Raporu

```typescript
const response = await supabase.functions.invoke('dia-api-test', {
  body: {
    dataSource: 'scf.fatura_listele',
    filters: [
      { field: 'turu', operator: 'equals', value: 3 }
    ],
    periodConfig: {
      enabled: true,
      historicalCount: 3,
      mergeResults: true
    }
  }
});
```

### 16.3 Impersonation ile Veri Çekme

```typescript
const response = await supabase.functions.invoke('dia-api-test', {
  body: {
    dataSource: 'scf.carikart_listele',
    targetUserId: 'other-user-uuid',
    limit: 50
  }
});
```

---

## 17. Kontör Optimizasyonu

DIA web servisi kontör harcayan bir sistemdir. Optimizasyon için:

1. **Agresif önbellekleme** - 10 dakika TTL
2. **Batch istekler** - Birden fazla widget aynı veriyi paylaşabilir
3. **Lazy loading** - Görünür widget'lar öncelikli
4. **Stale-while-revalidate** - Eski veriyi göster, arka planda güncelle
5. **Dönem bazlı sorgulama** - Sadece gerekli dönemleri çek
6. **Merkezi Veri Kaynakları** - Aynı sorguyu kullanan widget'lar tek bir cache'den beslenir

---

## 18. Dosya Yapısı Özeti

### Edge Functions

```
supabase/functions/
├── _shared/
│   └── diaAutoLogin.ts          # Otomatik oturum yenileme
├── dia-login/
│   └── index.ts                 # İlk giriş
├── dia-api-test/
│   └── index.ts                 # Ana veri servisi (CRUD)
├── dia-sync-periods/
│   └── index.ts                 # Dönem senkronizasyonu
├── dia-genel-rapor/
│   └── index.ts                 # Genel cari raporu
├── dia-finans-rapor/
│   └── index.ts                 # Finans raporu
└── dia-satis-rapor/
    └── index.ts                 # Satış raporu
```

### Frontend

```
src/
├── contexts/
│   ├── DiaDataCacheContext.tsx  # Veri önbellekleme
│   └── ImpersonationContext.tsx # Kullanıcı görüntüleme
├── hooks/
│   ├── useDiaProfile.tsx        # DIA profil bilgileri
│   ├── useDynamicWidgetData.tsx # Widget veri çekimi
│   ├── useDataSourceLoader.tsx  # Merkezi veri yükleme
│   └── useFirmaPeriods.tsx      # Dönem yönetimi
├── lib/
│   ├── diaClient.ts             # DIA istemci fonksiyonları
│   ├── diaRequestQueue.ts       # İstek kuyruğu
│   └── filterUtils.ts           # Filtre dönüşümleri
└── docs/
    └── DIA_CONNECTION_GUIDE.md  # Bu dokümantasyon
```

---

## Kritik Uyarılar

⚠️ **Ekleme işlemlerinde `_key` göndermemeye dikkat edin.**

⚠️ **Güncelleme işlemlerinde ise `_key` göndermeyi unutmayın.**

⚠️ **`firma_kodu` her zaman integer olarak gönderilmelidir.**

⚠️ **Metot adlarında modül prefix'i (`scf_`) kullanılmamalıdır.**

⚠️ **Otomatik/sürekli DIA API sorguları yapılmamalıdır - yalnızca kullanıcı eylemi veya yapılandırılmış tetikleyici ile çağrılmalıdır.**

---

*Son Güncelleme: 2026-01-22 | DIA Web Servisleri v3*
