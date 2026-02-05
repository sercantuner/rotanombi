
# AI Widget Oluşturma - Veri Modeli Entegrasyonu Planı

## Özet
AI kod üreticisinin (`CustomCodeWidgetBuilder`) veri kaynaklarını ve aralarındaki ilişkileri (`data_source_relationships`) otomatik olarak anlayıp kullanması ve MultiQueryBuilder'ın basitleştirilmesi.

## Mevcut Durum

### AI Kod Üreticisi (`CustomCodeWidgetBuilder`)
- Sadece seçilen veri kaynağının `last_sample_data` örnek verisini ve alan istatistiklerini AI'ye gönderiyor
- Veri kaynakları arasındaki ilişkiler (`data_source_relationships`) AI prompt'a dahil edilmiyor
- Kullanıcı manuel olarak DIA Model linkleri eklemek zorunda

### MultiQueryBuilder
- Çoklu sorgu seçimi + birleştirme (merge) konfigürasyonu içeriyor
- Kullanıcı LEFT_JOIN, INNER_JOIN, UNION gibi birleştirme tiplerini seçmek zorunda
- Alan eşleştirmesi (leftField → rightField) manuel yapılıyor

---

## Yapılacak Değişiklikler

### 1. AI Prompt'a Veri Modeli Bilgilerini Ekle

**Dosya:** `src/components/admin/CustomCodeWidgetBuilder.tsx`

Yeni bir helper fonksiyon eklenecek:
```text
// Veri modeli bilgilerini topla
const getDataModelContext = useCallback(async () => {
  // Seçili veri kaynağının ilişkilerini getir
  const relationships = getRelationshipsForDataSource(selectedDataSourceId);
  
  // İlişkili diğer veri kaynaklarının adları ve alanları
  const relatedSources = relationships.map(rel => {
    const isSource = rel.source_data_source_id === selectedDataSourceId;
    const relatedId = isSource ? rel.target_data_source_id : rel.source_data_source_id;
    const relatedDS = getDataSourceById(relatedId);
    
    return {
      name: relatedDS?.name,
      relationField: isSource ? rel.source_field : rel.target_field,
      targetField: isSource ? rel.target_field : rel.source_field,
      type: rel.relationship_type,
      crossFilter: rel.cross_filter_direction,
    };
  });
  
  return { relationships, relatedSources };
});
```

**AI Prompt'a Ekleme:**
```text
═══════════════════════════════════════════════════════════════
                    VERİ MODELİ İLİŞKİLERİ
═══════════════════════════════════════════════════════════════

📊 Mevcut Veri Kaynağı: Cari Kart Listesi
   Alanlar: _key, carikodu, unvan, bakiye, toplambakiye, ...

🔗 İlişkili Veri Kaynakları:
   • Cari Hareket → _key_scf_carikart (one_to_many)
   • Fatura Listesi → _key_scf_carikart (one_to_many)  
   • Vade Bakiye → carikodu = carikodu (one_to_one)

💡 Bu ilişkileri kullanarak veri birleştirmesi yapabilirsin.
```

### 2. Örnek Veriler İçin Mevcut Cache Kullan

**Mevcut durum zaten doğru çalışıyor:**
- `selectedDataSource.last_sample_data` önce kontrol ediliyor
- Boşsa DIA API'den çekiliyor

**İyileştirme:** Multi-query modunda da tüm veri kaynaklarının cache'lerini kullan:
```text
// Her sorgu için cache kontrolü
multiQuery.queries.forEach(q => {
  const ds = getDataSourceById(q.dataSourceId);
  if (ds?.last_sample_data) {
    dataMap[q.id] = ds.last_sample_data;
  }
});
```

### 3. MultiQueryBuilder Basitleştirme

**Dosya:** `src/components/admin/MultiQueryBuilder.tsx`

Birleştirme (merge) panelini **opsiyonel** yap veya tamamen kaldır:

