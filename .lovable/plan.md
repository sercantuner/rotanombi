

# Personel Mesai Analizi - Parametre ve Filtreleri Dış Filtre Butonuna Taşıma

## Mevcut Durum

Widget kodu icinde sol panelde ("Ayarlar") su kontroller var:
- **Personel Secimi** (dropdown/select - `selectedUser` state)
- **Calisma Gunleri** (Pt-Pz toggle butonlari - `workingDays` state)
- **Mesai Baslangic/Bitis saati** (time input - `workHours` state)
- **Gec Tolerans / Erken Tolerans** (number input - `tolerance` state)
- **Resmi Tatiller** (checkbox + date input - `useNationalHolidays`, `holidays` state)

Bunlarin hepsi widget icindeki `React.useState` ile yonetiliyor ve sol panelde render ediliyor.

## Hedef

Bu kontrolleri widget kodundan cikarip `Widget.filters` ve `Widget.parameters` metadata tanimlarina tasimak. Boylece kullanici bunlari widget'in sag ust kosesindeki filtre/ayar butonundan (WidgetFiltersButton) yonetebilecek.

## Plan

### 1. Widget koduna `Widget.filters` ve `Widget.parameters` tanimlarini ekle

```javascript
Widget.filters = [
  { key: "personel", label: "Personel", type: "multi-select" }
];

Widget.parameters = [
  { key: "mesaiBaslangic", label: "Mesai Baslangic", type: "text", defaultValue: "08:00" },
  { key: "mesaiBitis", label: "Mesai Bitis", type: "text", defaultValue: "18:00" },
  { key: "gecTolerans", label: "Gec Tolerans (dk)", type: "number", defaultValue: 15, min: 0, max: 60 },
  { key: "erkenTolerans", label: "Erken Tolerans (dk)", type: "number", defaultValue: 15, min: 0, max: 60 },
  { key: "resmiTatiller", label: "Resmi Tatiller", type: "toggle", defaultValue: true }
];
```

### 2. Widget kodunu guncelle

- **Kaldirilacaklar:**
  - `selectedUser` state ve sol paneldeki personel dropdown
  - `workHours` state ve saat inputlari
  - `tolerance` state ve tolerans inputlari
  - `useNationalHolidays` state ve checkbox
  - `showSettings` state ve sol panel toggle butonu
  - Sol panel UI blogu tamamen (250px panel)

- **Korunacaklar:**
  - `holidays` state (ozel tatil ekleme islemi karmasik bir UI gerektirdigi icin widget icinde kalabilir veya basitlestirilir)
  - Tum veri isleme mantigi
  - Grafik ve KPI render kodu
  - Detayli liste popup'i

- **Degistirilecekler:**
  - `selectedUser` yerine `filters.personel` kullanilacak (multi-select array)
  - `workHours.start` yerine `filters.mesaiBaslangic || '08:00'`
  - `workHours.end` yerine `filters.mesaiBitis || '18:00'`
  - `tolerance.late` yerine `filters.gecTolerans || 15`
  - `tolerance.early` yerine `filters.erkenTolerans || 15`
  - `useNationalHolidays` yerine `filters.resmiTatiller !== false`
  - Personel filtreleme multi-select'e donusecek (birden fazla personel secimi)

### 3. Veritabani guncelleme

`widgets` tablosundaki `builder_config` alaninin `widgetFilters` ve `widgetParameters` JSON alanlari guncellenecek. Ayrica `customCode` alani yeni kod ile degistirilecek.

### Teknik Detaylar

- Widget ID: `947b4596-5271-4d21-8aa1-7cf084fa650a`
- Tek bir SQL UPDATE ile `builder_config` guncellenecek
- Sol panel tamamen kaldirilinca widget alani tamamen grafige ayrilacak, daha genis bir gorunum elde edilecek
- `holidays` (ozel tatil ekleme) kompleks bir UI gerektirdigi icin simdilik widget icinde minimal bir sekilde tutulabilir veya tamamen kaldirilabilir

