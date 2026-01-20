// Custom Code Widget Builder - Hardcoded React kodu ile widget oluşturma
// Veri kaynağı seçimi, JSON görüntüleme/indirme, AI kod üretimi, kod editörü ve önizleme

import React, { useState, useEffect, useMemo, useCallback, Component, ErrorInfo, ReactNode } from 'react';
import { useDataSources, DataSource as DataSourceType } from '@/hooks/useDataSources';
import { useWidgetAdmin } from '@/hooks/useWidgets';
import { WidgetFormData, PAGE_CATEGORIES, WIDGET_SIZES } from '@/lib/widgetTypes';
import { DataSourceSelector } from './DataSourceSelector';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Code, Database, Eye, Save, Play, Copy, Check, 
  LayoutGrid, AlertCircle, FileJson, Wand2, X,
  RefreshCw, Loader2, Download, Sparkles, Send, MessageSquare
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// Recharts bileşenlerini scope'a ekle
const RechartsScope = {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
};

// Error Boundary bileşeni
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Widget render error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// Ikon listesi
const AVAILABLE_ICONS = [
  'Wallet', 'CreditCard', 'DollarSign', 'Coins', 'Banknote', 'PiggyBank', 'Receipt', 'Scale',
  'BarChart', 'BarChart2', 'BarChart3', 'LineChart', 'PieChart', 'TrendingUp', 'TrendingDown', 'Activity',
  'Users', 'User', 'UserCheck', 'Building', 'Building2', 'Briefcase', 'Award', 'Target',
  'ShoppingCart', 'ShoppingBag', 'Package', 'Box', 'Truck', 'Store',
  'FileText', 'Files', 'FolderOpen', 'ClipboardList', 'ClipboardCheck',
  'Clock', 'Calendar', 'CalendarDays', 'Timer', 'History',
  'CheckCircle', 'XCircle', 'AlertCircle', 'AlertTriangle', 'Info', 'HelpCircle',
  'Hash', 'Percent', 'Database', 'Server', 'Globe', 'Map', 'MapPin', 'Layers', 'LayoutGrid', 'Grid3x3',
];

interface CustomCodeWidgetBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: () => void;
}

// Dinamik icon renderer
const DynamicIcon = ({ iconName, className }: { iconName: string; className?: string }) => {
  const Icon = (LucideIcons as any)[iconName];
  if (!Icon) return <LayoutGrid className={className} />;
  return <Icon className={className} />;
};

// Varsayılan kod şablonu - React.createElement ile
const getDefaultCodeTemplate = () => `// Widget bileşeni - data prop'u ile veri alır
// props: { data: any[] } - Veri kaynağından gelen veriler

function Widget({ data }) {
  // Yükleme durumu
  if (!data || data.length === 0) {
    return React.createElement('div', 
      { className: 'flex items-center justify-center h-48 text-muted-foreground' },
      'Veri bulunamadı'
    );
  }

  // Örnek hesaplama
  var toplamBakiye = data.reduce(function(acc, item) {
    var bakiye = parseFloat(item.toplambakiye) || 0;
    return acc + bakiye;
  }, 0);

  var formatCurrency = function(value) {
    if (Math.abs(value) >= 1000000) {
      return '₺' + (value / 1000000).toFixed(1) + 'M';
    } else if (Math.abs(value) >= 1000) {
      return '₺' + (value / 1000).toFixed(0) + 'K';
    }
    return '₺' + value.toLocaleString('tr-TR');
  };

  return React.createElement('div', { className: 'p-4' },
    React.createElement('div', { className: 'text-2xl font-bold text-primary' }, formatCurrency(toplamBakiye)),
    React.createElement('div', { className: 'text-sm text-muted-foreground mt-1' }, data.length + ' kayıt')
  );
}

// Widget bileşenini export et
return Widget;
`;

