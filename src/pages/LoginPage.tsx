import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme';
import { Mail, Lock, Loader2, UserPlus, Crown, ArrowLeft, Shield } from 'lucide-react';
import rotanombiLogo from '@/assets/rotanombi-logo.png';
import rotanombiLogoDark from '@/assets/rotanombi-logo-dark.svg';
import rotaLogoDark from '@/assets/rota-logo-dark.svg';
import rotaLogoLight from '@/assets/rota-logo-light.svg';
import loginBg from '@/assets/login-bg.jpg';

export function LoginPage() {
  const { login, register, isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { theme } = useTheme();
  
  const isDark = theme === 'dark';
  const appLogo = isDark ? rotanombiLogoDark : rotanombiLogo;
  const rotaLogo = isDark ? rotaLogoLight : rotaLogoDark;

  // Super Admin modu kontrolü
  const isSuperAdminMode = searchParams.get('mode') === 'super-admin';
  
  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      const from = isSuperAdminMode ? '/super-admin-panel' : (location.state?.from?.pathname || '/dashboard');
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate, location, isSuperAdminMode]);

  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    displayName: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (isRegisterMode) {
      const result = await register(formData.email, formData.password, formData.displayName);
      if (!result.success) {
        setError(result.error || 'Kayıt başarısız');
      } else {
        setSuccess('Kayıt başarılı! Giriş yapabilirsiniz.');
        setIsRegisterMode(false);
        setFormData({ ...formData, password: '', displayName: '' });
      }
    } else {
      const result = await login(formData.email, formData.password);
      if (!result.success) {
        setError(result.error || 'Giriş başarısız');
      } else {
        const from = isSuperAdminMode ? '/super-admin-panel' : (location.state?.from?.pathname || '/dashboard');
        navigate(from, { replace: true });
      }
    }
  };

  // Super Admin modu için özel tasarım
  if (isSuperAdminMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
        {/* Animated background pattern */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-amber-600/10 rounded-full blur-3xl animate-pulse delay-1000" />
        </div>
        
        <div className="relative w-full max-w-md">
          {/* Back button */}
          <button
            onClick={() => navigate('/login')}
            className="absolute -top-12 left-0 flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Normal Giriş
          </button>

          {/* Super Admin Card */}
          <div className="bg-slate-800/50 backdrop-blur-xl border border-amber-500/20 rounded-2xl p-8 shadow-2xl">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 mb-4 shadow-lg shadow-amber-500/25">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <div className="flex items-center justify-center gap-2 mb-2">
                <Crown className="w-5 h-5 text-amber-500" />
                <span className="text-xs font-medium text-amber-500 uppercase tracking-wider">
                  Sistem Yöneticisi
                </span>
                <Crown className="w-5 h-5 text-amber-500" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Yönetici Girişi</h1>
              <p className="text-slate-400 text-sm">Bu alan yetkili sistem yöneticileri içindir</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">E-posta</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full h-12 pl-11 pr-4 rounded-xl border border-slate-600 bg-slate-700/50 text-white placeholder:text-slate-500 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all"
                    placeholder="admin@example.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Şifre</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full h-12 pl-11 pr-4 rounded-xl border border-slate-600 bg-slate-700/50 text-white placeholder:text-slate-500 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all"
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-medium hover:from-amber-600 hover:to-amber-700 focus:ring-2 focus:ring-amber-500/50 focus:ring-offset-2 focus:ring-offset-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Doğrulanıyor...
                  </>
                ) : (
                  <>
                    <Shield className="w-5 h-5" />
                    Yönetici Olarak Giriş Yap
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <p className="text-xs text-amber-400/80 text-center">
                🔒 Bu giriş noktası izlenmektedir. Yetkisiz erişim girişimleri kayıt altına alınır.
              </p>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3 mt-8">
            <a href="https://www.rotayazilim.net" target="_blank" rel="noopener noreferrer" className="opacity-40 hover:opacity-70 transition-opacity">
              <img src={rotaLogoLight} alt="Rota Yazılım" className="h-5 w-auto" />
            </a>
            <p className="text-center text-xs text-slate-500">© 2026 Rota Yazılım • RotanomBI v3.0</p>
          </div>
        </div>
      </div>
    );
  }

  // Normal login sayfası - tema duyarlı
  return (
    <div className="min-h-screen flex">
      {/* Sol taraf - BI Görseli */}
      <div className="hidden lg:flex lg:w-3/5 relative overflow-hidden">
        <img 
          src={loginBg} 
          alt="Business Intelligence" 
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent" />
        
        <div className="absolute bottom-8 left-8 z-10">
          <img src={appLogo} alt="RotanomBI" className="h-10 w-auto mb-3" />
          <p className="text-slate-600 dark:text-slate-300 text-sm font-medium">
            İş Zekası & Rapor Portalı
          </p>
        </div>
      </div>

      {/* Sağ taraf - Login Form */}
      <div className="w-full lg:w-2/5 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="text-center mb-8 lg:hidden">
            <img src={appLogo} alt="RotanomBI" className="h-10 w-auto mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">İş Zekası Rapor Portalı</p>
          </div>

          {/* Form başlığı */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {isRegisterMode ? 'Hesap Oluşturun' : 'Hoş Geldiniz'}
            </h1>
            <p className="text-muted-foreground">
              {isRegisterMode 
                ? 'Yeni hesabınızı oluşturmak için bilgilerinizi girin' 
                : 'Devam etmek için hesabınıza giriş yapın'}
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Display Name (only for register) */}
            {isRegisterMode && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Ad Soyad</label>
                <div className="relative">
                  <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type="text"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    className="w-full h-12 pl-11 pr-4 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    placeholder="Ad Soyad"
                  />
                </div>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">E-posta</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full h-12 pl-11 pr-4 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  placeholder="email@example.com"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Şifre</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full h-12 pl-11 pr-4 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                {error}
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-600 dark:text-green-400 text-sm">
                {success}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {isRegisterMode ? 'Kayıt Yapılıyor...' : 'Giriş Yapılıyor...'}
                </>
              ) : (
                isRegisterMode ? 'Kayıt Ol' : 'Giriş Yap'
              )}
            </button>
          </form>

          {/* Toggle Mode */}
          <div className="mt-6 text-center space-y-3">
            <button
              type="button"
              onClick={() => {
                setIsRegisterMode(!isRegisterMode);
                setError('');
                setSuccess('');
              }}
              className="text-sm text-primary hover:underline"
            >
              {isRegisterMode 
                ? 'Zaten hesabınız var mı? Giriş yapın' 
                : 'Hesabınız yok mu? Kayıt olun'}
            </button>
            
            {/* Super Admin Login Hint */}
            <div className="pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => navigate('/login?mode=super-admin')}
                className="text-xs text-muted-foreground hover:text-amber-600 transition-colors flex items-center justify-center gap-1 mx-auto"
              >
                <Crown className="w-3 h-3" />
                Sistem Yöneticisi Girişi
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-col items-center gap-3 mt-12 pt-8 border-t border-border">
            <a 
              href="https://www.rotayazilim.net" 
              target="_blank" 
              rel="noopener noreferrer"
              className="opacity-60 hover:opacity-100 transition-opacity"
            >
              <img src={rotaLogo} alt="Rota Yazılım" className="h-5 w-auto" />
            </a>
            <p className="text-center text-xs text-muted-foreground">
              © 2026 Rota Yazılım • RotanomBI v3.0
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
