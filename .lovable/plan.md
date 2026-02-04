
# AI Kod Üretiminde Yarıda Kalma Sorunu - Çözüm Planı

## Problem Analizi

AI modelinin cevap karakter/token limiti nedeniyle uzun kodlar yarıda kesiliyor. Bu durum `max_tokens: 64000` parametresinden bağımsız olarak modelin kendi output sınırından kaynaklanıyor.

**Mevcut Durum:**
- `ai-code-generator` edge function `max_tokens: 64000` ile çağrı yapıyor
- Ancak AI modeli (google/gemini-3-pro-preview) kendi output limitine ulaştığında kodu yarım bırakıyor
- `finish_reason: "length"` döndüğünde bu durum tespit edilebilir ama şu an kontrol edilmiyor

## Çözüm Stratejisi

### 1. Yarım Kalan Yanıtı Tespit Et (finish_reason kontrolü)

AI API'den dönen yanıtı kontrol ederek kodun yarıda kalıp kalmadığını tespit et:

```text
finish_reason: "stop"   → Normal sonlanma, kod tam
finish_reason: "length" → Token limiti aşıldı, kod yarım
```

### 2. Otomatik Devam Mekanizması (Auto-Continue)

Kod yarım kaldığında otomatik olarak devam isteği gönder:

```text
Akış:
1. AI'dan ilk yanıt al
2. finish_reason == "length" ise:
   a. Mevcut kodu sakla
   b. "Kodun geri kalanını yaz, kaldığın yerden devam et:" promptu gönder
   c. Dönen kodu mevcut koda ekle
   d. Tekrar kontrol et (max 3 deneme)
3. Tam kodu birleştir ve döndür
```

### 3. Akıllı Kod Parçalama (Code Chunking)

Çok büyük widget'lar için kodu mantıksal parçalara böl:

```text
Bölüm 1: Helper fonksiyonlar (formatCurrency, getColor, vb.)
Bölüm 2: Veri işleme ve state
Bölüm 3: Ana render mantığı
Bölüm 4: return Widget
```

---

## Teknik Değişiklikler

### Dosya: `supabase/functions/ai-code-generator/index.ts`

**Yeni fonksiyon: `isCodeComplete()`**
```text
Kodun tamamlanıp tamamlanmadığını kontrol eder:
- "return Widget;" ile bitip bitmediği
- Parantez/süslü parantez dengesi
- Fonksiyon tanımının kapanıp kapanmadığı
```

**Yeni fonksiyon: `continueGeneration()`**
```text
Yarım kalan kodu tamamlamak için yeni istek gönderir:
- Mevcut kodu context olarak verir
- "Kaldığın yerden devam et" promptu kullanır
- Dönen parçayı mevcut koda ekler
```

**Ana akış güncelleme:**
```text
1. İlk API çağrısını yap
2. finish_reason'ı kontrol et
3. "length" ise veya kod tamamlanmamışsa:
   - continueGeneration() çağır (max 3 kez)
   - Parçaları birleştir
4. Son kontrolü yap ve döndür
```

### Dosya: `src/components/admin/CustomCodeWidgetBuilder.tsx`

**UI Güncellemesi:**
- Kod devam ediyor durumu için loading state ekle
- "Kod uzun, devam ediliyor... (2/3)" gibi progress göster
- Yarım kalan kod uyarısı göster (kullanıcı manuel devam edebilsin)

---

## Uygulama Detayları

### Edge Function Değişiklikleri

```javascript
// Yarım kod tespit fonksiyonu
function isCodeComplete(code) {
  // return Widget; kontrolü
  if (!code.includes('return Widget;')) return false;
  
  // Parantez dengesi
  const openBraces = (code.match(/{/g) || []).length;
  const closeBraces = (code.match(/}/g) || []).length;
  if (openBraces !== closeBraces) return false;
  
  // Fonksiyon tanımı kontrolü
  if (!code.match(/function\s+Widget\s*\(\s*\{[^}]*\}\s*\)/)) return false;
  
  return true;
}

// Devam isteme fonksiyonu
async function continueGeneration(partialCode, apiKey, attempt) {
  const continuePrompt = `Aşağıdaki kod yarım kaldı. Kaldığın yerden AYNEN devam et:
  
\`\`\`javascript
${partialCode.slice(-2000)}
\`\`\`

Sadece DEVAM kodunu yaz, baştan başlama!`;
  
  // API çağrısı...
}

// Ana fonksiyonda kullanım
let fullCode = generatedCode;
let attempts = 0;
const MAX_ATTEMPTS = 3;

while (!isCodeComplete(fullCode) && attempts < MAX_ATTEMPTS) {
  attempts++;
  console.log(`[AI Code Generator] Kod yarım, devam ediliyor (${attempts}/${MAX_ATTEMPTS})...`);
  
  const continuation = await continueGeneration(fullCode, LOVABLE_API_KEY, attempts);
  fullCode += '\n' + continuation;
}
```

### Frontend Güncellemeleri

```typescript
// Yeni state
const [generationProgress, setGenerationProgress] = useState<{
  isPartial: boolean;
  attempt: number;
  maxAttempts: number;
} | null>(null);

// API yanıtında progress bilgisi göster
if (response.data?.isPartial) {
  setGenerationProgress({
    isPartial: true,
    attempt: response.data.currentAttempt,
    maxAttempts: response.data.maxAttempts
  });
}
```

---

## Beklenen Sonuçlar

1. **Otomatik Tamamlama:** Uzun kodlar otomatik olarak birden fazla istekle tamamlanacak
2. **Görsel Geri Bildirim:** Kullanıcı kodun devam ettiğini görecek
3. **Fail-Safe:** 3 denemeden sonra bile tamamlanamazsa kullanıcıya bilgi verilecek
4. **Manuel Seçenek:** Kullanıcı "Devam Et" butonuyla manuel olarak da devam isteyebilecek

## Risk ve Dikkat Edilecekler

- Her devam isteği ek AI kredisi harcar
- Çok karmaşık widget'larda 3 deneme yetmeyebilir (ama nadir)
- Kod parçaları birleştirilirken syntax hatası olabilir → validation gerekli