// Vade yaşlandırma şablonu - React.createElement ile
const getAgingChartTemplate = () => `// Vade Yaşlandırma Grafiği
// props: { data: any[] } - Cari vade bakiye verileri

function VadeYaslandirmaWidget({ data }) {
  var periyotState = React.useState('gunluk');
  var periyot = periyotState[0];
  var setPeriyot = periyotState[1];

  if (!data || data.length === 0) {
    return React.createElement('div', 
      { className: 'flex items-center justify-center h-64 text-muted-foreground' },
      'Veri bulunamadı'
    );
  }

  // Verileri hesapla
  var yaslandirma = React.useMemo(function() {
    var vade90Plus = 0, vade90 = 0, vade60 = 0, vade30 = 0, guncel = 0;
    var gelecek30 = 0, gelecek60 = 0, gelecek90 = 0, gelecek90Plus = 0;
    
    var today = new Date();
    
    data.forEach(function(item) {
      var bakiye = parseFloat(item.toplambakiye) || 0;
      if (bakiye <= 0) return;
      
      var vadeTarihi = item.vadetarihi ? new Date(item.vadetarihi) : today;
      var gunFarki = Math.floor((today - vadeTarihi) / (1000 * 60 * 60 * 24));
      
      if (gunFarki > 90) vade90Plus += bakiye;
      else if (gunFarki > 60) vade90 += bakiye;
      else if (gunFarki > 30) vade60 += bakiye;
      else if (gunFarki > 0) vade30 += bakiye;
      else if (gunFarki === 0) guncel += bakiye;
      else if (gunFarki > -30) gelecek30 += bakiye;
      else if (gunFarki > -60) gelecek60 += bakiye;
      else if (gunFarki > -90) gelecek90 += bakiye;
      else gelecek90Plus += bakiye;
    });
    
    return { vade90Plus: vade90Plus, vade90: vade90, vade60: vade60, vade30: vade30, guncel: guncel, gelecek30: gelecek30, gelecek60: gelecek60, gelecek90: gelecek90, gelecek90Plus: gelecek90Plus };
  }, [data]);

  var formatCurrency = function(value) {
    if (value >= 1000000) return '₺' + (value / 1000000).toFixed(1) + 'M';
    if (value >= 1000) return '₺' + (value / 1000).toFixed(0) + 'K';
    return '₺' + value.toLocaleString('tr-TR');
  };

  // Chart verisi oluştur
  var chartData = [
    { name: '90+ Gün', value: yaslandirma.vade90Plus, type: 'gecmis', color: 'hsl(var(--destructive))' },
    { name: '61-90', value: yaslandirma.vade90, type: 'gecmis', color: 'hsl(0 65% 50%)' },
    { name: '31-60', value: yaslandirma.vade60, type: 'gecmis', color: 'hsl(25 95% 53%)' },
    { name: '1-30', value: yaslandirma.vade30, type: 'gecmis', color: 'hsl(38 92% 50%)' },
    { name: 'BUGÜN', value: yaslandirma.guncel, type: 'guncel', color: 'hsl(var(--primary))' },
    { name: '-30', value: yaslandirma.gelecek30, type: 'gelecek', color: 'hsl(142 76% 46%)' },
    { name: '-60', value: yaslandirma.gelecek60, type: 'gelecek', color: 'hsl(142 72% 40%)' },
    { name: '-90', value: yaslandirma.gelecek90, type: 'gelecek', color: 'hsl(142 68% 34%)' },
    { name: '-90+', value: yaslandirma.gelecek90Plus, type: 'gelecek', color: 'hsl(142 65% 28%)' }
  ];

  var toplam = chartData.reduce(function(acc, item) { return acc + item.value; }, 0);
  var gecmisToplam = chartData.filter(function(d) { return d.type === 'gecmis'; }).reduce(function(acc, d) { return acc + d.value; }, 0);
  var gelecekToplam = chartData.filter(function(d) { return d.type === 'gelecek'; }).reduce(function(acc, d) { return acc + d.value; }, 0);
  var maxValue = Math.max.apply(null, chartData.map(function(d) { return d.value; }));

  return React.createElement('div', { className: 'space-y-4' },
    // Periyot seçici ve toplam
    React.createElement('div', { className: 'flex items-center justify-between' },
      React.createElement('div', { className: 'text-sm text-muted-foreground' },
        'Toplam: ',
        React.createElement('span', { className: 'font-semibold text-foreground' }, formatCurrency(toplam))
      ),
      React.createElement('div', { className: 'flex items-center bg-secondary/50 rounded-lg p-1' },
        ['gunluk', 'haftalik', 'aylik'].map(function(p) {
          return React.createElement('button', {
            key: p,
            onClick: function() { setPeriyot(p); },
            className: 'px-3 py-1.5 text-xs font-medium rounded-md transition-colors ' + 
              (periyot === p ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')
          }, p === 'gunluk' ? 'Günlük' : p === 'haftalik' ? 'Haftalık' : 'Aylık');
        })
      )
    ),
    // Legend
    React.createElement('div', { className: 'flex items-center justify-center gap-6 text-xs' },
      React.createElement('div', { className: 'flex items-center gap-2' },
        React.createElement('div', { className: 'w-3 h-3 rounded-sm bg-destructive' }),
        React.createElement('span', { className: 'text-muted-foreground' }, 
          'Vadesi Geçmiş: ',
          React.createElement('span', { className: 'font-semibold text-foreground' }, formatCurrency(gecmisToplam))
        )
      ),
      React.createElement('div', { className: 'flex items-center gap-2' },
        React.createElement('div', { className: 'w-3 h-3 rounded-sm bg-primary' }),
        React.createElement('span', { className: 'text-muted-foreground' }, 
          'Güncel: ',
          React.createElement('span', { className: 'font-semibold text-foreground' }, formatCurrency(yaslandirma.guncel))
        )
      ),
      React.createElement('div', { className: 'flex items-center gap-2' },
        React.createElement('div', { className: 'w-3 h-3 rounded-sm', style: { backgroundColor: 'hsl(142 76% 46%)' } }),
        React.createElement('span', { className: 'text-muted-foreground' }, 
          'Gelecek: ',
          React.createElement('span', { className: 'font-semibold text-foreground' }, formatCurrency(gelecekToplam))
        )
      )
    ),
    // Bar chart (CSS tabanlı)
    React.createElement('div', { className: 'h-48 flex items-end justify-center gap-1' },
      chartData.map(function(item, idx) {
        return React.createElement('div', { key: idx, className: 'flex flex-col items-center gap-1 flex-1' },
          React.createElement('div', {
            className: 'w-full rounded-t transition-all hover:opacity-80 cursor-pointer relative group',
            style: { 
              height: maxValue > 0 ? ((item.value / maxValue) * 100) + '%' : '0%',
              backgroundColor: item.color,
              minHeight: item.value > 0 ? '4px' : '0'
            }
          },
            React.createElement('div', { 
              className: 'absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-card border border-border rounded px-2 py-1 text-xs whitespace-nowrap z-10'
            }, formatCurrency(item.value))
          ),
          React.createElement('span', { className: 'text-[10px] text-muted-foreground whitespace-nowrap' }, item.name)
        );
      })
    ),
    // Uyarı
    yaslandirma.vade90Plus > 0 ? React.createElement('div', { 
      className: 'p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-center gap-3'
    },
      React.createElement('span', { className: 'text-sm text-destructive' },
        React.createElement('span', { className: 'font-semibold' }, formatCurrency(yaslandirma.vade90Plus)),
        ' tutarında 90 günü aşmış alacak var'
      )
    ) : null
  );
}

return VadeYaslandirmaWidget;
`;

