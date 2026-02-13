import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme';
import { Mail, Lock, Loader2, UserPlus, ArrowLeft, Shield, Eye, KeyRound, Server, ShieldCheck } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import rotanombiLogo from '@/assets/rotanombi-logo.png';
import rotanombiLogoDark from '@/assets/rotanombi-logo-dark.svg';
import rotaLogoDark from '@/assets/rota-logo-dark.svg';
import rotaLogoLight from '@/assets/rota-logo-light.svg';
import loginBg from '@/assets/login-bg.jpg';

const REMEMBER_KEY = 'rotanombi_remembered_email';

function useRememberedEmail() {
  const stored = localStorage.getItem(REMEMBER_KEY);
  return stored || '';
}

/* ─── Shared form components ─── */

function FormInput({ icon: Icon, ...props }: { icon: React.ElementType } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
      <input
        {...props}
        className="w-full h-12 pl-11 pr-4 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
      />
    </div>
  );
}

function AdminFormInput({ icon: Icon, ...props }: { icon: React.ElementType } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
      <input
        {...props}
        className="w-full h-12 pl-11 pr-4 rounded-xl border border-slate-600 bg-slate-700/50 text-white placeholder:text-slate-500 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all"
      />
    </div>
  );
}

/* ─── Super Admin Login ─── */

