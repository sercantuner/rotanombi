// AI Code Generator - Widget kodu üretimi için Lovable AI Gateway kullanır

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, sampleData } = await req.json();

    if (!prompt) {
      throw new Error("Prompt gerekli");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY yapılandırılmamış");
    }

    console.log("[AI Code Generator] Kod üretiliyor...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Sen bir React widget geliştirme uzmanısın. Kullanıcının isteğine göre React bileşeni kodu yazacaksın.

Kurallar:
1. Sadece JavaScript/JSX kodu yaz, TypeScript kullanma
2. "function Widget({ data })" formatında tek bir bileşen yaz
3. React hook'ları React.useState, React.useMemo, React.useCallback şeklinde kullan (import etme)
4. Tailwind CSS sınıflarını kullan
5. Recharts kütüphanesi kullanabilirsin (BarChart, LineChart, PieChart, AreaChart vb.)
6. Lucide ikonları kullanabilirsin
7. En sonda "return Widget;" ile bileşeni döndür
8. Veri yoksa "Veri bulunamadı" göster
9. Para birimi için ₺ kullan ve formatla (K, M)
10. Renklerde hsl(var(--primary)), hsl(var(--destructive)), hsl(var(--muted)) gibi CSS değişkenleri kullan
11. Kod içine yorum satırları ekle

Örnek kod yapısı:
\`\`\`javascript
// Widget açıklaması
function Widget({ data }) {
  // Yükleme kontrolü
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        Veri bulunamadı
      </div>
    );
  }

  // Hesaplamalar
  const hesaplama = React.useMemo(() => {
    // ...
  }, [data]);

  // Render
  return (
    <div className="p-4">
      {/* İçerik */}
    </div>
  );
}

return Widget;
\`\`\`

SADECE JavaScript kodu döndür, açıklama veya markdown formatı kullanma.`,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
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
