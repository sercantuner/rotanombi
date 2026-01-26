
# CustomCodeWidgetBuilder Wizard Dönüşümü ve AI Token Limiti Artışı

## Genel Bakış
Bu plan, AI kod üretimindeki karakter sınırını kaldırarak tamamlanmamış kod sorununu çözer ve CustomCodeWidgetBuilder bileşenini adım adım ilerleyen bir wizard (form) yapısına dönüştürür.

---

## Bölüm 1: AI Token Limitini Artırma

### Sorun
- Mevcut `max_tokens: 8000` sınırı karmaşık widgetlar için yetersiz kalıyor
- Nakit Akış Projeksiyonu gibi büyük widgetlar yarıda kesiliyor ve syntax error veriyor

### Çözüm

**Dosya:** `supabase/functions/ai-code-generator/index.ts`

```text
Mevcut:   max_tokens: 8000
Yeni:     max_tokens: 16000
```

Ayrıca AI system prompt'a şu talimat eklenecek:
```text
ÖNEMLİ: Kodu MUTLAKA tamamla. Yarıda bırakma!
Son satır her zaman "return Widget;" olmalıdır.
```

---

## Bölüm 2: Wizard/Stepper Form Yapısı

### Mevcut Tab Yapısı → Wizard Adımları

```text
MEVCUT YAPIDA (Tabs):
┌──────────────────────────────────────────────────┐
│  [JSON] [Birleştir] [AI] [Kod] [Önizle]         │
│  ─────────────────────────────────────           │
│  Tüm sekmeler görünür, kullanıcı serbestçe      │
│  geçiş yapabiliyor ama akış belirsiz            │
└──────────────────────────────────────────────────┘

YENİ WIZARD YAPISI:
┌──────────────────────────────────────────────────┐
│  ● Veri  ○ AI Üret  ○ Kod Düzenle  ○ Önizle     │
│  ─────────────────────────────────────           │
│  Adım 1 içeriği                                  │
│                                                  │
│         [◀ Geri]  [İleri ▶] [Kaydet]            │
└──────────────────────────────────────────────────┘
```

### Wizard Adımları

| Adım | Başlık | İçerik | İleri Koşulu |
|------|--------|--------|--------------|
| 1 | **Veri Kaynağı** | Widget bilgileri + DataSource seçimi + JSON önizleme | Veri yüklenmeli |
| 2 | **AI Kod Üret** | Prompt yazma, veri analizi, kod üretme | Kod üretilmeli VEYA atla |
| 3 | **Kod Düzenle** | Kod editörü + AI chat ile iyileştirme | Kod hatasız olmalı |
| 4 | **Önizle & Kaydet** | Canlı önizleme + Kaydet butonu | - |

### Tasarım Detayları

1. **Stepper Header**:
   - Yatay adım göstergesi (numbered circles)
   - Tamamlanan adımlar yeşil ✓ işareti
   - Mevcut adım vurgulu
   - Tıklanarak geri gidilebilir (sadece tamamlanan adımlara)

2. **Navigasyon Butonları**:
   - "Geri" butonu (ilk adımda gizli)
   - "İleri" butonu (koşullar sağlanmazsa disabled)
   - "Atla" seçeneği (AI adımında opsiyonel)
   - "Kaydet" butonu (son adımda)

3. **Adım İçerikleri**:
   - Adım 1: Sol panel + JSON önizleme birleştirilmiş
   - Adım 2: AI prompt + veri analizi + üret butonu
   - Adım 3: Kod editörü + AI chat (büyük alan)
   - Adım 4: Tam ekran önizleme + widget bilgileri özeti

---

## Bölüm 3: State Yönetimi

### Yeni State Değişkenleri

```typescript
const [currentStep, setCurrentStep] = useState(0);
const [completedSteps, setCompletedSteps] = useState<number[]>([]);
const [stepValidation, setStepValidation] = useState({
  step1: false, // Veri yüklendi mi?
  step2: true,  // AI opsiyonel, her zaman geçilebilir
  step3: false, // Kod hatasız mı?
  step4: true,  // Her zaman tamamlanabilir
});
```

### İlerleme Mantığı

```typescript
const canProceed = (step: number) => {
  switch(step) {
    case 0: return sampleData.length > 0 || mergedQueryData.length > 0;
    case 1: return true; // AI opsiyonel
    case 2: return !codeError && customCode.trim().length > 0;
    case 3: return true;
    default: return false;
  }
};
```

---

## Bölüm 4: UI Bileşen Yapısı

### Stepper Component

```text
┌────────────────────────────────────────────────────────────┐
│   ●━━━━━━●━━━━━━○━━━━━━○                                   │
│   Veri   AI     Kod    Önizle                              │
│   ✓      ●      ○      ○                                   │
└────────────────────────────────────────────────────────────┘
```

### Her Adım için Layout

