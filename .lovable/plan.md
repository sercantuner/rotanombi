
# DIA Büyük Veri Senkronizasyonu - Otomatik Chunk Sistemi

## Problem Analizi

### Kök Neden: Edge Function Timeout (504)
Analytics logları gösteriyor ki:
- Büyük veri kaynaklarında (Stok Listesi vb.) edge function **~150 saniye** (2.5 dakika) çalışıyor
- Supabase edge function maksimum **150 saniye** wall-time sınırına sahip
- Bu sınıra ulaşıldığında **504 Gateway Timeout** dönüyor
- Mevcut `PAGE_SIZE = 200` ile sayfalama var ama **tüm sayfalar tek request içinde** işleniyor

### Mevcut Akış (Problemli)
```text
Frontend --[1 request]--> dia-data-sync Edge Function
                                |
                                v
                    DIA API (Sayfa 1: 200 kayıt)
                    DIA API (Sayfa 2: 200 kayıt)
                    DIA API (Sayfa 3: 200 kayıt)
                    ...
                    DIA API (Sayfa N: 200 kayıt) --> TIMEOUT!
                                |
                                v
                    DB Write (hepsi birden)
```

## Çözüm: Frontend-Orchestrated Chunking

### Yeni Akış
```text
Frontend --[request 1]--> Edge Function (offset=0, chunk_size=500)
                              |
                              v
                    DIA API (Sayfa 1-2: 400 kayıt) + DB Write
                              |
                              v
                    Response: { hasMore: true, nextOffset: 500, written: 400 }

Frontend --[500ms bekle]-->

Frontend --[request 2]--> Edge Function (offset=500, chunk_size=500)
                              |
                              v
                    DIA API (Sayfa 3-4: 400 kayıt) + DB Write
                              ...
                    Response: { hasMore: false, totalWritten: 20000 }
```

## Teknik Değişiklikler

### 1. Edge Function: Yeni Chunk-Bazlı Sync Action

**Dosya:** `supabase/functions/dia-data-sync/index.ts`

Yeni `syncChunk` action eklenecek:

```typescript
interface ChunkSyncRequest {
  action: 'syncChunk';
  targetUserId?: string;
  dataSourceSlug: string;
  periodNo: number;
  offset: number;      // Başlangıç offseti
  chunkSize: number;   // Bu chunk'ta çekilecek max kayıt (varsayılan: 1000)
}

interface ChunkSyncResponse {
  success: boolean;
  written: number;          // Bu chunk'ta yazılan kayıt
  hasMore: boolean;         // Daha fazla veri var mı
  nextOffset: number;       // Sonraki chunk için offset
  totalProcessed: number;   // Toplam işlenen
  error?: string;
}
```

Chunk işleme mantığı:
- Offset'ten başla
- ChunkSize kadar kayıt çek (PAGE_SIZE=200 ile 5 sayfa = 1000 kayıt)
- Her sayfayı çekince hemen DB'ye yaz
- ChunkSize'a ulaşınca veya veri bitince dur
- `hasMore` ile devam bilgisi dön

### 2. Frontend: Chunk Loop Orchestration

**Dosya:** `src/components/admin/BulkDataSyncManager.tsx`

Yeni `syncSourceWithChunks` fonksiyonu:

```typescript
const CHUNK_SIZE = 1000;        // Her chunk'ta max kayıt
const CHUNK_DELAY_MS = 500;     // Chunk'lar arası bekleme
const MAX_CHUNKS = 100;         // Güvenlik limiti (max 100.000 kayıt)

const syncSourceWithChunks = async (
  userId: string,
  sourceSlug: string,
  periodNo: number,
  onProgress?: (written: number, hasMore: boolean) => void
): Promise<{ success: boolean; totalWritten: number; error?: string }> => {
  let offset = 0;
  let totalWritten = 0;
  let chunkCount = 0;
  
  while (chunkCount < MAX_CHUNKS) {
    const response = await supabase.functions.invoke('dia-data-sync', {
      body: {
        action: 'syncChunk',
        targetUserId: userId,
        dataSourceSlug: sourceSlug,
        periodNo: periodNo,
        offset: offset,
        chunkSize: CHUNK_SIZE,
      },
    });
    
    if (response.error || !response.data?.success) {
      return { 
        success: false, 
        totalWritten, 
        error: response.error?.message || response.data?.error 
      };
    }
    
    totalWritten += response.data.written;
    onProgress?.(totalWritten, response.data.hasMore);
    
    if (!response.data.hasMore) {
      // Veri bitti
      return { success: true, totalWritten };
    }
    
    offset = response.data.nextOffset;
    chunkCount++;
    
    // Rate limiting - chunk'lar arası bekleme
    await new Promise(resolve => setTimeout(resolve, CHUNK_DELAY_MS));
  }
  
  return { success: true, totalWritten }; // MAX_CHUNKS'a ulaşıldı
};
```

### 3. Progress UI Güncellemesi

Chunk ilerlemesi gösterimi:

```typescript
interface SourcePeriodProgress {
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped';
  recordsFetched?: number;
  error?: string;
  // Yeni: Chunk ilerleme bilgisi
  chunksCompleted?: number;
  isChunking?: boolean;
}
```

UI'da chunk ilerleme badge'i:
- "🔄 Chunk 3/? - 1500 kayıt" gibi dinamik gösterim

## Dosya Değişiklikleri

| Dosya | Değişiklik |
|-------|------------|
| `supabase/functions/dia-data-sync/index.ts` | `syncChunk` action ekle, chunk-bazlı streaming mantığı |
| `src/components/admin/BulkDataSyncManager.tsx` | `syncSourceWithChunks` fonksiyonu, chunk loop orchestration |

## Parametreler

| Parametre | Değer | Açıklama |
|-----------|-------|----------|
| CHUNK_SIZE | 1000 | Her chunk'ta çekilecek max kayıt |
| PAGE_SIZE | 200 | DIA API sayfa boyutu |
| CHUNK_DELAY_MS | 500 | Chunk'lar arası bekleme (ms) |
| MAX_CHUNKS | 100 | Güvenlik limiti (max 100.000 kayıt) |
| BATCH_SIZE | 25 | DB yazma batch boyutu |

## Beklenen Sonuçlar

### Timeout Riski
- **Önce:** Tek request'te 20.000 kayıt = ~150sn = Timeout
- **Sonra:** 20 chunk x 1000 kayıt = Her chunk ~15sn = Timeout yok

### Performans
- Her chunk ~10-20 saniye içinde tamamlanır
- Toplam 20.000 kayıt ~3-5 dakikada güvenli şekilde senkronize edilir
- Rate limiting ile DIA sunucusu yüklenmez

### UI Deneyimi
- Kullanıcı chunk ilerlemesini gerçek zamanlı görür
- "Stok Listesi - Dönem 9: 🔄 3500/? kayıt işleniyor..."
- Acil Durdur chunk bitiminde güvenli durur

## Alternatif Düşünceler

1. **WebSocket/SSE:** Daha sofistike ama karmaşık
2. **Background Job:** Supabase'de native yok, workaround gerekir
3. **Daha küçük PAGE_SIZE:** DIA istek sayısı artar ama her sayfa daha hızlı

Seçilen yaklaşım (Frontend-orchestrated chunking) en basit ve güvenilir çözüm.
