
# "Guncel" = DIA ile Birebir Ayni - reconcileKeys Entegrasyonu

## Problem

Simdi "Guncel" gostergesi sadece "yeni/guncellenen kayitlari DIA'dan cektim" anlamina geliyor. Ama DIA'da silinen kayitlar tespit edilmiyor cunku `backgroundRevalidate` fonksiyonu `syncSingleSource` action'ini cagiriyor ve bu action icerisinde `reconcileKeys` calismyor.

Sonuc: Widget yesil ucgen gosteriyor ("Guncel") ama aslinda DB'de DIA'da artik olmayan kayitlar duruyor.

## Cozum

`backgroundRevalidate` isleminin sonunda, sync basarili olduktan sonra `reconcileKeys` action'ini da cagirmak. Boylece:

1. Yeni/guncellenen kayitlar yazilir (syncSingleSource - mevcut)
2. Silinen kayitlar tespit edilip `is_deleted: true` olarak isaretlenir (reconcileKeys - yeni eklenen adim)
3. Ancak ondan sonra gosterge "Guncel" olur

## Teknik Degisiklik

### Degisecek Dosya: `src/hooks/useDynamicWidgetData.tsx`

`backgroundRevalidate` fonksiyonu icinde, `syncSingleSource` basarili olduktan sonra ve DB'den taze veri cekmeden once, `reconcileKeys` cagrisi eklenir:

```typescript
// Mevcut: syncSingleSource cagir
const result = await response.json();

// YENİ: reconcileKeys cagir (silinen kayitlari tespit et)
try {
  const recResponse = await fetch(`${SUPABASE_URL}/functions/v1/dia-data-sync`, {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${session.access_token}`, 
      'Content-Type': 'application/json' 
    },
    body: JSON.stringify({
      action: 'reconcileKeys',
      dataSourceSlug: slug,
      periodNo: effectiveDonem,
    }),
  });
  const recResult = await recResponse.json();
  if (recResult.markedDeleted > 0) {
    console.log(`[Background Revalidate] reconcileKeys: ${recResult.markedDeleted} silinen kayit tespit edildi`);
  }
} catch (recErr) {
  // reconcileKeys hatasi sync'i engellemez - log ve devam
  console.warn(`[Background Revalidate] reconcileKeys error:`, recErr);
}

// Sonra DB'den taze veriyi cek (is_deleted=false filtreli)
const freshDbResult = await fetchFromDatabase(...);
```

### Sira Onemli

```text
1. syncSingleSource  --> Yeni/guncellenen kayitlari yaz
2. reconcileKeys     --> DIA'da olmayan kayitlari is_deleted=true yap
3. fetchFromDatabase --> DB'den is_deleted=false kayitlari cek (temiz veri)
4. dataStatus = "Guncel" --> Simdi gercekten guncel
```

### Performans Etkisi

`reconcileKeys` DIA'dan sadece `_key` listesini ceker (limit: 0, tek alan). Bu genelde hizli bir islemdir (< 2-3 saniye). `backgroundRevalidate` zaten arka planda calisiyor, kullanici bunu fark etmez.

### Edge Case: Period-Independent Kaynaklar

`reconcileKeys` zaten edge function icerisinde `periodNo` parametresini zorunlu tutuyor. Period-independent kaynaklar icin de mevcut donem kodu gonderilir (ayni sekilde `syncSingleSource` de yapiyor).

## Degisecek Dosyalar

| Dosya | Degisiklik |
|-------|------------|
| `src/hooks/useDynamicWidgetData.tsx` | `backgroundRevalidate` icine `reconcileKeys` cagrisi eklenir |

## Sonuc

Widget "Guncel" dediginde artik su garantiyi verir:
- Tum yeni kayitlar DIA'dan cekildi
- Tum guncellenen kayitlar DIA'dan cekildi
- DIA'da silinen kayitlar DB'de `is_deleted: true` olarak isaretlendi
- Widget sadece `is_deleted: false` kayitlari gosteriyor
