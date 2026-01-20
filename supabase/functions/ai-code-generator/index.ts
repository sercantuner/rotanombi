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
3. "function Widget({ data })" formatında tek bir bileşen yaz
4. React hook'ları React.useState, React.useMemo şeklinde kullan (import etme)
5. En sonda "return Widget;" ile bileşeni döndür
6. Veri yoksa "Veri bulunamadı" göster
7. Para birimi için ₺ kullan ve formatla (K, M)
8. Renklerde 'hsl(var(--primary))', 'hsl(var(--destructive))' gibi CSS değişkenleri kullan

JSX KULLANMA! Şu şekilde yaz:
YANLIŞ (JSX): <div className="p-4">Merhaba</div>
DOĞRU: React.createElement('div', { className: 'p-4' }, 'Merhaba')

YANLIŞ (JSX): <span className="text-primary">{value}</span>
DOĞRU: React.createElement('span', { className: 'text-primary' }, value)

İç içe elementler:
React.createElement('div', { className: 'space-y-4' },
  React.createElement('h2', { className: 'font-bold' }, 'Başlık'),
  React.createElement('p', null, 'Paragraf')
)

Map kullanımı:
React.createElement('div', null,
  data.map(function(item, idx) {
    return React.createElement('span', { key: idx }, item.name);
  })
)

Koşullu render:
value > 0 
  ? React.createElement('span', { className: 'text-green-500' }, '+' + value)
  : React.createElement('span', { className: 'text-red-500' }, value)

Örnek tam kod:
function Widget({ data }) {
  if (!data || data.length === 0) {
    return React.createElement('div', 
      { className: 'flex items-center justify-center h-48 text-muted-foreground' },
      'Veri bulunamadı'
    );
  }

  var toplam = data.reduce(function(acc, item) {
    return acc + (parseFloat(item.toplambakiye) || 0);
  }, 0);

  var formatCurrency = function(value) {
    if (Math.abs(value) >= 1000000) return '₺' + (value / 1000000).toFixed(1) + 'M';
    if (Math.abs(value) >= 1000) return '₺' + (value / 1000).toFixed(0) + 'K';
    return '₺' + value.toLocaleString('tr-TR');
  };

  return React.createElement('div', { className: 'p-4 space-y-4' },
    React.createElement('div', { className: 'text-2xl font-bold' }, formatCurrency(toplam)),
    React.createElement('div', { className: 'text-sm text-muted-foreground' }, data.length + ' kayıt')
  );
}

return Widget;

SADECE JavaScript kodu döndür, açıklama veya markdown formatı kullanma.`;

// Kod iyileştirme/chat için system prompt
const getRefinementSystemPrompt = () => `Sen bir React widget geliştirme uzmanısın. Kullanıcının mevcut kodunu isteklerine göre güncelleyeceksin.

ÖNEMLİ KURALLAR:
1. JSX KULLANMA! Sadece React.createElement kullan
2. Mevcut kod yapısını koru, sadece istenen değişiklikleri yap
3. Renk değişiklikleri için Tailwind sınıfları kullan (text-red-500, bg-blue-600 vb.)
4. Animasyonlar için Tailwind animate-* sınıfları kullan
5. En sonda "return Widget;" veya benzeri export olmalı

JSX KULLANMA! React.createElement kullan:
YANLIŞ: <div>...</div>
DOĞRU: React.createElement('div', null, ...)

Kod güncellemesi yaparken:
- Sadece istenen kısımları değiştir
- Mevcut hesaplamaları ve mantığı koru
- Yeni özellik eklerken mevcut yapıyı bozma

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
