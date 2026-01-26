
# Kapsamlı Widget Sistemi Temizliği ve Responsive Legend Düzeltmesi

## Özet

Bu plan üç ana hedefi kapsar:
1. **Custom Code Widget'ların Legend Sistemini Düzeltme** - %40 eşik ve toggle butonu
2. **Global Filtre Barının Kalıcı Kaydedilmesi** - Sayfa yenilenince filtreler korunsun  
3. **Standart Grafik Kodlarının Temizlenmesi** - Bar/Line/Area/Pie/Donut kodlarını sil, zorunlulukları AI'a aktar

---

## 1. Custom Code Widget Legend Düzeltmesi

### Sorun
"Müşteri Kaynak Dağılımı" widget'ı `viz_type: 'custom'` tipinde. Veritabanındaki `customCode` alanında kendi React kodunu barındırıyor ve legend'ı sabit `max-h-[120px]` ile gösteriyor. Hiçbir oran kontrolü veya toggle butonu yok.

### Çözüm
AI code generator'ın system prompt'una **Legend Responsive Kuralları** eklenmeli:

**Yeni AI Zorunlulukları (ai-code-generator/index.ts):**

```text
📊 RESPONSIVE LEGEND KURALI (ZORUNLU!)
───────────────────────────────────────────────────────────────────────────────
Pie/Donut/Bar/Line/Area grafiklerinde legend kullanıyorsan:

1. Container yüksekliğini ölç:
   var containerRef = React.useRef(null);
   var legendExpanded = React.useState(false);
   var hasEnoughSpace = React.useState(true);
   
   React.useEffect(function() {
     if (containerRef.current) {
       var containerHeight = containerRef.current.offsetHeight;
       var headerHeight = 56; // Başlık alanı
       var contentHeight = containerHeight - headerHeight;
       
       // Legend için tahmini yükseklik (item sayısı * 24px)
       var legendHeight = chartData.length * 24;
       var threshold = contentHeight * 0.40; // %40 eşik
       
       hasEnoughSpace[1](legendHeight <= threshold);
     }
   }, [chartData]);

2. Toggle butonu ekle (legend sığmıyorsa):
   !hasEnoughSpace[0] && React.createElement('button', {
     onClick: function() { legendExpanded[1](!legendExpanded[0]); },
     className: 'flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground'
   },
     legendExpanded[0] ? 'Gizle' : 'Detaylar',
     React.createElement('span', { 
       className: 'transform transition-transform ' + (legendExpanded[0] ? 'rotate-180' : '') 
     }, '▼')
   )

3. Legend'ı koşullu göster:
   (hasEnoughSpace[0] || legendExpanded[0]) && React.createElement('div', {
     className: 'grid grid-cols-2 gap-1',
     style: !hasEnoughSpace[0] && legendExpanded[0] 
       ? { maxHeight: Math.floor(contentHeight * 0.6), overflowY: 'auto' }
       : undefined
   }, legendItems)

❌ YANLIŞ: Legend'ı sabit yükseklikle göstermek (max-h-[120px] vb.)
✅ DOĞRU: Container yüksekliğinin %40'ından fazla yer kaplıyorsa gizle, toggle ile aç
```

### Mevcut Widget Güncelleme
Veritabanındaki "Müşteri Kaynak Dağılımı" widget'ının (`c0490cae-4d72-4351-94a6-539db016aff0`) `customCode` alanı, bu yeni kurallara uygun olarak güncellenecek.

---

## 2. Global Filtre Barı Kaydetme

### Sorun
Üst filtre barındaki seçimler (Satış Temsilcisi, Şube, Tarih vb.) sayfa yenilendiğinde sıfırlanıyor. `GlobalFilterContext` içindeki state hafızada tutuluyor, veritabanına kalıcı olarak kaydedilmiyor.

### Çözüm

**GlobalFilterContext.tsx değişiklikleri:**

