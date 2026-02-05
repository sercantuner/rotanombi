
# 502 Bad Gateway Hatası Çözüm Planı

## Problem Analizi

### Hata Detayları
- **Hata kodu:** 502 Bad Gateway
- **Oluşma zamanı:** ~28 saniye (28.591 ms)
- **Oluşma noktası:** 16. chunk (offset ~15.000-16.000)
- **Veri kaynağı:** scf_fatura_listele

### Kök Neden: Bellek Sınırı (WORKER_LIMIT)
502 hatası Edge Function'ın bellek sınırını aştığını gösteriyor. Mevcut yapıda:

| Sorun | Etkisi |
|-------|--------|
| CHUNK_SIZE = 1000 | Her chunk'ta 1000 kayıt bellekte tutuluyor |
| Tek tek upsert | 1000 kayıt = 1000 ayrı DB isteği |
| Session check her sayfada | Gereksiz DB sorguları |

---

## Çözüm Stratejisi

### Değişiklik 1: CHUNK_SIZE Küçültme
Her chunk'ta işlenen kayıt sayısını düşürerek bellek baskısını azalt:

| Parametre | Eski | Yeni |
|-----------|------|------|
| CHUNK_SIZE (Frontend) | 1000 | 500 |
| DEFAULT_CHUNK_SIZE (Edge) | 1000 | 500 |
| PAGE_SIZE | 200 | 200 (değişmez) |

### Değişiklik 2: Batch Upsert Optimizasyonu
Tek tek upsert yerine gerçek batch upsert kullanarak DB istek sayısını azalt:

```typescript
// ÖNCE: Her kayıt için ayrı upsert (1000 istek)
for (const r of recs.slice(i, i + BATCH_SIZE)) {
  await sb.from('company_data_cache').upsert({ ... });
}

// SONRA: Batch upsert (4-5 istek)
const batch = recs.slice(i, i + 200).map(r => ({
  sunucu_adi: sun,
  firma_kodu: fk,
  donem_kodu: dk,
  data_source_slug: slug,
  dia_key: Number(r._key || r.id),
  data: r,
  is_deleted: false,
  updated_at: new Date().toISOString()
})).filter(item => item.dia_key);

await sb.from('company_data_cache').upsert(batch, { 
  onConflict: '...' 
});
```

### Değişiklik 3: Session Cache
Her sayfada session kontrolü yerine chunk başında bir kez kontrol:

```typescript
// ÖNCE: Her fetchPage'de ensureValidSession çağrılıyor
// SONRA: streamChunk başında bir kez session al, her sayfada kullan
const sessionResult = await ensureValidSession(sb, uid, sess);
if (!sessionResult.success) return { ok: false, ... };
const validSession = sessionResult.session;

// fetchPage artık session parametre alır (kontrol yapmaz)
```

### Değişiklik 4: Bellek Optimizasyonu
Veri işlendikten sonra referansları temizle:

```typescript
// Her sayfa yazıldıktan sonra referansı temizle
if (r.data.length > 0) {
  await writeBatch(sb, sun, fk, dk, slug, r.data);
  fetched += r.data.length;
  // Veriyi bellekten serbest bırak
  r.data = null; 
}
```

---

## Dosya Değişiklikleri

| Dosya | Değişiklik |
|-------|------------|
| `supabase/functions/dia-data-sync/index.ts` | CHUNK_SIZE=500, Batch upsert, Session cache |
| `src/components/admin/BulkDataSyncManager.tsx` | CHUNK_SIZE=500 |

---

## Yeni Parametreler

| Parametre | Değer | Açıklama |
|-----------|-------|----------|
| CHUNK_SIZE | 500 | Her chunk'ta max kayıt (eskisi 1000) |
| BATCH_UPSERT_SIZE | 200 | Batch upsert kayıt sayısı |
| PAGE_SIZE | 200 | DIA API sayfa boyutu (değişmez) |

---

## Beklenen Sonuçlar

### Bellek Kullanımı
- **Önce:** 1000 kayıt x ~5KB = ~5MB per chunk + kümülatif birikim
- **Sonra:** 500 kayıt x ~5KB = ~2.5MB per chunk, referanslar temizleniyor

### DB İstek Sayısı
- **Önce:** 1000 kayıt = 1000 ayrı upsert
- **Sonra:** 500 kayıt = ~3 batch upsert (200 + 200 + 100)

### Performans
- Her chunk ~10-15 saniye içinde tamamlanır (timeout sınırının çok altında)
- 20.000 kayıt = 40 chunk = ~8-10 dakika güvenli senkronizasyon

