
# DIA Veri Senkronizasyonu Optimizasyon Planı

## Tespit Edilen Sorunlar

### 1. INVALID_SESSION Hatası
DIA session'ı 30 dakikada expire oluyor. Uzun süren sync işlemlerinde (çok sayfalı veri çekme) session timeout'a uğruyor.

### 2. Database Statement Timeout
Lovable Cloud veritabanı varsayılan olarak ~10 saniye statement timeout'a sahip. Büyük batch upsert işlemleri bu süreyi aşıyor.

### 3. Edge Function Timeout
Edge Function maksimum 60 saniye çalışabiliyor. Tüm dönemleri tek seferde çekmek bu süreyi aşıyor.

### 4. Takılı Kalan Sync Kayıtları
Timeout olan işlemler `running` durumunda kalıyor ve temizlenmiyor.

---

## Çözüm Stratejisi

### Faz 1: Edge Function Yeniden Tasarımı

```text
+------------------+     +-------------------+     +------------------+
|   Frontend       | --> |  dia-data-sync    | --> |  DIA API         |
|   (BulkSync)     |     |  (per source/     |     |  (sayfa sayfa)   |
|                  |     |   period)         |     |                  |
+------------------+     +-------------------+     +------------------+
        |                        |
        |  Döngü                 |  Her sayfa sonrası
        |  (source by source)   |  session refresh check
        v                        v
+------------------+     +-------------------+
|  Progress UI     |     |  company_data_    |
|  (realtime)      |     |  cache (upsert)   |
+------------------+     +-------------------+
```

**Değişiklikler:**
- Her veri kaynağı ve dönem için **ayrı Edge Function çağrısı** (timeout önleme)
- Session'ı **her DIA çağrısı öncesinde** kontrol et ve gerekirse yenile
- Daha küçük batch boyutları (50 kayıt)
- Her sayfa yazıldıktan sonra hemen temizleme

### Faz 2: Session Yönetimi İyileştirmesi

`diaAutoLogin.ts` güncellemesi:
- INVALID_SESSION hatası alınırsa **otomatik retry** mekanizması
- Session yenileme için middleware pattern
- Her API çağrısı öncesi session geçerlilik kontrolü

```typescript
// Yeni fonksiyon: refreshSessionIfNeeded
async function ensureValidSession(supabase, userId, currentSession) {
  // Session 2 dakikadan az kaldıysa yenile
  if (isSessionExpiringSoon(currentSession)) {
    return await performAutoLogin(supabase, userId);
  }
  return currentSession;
}
```

### Faz 3: Frontend Orchestration (Tek Kaynak/Dönem Bazlı)

`BulkDataSyncManager.tsx` güncellemesi:
- **Sunucu bazlı değil, sunucu+kaynak+dönem bazlı** sync
- Her kaynak/dönem için ayrı API çağrısı
- Detaylı ilerleme gösterimi
- Hata detaylarını açıkça gösterme

```text
Sync Progress:
├── corlugrup (Firma 1)
│   ├── cari_kart_listesi
│   │   ├── Dönem 3: ✅ 2085 kayıt
│   │   ├── Dönem 2: ✅ 1800 kayıt
│   │   └── Dönem 1: ✅ 1500 kayıt
│   ├── scf_fatura_listele
│   │   ├── Dönem 3: ⏳ Çalışıyor...
│   │   └── ...
│   └── ...
└── eguncel (Firma 9)
    └── ...
```

---

## Teknik Değişiklikler

### 1. `dia-data-sync/index.ts` Güncellemeleri

**A. Session Refresh Mekanizması:**
```typescript
// Her sayfa çekimi öncesinde session kontrolü
async function fetchPageWithSessionRefresh(
  supabase, userId, diaSession, payload
) {
  // Session süresi dolmak üzereyse yenile
  const session = await ensureValidSession(supabase, userId, diaSession);
  
  // Payload'daki session_id'yi güncelle
  payload[methodKey].session_id = session.sessionId;
  
  // API çağrısı yap
  const response = await fetch(diaUrl, {...});
  const result = await response.json();
  
  // INVALID_SESSION hatası varsa retry
  if (result.msg === 'INVALID_SESSION' || result.code === '401') {
    const newSession = await performAutoLogin(supabase, userId);
    payload[methodKey].session_id = newSession.sessionId;
    return await fetch(diaUrl, {...});
  }
  
  return result;
}
```

