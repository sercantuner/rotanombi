

# Nakit Akis Yaslandirmasi - Gun Kaydirma Parametresi

## Amac

Widget'a bir "Gun Kaydirma" sayisal parametresi eklenecek. Bu parametre, vade tarihlerini belirtilen gun sayisi kadar ileri (+) veya geri (-) kaydirarak "what-if" analizi yapilmasini saglayacak. Ornegin kullanici "+15" girerse tum vade tarihleri 15 gun ileri alinir, boylece 15 gun sonrasinin yaslandirma gorunumu simule edilir.

## Degisiklikler

Tek dosya degisecek: **widgets tablosundaki** `ai_nakit_akis_yaslandirma_analizi_mlb4hlt1` widget'inin `builder_config.customCode` alani.

### 1. Parametre Tanimi Ekleme

`Widget.parameters` dizisine yeni bir `number` tipinde parametre eklenecek:

```
{ key: 'gunKaydirma', label: 'Gun Kaydirma', type: 'number', defaultValue: 0 }
```

### 2. Parametre Okuma

Widget fonksiyonunun basinda mevcut `filters` okumasina ek olarak:

```
var gunKaydirma = parseInt(filters && filters.gunKaydirma) || 0;
```

### 3. Vade Tarihi Manipulasyonu

`processedData` icindeki hareket dongusu icerisinde, `vadeTarihi` hesaplandiktan hemen sonra gun kaydirma uygulanacak:

```
// Mevcut kod:
var vadeTarihi = new Date(vadeStr);
vadeTarihi.setHours(0, 0, 0, 0);

// Yeni ekleme:
vadeTarihi.setDate(vadeTarihi.getDate() + gunKaydirma);
```

Bu sayede `diffDays` hesabi otomatik olarak kaydirmali tarihe gore yapilacak ve tum bucket dagilimlari buna gore degisecek.

### 4. Baslik Gostergesi

`gunKaydirma !== 0` ise baslikta kucuk bir bilgilendirme etiketi gosterilecek (ornek: "+15 gun kaydirma" veya "-10 gun kaydirma").

### 5. useMemo Bagimliliklari

`processedData`'nin `useMemo` bagimlilik dizisine `gunKaydirma` eklenecek, boylece parametre degistiginde grafik yeniden hesaplanacak.

## Teknik Detay

- Widget'in `builder_config` JSON'u veritabaninda guncellenerek `customCode` degistirilecek
- Mevcut filtreler ve parametreler korunacak, sadece yeni parametre eklenmis olacak
- `number` tipi parametre, widget filtre panelinde sayi girisi olarak gosterilecek
- Varsayilan deger 0 oldugu icin mevcut davranis degismeyecek

