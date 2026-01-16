import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { BarChart3, Server, User, Lock, Loader2 } from 'lucide-react';

export function LoginPage() {
  const { login, isLoading, rememberedCredentials } = useAuth();
  const [formData, setFormData] = useState({
    sunucuAdi: '',
    kullaniciAdi: '',
    sifre: '',
    rememberMe: false,
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (rememberedCredentials) {
      setFormData({
        sunucuAdi: rememberedCredentials.sunucuAdi,
        kullaniciAdi: rememberedCredentials.kullaniciAdi,
        sifre: rememberedCredentials.sifre,
        rememberMe: true,
      });
    }
  }, [rememberedCredentials]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const result = await login({
      sunucuAdi: formData.sunucuAdi,
      kullaniciAdi: formData.kullaniciAdi,
      sifre: formData.sifre,
      rememberMe: formData.rememberMe,
    });

    if (!result.success) {
      setError(result.error || 'Giriş başarısız');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4 glow-border">
            <BarChart3 className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold gradient-text">RotanomBI</h1>
          <p className="text-muted-foreground mt-2">İş Zekası Rapor Portalı</p>
        </div>

        {/* Login Form */}
        <div className="glass-card rounded-2xl p-8 animate-slide-up">
          <h2 className="text-xl font-semibold text-center mb-6">Sisteme Giriş</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Server Name */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Sunucu Adı
              </label>
              <div className="relative">
                <Server className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  value={formData.sunucuAdi}
                  onChange={(e) => setFormData({ ...formData, sunucuAdi: e.target.value })}
                  className="input-field pl-11"
                  placeholder="ornek_sunucu"
                  required
                />
              </div>
            </div>

            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Kullanıcı Adı
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  value={formData.kullaniciAdi}
                  onChange={(e) => setFormData({ ...formData, kullaniciAdi: e.target.value })}
                  className="input-field pl-11"
                  placeholder="kullanici_adi"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Şifre
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="password"
                  value={formData.sifre}
                  onChange={(e) => setFormData({ ...formData, sifre: e.target.value })}
                  className="input-field pl-11"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {/* Remember Me */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.rememberMe}
                onChange={(e) => setFormData({ ...formData, rememberMe: e.target.checked })}
                className="w-4 h-4 rounded border-border bg-secondary text-primary focus:ring-primary focus:ring-offset-background"
              />
              <span className="text-sm text-muted-foreground">Beni Hatırla</span>
            </label>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-lg bg-destructive/20 border border-destructive/30 text-destructive text-sm">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Giriş Yapılıyor...
                </>
              ) : (
                'Giriş Yap'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          © 2024 Rota Yazılım • RotanomBI v3.0
        </p>
      </div>
    </div>
  );
}
