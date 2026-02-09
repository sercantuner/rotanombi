import { ExternalLink } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import rotaLogoDark from '@/assets/rota-logo-dark.svg';
import rotaLogoLight from '@/assets/rota-logo-light.svg';
import diaLogoDark from '@/assets/dia-logo-dark.svg';
import diaLogoLight from '@/assets/dia-logo-light.svg';

export default function LandingFooter() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const rotaLogo = isDark ? rotaLogoLight : rotaLogoDark;
  const diaLogo = isDark ? diaLogoDark : diaLogoLight;

  return (
    <footer className="border-t border-border bg-muted/20 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <img src={rotaLogo} alt="Rota Yazılım" className="h-7" />
          <span className="text-sm text-muted-foreground">Rota Yazılım tarafından geliştirilmiştir</span>
        </div>
        <div className="flex items-center gap-4">
          <img src={diaLogo} alt="DIA ERP" className="h-6 opacity-60" />
          <a href="https://rotayazilim.net" target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            rotayazilim.net
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
      <div className="max-w-6xl mx-auto mt-6 pt-6 border-t border-border text-center">
        <p className="text-xs text-muted-foreground">© 2026 Rota Yazılım – RotanomBI v3.0</p>
      </div>
    </footer>
  );
}
