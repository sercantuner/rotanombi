
# Widget Marketplace Etiket Seçimi İyileştirmesi

## Problem Analizi

Mevcut sistem 30 aktif etiket içeriyor ve bunlar yatay ScrollArea içinde "pill" şeklinde gösterilmeye çalışılıyor. Bu durum:
- Ekran genişliğine göre taşmalar yaratıyor
- Shift+Click ile çoklu seçim kullanıcı dostu değil
- Tüm etiketler görünür olmadığında keşfedilemez hale geliyor

## Önerilen Çözüm: Popover Tabanlı Etiket Filtresi

Mevcut kategori pill'lerini sadeleştirip, etiket filtreleme için ayrı bir "Etiket Filtrele" butonu ve Popover/Command yapısı kullanacağız.

```text
+--------------------------------------------------+
| [Arama Input...]     [Etiket Filtrele ▾] (3)     |
+--------------------------------------------------+
| [Tümü] [Satış] [Finans] [Stok]  (Popüler 5-6)    |
+--------------------------------------------------+
```

## Teknik Değişiklikler

### 1. Yeni TagFilterPopover Bileşeni

`src/components/marketplace/TagFilterPopover.tsx` dosyası oluşturulacak:

- **Trigger**: "Etiket Filtrele" butonu + seçili etiket sayısı badge
- **Content**: 
  - Command bileşeni ile aranabilir etiket listesi
  - Checkbox ile çoklu seçim
  - "Tümünü Temizle" ve "Uygula" butonları
  - Kategorileri gruplama (ikon bazlı veya alfabetik)

```tsx
// Örnek yapı
<Popover>
  <PopoverTrigger asChild>
    <Button variant="outline">
      <Tag className="h-4 w-4 mr-2" />
      Etiket Filtrele
      {selectedTags.length > 0 && <Badge>{selectedTags.length}</Badge>}
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-80">
    <Command>
      <CommandInput placeholder="Etiket ara..." />
      <CommandList>
        {tags.map(tag => (
          <CommandItem key={tag.slug}>
            <Checkbox checked={selected.includes(tag.slug)} />
            {tag.name}
          </CommandItem>
        ))}
      </CommandList>
    </Command>
  </PopoverContent>
</Popover>
```

### 2. WidgetMarketplacePage Güncelleme

Header alanında yapılacak değişiklikler:

- **Arama satırı**: Search input + TagFilterPopover yan yana
- **Kategori Pills**: Sadece popüler 6-8 kategori gösterilecek (widget sayısına göre sıralı)
- **Seçili etiketler**: Arama altında kompakt badge listesi (zaten mevcut, korunacak)

### 3. Görsel İyileştirmeler

- Popover içinde etiket ikonları gösterilecek
- Widget sayısı her etiketin yanında görünecek
- Seçili etiketler Popover trigger'ında da badge olarak görünecek
- Temizle butonu seçim varken aktif

## Kullanıcı Deneyimi Akışı

1. Kullanıcı "Etiket Filtrele" butonuna tıklar
2. Popover açılır, tüm etiketler aranabilir listede görünür
3. Checkbox ile istediği etiketleri seçer
4. Popover dışına tıklayınca veya "Uygula" ile kapatılır
5. Widget grid seçilen etiketlere göre filtrelenir
6. Seçili etiketler arama altında Badge olarak görünür, tıklanarak kaldırılabilir

## Dosya Değişiklikleri

| Dosya | İşlem | Açıklama |
|-------|-------|----------|
| `src/components/marketplace/TagFilterPopover.tsx` | Yeni | Popover tabanlı etiket seçici |
| `src/pages/WidgetMarketplacePage.tsx` | Güncelle | Yeni popover entegrasyonu, kategori pills sadeleştirme |

## Avantajlar

- 30+ etiket düzgün organize edilir
- Arama ile hızlı etiket bulma
- Çoklu seçim sezgisel (Checkbox)
- Mobil uyumlu
- Shift+Click karmaşıklığı kaldırılır
- Popüler kategoriler hızlı erişim için kalır