```typescript
// 1. Otomatik kaydetme için debounce mekanizması
const debouncedSave = useCallback(
  debounce(async (filtersToSave: GlobalFilters) => {
    if (!user) return;
    
    // __auto__ isimli özel bir preset olarak kaydet
    const filtersWithoutLocked = { ...filtersToSave, _diaAutoFilters: [] };
    
    await supabase
      .from('page_filter_presets')
      .upsert({
        user_id: user.id,
        page_id: pageId || null,
        name: '__auto__',
        filters: JSON.parse(JSON.stringify(filtersWithoutLocked)),
        is_default: true,
      }, { onConflict: 'user_id,page_id,name' });
  }, 1000),
  [user, pageId]
);

// 2. Filtre değiştiğinde otomatik kaydet
useEffect(() => {
  if (user && !isLoading) {
    debouncedSave(filters);
  }
}, [filters, user, isLoading, debouncedSave]);

// 3. Sayfa yüklendiğinde __auto__ preset'i yükle
useEffect(() => {
  async function loadAutoFilters() {
    if (!user) return;
    
    const { data } = await supabase
      .from('page_filter_presets')
      .select('filters')
      .eq('user_id', user.id)
      .eq('name', '__auto__')
      .eq('page_id', pageId || null)
      .maybeSingle();
    
    if (data?.filters) {
      setFilters(prev => ({
        ...prev,
        ...(data.filters as Partial<GlobalFilters>),
      }));
    }
  }
  
  loadAutoFilters();
}, [user, pageId]);
```

**Kaydetme Mantığı:**
- Filtre her değiştiğinde 1 saniye debounce ile otomatik kaydet
- `__auto__` isimli özel preset olarak `page_filter_presets` tablosuna yaz
- Sayfa yüklendiğinde önce `__auto__` preset'i kontrol et ve yükle
- Zorunlu filtreler (`_diaAutoFilters`) preset'e dahil edilmez

---

## 3. Standart Grafik Kodlarının Silinmesi

### Kaldırılacak Kodlar (BuilderWidgetRenderer.tsx)

Aşağıdaki bloklar tamamen silinecek çünkü artık tüm widget'lar CustomCode olarak oluşturuluyor:

| Satır Aralığı | İçerik | Açıklama |
|---------------|--------|----------|
| 762-826 | Bar Chart renderer | Standart bar grafik kodu |
| 829-890 | Line Chart renderer | Standart çizgi grafik kodu |
| 893-954 | Area Chart renderer | Standart alan grafik kodu |
| 957-983 | Pie/Donut Chart delegasyonu | PieDonutChartWithResponsiveLegend çağrısı |
| 100-391 | PieDonutChartWithResponsiveLegend | Tam bileşen |
| 985-1017 | Table renderer | Standart tablo kodu |
| 1020-1133 | Pivot Table renderer | Pivot tablo kodu |
| 1136-1178 | List renderer | Standart liste kodu |

### Korunacak Kodlar

| İçerik | Neden |
|--------|-------|
| KPI renderer (656-689) | KPI widget'ları hala standart sistem kullanıyor |
| Custom Code renderer (692-759) | Tüm grafik/tablo widget'ları artık buradan render ediliyor |
| ErrorBoundary (50-70) | Custom code hataları için gerekli |
| calculateAggregation (73-91) | Pivot gibi yapılar için hala kullanılabilir |
| formatValue (401-425) | KPI formatlaması için gerekli |
| DynamicIcon (394-398) | İkon render için gerekli |

### AI'a Aktarılacak Zorunluluklar

Silinen kodlardaki best practice'ler AI system prompt'una eklenmeli:

**ai-code-generator/index.ts'e eklenecekler:**

