
# Veri Olan Ama Gorunmeyen Widget'lari Duzeltme Plani

## Sorunun Kok Nedeni

Widget snapshot sistemi yanlis donem koduyla calisiyor. Senkronizasyon tamamlandiktan sonra frontend'den cagrilan `widget-compute` fonksiyonuna **donem kodu gonderilmiyor**. Fonksiyon varsayilan olarak `donemKodu = 1` kullaniyor, ancak verilerin cogu farkli donemlerde (ornegin donem 3) bulunuyor. Bu nedenle snapshot hesaplamasi 0 kayit buluyor ve widget'lar bos gorunuyor.

## Etkilenen Widget'lar

`rotayazilim:20` sunucusu icin donem 3'te veri olan ama snapshot'ta 0 kayit gosterilen widget'lar:

| Widget | Veri Kaynagi | Gercek Kayit | Snapshot |
|--------|-------------|-------------|----------|
| Negatif Stok Uyarisi | Stok_listesi (donem 3) | 570 | 0 |
| Cari Risk Matrisi | cari_kart_listesi (donem 3) | 613 | 0 |
| Cari Finansal Risk Analizi | Cari_vade_bakiye_listele (donem 3) | 2131 | 0 |
| Banka Varliklari Ozeti | Banka_Hesap_listesi (donem 3) | 5 | 0 |
| Kasa Varlik Ozeti | Kasa Kart Listesi (donem 3) | 1 | 0 |
| + 5 diger cari kart bazli widget | cari_kart_listesi (donem 3) | 613 | 0 |

Bu sorun TUM sunuculari etkiliyor (sadece rotayazilim degil).

## Cozum Adimlari

### Adim 1: Frontend - Donem Kodunu widget-compute'a Gonder

`src/hooks/useSyncOrchestrator.tsx` dosyasinda, `post_sync` cagrisi yapilirken `donemKodu` eklenmeli:

```text
Oncesi:
  const computeBody = {
    sunucuAdi: effectiveSunucu,
    firmaKodu: effectiveFirma,
    syncTrigger: 'post_sync',
  };

Sonrasi:
  const computeBody = {
    sunucuAdi: effectiveSunucu,
    firmaKodu: effectiveFirma,
    donemKodu: profile?.donem_kodu || '1',
    syncTrigger: 'post_sync',
  };
```

### Adim 2: widget-compute - Guvenli Donem Tespit Mekanizmasi

Edge function'da, donem kodu gelmediginde profiller tablosundan dogru donemi otomatik tespit etmeli:

```text
Mevcut (hatali):
  const dk = parseInt(donemKodu) || 1;

Yeni (guvenli):
  let dk = parseInt(donemKodu);
  if (isNaN(dk) || dk < 1) {
    // Profil tablosundan dogru donemi bul
    const { data: profileData } = await sb.from('profiles')
      .select('donem_kodu')
      .eq('dia_sunucu_adi', sunucuAdi)
      .eq('firma_kodu', firmaKodu)
      .limit(1)
      .single();
    dk = parseInt(profileData?.donem_kodu) || 1;
  }
```

### Adim 3: Mevcut Yanlis Snapshot'lari Temizle

Yanlis donem koduyla hesaplanmis mevcut snapshot'lari silerek widget'larin DB'den dogru veriyi cekmesini sagla.

### Adim 4: widget-compute'u Yeniden Deploy Et

Degisiklikler sonrasi edge function'i deploy edip, tum sunucular icin yeniden hesaplama tetikle.

## Teknik Detaylar

### Hatanin Akisi (Mevcut)

```text
Sync tamamlanir
  -> useSyncOrchestrator widget-compute'u cagirir (donemKodu YOK)
  -> widget-compute parseInt(undefined) = NaN, NaN || 1 = 1
  -> fetchCacheData(..., donemKodu=1)
  -> Veri donem 3'te, donem 1'de yok -> 0 kayit
  -> Snapshot raw_row_count=0 olarak kaydedilir
  -> Dashboard snapshot'tan okur -> bos widget
```

### Duzeltilmis Akis

```text
Sync tamamlanir
  -> useSyncOrchestrator widget-compute'u cagirir (donemKodu=3)
  -> widget-compute parseInt("3") = 3
  -> fetchCacheData(..., donemKodu=3)
  -> 570 kayit bulunur
  -> Snapshot raw_row_count=570 olarak kaydedilir
  -> Dashboard snapshot'tan okur -> dogru veri
```

### Degisecek Dosyalar

1. **`src/hooks/useSyncOrchestrator.tsx`** - `donemKodu` parametresini ekle
2. **`supabase/functions/widget-compute/index.ts`** - Donem kodu fallback mekanizmasi ekle
3. **Veritabani** - Mevcut yanlis snapshot'lari temizle (migration)