// Kod şablonları
const CODE_TEMPLATES = [
  { id: 'basic', name: 'Temel Şablon', code: getDefaultCodeTemplate() },
  { id: 'aging', name: 'Vade Yaşlandırma', code: getAgingChartTemplate() },
];

// Chat mesaj tipi
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function CustomCodeWidgetBuilder({ open, onOpenChange, onSave }: CustomCodeWidgetBuilderProps) {
  const { createWidget, isLoading: isSaving } = useWidgetAdmin();
  const { activeDataSources, getDataSourceById } = useDataSources();
  const { user } = useAuth();
  
  // Widget temel bilgileri
  const [widgetKey, setWidgetKey] = useState('custom_widget_' + Date.now());
  const [widgetName, setWidgetName] = useState('Özel Widget');
  const [widgetDescription, setWidgetDescription] = useState('');
  const [widgetIcon, setWidgetIcon] = useState('Code');
  const [widgetSize, setWidgetSize] = useState<'sm' | 'md' | 'lg' | 'xl' | 'full'>('lg');
  const [defaultPage, setDefaultPage] = useState<'dashboard' | 'satis' | 'finans' | 'cari'>('dashboard');
  
  // Veri kaynağı
  const [selectedDataSourceId, setSelectedDataSourceId] = useState<string | null>(null);
  const selectedDataSource = selectedDataSourceId ? getDataSourceById(selectedDataSourceId) : null;
  
  // JSON veri ve kod
  const [sampleData, setSampleData] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [customCode, setCustomCode] = useState(getDefaultCodeTemplate());
  const [codeError, setCodeError] = useState<string | null>(null);
  
  // AI kod üretimi
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  
  // AI Chat
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  
  // Kopyalama durumu
  const [copied, setCopied] = useState(false);
  
  // Aktif sekme
  const [activeTab, setActiveTab] = useState('datasource');

  // Veri kaynağı seçildiğinde veri çek
  const handleDataSourceSelect = async (dataSource: DataSourceType | null) => {
    if (dataSource) {
      setSelectedDataSourceId(dataSource.id);
      
      // Örnek veri varsa kullan
      if (dataSource.last_sample_data) {
        setSampleData(dataSource.last_sample_data as any[]);
        toast.success('Önbellek verisi yüklendi');
        return;
      }
      
      // Yoksa API'den çek
      await fetchDataFromSource(dataSource);
    } else {
      setSelectedDataSourceId(null);
      setSampleData([]);
    }
  };

  // API'den veri çek
  const fetchDataFromSource = async (dataSource: DataSourceType) => {
    if (!user) {
      toast.error('Oturum bilgisi bulunamadı');
      return;
    }

    setIsLoadingData(true);
    try {
      const response = await supabase.functions.invoke('dia-api-test', {
        body: {
          user_id: user.id,
          module: dataSource.module,
          method: dataSource.method,
          filters: dataSource.filters || [],
          sorts: dataSource.sorts || [],
          selectedcolumns: dataSource.selected_columns || [],
          limit: Math.min(dataSource.limit_count || 100, 100),
        },
      });

      if (response.error) throw response.error;
      if (!response.data?.success) throw new Error(response.data?.error || 'API hatası');

      const data = response.data.sampleData || [];
      setSampleData(data);
      toast.success(`${data.length} kayıt yüklendi`);
    } catch (err: any) {
      toast.error(err.message || 'Veri yüklenemedi');
      setSampleData([]);
    } finally {
      setIsLoadingData(false);
    }
  };

  // Şablon uygula
  const applyTemplate = (templateId: string) => {
    const template = CODE_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      setCustomCode(template.code);
      if (templateId === 'aging') {
        setWidgetName('Vade Yaşlandırma');
        setWidgetIcon('Calendar');
        setWidgetSize('xl');
      }
      toast.success(`"${template.name}" şablonu uygulandı`);
    }
  };

  // Kodu kopyala
  const copyCode = () => {
    navigator.clipboard.writeText(customCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Kod kopyalandı');
  };

  // JSON kopyala
  const copyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(sampleData, null, 2));
    toast.success('JSON kopyalandı');
  };

  // JSON indir
  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(sampleData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedDataSource?.slug || 'data'}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('JSON dosyası indirildi');
  };

  // AI ile kod üret
  const generateCodeWithAI = async () => {
    if (!aiPrompt.trim()) {
      toast.error('Lütfen ne tür bir widget istediğinizi açıklayın');
      return;
    }

    if (sampleData.length === 0) {
      toast.error('Önce veri kaynağı seçip veri yükleyin');
      return;
    }

    setIsGeneratingCode(true);
    try {
      // Veri yapısını analiz et
      const sampleFields = sampleData.length > 0 ? Object.keys(sampleData[0]) : [];
      const fieldTypes: Record<string, string> = {};
      
      if (sampleData.length > 0) {
        sampleFields.forEach(field => {
          const value = sampleData[0][field];
          if (typeof value === 'number') fieldTypes[field] = 'number';
          else if (typeof value === 'boolean') fieldTypes[field] = 'boolean';
          else if (value && !isNaN(Date.parse(value))) fieldTypes[field] = 'date';
          else fieldTypes[field] = 'string';
        });
      }

      const systemPrompt = `Veri yapısı:
- Alanlar: ${sampleFields.join(', ')}
- Tipleri: ${JSON.stringify(fieldTypes)}
- Örnek kayıt: ${JSON.stringify(sampleData[0], null, 2)}

Kullanıcı isteği: ${aiPrompt}`;

      const response = await supabase.functions.invoke('ai-code-generator', {
        body: {
          prompt: systemPrompt,
          sampleData: sampleData.slice(0, 3),
          mode: 'generate'
        },
      });

      if (response.error) throw response.error;
      
      const generatedCode = response.data?.code || response.data?.content;
      if (generatedCode) {
        setCustomCode(generatedCode);
        setChatHistory([
          { role: 'user', content: aiPrompt },
          { role: 'assistant', content: 'Kod üretildi! Aşağıdaki chat alanından değişiklik isteyebilirsiniz.' }
        ]);
        setActiveTab('code');
        toast.success('Kod üretildi! Kod editöründe görüntüleyebilirsiniz.');
      } else {
        throw new Error('AI yanıtı alınamadı');
      }
    } catch (err: any) {
      console.error('AI kod üretimi hatası:', err);
      toast.error(err.message || 'Kod üretilemedi. Lütfen tekrar deneyin.');
    } finally {
      setIsGeneratingCode(false);
    }
  };

  // Chat ile kod iyileştir
  const sendChatMessage = async () => {
    if (!chatInput.trim()) return;
    if (!customCode.trim()) {
      toast.error('Önce bir kod oluşturun');
      return;
    }

    const userMessage = chatInput.trim();
    setChatInput('');
    setIsChatLoading(true);

    // Kullanıcı mesajını ekle
    const updatedHistory: ChatMessage[] = [
      ...chatHistory,
      { role: 'user', content: userMessage }
    ];
    setChatHistory(updatedHistory);

    try {
      const prompt = `Mevcut widget kodu:\n\`\`\`javascript\n${customCode}\n\`\`\`\n\nKullanıcı isteği: ${userMessage}\n\nÖNEMLİ: JSX KULLANMA! Sadece React.createElement kullan. Güncellenmiş kodun tamamını döndür.`;

      const response = await supabase.functions.invoke('ai-code-generator', {
        body: {
          prompt,
          chatHistory: updatedHistory,
          mode: 'refine'
        },
      });

      if (response.error) throw response.error;
      
      const updatedCode = response.data?.code;
      if (updatedCode) {
        setCustomCode(updatedCode);
        setChatHistory([
          ...updatedHistory,
          { role: 'assistant', content: '✅ Kod güncellendi!' }
        ]);
        toast.success('Kod güncellendi');
      } else {
        throw new Error('Kod güncellenemedi');
      }
    } catch (err: any) {
      console.error('Chat hatası:', err);
      setChatHistory([
        ...updatedHistory,
        { role: 'assistant', content: '❌ Hata: ' + (err.message || 'İşlem başarısız') }
      ]);
      toast.error(err.message || 'İşlem başarısız');
    } finally {
      setIsChatLoading(false);
    }
  };

  // Hızlı eylem
  const applyQuickAction = (action: string) => {
    setChatInput(action);
  };

  // Widget kaydet
  const handleSave = async () => {
    if (!widgetKey || !widgetName) {
      toast.error('Widget key ve adı zorunludur');
      return;
    }

    if (!selectedDataSourceId) {
      toast.error('Bir veri kaynağı seçmelisiniz');
      return;
    }

    const moduleValue = (selectedDataSource?.module || 'scf') as 'bcs' | 'fat' | 'gts' | 'scf' | 'sis' | 'stk';
    
    const builderConfig = {
      dataSourceId: selectedDataSourceId,
      dataSourceSlug: selectedDataSource?.slug,
      diaApi: {
        module: moduleValue,
        method: selectedDataSource?.method || 'carikart_listele',
        parameters: {},
      },
      customCode: customCode,
      visualization: {
        type: 'custom' as const,
        isCustomCode: true,
      },
    };

    const formData: WidgetFormData = {
      widget_key: widgetKey,
      name: widgetName,
      description: widgetDescription,
      category: defaultPage,
      type: 'chart',
      data_source: 'genel',
      size: widgetSize,
      icon: widgetIcon,
      default_page: defaultPage,
      default_visible: true,
      available_filters: [],
      default_filters: {},
      min_height: '',
      grid_cols: null,
      is_active: true,
      is_default: false,
      sort_order: 100,
      builder_config: builderConfig,
    };

    const success = await createWidget(formData);
    if (success) {
      toast.success('Widget oluşturuldu!');
      onSave?.();
      onOpenChange(false);
    }
  };

  // Dinamik kod çalıştırma ile önizleme bileşeni
  const PreviewResult = useMemo(() => {
    if (!customCode.trim() || sampleData.length === 0) {
      return { component: null, error: null };
    }
    
    try {
      // Kodu çalıştırılabilir fonksiyona dönüştür
      const fn = new Function(
        'React',
        'data',
        'LucideIcons',
        'Recharts',
        customCode
      );
      
      const WidgetComponent = fn(React, sampleData, LucideIcons, RechartsScope);
      
      if (typeof WidgetComponent !== 'function') {
        return { 
          component: null, 
          error: 'Widget fonksiyonu bulunamadı. Kodunuzda "return Widget;" veya "return VadeYaslandirmaWidget;" olmalı.' 
        };
      }
      
      return { component: WidgetComponent, error: null };
    } catch (err: any) {
      return { component: null, error: err.message };
    }
  }, [customCode, sampleData]);

  // Error state'i güncelle
  useEffect(() => {
    setCodeError(PreviewResult.error);
  }, [PreviewResult.error]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Code className="h-5 w-5 text-primary" />
            Custom Code Widget Builder
          </DialogTitle>
          <DialogDescription>
            Veri kaynağı seçin, kodu yazın ve önizleme yapın
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex">
          {/* Sol Panel - Ayarlar */}
          <div className="w-80 border-r flex flex-col">
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-4">
                {/* Widget Bilgileri */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <LayoutGrid className="h-4 w-4" />
                    Widget Bilgileri
                  </h3>
                  
                  <div className="space-y-2">
                    <Label>Widget Key</Label>
                    <Input
                      value={widgetKey}
                      onChange={(e) => setWidgetKey(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                      placeholder="custom_widget_key"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Widget Adı</Label>
                    <Input
                      value={widgetName}
                      onChange={(e) => setWidgetName(e.target.value)}
                      placeholder="Özel Widget"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Açıklama</Label>
                    <Input
                      value={widgetDescription}
                      onChange={(e) => setWidgetDescription(e.target.value)}
                      placeholder="Widget açıklaması"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label>Boyut</Label>
                      <Select value={widgetSize} onValueChange={(v: any) => setWidgetSize(v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                         <SelectContent>
                          {WIDGET_SIZES.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Sayfa</Label>
                      <Select value={defaultPage} onValueChange={(v: any) => setDefaultPage(v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAGE_CATEGORIES.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* İkon Seçimi */}
                  <div className="space-y-2">
                    <Label>İkon</Label>
                    <div className="grid grid-cols-8 gap-1 p-2 border rounded-lg max-h-32 overflow-y-auto">
                      {AVAILABLE_ICONS.slice(0, 32).map(iconName => (
                        <button
                          key={iconName}
                          onClick={() => setWidgetIcon(iconName)}
                          className={cn(
                            "p-1.5 rounded hover:bg-accent transition-colors",
                            widgetIcon === iconName && "bg-primary/20 ring-1 ring-primary"
                          )}
                          title={iconName}
                        >
                          <DynamicIcon iconName={iconName} className="h-4 w-4" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Veri Kaynağı */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Veri Kaynağı
                  </h3>
                  
                  <DataSourceSelector
                    selectedId={selectedDataSourceId}
                    onSelect={handleDataSourceSelect}
                  />

                  {selectedDataSource && (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {selectedDataSource.module}.{selectedDataSource.method}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => fetchDataFromSource(selectedDataSource)}
                        disabled={isLoadingData}
                      >
                        {isLoadingData ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Kod Şablonları */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Wand2 className="h-4 w-4" />
                    Şablonlar
                  </h3>
                  
                  <div className="space-y-2">
                    {CODE_TEMPLATES.map(template => (
                      <Button
                        key={template.id}
                        variant="outline"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => applyTemplate(template.id)}
                      >
                        <Code className="h-3 w-3 mr-2" />
                        {template.name}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>

          {/* Sağ Panel - Tabs */}
          <div className="flex-1 flex flex-col">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
              <TabsList className="w-full justify-start rounded-none border-b px-4">
                <TabsTrigger value="datasource" className="gap-2">
                  <FileJson className="h-4 w-4" />
                  JSON Veri
                </TabsTrigger>
                <TabsTrigger value="ai" className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  AI Kod Üret
                </TabsTrigger>
                <TabsTrigger value="code" className="gap-2">
                  <Code className="h-4 w-4" />
                  Kod Editörü
                </TabsTrigger>
                <TabsTrigger value="preview" className="gap-2">
                  <Eye className="h-4 w-4" />
                  Önizleme
                </TabsTrigger>
              </TabsList>

              {/* JSON Veri Sekmesi */}
              <TabsContent value="datasource" className="flex-1 p-4 m-0">
                <div className="h-full flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{sampleData.length} kayıt</Badge>
                      {isLoadingData && <Loader2 className="h-4 w-4 animate-spin" />}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={copyJson} disabled={sampleData.length === 0}>
                        <Copy className="h-3 w-3 mr-1" />
                        Kopyala
                      </Button>
                      <Button size="sm" variant="outline" onClick={downloadJson} disabled={sampleData.length === 0}>
                        <Download className="h-3 w-3 mr-1" />
                        İndir
                      </Button>
                    </div>
                  </div>
                  <ScrollArea className="flex-1 border rounded-lg">
                    <pre className="p-4 text-xs font-mono whitespace-pre-wrap">
                      {sampleData.length > 0 
                        ? JSON.stringify(sampleData.slice(0, 10), null, 2)
                        : 'Veri kaynağı seçin...'}
                    </pre>
                  </ScrollArea>
                  {sampleData.length > 10 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      İlk 10 kayıt gösteriliyor (toplam {sampleData.length})
                    </p>
                  )}
                </div>
              </TabsContent>

              {/* AI Kod Üretimi Sekmesi */}
              <TabsContent value="ai" className="flex-1 p-4 m-0">
                <div className="h-full flex flex-col gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      Ne tür bir widget istiyorsunuz?
                    </Label>
                    <Textarea
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="Örnek: Vade yaşlandırma grafiği oluştur. X ekseninde vade dilimleri (90+ gün, 60-90, 30-60, 0-30, bugün, gelecek) Y ekseninde toplam bakiye göster. Vadesi geçmişleri kırmızı tonlarında, gelecekleri yeşil tonlarında renklendir."
                      className="min-h-[120px] resize-none"
                    />
                  </div>

                  {sampleData.length > 0 && (
                    <div className="p-3 rounded-lg bg-muted/50 border">
                      <div className="text-xs text-muted-foreground mb-2">Kullanılabilir alanlar:</div>
                      <div className="flex flex-wrap gap-1">
                        {Object.keys(sampleData[0] || {}).slice(0, 15).map(field => (
                          <Badge key={field} variant="outline" className="text-xs cursor-pointer hover:bg-accent" onClick={() => setAiPrompt(prev => prev + ` ${field}`)}>
                            {field}
                          </Badge>
                        ))}
                        {Object.keys(sampleData[0] || {}).length > 15 && (
                          <Badge variant="secondary" className="text-xs">
                            +{Object.keys(sampleData[0] || {}).length - 15} alan
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Button
                      onClick={generateCodeWithAI}
                      disabled={isGeneratingCode || !aiPrompt.trim() || sampleData.length === 0}
                      className="gap-2"
                    >
                      {isGeneratingCode ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      {isGeneratingCode ? 'Kod Üretiliyor...' : 'AI ile Kod Üret'}
                    </Button>
                    
                    {sampleData.length === 0 && (
                      <span className="text-xs text-muted-foreground">
                        Önce sol panelden veri kaynağı seçin
                      </span>
                    )}
                  </div>

                  <div className="flex-1 p-4 rounded-lg border-2 border-dashed flex items-center justify-center text-muted-foreground">
                    <div className="text-center max-w-md">
                      <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm font-medium mb-2">AI Kod Üretimi</p>
                      <p className="text-xs">
                        Veri yapısını ve istediğiniz görselleştirmeyi açıklayın. 
                        AI, React/JavaScript kodu oluşturacak ve "Kod Editörü" sekmesine yazacak.
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Kod Editörü Sekmesi */}
              <TabsContent value="code" className="flex-1 p-4 m-0">
                <div className="h-full flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">React / JavaScript</Badge>
                    </div>
                    <Button size="sm" variant="outline" onClick={copyCode}>
                      {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                      {copied ? 'Kopyalandı' : 'Kopyala'}
                    </Button>
                  </div>
                  
                  {/* Kod editörü */}
                  <Textarea
                    value={customCode}
                    onChange={(e) => setCustomCode(e.target.value)}
                    className="flex-1 font-mono text-xs resize-none min-h-[200px]"
                    placeholder="Widget kodunuzu buraya yazın..."
                  />
                  
                  {codeError && (
                    <div className="mt-2 p-2 rounded bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      {codeError}
                    </div>
                  )}

                  {/* AI Chat Alanı */}
                  <div className="border-t mt-4 pt-4">
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-primary" />
                      AI ile Kodu Geliştir
                    </h4>
                    
                    {/* Chat geçmişi */}
                    {chatHistory.length > 0 && (
                      <ScrollArea className="h-24 border rounded-lg p-2 mb-2 bg-muted/30">
                        <div className="space-y-2">
                          {chatHistory.map((msg, i) => (
                            <div 
                              key={i} 
                              className={cn(
                                "text-xs p-2 rounded",
                                msg.role === 'user' 
                                  ? 'bg-primary/10 text-primary ml-4' 
                                  : 'bg-secondary text-secondary-foreground mr-4'
                              )}
                            >
                              {msg.content}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                    
                    {/* Input alanı */}
                    <div className="flex gap-2">
                      <Input 
                        value={chatInput} 
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendChatMessage();
                          }
                        }}
                        placeholder="Renkleri değiştir, grafiği düzenle..."
                        disabled={isChatLoading}
                      />
                      <Button 
                        size="sm" 
                        onClick={sendChatMessage}
                        disabled={isChatLoading || !chatInput.trim()}
                      >
                        {isChatLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>

                    {/* Hızlı eylem butonları */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-xs h-7"
                        onClick={() => applyQuickAction('Renkleri daha canlı ve profesyonel yap')}
                      >
                        🎨 Renkler
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => applyQuickAction('Tooltipleri ve metinleri Türkçeleştir')}
                      >
                        🌍 Türkçeleştir
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => applyQuickAction('Hover animasyonları ekle')}
                      >
                        ✨ Animasyon
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => applyQuickAction('Dark mode uyumlu yap')}
                      >
                        🌙 Dark Mode
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Önizleme Sekmesi */}
              <TabsContent value="preview" className="flex-1 p-4 m-0">
                <Card className="h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <DynamicIcon iconName={widgetIcon} className="h-4 w-4" />
                      {widgetName}
                    </CardTitle>
                    {widgetDescription && (
                      <CardDescription>{widgetDescription}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    {sampleData.length === 0 ? (
                      <div className="border-2 border-dashed rounded-lg p-4 min-h-[300px] flex items-center justify-center text-muted-foreground">
                        <div className="text-center">
                          <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Önce veri kaynağı seçin</p>
                        </div>
                      </div>
                    ) : codeError ? (
                      <Alert variant="destructive" className="min-h-[300px]">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          <pre className="text-xs whitespace-pre-wrap mt-2">{codeError}</pre>
                        </AlertDescription>
                      </Alert>
                    ) : PreviewResult.component ? (
                      <div className="min-h-[300px] border rounded-lg p-4">
                        <ErrorBoundary fallback={
                          <div className="text-destructive text-sm flex items-center gap-2">
                            <AlertCircle className="h-4 w-4" />
                            Widget render hatası
                          </div>
                        }>
                          {React.createElement(PreviewResult.component, { data: sampleData })}
                        </ErrorBoundary>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed rounded-lg p-4 min-h-[300px] flex items-center justify-center text-muted-foreground">
                        <div className="text-center">
                          <Code className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Kod yazın veya AI ile üretin</p>
                          <p className="text-xs mt-1">Widget otomatik önizlenecek</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            İptal
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !selectedDataSourceId}>
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Widget Oluştur
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
