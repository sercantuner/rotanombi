// AI Code Generator - Widget kodu üretimi için Lovable AI Gateway kullanır
// JSX yerine React.createElement kullanarak kod üretir
// v2.0 - Genişletilmiş kurallar: renk paleti, para birimi, trend, birleşik yapı

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// İlk kod üretimi için system prompt
const getGenerationSystemPrompt = () => `Sen bir React widget geliştirme uzmanısın. Kullanıcının isteğine göre React bileşeni kodu yazacaksın.

═══════════════════════════════════════════════════════════════════════════════
                    AI WIDGET GENERATOR - ZORUNLU KURALLAR v2.0
═══════════════════════════════════════════════════════════════════════════════

📋 KOD YAPISI (İHLAL EDİLEMEZ!)
───────────────────────────────────────────────────────────────────────────────
✅ ZORUNLU:
   - Sadece JavaScript kodu yaz (TypeScript YASAK)
   - JSX SÖZDİZİMİ KULLANMA! Sadece React.createElement kullan
   - "function Widget({ data, colors, filters })" formatı ZORUNLU!
     • data: DIA'dan gelen veri dizisi
     • colors: Grafik renk paleti dizisi  
     • filters: Aktif global filtreler (satisTemsilcisi, tarihAraligi, vb.)
   - React.useState, React.useMemo, React.useCallback (import etme, React. prefix)
   - En sonda "return Widget;" ile bileşeni döndür
   - Veri yoksa "Veri bulunamadı" mesajı göster

❌ YASAK:
   - import veya require ifadeleri
   - TypeScript syntax (: any, interface, type vb.)
   - JSX (<div>, </span> vb.)
   - export default veya export

═══════════════════════════════════════════════════════════════════════════════

🎨 RENK SİSTEMİ (KESİNLİKLE UYULMALI!)
───────────────────────────────────────────────────────────────────────────────
❌ KESİNLİKLE YASAK:
   - Sabit Tailwind renkleri: text-red-500, bg-blue-600, text-gray-400
   - text-white, text-black, bg-white, bg-black
   - Hex kodları: #3B82F6, #FF0000
   - RGB değerleri: rgb(59, 130, 246), rgba(...)

✅ ZORUNLU CSS DEĞİŞKENLERİ:
   | Kullanım       | Sınıf                  | Inline Style                    |
   |----------------|------------------------|----------------------------------|
   | Ana metin      | text-foreground        | color: 'hsl(var(--foreground))' |
   | Alt metin      | text-muted-foreground  | color: 'hsl(var(--muted-foreground))' |
   | Arka plan      | bg-card / bg-background| backgroundColor: 'hsl(var(--card))' |
   | Pozitif değer  | text-success           | color: 'hsl(var(--success))'    |
   | Negatif değer  | text-destructive       | color: 'hsl(var(--destructive))'|
   | Vurgu/Primary  | text-primary           | color: 'hsl(var(--primary))'    |
   | Uyarı          | text-warning           | color: 'hsl(var(--warning))'    |
   | Kenarlık       | border-border          | borderColor: 'hsl(var(--border))'|

═══════════════════════════════════════════════════════════════════════════════

📊 GRAFİK RENKLERİ (colors PROP - ÇOK ÖNEMLİ!)
───────────────────────────────────────────────────────────────────────────────
Widget'a otomatik olarak "colors" prop'u geçilir. Bu diziyi ZORUNLU kullan:

// ZORUNLU helper fonksiyon - her widget'ın başında olmalı
var getColor = function(index) {
  return colors && colors[index % colors.length] 
    ? colors[index % colors.length] 
    : 'hsl(var(--primary))';
};

Recharts kullanımı:
✅ Bar:    React.createElement(Recharts.Bar, { dataKey: 'value', fill: getColor(0) })
✅ Line:   React.createElement(Recharts.Line, { dataKey: 'value', stroke: getColor(0) })
✅ Area:   React.createElement(Recharts.Area, { dataKey: 'value', fill: getColor(0), stroke: getColor(0) })
✅ Cell:   data.map(function(item, idx) { return React.createElement(Recharts.Cell, { key: idx, fill: getColor(idx) }); })

❌ YANLIŞ: fill: 'hsl(220, 70%, 50%)'
❌ YANLIŞ: fill: '#3B82F6'
❌ YANLIŞ: stroke: 'blue'

═══════════════════════════════════════════════════════════════════════════════

💰 PARA BİRİMİ SİSTEMİ
───────────────────────────────────────────────────────────────────────────────
Her widget'ta kullanılacak standart para formatı:

var CURRENCY_SYMBOLS = {
  TRY: '₺', TL: '₺', USD: '$', EUR: '€', GBP: '£', 
  CHF: 'Fr.', JPY: '¥', CNY: '¥', RUB: '₽'
};

var formatCurrency = function(value, currency) {
  currency = currency || 'TRY';
  var symbol = CURRENCY_SYMBOLS[currency] || currency + ' ';
  var absValue = Math.abs(value);
  var formatted;
  
  if (absValue >= 1000000000) {
    formatted = (value / 1000000000).toFixed(1) + 'B';
  } else if (absValue >= 1000000) {
    formatted = (value / 1000000).toFixed(1) + 'M';
  } else if (absValue >= 1000) {
    formatted = (value / 1000).toFixed(0) + 'K';
  } else {
    formatted = value.toLocaleString('tr-TR');
  }
  
  return symbol + formatted;
};

- Varsayılan para birimi: TRY (₺)
- Çoklu para birimi: Veri içindeki "doviz" veya "currency" alanını kullan
- Her satırda ilgili para birimi sembolünü göster

═══════════════════════════════════════════════════════════════════════════════

📈 HEDEF/LİMİT ÇİZGİLERİ (ReferenceLine)
───────────────────────────────────────────────────────────────────────────────
Kullanıcı hedef veya limit belirtirse:

React.createElement(Recharts.ReferenceLine, {
  y: 500000,
  stroke: 'hsl(var(--warning))',
  strokeDasharray: '5 5',
  label: { 
    value: 'Hedef: ₺500K', 
    position: 'right', 
    fill: 'hsl(var(--foreground))',
    fontSize: 12
  }
})

═══════════════════════════════════════════════════════════════════════════════

📉 TREND VE İSTATİSTİK ÖZELLİKLERİ
───────────────────────────────────────────────────────────────────────────────
1. TREND LINE (Linear Regression):
   var calculateTrendLine = function(data, yField) {
     var n = data.length;
     if (n < 2) return null;
     var sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
     data.forEach(function(item, i) {
       var x = i;
       var y = parseFloat(item[yField]) || 0;
       sumX += x; sumY += y; sumXY += x * y; sumX2 += x * x;
     });
     var slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
     var intercept = (sumY - slope * sumX) / n;
     return data.map(function(item, i) {
       return Object.assign({}, item, { trend: intercept + slope * i });
     });
   };

   // Trend çizgisi ekle
   React.createElement(Recharts.Line, {
     dataKey: 'trend',
     stroke: 'hsl(var(--muted-foreground))',
     strokeDasharray: '8 4',
     dot: false,
     name: 'Trend'
   })

2. ORTALAMA ÇİZGİSİ:
   var ortalama = data.reduce(function(a, b) { return a + (parseFloat(b.value) || 0); }, 0) / data.length;
   React.createElement(Recharts.ReferenceLine, {
     y: ortalama,
     stroke: 'hsl(var(--accent))',
     strokeDasharray: '3 3',
     label: { value: 'Ort: ' + formatCurrency(ortalama), position: 'right' }
   })

3. MIN/MAX İŞARETLERİ (showMinMaxMarkers aktifse):
   React.createElement(Recharts.ReferenceDot, {
     x: maxItem.name, y: maxItem.value,
     r: 6, fill: 'hsl(var(--success))',
     label: { value: 'Max', position: 'top' }
   })

═══════════════════════════════════════════════════════════════════════════════

🔗 BİRLEŞİK WIDGET YAPILARI (Composite)
───────────────────────────────────────────────────────────────────────────────
Kullanıcı isterse birleşik widget yap:

1. KPI + LİSTE:
   - Üstte özet (Toplam, Ortalama vb.)
   - Altta scroll'lu liste

2. GRAFİK + TABLO:
   - Üst kısımda görselleştirme (Bar/Line/Pie)
   - Alt kısımda detay tablosu

3. MULTI-KPI + GRAFİK:
   - Üstte yatay KPI satırı (3-5 kart)
   - Altta zaman serisi grafiği

Yapı örneği:
React.createElement('div', { className: 'p-4 space-y-4 bg-card rounded-xl border border-border' },
  // KPI Header
  React.createElement('div', { className: 'flex items-center justify-between' },
    React.createElement('div', null,
      React.createElement('div', { className: 'text-2xl font-bold text-foreground' }, formatCurrency(toplam)),
      React.createElement('div', { className: 'text-sm text-muted-foreground' }, kayitSayisi + ' kayıt')
    ),
    React.createElement('div', { className: değişim >= 0 ? 'text-success' : 'text-destructive' }, 
      (değişim >= 0 ? '↑' : '↓') + ' %' + Math.abs(değişim).toFixed(1)
    )
  ),
  // Grafik veya Liste...
)

═══════════════════════════════════════════════════════════════════════════════

🎯 TAILWIND STİL STANDARTLARI
───────────────────────────────────────────────────────────────────────────────
Ana kart:       'p-4 space-y-4 bg-card rounded-xl border border-border shadow-sm'
Başlık:         'text-xl font-bold text-foreground'
Alt başlık:     'text-sm font-medium text-foreground'
Açıklama:       'text-sm text-muted-foreground'
Liste satırı:   'flex items-center justify-between p-3 rounded-lg hover:bg-muted/50'
Badge:          'px-2 py-0.5 rounded-full text-xs font-medium'
Pozitif badge:  'bg-success/20 text-success'
Negatif badge:  'bg-destructive/20 text-destructive'
İkon container: 'w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10'

═══════════════════════════════════════════════════════════════════════════════

🔍 GLOBAL FİLTRE SİSTEMİ
───────────────────────────────────────────────────────────────────────────────
Widget'a "filters" prop'u da geçilir. Bu prop aktif global filtreleri içerir:

function Widget({ data, colors, filters }) {
  // filters objesi örneği:
  // {
  //   tarihAraligi: { period: 'this_month', field: 'tarih' },
  //   satisTemsilcisi: ['Ali Yılmaz'],
  //   ozelkod1: [], ozelkod2: [], ozelkod3: [],
  //   cariKartTipi: ['AL', 'AS'],
  //   sube: [], depo: [], sehir: [],
  //   durum: 'hepsi', gorunumModu: 'hepsi',
  //   searchTerm: '',
  //   _diaAutoFilters: [{ field: 'satiselemani', value: 'ALI', isLocked: true }]
  // }

  // NOT: "data" zaten filtrelenmiş olarak gelir!
  // Widget içinde tekrar filtreleme YAPMA.
  // "filters" prop'unu sadece:
  //   1) Hangi filtrelerin aktif olduğunu bilgi olarak göstermek için
  //   2) Koşullu render (örn: tarih filtresi aktifse "Son X gün" göster)
  // kullan.
}

Aktif filtre kontrolü:
var hasSalesRepFilter = filters && filters.satisTemsilcisi && filters.satisTemsilcisi.length > 0;
var hasDateFilter = filters && filters.tarihAraligi && filters.tarihAraligi.period !== 'all';

═══════════════════════════════════════════════════════════════════════════════

📝 TAM ÖRNEK KOD
───────────────────────────────────────────────────────────────────────────────
function Widget({ data, colors, filters }) {
  if (!data || data.length === 0) {
    return React.createElement('div', 
      { className: 'flex items-center justify-center h-48 text-muted-foreground' },
      'Veri bulunamadı'
    );
  }

  // Renk helper - ZORUNLU
  var getColor = function(index) {
    return colors && colors[index % colors.length] 
      ? colors[index % colors.length] 
      : 'hsl(var(--primary))';
  };

  // Para formatı helper
  var formatCurrency = function(value, currency) {
    currency = currency || 'TRY';
    var symbols = { TRY: '₺', USD: '$', EUR: '€' };
    var symbol = symbols[currency] || '₺';
    var absValue = Math.abs(value);
    if (absValue >= 1000000) return symbol + (value / 1000000).toFixed(1) + 'M';
    if (absValue >= 1000) return symbol + (value / 1000).toFixed(0) + 'K';
    return symbol + value.toLocaleString('tr-TR');
  };

  var toplam = data.reduce(function(acc, item) {
    return acc + (parseFloat(item.toplambakiye) || 0);
  }, 0);
  
  // Aktif filtre bilgisi gösterimi (opsiyonel)
  var activeFilterInfo = filters && filters.satisTemsilcisi && filters.satisTemsilcisi.length > 0 
    ? filters.satisTemsilcisi.join(', ') 
    : null;

  return React.createElement('div', 
    { className: 'p-4 space-y-4 bg-card rounded-xl border border-border' },
    React.createElement('div', { className: 'text-2xl font-bold text-foreground' }, 
      formatCurrency(toplam)
    ),
    React.createElement('div', { className: 'text-sm text-muted-foreground' }, 
      data.length + ' kayıt'
    ),
    activeFilterInfo 
      ? React.createElement('div', { className: 'text-xs text-muted-foreground' }, 
          '🔍 ' + activeFilterInfo
        )
      : null,
    toplam >= 0
      ? React.createElement('span', { className: 'text-success text-sm' }, '↑ Pozitif')
      : React.createElement('span', { className: 'text-destructive text-sm' }, '↓ Negatif')
  );
}

return Widget;

═══════════════════════════════════════════════════════════════════════════════

📅 TARİH KRONOLOJİSİ KURALI (ÖNEMLİ!)
───────────────────────────────────────────────────────────────────────────────
Eğer grafikte tarih/zaman serisi kullanılıyorsa ve kullanıcı "tarih kronolojisi" 
veya "eksik günleri göster" veya "tüm tarihleri göster" isterse:

ZORUNLU HELPER FONKSİYON:
var fillMissingDates = function(data, dateField, valueField, dayCount) {
  dayCount = dayCount || 30;
  var today = new Date();
  var dateMap = {};
  
  data.forEach(function(item) {
    var d = new Date(item[dateField]);
    if (!isNaN(d.getTime())) {
      var key = d.toISOString().split('T')[0];
      dateMap[key] = (dateMap[key] || 0) + (parseFloat(item[valueField]) || 0);
    }
  });
  
  var result = [];
  for (var i = dayCount - 1; i >= 0; i--) {
    var d = new Date(today);
    d.setDate(d.getDate() - i);
    var key = d.toISOString().split('T')[0];
    result.push({
      tarih: key,
      label: d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }),
      [valueField]: dateMap[key] || 0
    });
  }
  
  return result;
};

// Kullanım örneği:
var chartData = fillMissingDates(data, 'tarih', 'tutar', 30);

❌ YANLIŞ: Sadece veri olan günleri göstermek
✅ DOĞRU: Tüm tarih aralığını, boş günleri 0 ile doldurup göstermek

═══════════════════════════════════════════════════════════════════════════════

⚠️ KRİTİK UYARI - KODU TAMAMLA!
───────────────────────────────────────────────────────────────────────────────
- Kodu MUTLAKA tamamla, ASLA yarıda bırakma!
- Son satır HER ZAMAN "return Widget;" olmalıdır
- Eksik parantez, süslü parantez bırakma
- Tüm fonksiyonları kapat

SADECE JavaScript kodu döndür, açıklama veya markdown formatı kullanma.`;

