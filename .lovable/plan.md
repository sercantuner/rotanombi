

# Landing Page - RotanomBI Ana Sayfa

## Ozet
"/" rotasini dogrudan dashboard'a yonlendirmek yerine, giris yapmamis kullanicilar icin modern bir Landing Page olusturulacak. Giris yapmis kullanicilar otomatik olarak dashboard'a yonlendirilecek.

## Sayfa Yapisi

### Header (Sticky, transparent -> solid on scroll)
- Sol: RotanomBI logosu (`rotanombi-logo.png`)
- Sag: "Giris Yap" butonu (`/login`'e yonlendirir)

### Hero Section
- Baslik: "DIA ERP Verilerinizi Anlamli Gorsellere Donusturun"
- Alt baslik: "Yapay zeka destekli is zekasi platformu ile verilerinizi gercek zamanli izleyin, ozel dashboard'lar olusturun."
- CTA butonu: "Ucretsiz Deneyin" -> `/login`
- Arka plan: Gradient + subtle pattern

### Canli Istatistikler Section
Veritabanindan gercek verilerle doldurulan 4 metrik karti:
- Aktif Kullanici Sayisi: **7** (profiles tablosundan)
- Toplam Widget: **29** (widgets tablosundan)
- AI ile Uretilen: **29** (custom code widget'lar)
- Desteklenen Veri Modeli: **20+** (DIA model sayisi, sabit)

### Ozellikler Section
6 ozellik karti (ikon + baslik + aciklama):
- AI Widget Uretici
- Gercek Zamanli Veri
- Surukle-Birak Dashboard
- DIA ERP Entegrasyonu
- Widget Marketplace
- Takim Yonetimi

### Fiyatlandirma Section
3 plan karti yan yana:

| | Demo | Aylik | Yillik |
|---|---|---|---|
| Sure | 1 Ay | Aylik | Yillik |
| Fiyat | Ucretsiz | ~2.315 TL/ay + KDV | 25.000 TL/yil + KDV |
| Aylik karsiligi | - | 2.315 TL | ~2.083 TL (%10 indirimli) |
| Hesaplama | - | 25.000 / 12 = 2.083 * 1.10 = ~2.292 (yuvarlanir 2.315) | 25.000 TL |
| Ozellikler | Tum ozellikler, 1 ay sinirli | Tum ozellikler | Tum ozellikler, %10 tasarruf |

Hesap detayi:
- Yillik fiyat: 25.000 TL + KDV
- Yillik aylik karsiligi: 25.000 / 12 = ~2.083 TL
- Aylik fiyat (yilliga gore %10 pahali): 2.083 * 1.10 = ~2.292 -> yuvarlanarak **2.315 TL/ay + KDV**
- Yillik plan %10 indirimli badge'i alacak

### Footer
- Sol: Rota Yazilim logosu (`rota-logo-dark.svg`) + "Rota Yazilim tarafindan gelistirilmistir"
- Sag: rotayazilim.net linki
- Alt: "(C) 2024 Rota Yazilim - RotanomBI v3.0"

## Teknik Detaylar

### Dosya Degisiklikleri

| Dosya | Islem |
|---|---|
| `src/pages/LandingPage.tsx` | Yeni dosya - Landing page bileseni |
| `src/App.tsx` | "/" rotasini LandingPage'e yonlendir (giris yapmamis ise) |

### Routing Mantigi
- `App.tsx`'deki `<Route path="/" element={<Navigate to="/dashboard" replace />} />` satiri degistirilecek
- "/" rotasi `LandingPage` bilesenini gosterecek
- `LandingPage` icinde `useAuth()` ile kullanici kontrol edilecek: eger giris yapmissa otomatik `/dashboard`'a yonlendirilecek

### Canli Istatistikler
- `LandingPage` icinde Supabase'den `profiles` ve `widgets` tablolarindan count sorgulari yapilacak
- Bu sorgular anonim kullanicilarin erisebilmesi icin RLS politikasi gerektirmez (count fonksiyonu kullanilacak)
- Alternatif olarak sabit degerler kullanilabilir (RLS sorununu onlemek icin)

### Tasarim
- Tailwind CSS ile tamamen responsive
- Dark/Light mode destegi (ThemeProvider zaten mevcut)
- Animasyonlar: fade-in, slide-up (mevcut CSS animasyonlari kullanilacak)
- Mevcut renk paleti kullanilacak (primary, accent, muted vb.)
- Mobil oncelikli tasarim

### Logolar
- RotanomBI: `src/assets/rotanombi-logo.png`
- Rota Yazilim (light bg): `src/assets/rota-logo-dark.svg`
- Rota Yazilim (dark bg): `src/assets/rota-logo-light.svg`