```text
Mevcut UI:
┌─────────────────────────────────────────┐
│ Sorgular (3 kaynak mevcut)              │
│ ┌─────────────────────────────────────┐ │
│ │ Sorgu 1: Cari Kart Listesi          │ │
│ │ Sorgu 2: Vade Bakiye               │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Birleştirmeler                          │
│ ┌─────────────────────────────────────┐ │
│ │ Cari Kart ─ LEFT_JOIN ─ Vade Bakiye│ │
│ │ _key        ────────►    carikodu  │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘

Yeni UI (Basitleştirilmiş):
┌─────────────────────────────────────────┐
│ Veri Kaynakları (3 kaynak mevcut)       │
│ ┌─────────────────────────────────────┐ │
│ │ ☑ Cari Kart Listesi                 │ │
│ │ ☑ Vade Bakiye                       │ │
│ │ ☐ Fatura Listesi                    │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ 💡 İlişki bilgileri Veri Modeli'nden    │
│    otomatik alınacak.                   │
└─────────────────────────────────────────┘
```

**Değişiklik detayları:**
- `MergeEditor` bileşenini kaldır veya collapse altına taşı (gelişmiş mod)
- Veri kaynağı seçildiğinde `data_source_relationships` tablosundan ilişkileri otomatik çek
- AI kod üreticisi bu ilişkileri prompt'ta görecek

### 4. WidgetBuilder "Birleştir" Sekmesini Güncelle

**Dosya:** `src/components/admin/WidgetBuilder.tsx`

"Birleştir" sekmesi yerine "Çoklu Kaynak" sekmesi:
- Sadece veri kaynağı checkbox listesi
- İlişki bilgisi badge olarak gösterilsin (otomatik)

---

## Değiştirilecek Dosyalar

| Dosya | Değişiklik |
|-------|------------|
| `src/components/admin/CustomCodeWidgetBuilder.tsx` | `useDataSourceRelationships` hook'unu ekle, prompt'a ilişki bilgilerini dahil et |
| `src/components/admin/MultiQueryBuilder.tsx` | Birleştirme panelini basitleştir, sadece veri kaynağı seçimi kalsın |
| `src/components/admin/WidgetBuilder.tsx` | "Birleştir" sekmesinin başlığını ve açıklamasını güncelle |

---

## Teknik Detaylar

### Hook Bağımlılıkları
```typescript
// CustomCodeWidgetBuilder.tsx'e eklenecek
import { useDataSourceRelationships } from '@/hooks/useDataSourceRelationships';

// Component içinde
const { relationships, getRelationshipsForDataSource } = useDataSourceRelationships();
```

### Prompt Zenginleştirme Örneği
```text
📊 VERİ KAYNAĞI: cari_kart_listesi
   Module: scf/carikart_listele
   Kayıt: 1,247 adet
   
   Seçili Alanlar (197):
   _key, carikodu, unvan, bakiye, toplambakiye, ...
   
   Alan İstatistikleri:
   • toplambakiye (number): min: -5.2M, max: 12.8M, toplam: 847.3M
   • vadegunu (number): min: 0, max: 365, ort: 45

🔗 İLİŞKİLER:
   • scf_carihesap_fisi → _key_scf_carikart (one_to_many)
     Cross-filter: both
   • scf_fatura → _key_scf_carikart (one_to_many)
     Cross-filter: single
     
📋 İLİŞKİLİ VERİ KAYNAKLARI:
   • Cari Hareket Listesi (412 kayıt) - borc, alacak, tarih, fisno
   • Fatura Listesi (89 kayıt) - tarih, toplam, kdv, net
```

---

## Beklenen Faydalar

1. **Daha Akıllı AI Kod Üretimi**: AI, veri kaynakları arasındaki ilişkileri anlayarak daha doğru birleştirme kodu yazabilir
2. **Basitleştirilmiş Kullanıcı Deneyimi**: Manuel merge konfigürasyonu yerine sadece kaynak seçimi
3. **Tutarlılık**: Veri Modeli'nde tanımlanan ilişkiler tüm sistemde aynı şekilde kullanılır
4. **Performans**: Cache'lenmiş veriler öncelikli kullanılır