function SuperAdminLogin() {
  const { login, resetPassword, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const rememberedEmail = useRememberedEmail();
  const [email, setEmail] = useState(rememberedEmail);
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(!!rememberedEmail);
  const [error, setError] = useState('');
  const [forgotMode, setForgotMode] = useState(false);
  const [success, setSuccess] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (rememberMe) localStorage.setItem(REMEMBER_KEY, email);
    else localStorage.removeItem(REMEMBER_KEY);

    const result = await login(email, password);
    if (!result.success) setError(result.error || 'Giriş başarısız');
    else navigate(location.state?.from?.pathname || '/super-admin-panel', { replace: true });
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const result = await resetPassword(email);
    if (!result.success) setError(result.error || 'İşlem başarısız');
    else setSuccess('Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.');
  };

  return (
    <div className="min-h-screen flex bg-slate-900">
      {/* Left panel – corporate branding */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden">
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 rounded-lg bg-sky-500/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-sky-400" />
            </div>
            <span className="text-white/80 text-sm font-medium tracking-wide uppercase">Yönetim Konsolu</span>
          </div>

          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Sistem Yönetim<br />Merkezi
          </h1>
          <p className="text-slate-400 text-lg max-w-md">
            RotanomBI platformunun merkezi yönetim paneline güvenli erişim sağlayın.
          </p>
        </div>

        <div className="relative z-10 space-y-4">
          {[
            { icon: Eye, label: '7/24 İzleme' },
            { icon: ShieldCheck, label: 'Şifrelenmiş Bağlantı' },
            { icon: Server, label: 'Güvenli Erişim' },
          ].map(({ icon: I, label }) => (
            <div key={label} className="flex items-center gap-3 text-slate-500">
              <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center border border-slate-700">
                <I className="w-4 h-4 text-slate-400" />
              </div>
              <span className="text-sm">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel – form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-slate-900 lg:bg-slate-850">
        <div className="w-full max-w-md">
          {/* Mobile header */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-lg bg-sky-500/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-sky-400" />
            </div>
            <span className="text-white/80 text-sm font-medium tracking-wide uppercase">Yönetim Konsolu</span>
          </div>

          <button
            onClick={() => navigate('/login')}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-300 transition-colors text-sm mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Normal Giriş
          </button>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">
              {forgotMode ? 'Şifre Sıfırlama' : 'Yönetici Girişi'}
            </h2>
            <p className="text-slate-400 text-sm">
              {forgotMode
                ? 'E-posta adresinizi girin, size sıfırlama bağlantısı gönderelim.'
                : 'Yetkili sistem yöneticileri için güvenli giriş noktası'}
            </p>
          </div>

          {forgotMode ? (
            <form onSubmit={handleReset} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">E-posta</label>
                <AdminFormInput icon={Mail} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@example.com" required />
              </div>
              {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>}
              {success && <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">{success}</div>}
              <button type="submit" disabled={isLoading} className="w-full h-12 rounded-xl bg-sky-600 text-white font-medium hover:bg-sky-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <KeyRound className="w-5 h-5" />}
                {isLoading ? 'Gönderiliyor...' : 'Sıfırlama Bağlantısı Gönder'}
              </button>
              <button type="button" onClick={() => { setForgotMode(false); setError(''); setSuccess(''); }} className="w-full text-sm text-slate-400 hover:text-white transition-colors">
                ← Girişe Dön
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">E-posta</label>
                <AdminFormInput icon={Mail} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@example.com" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Şifre</label>
                <AdminFormInput icon={Lock} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={rememberMe} onCheckedChange={(v) => setRememberMe(!!v)} className="border-slate-600 data-[state=checked]:bg-sky-600 data-[state=checked]:border-sky-600" />
                  <span className="text-sm text-slate-400">Beni hatırla</span>
                </label>
                <button type="button" onClick={() => { setForgotMode(true); setError(''); }} className="text-sm text-sky-400 hover:text-sky-300 transition-colors">
                  Şifremi unuttum
                </button>
              </div>

              {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>}

              <button type="submit" disabled={isLoading} className="w-full h-12 rounded-xl bg-sky-600 text-white font-medium hover:bg-sky-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                {isLoading ? <><Loader2 className="w-5 h-5 animate-spin" />Doğrulanıyor...</> : <><Shield className="w-5 h-5" />Yönetici Olarak Giriş Yap</>}
              </button>
            </form>
          )}

          <div className="mt-8 p-3 rounded-xl bg-slate-800/50 border border-slate-700">
            <p className="text-xs text-slate-500 text-center">
              Bu giriş noktası izlenmektedir. Yetkisiz erişim girişimleri kayıt altına alınır.
            </p>
          </div>

          <div className="flex flex-col items-center gap-3 mt-8">
            <a href="https://www.rotayazilim.net" target="_blank" rel="noopener noreferrer" className="opacity-40 hover:opacity-70 transition-opacity">
              <img src={rotaLogoLight} alt="Rota Yazılım" className="h-5 w-auto" />
            </a>
            <p className="text-center text-xs text-slate-500">© 2026 Rota Yazılım • RotanomBI v3.0</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Normal Login ─── */

export function LoginPage() {
  const { login, register, resetPassword, isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { theme } = useTheme();

  const isDark = theme === 'dark';
  const appLogo = isDark ? rotanombiLogoDark : rotanombiLogo;
  const rotaLogo = isDark ? rotaLogoLight : rotaLogoDark;

  const isSuperAdminMode = searchParams.get('mode') === 'super-admin';

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      const from = isSuperAdminMode ? '/super-admin-panel' : (location.state?.from?.pathname || '/dashboard');
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate, location, isSuperAdminMode]);

  const rememberedEmail = useRememberedEmail();
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [rememberMe, setRememberMe] = useState(!!rememberedEmail);
  const [formData, setFormData] = useState({ email: rememberedEmail, password: '', displayName: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (isSuperAdminMode) return <SuperAdminLogin />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (rememberMe) localStorage.setItem(REMEMBER_KEY, formData.email);
    else localStorage.removeItem(REMEMBER_KEY);

    if (isRegisterMode) {
      const result = await register(formData.email, formData.password, formData.displayName);
      if (!result.success) {
        setError(result.error || 'Kayıt başarısız');
      } else {
        setSuccess('Kayıt başarılı! E-posta adresinize doğrulama bağlantısı gönderildi. Lütfen e-postanızı kontrol edin.');
        setIsRegisterMode(false);
        setFormData({ ...formData, password: '', displayName: '' });
      }
    } else {
      const result = await login(formData.email, formData.password);
      if (!result.success) {
        setError(result.error || 'Giriş başarısız');
      } else {
        // Check if super_admin -> redirect accordingly
        const { data: session } = await supabase.auth.getSession();
        const userId = session?.session?.user?.id;
        let defaultPath = '/dashboard';
        if (userId) {
          const { data: isSA } = await supabase.rpc('is_super_admin', { _user_id: userId });
          if (isSA) defaultPath = '/super-admin-panel';
        }
        navigate(location.state?.from?.pathname || defaultPath, { replace: true });
      }
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const result = await resetPassword(formData.email);
    if (!result.success) setError(result.error || 'İşlem başarısız');
    else setSuccess('Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.');
  };

  return (
    <div className="min-h-screen flex">
      {/* Left – background image */}
      <div className="hidden lg:flex lg:w-3/5 relative overflow-hidden">
        <img src={loginBg} alt="Business Intelligence" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent" />
        <div className="absolute bottom-8 left-8 z-10">
          <img src={appLogo} alt="RotanomBI" className="h-10 w-auto mb-3" />
          <p className="text-slate-600 dark:text-slate-300 text-sm font-medium">İş Zekası & Rapor Portalı</p>
        </div>
      </div>

      {/* Right – form */}
      <div className="w-full lg:w-2/5 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="text-center mb-8 lg:hidden">
            <img src={appLogo} alt="RotanomBI" className="h-10 w-auto mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">İş Zekası Rapor Portalı</p>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {forgotMode ? 'Şifre Sıfırlama' : isRegisterMode ? 'Hesap Oluşturun' : 'Hoş Geldiniz'}
            </h1>
            <p className="text-muted-foreground">
              {forgotMode
                ? 'E-posta adresinizi girin, size sıfırlama bağlantısı gönderelim.'
                : isRegisterMode
                  ? 'Yeni hesabınızı oluşturmak için bilgilerinizi girin'
                  : 'Devam etmek için hesabınıza giriş yapın'}
            </p>
          </div>

          {forgotMode ? (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">E-posta</label>
                <FormInput icon={Mail} type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="email@example.com" required />
              </div>
              {error && <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm">{error}</div>}
              {success && <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-600 dark:text-green-400 text-sm">{success}</div>}
              <button type="submit" disabled={isLoading} className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <KeyRound className="w-5 h-5" />}
                {isLoading ? 'Gönderiliyor...' : 'Sıfırlama Bağlantısı Gönder'}
              </button>
              <button type="button" onClick={() => { setForgotMode(false); setError(''); setSuccess(''); }} className="w-full text-sm text-primary hover:underline">
                ← Girişe Dön
              </button>
            </form>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-5">
                {isRegisterMode && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Ad Soyad</label>
                    <FormInput icon={UserPlus} type="text" value={formData.displayName} onChange={e => setFormData({ ...formData, displayName: e.target.value })} placeholder="Ad Soyad" />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">E-posta</label>
                  <FormInput icon={Mail} type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="email@example.com" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Şifre</label>
                  <FormInput icon={Lock} type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} placeholder="••••••••" required minLength={6} />
                </div>

                {!isRegisterMode && (
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={rememberMe} onCheckedChange={(v) => setRememberMe(!!v)} />
                      <span className="text-sm text-muted-foreground">Beni hatırla</span>
                    </label>
                    <button type="button" onClick={() => { setForgotMode(true); setError(''); setSuccess(''); }} className="text-sm text-primary hover:underline">
                      Şifremi unuttum
                    </button>
                  </div>
                )}

                {error && <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm">{error}</div>}
                {success && <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-600 dark:text-green-400 text-sm">{success}</div>}

                <button type="submit" disabled={isLoading} className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                  {isLoading ? <><Loader2 className="w-5 h-5 animate-spin" />{isRegisterMode ? 'Kayıt Yapılıyor...' : 'Giriş Yapılıyor...'}</> : (isRegisterMode ? 'Kayıt Ol' : 'Giriş Yap')}
                </button>
              </form>

              <div className="mt-6 text-center space-y-3">
                <button type="button" onClick={() => { setIsRegisterMode(!isRegisterMode); setError(''); setSuccess(''); }} className="text-sm text-primary hover:underline">
                  {isRegisterMode ? 'Zaten hesabınız var mı? Giriş yapın' : 'Hesabınız yok mu? Kayıt olun'}
                </button>
                <div className="pt-2 border-t border-border">
                  <button type="button" onClick={() => navigate('/login?mode=super-admin')} className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-1 mx-auto">
                    <Shield className="w-3 h-3" />
                    Sistem Yöneticisi Girişi
                  </button>
                </div>
              </div>
            </>
          )}

          <div className="flex flex-col items-center gap-3 mt-12 pt-8 border-t border-border">
            <a href="https://www.rotayazilim.net" target="_blank" rel="noopener noreferrer" className="opacity-60 hover:opacity-100 transition-opacity">
              <img src={rotaLogo} alt="Rota Yazılım" className="h-5 w-auto" />
            </a>
            <p className="text-center text-xs text-muted-foreground">© 2026 Rota Yazılım • RotanomBI v3.0</p>
          </div>
        </div>
      </div>
    </div>
  );
}