```text
📊 GRAFİK ZORUNLULUKları (SİLİNEN STANDART KODLARDAN)
───────────────────────────────────────────────────────────────────────────────

1. DRILL-DOWN DESTEĞİ:
   - Grafik elementlerine onClick ekle
   - onClick'te bar/slice/dot ismi ve field bilgisini yakala
   - Modal veya detay görünümü aç
   
   ✅ Örnek (Bar):
   React.createElement(Recharts.Bar, { 
     dataKey: 'value',
     onClick: function(entry) { 
       console.log('Tıklanan:', entry.name); 
       // Detay modalı açılabilir
     }
   })

2. TARİH EKSENİ FORMATLAMA:
   - 10'dan fazla tarih varsa etiketleri -45 derece döndür
   - interval hesapla: Math.floor(data.length / 10)
   - textAnchor: 'end' kullan
   
   ✅ Örnek:
   React.createElement(Recharts.XAxis, { 
     dataKey: 'name',
     angle: data.length > 10 ? -45 : 0,
     textAnchor: data.length > 10 ? 'end' : 'middle',
     height: data.length > 10 ? 60 : 30,
     interval: data.length > 15 ? Math.floor(data.length / 10) : 0
   })

3. GRADİENT RENK (TARİH SERİLERİ):
   - 10'dan fazla tarih noktası varsa gradient uygula
   - İlk renk: colors[0] tam opaklık
   - Son renk: colors[0] %30 opaklık (veya açık ton)

4. LEGEND POZİSYONU:
   - legendPosition: 'top' | 'bottom' | 'hidden'
   - verticalAlign prop'u ile ayarla
   - Varsayılan: 'bottom'

5. RESPONSIVE TOOLTIP:
   - contentStyle ile tema uyumlu stil
   - backgroundColor: 'hsl(var(--card))'
   - border: '1px solid hsl(var(--border))'
   - borderRadius: '8px'
   - zIndex: 9999 (ZORUNLU!)

6. KART YAPISI:
   - Ana container: 'p-4 bg-card rounded-xl border border-border h-full flex flex-col'
   - Header: 'flex items-center justify-between gap-2'
   - Content: 'flex-1 min-h-0'
```

---

## Dosya Değişiklikleri

| Dosya | İşlem | Değişiklik |
|-------|-------|------------|
| `supabase/functions/ai-code-generator/index.ts` | Güncelle | Legend kuralları + silinen grafik zorunlulukları ekle |
| `src/contexts/GlobalFilterContext.tsx` | Güncelle | Filtre auto-save + load mantığı ekle |
| `src/components/dashboard/BuilderWidgetRenderer.tsx` | Büyük silme | Bar/Line/Area/Pie/Donut/Table/Pivot/List blokları sil |
| Widget DB (customCode alanı) | SQL güncelleme | "Müşteri Kaynak Dağılımı" legend kodu düzelt |

---

## Uygulama Sırası

1. **AI Code Generator Güncellemesi** - Tüm yeni kuralları system prompt'a ekle
2. **GlobalFilterContext Güncelleme** - Auto-save/load mekanizması
3. **BuilderWidgetRenderer Temizliği** - Standart grafik kodlarını sil
4. **Widget DB Güncellemesi** - Mevcut custom widget'ları düzelt
5. **Test** - Dashboard'da legend davranışını ve filtre kalıcılığını test et

---

## Teknik Notlar

### Debounce Kütüphanesi
`GlobalFilterContext` için debounce fonksiyonu gerekli. Mevcut projede lodash yoksa basit bir debounce helper yazılabilir:

```typescript
function debounce<T extends (...args: any[]) => any>(fn: T, delay: number) {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}
```

### Veritabanı Unique Constraint
`page_filter_presets` tablosunda `(user_id, page_id, name)` üzerinde unique constraint olmalı. Yoksa migration gerekebilir.

### Widget Kodları Güncellenecek
Mevcut custom code widget'ların legend mantığı manuel olarak güncellenmeli veya AI ile yeniden üretilmeli. Alternatif olarak, widget builder'da bir "Legend davranışı" ayarı eklenip mevcut widget'lara uygulanabilir.
