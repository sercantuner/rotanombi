
# Kelime Bulutu (WordCloud) Widget İyileştirme Planı

## Mevcut Durum ve Sorunlar

1. **Kelimeler çok küçük**: Mevcut kod `value` değerleri düşük (1-100 arası sayım sayıları) ve `fontSize` ayarı optimize edilmemiş
2. **Bulut hissi yok**: Kelime rotasyonları yok, düz yatay dizilim var
3. **Görsel efekt eksik**: Animasyon, tooltip ve renk çeşitliliği yetersiz

## Yapılacak Değişiklikler

### 1. Font Boyutu Büyütme
Mevcut widget'ta `fontSizes: [12, 60]` gibi sınırlı bir aralık var. Bunu daha etkileyici hale getirmek için:
- Minimum font: 18px
- Maksimum font: 80px
- Value bazlı logaritmik ölçekleme (düşük değerleri bile okunabilir yapar)

### 2. Kelime Rotasyonu Ekleme
Gerçek bir "bulut" hissi için rastgele rotasyonlar eklenecek:
- 0°, 90°, -90°, 45°, -45° gibi açılar
- Spiral layout: "archimedean" (klasik bulut şekli)

### 3. Renk Çeşitliliği
Widget'ın `colors` prop'undan gelen palete göre renkler dağıtılacak:
- Her kategori farklı renk tonunda
- Hover efekti ile parlaklık

### 4. Tooltip Aktifleştirme
Kütüphanenin dahili tooltip özelliği açılacak:
- `enableTooltip: true`
- Kelimeye tıklandığında detay gösterimi

### 5. Animasyon Ekleme
`AnimatedWordRenderer` kullanarak kelimeler animasyonlu girecek:
- Fade-in + scale efekti
- Ardışık gecikme (staggered animation)

## Teknik Değişiklikler

### Widget customCode Güncellemesi

```javascript
// ÖNCE (sorunlu):
fontSize: function(word) { return word.value * 0.5; }
// fontSizes: [12, 60]  - çok küçük

// SONRA (düzeltilmiş):
fontSize: function(word, index) {
  var minSize = 20;
  var maxSize = 80;
  var logScale = Math.log(word.value + 1) / Math.log(maxValue + 1);
  return minSize + (maxSize - minSize) * logScale;
}

// Rotasyon ekleme:
rotate: function(word, index) {
  var angles = [0, 0, 0, 90, -90, 45, -45];
  return angles[index % angles.length];
}

// Spiral ve padding:
spiral: "archimedean"
padding: 3
```

### Veritabanı Güncellemesi
- `widgets` tablosundaki `builder_config.customCode` alanı güncellenecek
- Widget ID: `1ed12635-ed3c-433f-bd6a-5801c79ebe43`

## Görsel Sonuç

Değişiklikler sonrası:
- Kelimeler 20-80px arası boyutlarda
- Farklı açılarda döndürülmüş (bulut efekti)
- Renkli ve animasyonlu giriş
- Hover'da tooltip ile kelime detayı
- Gerçek bir "word cloud" görünümü