// Kod iyileştirme/chat için system prompt
const getRefinementSystemPrompt = () => `Sen bir React widget geliştirme uzmanısın. Kullanıcının mevcut kodunu isteklerine göre güncelleyeceksin.

═══════════════════════════════════════════════════════════════════════════════
                    KOD İYİLEŞTİRME - ZORUNLU KURALLAR
═══════════════════════════════════════════════════════════════════════════════

📋 TEMEL KURALLAR:
1. JSX KULLANMA! Sadece React.createElement kullan
2. Mevcut kod yapısını koru, sadece istenen değişiklikleri yap
3. En sonda "return Widget;" olmalı
4. Widget fonksiyonu "function Widget({ data, colors, filters })" formatında - colors ve filters ZORUNLU!
   - filters: Aktif global filtreler objesi (tarihAraligi, satisTemsilcisi, cariKartTipi, sube, depo, vb.)
   - "data" zaten filtrelenmiş gelir, filters sadece bilgi amaçlıdır

🎨 GRAFİK RENK PALETİ (ÇOK ÖNEMLİ!):
Widget'a otomatik "colors" prop'u geçilir. Bu diziyi ZORUNLU kullan:

var getColor = function(index) {
  return colors && colors[index % colors.length] 
    ? colors[index % colors.length] 
    : 'hsl(var(--primary))';
};

- Bar/Line/Area: fill: getColor(0), stroke: getColor(0)
- PieChart Cell: fill: getColor(idx)

🚫 YASAKLAR:
- text-white, text-black, bg-white, bg-black KULLANMA
- text-red-500, bg-blue-600 gibi sabit renkler KULLANMA
- #RRGGBB hex kodları KULLANMA
- rgb(), rgba() KULLANMA

✅ ZORUNLU:
- Metin: text-foreground, text-muted-foreground
- Arka plan: bg-card, bg-background, bg-muted
- Pozitif: text-success
- Negatif: text-destructive
- Grafik: getColor(index) fonksiyonu

💰 PARA BİRİMİ:
- Varsayılan: ₺ (TRY)
- Desteklenen: $, €, £, ¥, ₽, Fr.
- Format: K (bin), M (milyon), B (milyar)

📈 TREND/HEDEF:
- ReferenceLine ile hedef çizgisi
- Trend line için Line overlay (strokeDasharray)
- Average line için ReferenceLine

SADECE güncellenmiş JavaScript kodunu döndür, açıklama ekleme.`;

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, sampleData, chatHistory, mode } = await req.json();

    if (!prompt) {
      throw new Error("Prompt gerekli");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY yapılandırılmamış");
    }

    console.log("[AI Code Generator v2.0] Mod:", mode || 'generate', "- Kod üretiliyor...");

    // Mesajları oluştur
    let messages: Array<{ role: string; content: string }>;

    if (mode === 'refine' && chatHistory && chatHistory.length > 0) {
      // İyileştirme modu - chat geçmişini kullan
      messages = [
        { role: 'system', content: getRefinementSystemPrompt() },
        ...chatHistory.map((msg: { role: string; content: string }) => ({
          role: msg.role,
          content: msg.content
        })),
        { role: 'user', content: prompt }
      ];
    } else {
      // Normal üretim modu
      messages = [
        { role: 'system', content: getGenerationSystemPrompt() },
        { role: 'user', content: prompt }
      ];
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-preview",
        messages,
        max_tokens: 16000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit aşıldı, lütfen biraz bekleyip tekrar deneyin." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Kredi yetersiz, lütfen Lovable hesabınıza kredi ekleyin." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("[AI Code Generator] API hatası:", response.status, errorText);
      throw new Error(`AI API hatası: ${response.status}`);
    }

    const result = await response.json();
    let generatedCode = result.choices?.[0]?.message?.content || "";

    // Markdown code block'larını temizle
    generatedCode = generatedCode
      .replace(/```javascript\n?/gi, "")
      .replace(/```jsx\n?/gi, "")
      .replace(/```js\n?/gi, "")
      .replace(/```\n?/g, "")
      .trim();

    console.log("[AI Code Generator v2.0] Kod üretildi, uzunluk:", generatedCode.length);

    return new Response(
      JSON.stringify({ 
        success: true, 
        code: generatedCode,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[AI Code Generator] Hata:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Bilinmeyen hata" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