**B. Mikro Batch Yazma:**
```typescript
const MICRO_BATCH_SIZE = 25; // 100'den 25'e düşür

async function writeMicroBatches(supabase, records) {
  for (let i = 0; i < records.length; i += MICRO_BATCH_SIZE) {
    const batch = records.slice(i, i + MICRO_BATCH_SIZE);
    
    // Tek tek upsert (timeout önleme)
    for (const record of batch) {
      await supabase
        .from('company_data_cache')
        .upsert(record, { onConflict: '...' });
    }
  }
}
```

**C. Yeni Action: `syncSingleSource`:**
```typescript
// Tek kaynak, tek dönem sync
if (action === 'syncSingleSource') {
  const { dataSourceSlug, periodNo, targetUserId } = body;
  
  // Sadece belirtilen kaynak ve dönem için sync
  const result = await fetchAndWritePageByPage(
    supabase, session, source.module, source.method,
    periodNo, sunucuAdi, firmaKodu, dataSourceSlug
  );
  
  return Response.json({ success: true, result });
}
```

### 2. `_shared/diaAutoLogin.ts` Güncellemeleri

**Retry Wrapper:**
```typescript
export async function withSessionRetry<T>(
  supabase: any,
  userId: string,
  operation: (session: DiaSession) => Promise<T>
): Promise<T> {
  let session = await getDiaSession(supabase, userId);
  
  try {
    return await operation(session.session!);
  } catch (error) {
    if (isInvalidSessionError(error)) {
      // Force refresh
      await invalidateSession(supabase, userId);
      session = await getDiaSession(supabase, userId);
      return await operation(session.session!);
    }
    throw error;
  }
}
```

### 3. `BulkDataSyncManager.tsx` Güncellemeleri

**A. Detaylı Sync Orchestration:**
```typescript
interface DetailedSyncProgress {
  userId: string;
  serverName: string;
  sources: {
    slug: string;
    name: string;
    periods: {
      periodNo: number;
      status: 'pending' | 'running' | 'success' | 'error';
      recordsFetched?: number;
      error?: string;
    }[];
  }[];
}
```

**B. Kaynak Bazlı Sıralı Sync:**
```typescript
const syncUserData = async (user: UserWithDiaConfig) => {
  // 1. Önce dönemleri çek
  const periods = await fetchPeriods(user.user_id);
  
  // 2. Veri kaynaklarını çek
  const dataSources = await fetchDataSources();
  
  // 3. Her kaynak için, her dönem için sync
  for (const source of dataSources) {
    for (const period of periods) {
      // Acil stop kontrolü
      if (stopRequestedRef.current) break;
      
      // Tek kaynak/dönem sync
      await supabase.functions.invoke('dia-data-sync', {
        body: {
          action: 'syncSingleSource',
          targetUserId: user.user_id,
          dataSourceSlug: source.slug,
          periodNo: period.period_no,
        },
      });
      
      // UI güncelle
      updateProgress(user.user_id, source.slug, period.period_no, 'success');
    }
  }
};
```

**C. Hata Mesajı Görünürlüğü:**
- Her kaynak/dönem için ayrı durum gösterimi
- Tooltip ile detaylı hata mesajı
- Retry butonu (tek kaynak/dönem için)

### 4. Takılı Kayıtları Temizleme

**Cleanup Script (Edge Function başlangıcında):**
```typescript
// 5 dakikadan uzun süredir running olan kayıtları failed olarak işaretle
await supabase
  .from('sync_history')
  .update({ 
    status: 'failed', 
    error: 'Timeout - işlem tamamlanamadı',
    completed_at: new Date().toISOString()
  })
  .eq('status', 'running')
  .lt('started_at', new Date(Date.now() - 5 * 60 * 1000).toISOString());
```

---

## Dosya Değişiklikleri Özeti

| Dosya | Değişiklik |
|-------|------------|
| `supabase/functions/dia-data-sync/index.ts` | Session refresh, mikro batch, syncSingleSource action, cleanup logic |
| `supabase/functions/_shared/diaAutoLogin.ts` | withSessionRetry wrapper, session invalidation |
| `src/components/admin/BulkDataSyncManager.tsx` | Kaynak/dönem bazlı orchestration, detaylı progress UI |

---

## Beklenen İyileştirmeler

1. **Session Timeout Önleme**: Her çağrı öncesi session kontrolü
2. **Database Timeout Önleme**: Mikro batch yazma (25 kayıt)
3. **Edge Function Timeout Önleme**: Kaynak/dönem bazlı ayrı çağrılar
4. **Hata Görünürlüğü**: Detaylı hata mesajları UI'da
5. **Güvenilirlik**: Retry mekanizması ve takılı kayıt temizleme
