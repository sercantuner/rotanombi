
## Giris Ekrani Yenileme, Yeni Ozellikler ve Markali E-posta Sablonu

Bu plan, onceki onaylanan plani ve markali e-posta sablonunu birlikte kapsar.

---

### 1. AuthContext Guncellemesi

**Dosya:** `src/contexts/AuthContext.tsx`

- `resetPassword(email: string)` fonksiyonu eklenecek
- `supabase.auth.resetPasswordForEmail()` kullanilacak, redirect URL olarak `window.location.origin` ayarlanacak
- AuthContextType interface'ine `resetPassword` eklenecek

### 2. Super Admin Giris Ekrani - Kurumsal Tasarim

**Dosya:** `src/pages/LoginPage.tsx`

Mevcut tek kart tasarimi yerine split-panel kurumsal gorunume gecilecek:

- **Sol panel (lg ve ustu):** Koyu slate gradient arka plan, Shield ikonu ile buyuk kurumsal baslik, "Sistem Yonetim Konsolu" aciklamasi, guvenlik badge'leri (7/24 Izleme, Sifrelenmis Baglanti, Guvenli Erisim)
- **Sag panel:** Temiz beyaz/koyu form alani
- Crown ve emoji gibi oyunsu ogeler kaldirilacak, daha profesyonel bir dil kullanilacak
- Animasyonlu blur efektleri yerine statik, kurumsal dot pattern veya temiz gradient

### 3. "Beni Hatirla" Ozelligi (Her Iki Form)

- Sifre alani altina `rememberMe` checkbox'i eklenecek
- Tiklandiginda `localStorage` key'i: `rotanombi_remembered_email`
- Sayfa yuklendiginde localStorage'dan email okunup otomatik doldurulacak
- Checkbox varsayilan olarak `false`

### 4. "Sifremi Unuttum" Ozelligi (Her Iki Form)

- `forgotPasswordMode` state'i ile ayri gorunum
- Sadece email alani ve "Sifirla" butonu gosterilecek
- AuthContext'teki `resetPassword` fonksiyonu cagirilacak
- Basariliysa "Sifre sifirlama baglantisi e-posta adresinize gonderildi" mesaji
- "Girise don" linki ile normal moda donus

### 5. Kayit Basari Mesaji Guncelleme

- Mevcut "Kayit basarili! Giris yapabilirsiniz." mesaji "Kayit basarili! E-posta adresinize dogrulama baglantisi gonderildi. Lutfen e-postanizi kontrol edin." olarak guncellenecek

### 6. Markali E-posta Sablonu (Auth E-postalari)

Lovable Cloud auth sistemi uzerinden gonderilen e-postalar (dogrulama, sifre sifirlama) icin ozel HTML sablonlari yapilandirilacak. RotanomBI marka renkleri ve logosu kullanilacak.

**Marka Renkleri:**
- Primary (Ana Mavi): `#2B5EA7` (hsl 220 70% 45%)
- Accent (Yesil): `#29997A` (hsl 170 60% 40%)
- Arka Plan: `#F3F5F7`
- Metin: `#1E2A3B`

**Logo:** Publicerisimli logo URL'si olarak `https://rotanombi.lovable.app/favicon.png` kullanilacak (zaten yayinda olan favicon).

**Sablon icerigi:**
- Ust kisim: RotanomBI logosu (ortalanmis)
- Gri arka plan uzerinde beyaz kart yapisi
- Ana mavi renkli CTA butonu
- Alt kisimda "Rota Yazilim" footer'i ve telif hakki bilgisi
- Turkce metin

**Yapilandirilacak sablonlar:**
1. **Confirm Signup** (E-posta dogrulama): "Hosgeldiniz! E-posta adresinizi dogrulamak icin asagidaki butona tiklayin."
2. **Reset Password** (Sifre sifirlama): "Sifrenizi sifirlamak icin asagidaki butona tiklayin."
3. **Magic Link** (Sihirli baglanti): "Giris yapmak icin asagidaki butona tiklayin."

Bu sablonlar `supabase/config.toml` dosyasina auth e-posta yapilandirmasi olarak eklenecek.

---

### Teknik Detaylar

**Degisecek dosyalar:**

1. **`src/contexts/AuthContext.tsx`**
   - `resetPassword` fonksiyonu ve tip taniminin eklenmesi

2. **`src/pages/LoginPage.tsx`**
   - Super Admin bolumu: Split-panel kurumsal tasarim
   - Yeni state'ler: `rememberMe`, `forgotPasswordMode`
   - localStorage entegrasyonu
   - Her iki forma "Beni hatirla" checkbox'i
   - Her iki forma "Sifremi Unuttum" modu
   - Kayit basari mesaji guncellenmesi

3. **`supabase/config.toml`**
   - `[auth]` bolumune `site_url` eklenmesi
   - `[auth.email]` bolumune ozel HTML sablonlari (confirm, recovery, magic_link) ve Turkce konu satirlari eklenmesi

**Yeni state'ler (LoginPage):**
- `rememberMe: boolean`
- `forgotPasswordMode: boolean`

**localStorage key:** `rotanombi_remembered_email`