---

## Teknik Detaylar

### write() Fonksiyonu Yeni Hali
```typescript
async function writeBatch(sb: any, sun: string, fk: string, dk: number, slug: string, recs: any[]) {
  const UPSERT_BATCH = 200;
  let written = 0;
  
  for (let i = 0; i < recs.length; i += UPSERT_BATCH) {
    const batch = recs.slice(i, i + UPSERT_BATCH)
      .map(r => {
        const k = r._key || r.id;
        if (!k) return null;
        return { 
          sunucu_adi: sun, 
          firma_kodu: fk, 
          donem_kodu: dk, 
          data_source_slug: slug, 
          dia_key: Number(k), 
          data: r, 
          is_deleted: false, 
          updated_at: new Date().toISOString() 
        };
      })
      .filter(Boolean);
    
    if (batch.length === 0) continue;
    
    const { error } = await sb
      .from('company_data_cache')
      .upsert(batch, { 
        onConflict: 'sunucu_adi,firma_kodu,donem_kodu,data_source_slug,dia_key' 
      });
    
    if (!error) written += batch.length;
  }
  
  return written;
}
```

### fetchPageSimple() (Session kontrolsüz)
```typescript
async function fetchPageSimple(sess: any, mod: string, met: string, dk: number, off: number) {
  const url = `https://${sess.sunucuAdi}.ws.dia.com.tr/api/v3/${mod}/json`;
  const fm = met.startsWith(`${mod}_`) ? met : `${mod}_${met}`;
  const pl = { [fm]: { 
    session_id: sess.sessionId, 
    firma_kodu: sess.firmaKodu, 
    donem_kodu: dk, 
    limit: PAGE_SIZE, 
    offset: off 
  }};
  
  const res = await fetch(url, { 
    method: "POST", 
    headers: { "Content-Type": "application/json" }, 
    body: JSON.stringify(pl) 
  });
  
  if (!res.ok) return { ok: false, data: [], err: `HTTP ${res.status}` };
  const r = await res.json();
  
  if (r.msg === 'INVALID_SESSION' || r.code === '401') {
    return { ok: false, data: [], err: 'INVALID_SESSION', needsRefresh: true };
  }
  
  if (r.code && r.code !== "200") return { ok: false, data: [], err: r.msg || `Error ${r.code}` };
  if (r.error || r.hata) return { ok: false, data: [], err: r.error?.message || r.hata?.aciklama || "API error" };
  
  return { ok: true, data: parse(r, fm) };
}
```

### streamChunk() Güncellemesi
```typescript
async function streamChunk(
  sb: any, uid: string, sess: any, mod: string, met: string, dk: number, 
  sun: string, fk: string, slug: string, startOffset: number, chunkSize: number
) {
  // Chunk başında bir kez session doğrula
  const sr = await ensureValidSession(sb, uid, sess);
  if (!sr.success || !sr.session) {
    return { ok: false, fetched: 0, written: 0, hasMore: false, nextOffset: startOffset, err: sr.error || "Session fail" };
  }
  
  let validSession = sr.session;
  let off = startOffset;
  let fetched = 0;
  let written = 0;
  
  while (fetched < chunkSize) {
    const r = await fetchPageSimple(validSession, mod, met, dk, off);
    
    // Session hatası - yenile ve tekrar dene
    if (r.needsRefresh) {
      await invalidateSession(sb, uid);
      const ns = await getDiaSession(sb, uid);
      if (!ns.success || !ns.session) {
        return { ok: false, fetched, written, hasMore: false, nextOffset: off, err: "Session refresh fail" };
      }
      validSession = ns.session;
      continue; // Aynı sayfayı tekrar dene
    }
    
    if (!r.ok) {
      if (fetched === 0) return { ok: false, fetched, written, hasMore: false, nextOffset: off, err: r.err };
      break;
    }
    
    if (r.data.length > 0) {
      written += await writeBatch(sb, sun, fk, dk, slug, r.data);
      fetched += r.data.length;
    }
    
    if (r.data.length < PAGE_SIZE) {
      return { ok: true, fetched, written, hasMore: false, nextOffset: off + r.data.length };
    }
    
    off += PAGE_SIZE;
    
    if (fetched >= chunkSize) {
      return { ok: true, fetched, written, hasMore: true, nextOffset: off };
    }
  }
  
  return { ok: true, fetched, written, hasMore: false, nextOffset: off };
}
```