**Adım 1 - Veri Kaynağı:**
```text
┌──────────────────────────────────────────────────────────┐
│  📋 Widget Bilgileri                 📊 JSON Veri        │
│  ┌─────────────────────────────┐    ┌─────────────────┐  │
│  │ Key: custom_widget_xxx      │    │ {               │  │
│  │ Ad: Özel Widget             │    │   "cari": ...,  │  │
│  │ Boyut: [lg ▼]               │    │   "bakiye": ... │  │
│  │ Sayfa: [dashboard ▼]        │    │ }               │  │
│  │ İkon: [🎯 seç]              │    │                 │  │
│  └─────────────────────────────┘    └─────────────────┘  │
│                                                          │
│  📁 Veri Kaynağı                                         │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ [○ Tek Kaynak] [● Çoklu Kaynak]                     │ │
│  │ [cari_vade_bakiye ▼]           [Veri Yükle 🔄]     │ │
│  │ ✓ 145 kayıt yüklendi                                │ │
│  └─────────────────────────────────────────────────────┘ │
│                                    [İleri ▶]             │
└──────────────────────────────────────────────────────────┘
```

**Adım 2 - AI Kod Üret:**
```text
┌──────────────────────────────────────────────────────────┐
│  🤖 AI ile Widget Kodu Üret                              │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ Ne tür bir widget istiyorsunuz?                     │ │
│  │ ┌─────────────────────────────────────────────────┐ │ │
│  │ │ Vade yaşlandırma grafiği oluştur...             │ │ │
│  │ └─────────────────────────────────────────────────┘ │ │
│  │                                                     │ │
│  │ 📊 Veri Analizi: 145 kayıt, 12 alan                 │ │
│  │ [toplambakiye] [cariunvan] [vadetarihi] ...        │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  [◀ Geri]  [Atla →]  [🚀 AI ile Kod Üret]               │
└──────────────────────────────────────────────────────────┘
```

**Adım 3 - Kod Düzenle:**
```text
┌──────────────────────────────────────────────────────────┐
│  💻 Kod Editörü                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ function Widget({ data, colors }) {                 │ │
│  │   ...                                               │ │
│  │ }                                                   │ │
│  │ return Widget;                                      │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  💬 AI ile Kodu Geliştir                                 │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ [Renklendir] [Türkçeleştir] [Animasyon] [Dark Mode] │ │
│  │ ┌─────────────────────────────────────────────────┐ │ │
│  │ │ Değişiklik isteğinizi yazın...                  │ │ │
│  │ └─────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  [◀ Geri]  [✓ Hatasız]  [Önizle & Kaydet ▶]             │
└──────────────────────────────────────────────────────────┘
```

**Adım 4 - Önizle & Kaydet:**
```text
┌──────────────────────────────────────────────────────────┐
│  👁️ Widget Önizleme                                      │
│  ┌─────────────────────────────────────────────────────┐ │
│  │                                                     │ │
│  │          [CANLI WIDGET ÖNİZLEME]                   │ │
│  │                                                     │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  📋 Özet:                                                │
│  • Ad: Vade Yaşlandırma                                  │
│  • Boyut: lg | Sayfa: dashboard                          │
│  • Veri: cari_vade_bakiye (145 kayıt)                    │
│                                                          │
│  [◀ Geri]  [💾 Widget Kaydet]                            │
└──────────────────────────────────────────────────────────┘
```

---

## Bölüm 5: Dosya Değişiklikleri

### Değiştirilecek Dosyalar

| Dosya | Değişiklik |
|-------|------------|
| `supabase/functions/ai-code-generator/index.ts` | max_tokens: 8000 → 16000, tamamlama talimatı |
| `src/components/admin/CustomCodeWidgetBuilder.tsx` | Tabs → Stepper wizard yapısı, navigasyon mantığı |

### Yeni Eklentiler

1. **Stepper UI**: Wizard adımlarını gösteren üst bileşen
2. **StepContent**: Her adım için ayrı render bölümü  
3. **Navigation**: Geri/İleri/Atla/Kaydet butonları

---

## Bölüm 6: Uygulama Sırası

### Adım 1: AI Token Limiti
- `ai-code-generator/index.ts` dosyasında `max_tokens: 16000` yap
- System prompt'a tamamlama talimatı ekle

### Adım 2: Wizard State
- `currentStep` ve `completedSteps` state'leri ekle
- `canProceed()` ve `goToStep()` fonksiyonları

### Adım 3: Stepper Header
- Mevcut TabsList yerine Stepper component
- Adım numaraları ve başlıklar

### Adım 4: Adım İçerikleri
- Mevcut TabsContent'leri yeniden düzenle
- Her adım için optimize edilmiş layout

### Adım 5: Navigasyon
- Alt kısma Geri/İleri/Atla butonları
- Koşullu disabled state'ler

---

## Sonuç

Bu plan uygulandığında:
- ✅ AI kodları yarıda kesilmeyecek (16000 token)
- ✅ Adım adım wizard akışı (4 adım)
- ✅ Kullanıcı yönlendirilmiş deneyim
- ✅ Koşullu ilerleme (veri yükle → kod üret → düzenle → kaydet)
- ✅ Geri/ileri navigasyon
- ✅ "Atla" seçeneği (AI adımı opsiyonel)
- ✅ Tamamlanan adımların görsel gösterimi
