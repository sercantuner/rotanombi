// DIA API Request Queue - Eş zamanlı istek sayısını sınırlandırır
// Aşırı yük, session çakışması ve rate limit hatalarını önler

interface QueuedRequest {
  id: string;
  execute: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  retries: number;
  priority: number;
}

interface QueueConfig {
  maxConcurrent: number;      // Eş zamanlı maksimum istek sayısı
  maxRetries: number;         // Maksimum tekrar deneme
  retryDelay: number;         // İlk tekrar bekleme süresi (ms)
  retryBackoffMultiplier: number; // Üstel geri çekilme çarpanı
}

const DEFAULT_CONFIG: QueueConfig = {
  maxConcurrent: 2,           // Aynı anda en fazla 2 istek
  maxRetries: 2,              // 2 kez tekrar dene
  retryDelay: 1000,           // 1 saniye bekle
  retryBackoffMultiplier: 2,  // Her seferinde 2x bekle
};

// Tekrar denenebilir hatalar
const RETRYABLE_ERRORS = [
  'CancelledError',
  'INVALID_SESSION',
  'Network connection lost',
  'DIA bağlantı hatası: 500',
  'fetch failed',
  'Failed to fetch',
];

// Tekrar denemek anlamsız hatalar
const NON_RETRYABLE_ERRORS = [
  'dönem yetkiniz bulunmamaktadır',
  'UNKNOWN_CREDITS_ERROR',
  'Oturum bulunamadı',
  'API anahtarı bulunamadı',
];

class DiaRequestQueue {
  private queue: QueuedRequest[] = [];
  private activeRequests = 0;
  private config: QueueConfig;
  private isPaused = false;
  private pauseUntil = 0;

  constructor(config: Partial<QueueConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // İstek ekle
  enqueue<T>(
    requestFn: () => Promise<T>,
    priority: number = 0
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const request: QueuedRequest = {
        id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        execute: requestFn,
        resolve,
        reject,
        retries: 0,
        priority,
      };

      // Önceliğe göre sırala (yüksek öncelik önce)
      const insertIndex = this.queue.findIndex(q => q.priority < priority);
      if (insertIndex === -1) {
        this.queue.push(request);
      } else {
        this.queue.splice(insertIndex, 0, request);
      }

      this.processQueue();
    });
  }

  // Kuyruğu işle
  private async processQueue(): Promise<void> {
    // Duraklama kontrolü
    if (this.isPaused && Date.now() < this.pauseUntil) {
      setTimeout(() => this.processQueue(), this.pauseUntil - Date.now());
      return;
    }
    this.isPaused = false;

    // Kapasite kontrolü
    if (this.activeRequests >= this.config.maxConcurrent) {
      return;
    }

    // Kuyruktan al
    const request = this.queue.shift();
    if (!request) return;

    this.activeRequests++;

    try {
      const result = await request.execute();
      request.resolve(result);
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      
      // Tekrar denenmemesi gereken hata mı?
      const isNonRetryable = NON_RETRYABLE_ERRORS.some(e => 
        errorMessage.toLowerCase().includes(e.toLowerCase())
      );
      
      if (isNonRetryable) {
        request.reject(error);
      } else {
        // Tekrar denenebilir mi?
        const isRetryable = RETRYABLE_ERRORS.some(e => 
          errorMessage.toLowerCase().includes(e.toLowerCase())
        );
        
        if (isRetryable && request.retries < this.config.maxRetries) {
          request.retries++;
          const delay = this.config.retryDelay * Math.pow(this.config.retryBackoffMultiplier, request.retries - 1);
          
          console.log(`[DIA Queue] Retry ${request.retries}/${this.config.maxRetries} for ${request.id} in ${delay}ms`);
          
          // Kuyruğa geri ekle (öncelikli)
          setTimeout(() => {
            this.queue.unshift(request);
            this.processQueue();
          }, delay);
        } else {
          request.reject(error);
        }
      }
    } finally {
      this.activeRequests--;
      // Sonraki isteği başlat
      this.processQueue();
    }
  }

  // Tüm istekleri duraklat (rate limit durumunda)
  pause(durationMs: number): void {
    this.isPaused = true;
    this.pauseUntil = Date.now() + durationMs;
    console.log(`[DIA Queue] Paused for ${durationMs}ms due to rate limit`);
  }

  // Kuyruğu temizle
  clear(): void {
    const pending = this.queue.splice(0, this.queue.length);
    pending.forEach(req => req.reject(new Error('Queue cleared')));
  }

  // İstatistikler
  getStats() {
    return {
      queueLength: this.queue.length,
      activeRequests: this.activeRequests,
      isPaused: this.isPaused,
      pauseUntil: this.pauseUntil,
    };
  }
}

// Global instance
export const diaRequestQueue = new DiaRequestQueue();

// Rate limit hatası algıla ve kuyruğu duraklat
export function handleRateLimitError(errorMessage: string): boolean {
  if (errorMessage.includes('UNKNOWN_CREDITS_ERROR') || 
      errorMessage.includes('rate limit') ||
      errorMessage.includes('too many requests')) {
    diaRequestQueue.pause(30000); // 30 saniye bekle
    return true;
  }
  return false;
}

// Kuyruklu fetch wrapper
export async function queuedDiaFetch(
  url: string,
  options: RequestInit,
  priority: number = 0
): Promise<Response> {
  return diaRequestQueue.enqueue(
    async () => {
      const response = await fetch(url, options);
      
      // Rate limit kontrolü
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 30000;
        diaRequestQueue.pause(waitTime);
        throw new Error('Rate limit exceeded');
      }
      
      return response;
    },
    priority
  );
}
