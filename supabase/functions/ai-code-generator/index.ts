// AI Code Generator - Widget kodu üretimi için Lovable AI Gateway kullanır
// JSX yerine React.createElement kullanarak kod üretir

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// İlk kod üretimi için system prompt
const getGenerationSystemPrompt = () => `Sen bir React widget geliştirme uzmanısın. Kullanıcının isteğine göre React bileşeni kodu yazacaksın.

ÖNEMLİ KURALLAR - JSX KULLANMA!
1. Sadece JavaScript kodu yaz, TypeScript kullanma
2. JSX SÖZDİZİMİ KULLANMA! Sadece React.createElement kullan
3. "function Widget({ data, colors })" formatında tek bir bileşen yaz - colors prop'u zorunlu!
4. React hook'ları React.useState, React.useMemo şeklinde kullan (import etme)
5. En sonda "return Widget;" ile bileşeni döndür
6. Veri yoksa "Veri bulunamadı" göster
7. Para birimi için ₺ kullan ve formatla (K, M)
8. GRAFİK RENKLERİ İÇİN KESİNLİKLE colors PROP'UNU KULLAN!

=== ZORUNLU STİL KURALLARI ===

RENK SİSTEMİ - KESİNLİKLE UYULMALI:
- Sabit renk KULLANMA (text-red-500, bg-blue-600 gibi)
- Sadece CSS değişkenlerini kullan:
  * Ana renkler: 'text-primary', 'bg-primary', 'text-primary-foreground'
  * İkincil: 'text-secondary', 'bg-secondary', 'text-secondary-foreground'
  * Arka plan: 'bg-background', 'bg-card', 'bg-muted'
  * Metin: 'text-foreground', 'text-muted-foreground'
  * Vurgu: 'text-accent', 'bg-accent', 'text-accent-foreground'
  * Hata/Olumsuz: 'text-destructive', 'bg-destructive'
  * Başarı/Olumlu: 'text-success', 'bg-success' (veya 'text-green-500' gibi sabit renk yerine hsl(var(--success)))
  * Uyarı: 'text-warning', 'bg-warning'
  * Kenarlık: 'border-border', 'border-input'

KOYU MOD UYUMU - KESİNLİKLE UYULMALI:
- Tüm renkler hem açık hem koyu modda okunabilir olmalı
- 'text-white' veya 'text-black' KULLANMA, 'text-foreground' kullan
- 'bg-white' veya 'bg-black' KULLANMA, 'bg-background' veya 'bg-card' kullan
- Grafik renkleri için: 'hsl(var(--primary))', 'hsl(var(--destructive))', 'hsl(var(--accent))'
- Gölgeler için: 'shadow-sm', 'shadow-md' (otomatik tema uyumlu)

DEĞER BAZLI RENKLENDIRME:
- Pozitif değerler: 'text-success' veya style={{ color: 'hsl(var(--success))' }}
- Negatif değerler: 'text-destructive' veya style={{ color: 'hsl(var(--destructive))' }}
- Nötr değerler: 'text-muted-foreground'

TAILWIND STİL STANDARTLARI:
- Kart yapısı: 'bg-card rounded-xl border border-border shadow-sm p-4'
- Başlıklar: 'text-foreground font-semibold'
- Alt metinler: 'text-muted-foreground text-sm'
- Hover efektleri: 'hover:bg-muted', 'hover:border-primary'
- Boşluklar: 'space-y-4', 'gap-4', 'p-4', 'px-3 py-2'
- Yuvarlak köşeler: 'rounded-md', 'rounded-lg', 'rounded-xl'
- Animasyonlar: 'transition-all duration-200'

GRAFİK RENKLERİ (Recharts için) - KESİNLİKLE props.colors DİZİSİNİ KULLAN:
- Widget'a "colors" prop'u olarak bir renk dizisi geçilir
- props.colors[0], props.colors[1], ... şeklinde kullan
- Fallback olarak tema renkleri kullanılabilir ama öncelik colors prop'unda
- Örnek: fill: props.colors ? props.colors[0] : 'hsl(var(--primary))'
- Bar/Line/Area/Pie grafiklerde HER ZAMAN props.colors dizisini kullan

GRAFİK RENK KULLANIM ÖRNEĞİ:
React.createElement(Bar, { 
  dataKey: 'value', 
  fill: props.colors && props.colors[0] ? props.colors[0] : 'hsl(var(--primary))' 
})

Çoklu seri için:
data.map(function(item, idx) {
  return React.createElement(Cell, { 
    key: idx, 
    fill: props.colors && props.colors[idx % props.colors.length] ? props.colors[idx % props.colors.length] : 'hsl(var(--primary))' 
  });
})

YEDEK RENK DEĞERLERİ (colors prop yoksa):
- Ana: 'hsl(var(--primary))'
- İkincil: 'hsl(var(--accent))'
- Üçüncül: 'hsl(var(--muted-foreground))'
- Negatif/Hata: 'hsl(var(--destructive))'
- Pozitif/Başarı: 'hsl(var(--success))'

JSX KULLANMA! Şu şekilde yaz:
YANLIŞ (JSX): <div className="p-4">Merhaba</div>
DOĞRU: React.createElement('div', { className: 'p-4' }, 'Merhaba')

YANLIŞ (JSX): <span className="text-primary">{value}</span>
DOĞRU: React.createElement('span', { className: 'text-primary' }, value)

İç içe elementler:
React.createElement('div', { className: 'space-y-4' },
  React.createElement('h2', { className: 'font-bold text-foreground' }, 'Başlık'),
  React.createElement('p', { className: 'text-muted-foreground' }, 'Paragraf')
)

Map kullanımı:
React.createElement('div', null,
  data.map(function(item, idx) {
    return React.createElement('span', { key: idx }, item.name);
  })
)

Koşullu render (tema uyumlu):
value > 0 
  ? React.createElement('span', { className: 'text-success' }, '+' + value)
  : React.createElement('span', { className: 'text-destructive' }, value)

Örnek tam kod (tema uyumlu, colors prop kullanımı):
function Widget({ data, colors }) {
  if (!data || data.length === 0) {
    return React.createElement('div', 
      { className: 'flex items-center justify-center h-48 text-muted-foreground' },
      'Veri bulunamadı'
    );
  }

  // colors prop'undan renk al, yoksa fallback kullan
  var getColor = function(index) {
    return colors && colors[index % colors.length] ? colors[index % colors.length] : 'hsl(var(--primary))';
  };

  var toplam = data.reduce(function(acc, item) {
    return acc + (parseFloat(item.toplambakiye) || 0);
  }, 0);

  var formatCurrency = function(value) {
    if (Math.abs(value) >= 1000000) return '₺' + (value / 1000000).toFixed(1) + 'M';
    if (Math.abs(value) >= 1000) return '₺' + (value / 1000).toFixed(0) + 'K';
    return '₺' + value.toLocaleString('tr-TR');
  };

  // Recharts Bar örneği - colors prop kullanımı
  // React.createElement(Recharts.BarChart, {...},
  //   React.createElement(Recharts.Bar, { 
  //     dataKey: 'value', 
  //     fill: getColor(0) 
  //   })
  // )

  // PieChart Cell örneği - colors prop kullanımı
  // data.map(function(item, idx) {
  //   return React.createElement(Recharts.Cell, { 
  //     key: idx, 
  //     fill: getColor(idx) 
  //   });
  // })

  return React.createElement('div', { className: 'p-4 space-y-4 bg-card rounded-xl border border-border' },
    React.createElement('div', { className: 'text-2xl font-bold text-foreground' }, formatCurrency(toplam)),
    React.createElement('div', { className: 'text-sm text-muted-foreground' }, data.length + ' kayıt'),
    toplam >= 0
      ? React.createElement('span', { className: 'text-success text-sm' }, '↑ Pozitif')
      : React.createElement('span', { className: 'text-destructive text-sm' }, '↓ Negatif')
  );
}

return Widget;

SADECE JavaScript kodu döndür, açıklama veya markdown formatı kullanma.`;

