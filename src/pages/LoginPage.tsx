import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, Loader2, UserPlus } from 'lucide-react';
import rotanombiLogo from '@/assets/rotanombi-logo.png';
import rotaLogoDark from '@/assets/rota-logo-dark.svg';
import loginBg from '@/assets/login-bg.jpg';

export function LoginPage() {
  const { login, register, isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      const from = location.state?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate, location]);
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
        // Successful login - navigate to intended page
        const from = location.state?.from?.pathname || '/dashboard';
        navigate(from, { replace: true });
      }
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Sol taraf - BI Görseli */}
      <div className="hidden lg:flex lg:w-3/5 relative overflow-hidden">
        <img 
          src={loginBg} 
          alt="Business Intelligence" 
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent" />
        
        {/* Sol alt köşede marka */}
        <div className="absolute bottom-8 left-8 z-10">
          <img 
            src={rotanombiLogo} 
            alt="RotanomBI" 
            className="h-10 w-auto mb-3"
          />
          <p className="text-slate-600 text-sm font-medium">
            İş Zekası & Rapor Portalı
          </p>
        </div>
      </div>

      {/* Sağ taraf - Login Form */}
      <div className="w-full lg:w-2/5 flex items-center justify-center p-6 bg-slate-50">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="text-center mb-8 lg:hidden">
            <img 
              src={rotanombiLogo} 
              alt="RotanomBI" 
              className="h-10 w-auto mx-auto mb-2"
            />
            <p className="text-slate-500 text-sm">İş Zekası Rapor Portalı</p>
          </div>

          {/* Form başlığı */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-800 mb-2">
              {isRegisterMode ? 'Hesap Oluşturun' : 'Hoş Geldiniz'}
            </h1>
            <p className="text-slate-500">
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
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Ad Soyad
                </label>
                <div className="relative">
                  <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    className="w-full h-12 pl-11 pr-4 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    placeholder="Ad Soyad"
                  />
                </div>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                E-posta
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full h-12 pl-11 pr-4 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  placeholder="email@example.com"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Şifre
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full h-12 pl-11 pr-4 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
                {error}
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-green-600 text-sm">
                {success}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
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
          <div className="mt-6 text-center">
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
          </div>

          {/* Footer */}
          <div className="flex flex-col items-center gap-3 mt-12 pt-8 border-t border-slate-200">
            <a 
              href="https://www.rotayazilim.net" 
              target="_blank" 
              rel="noopener noreferrer"
              className="opacity-60 hover:opacity-100 transition-opacity"
            >
              <img 
                src={rotaLogoDark} 
                alt="Rota Yazılım" 
                className="h-5 w-auto"
              />
            </a>
            <p className="text-center text-xs text-slate-400">
              © 2024 Rota Yazılım • RotanomBI v3.0
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