// Kod iyileştirme/chat için system prompt
const getRefinementSystemPrompt = () => `Sen bir React widget geliştirme uzmanısın. Kullanıcının mevcut kodunu isteklerine göre güncelleyeceksin.

ÖNEMLİ KURALLAR:
1. JSX KULLANMA! Sadece React.createElement kullan
2. Mevcut kod yapısını koru, sadece istenen değişiklikleri yap
3. Animasyonlar için Tailwind animate-* sınıfları kullan
4. En sonda "return Widget;" veya benzeri export olmalı
5. Widget fonksiyonu "function Widget({ data, colors })" formatında olmalı - colors prop zorunlu!

=== GRAFİK RENK PALETİ SİSTEMİ (ÇOK ÖNEMLİ!) ===

Widget'a otomatik olarak "colors" prop'u geçirilir. Bu diziden renk almak için:

var getColor = function(index) {
  return colors && colors[index % colors.length] ? colors[index % colors.length] : 'hsl(var(--primary))';
};

- Bar/Line/Area grafiklerinde: fill: getColor(0), stroke: getColor(0)
- PieChart Cell'lerinde: data.map(function(item, idx) { return React.createElement(Cell, { key: idx, fill: getColor(idx) }); })
- Legend renkleri: getColor(0), getColor(1), getColor(2), ...

=== ZORUNLU STİL KURALLARI (HER ZAMAN UYGULANMALI) ===

RENK DEĞİŞİKLİKLERİ İÇİN:
- Sabit renk KULLANMA (text-red-500, bg-blue-600, text-white, bg-black gibi)
- Tema uyumlu CSS değişkenleri kullan:
  * Ana: 'text-primary', 'bg-primary', 'text-primary-foreground'
  * Arka plan: 'bg-background', 'bg-card', 'bg-muted'
  * Metin: 'text-foreground', 'text-muted-foreground'
  * Pozitif: 'text-success', 'bg-success'
  * Negatif: 'text-destructive', 'bg-destructive'
  * Uyarı: 'text-warning', 'bg-warning'
  * Vurgu: 'text-accent', 'bg-accent'
  * Kenarlık: 'border-border'

YEDEK GRAFİK RENKLERİ (colors prop yoksa):
- 'hsl(var(--primary))', 'hsl(var(--destructive))', 'hsl(var(--success))', 'hsl(var(--accent))'

KOYU MOD:
- Tüm değişiklikler hem açık hem koyu modda çalışmalı
- 'text-white/black' yerine 'text-foreground'
- 'bg-white/black' yerine 'bg-background' veya 'bg-card'

JSX KULLANMA! React.createElement kullan:
YANLIŞ: <div>...</div>
DOĞRU: React.createElement('div', null, ...)

Kod güncellemesi yaparken:
- Sadece istenen kısımları değiştir
- Mevcut hesaplamaları ve mantığı koru
- Yeni özellik eklerken mevcut yapıyı bozma
- Renkleri her zaman tema uyumlu yap
- Grafik renkleri için KESİNLİKLE colors prop'unu kullan

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

    console.log("[AI Code Generator] Mod:", mode || 'generate', "- Kod üretiliyor...");

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
        model: "google/gemini-3-flash-preview",
        messages,
        max_tokens: 4000,
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

    console.log("[AI Code Generator] Kod üretildi, uzunluk:", generatedCode.length);

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
