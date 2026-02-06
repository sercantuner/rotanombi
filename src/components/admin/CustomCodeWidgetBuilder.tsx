// Custom Code Widget Builder - Wizard Tabanlı Widget Oluşturma
// 4 Adım: 1) Veri Kaynağı 2) AI Kod Üret 3) Kod Düzenle 4) Önizle & Kaydet
// v2.1 - Wizard/Stepper yapısı + Kategori seçimi

import React, { useState, useEffect, useMemo, useCallback, Component, ErrorInfo, ReactNode } from 'react';
import { useDataSources, DataSource as DataSourceType } from '@/hooks/useDataSources';
import { useDataSourceRelationships } from '@/hooks/useDataSourceRelationships';
import { useWidgetAdmin, useWidgets } from '@/hooks/useWidgets';
import { useWidgetCategories } from '@/hooks/useWidgetCategories';
import { WidgetFormData, WIDGET_SIZES, TechnicalNotes } from '@/lib/widgetTypes';
import { MultiQueryConfig, DiaModelReference, AIRequirement, DEFAULT_AI_REQUIREMENTS, extractModelNameFromUrl } from '@/lib/widgetBuilderTypes';
import html2canvas from 'html2canvas';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import { DataSourceSelector } from './DataSourceSelector';
import { MultiQueryBuilder } from './MultiQueryBuilder';
import { ExampleWidgetPickerModal } from './ExampleWidgetPickerModal';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Slider } from '@/components/ui/slider';
import { 
  Code, Database, Eye, Save, Play, Copy, Check, 
  LayoutGrid, AlertCircle, FileJson, Wand2, X,
  RefreshCw, Loader2, Download, Sparkles, Send, MessageSquare, 
  Link2, Layers, ChevronLeft, ChevronRight, CheckCircle2, Circle,
  Search, Folder
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  // Ek bileşenler (Custom Code widget'larda kullanılıyor)
  ComposedChart,
  ScatterChart, Scatter,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  FunnelChart, Funnel, LabelList,
  ReferenceLine, ReferenceDot, ReferenceArea,
  Treemap,
  // RadialBarChart - yeni eklendi
  RadialBarChart, RadialBar
} from 'recharts';

// Recharts bileşenlerini scope'a ekle
const RechartsScope = {
  // Temel grafikler
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell,
  // Composed (karma) grafik
  ComposedChart,
  // Scatter (dağılım) grafik
  ScatterChart, Scatter,
  // Radar grafik
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  // Funnel (huni) grafik
  FunnelChart, Funnel, LabelList,
  // RadialBar grafik
  RadialBarChart, RadialBar,
  // Treemap
  Treemap,
  // Referans çizgileri ve işaretleyiciler
  ReferenceLine, ReferenceDot, ReferenceArea,
  // Ortak bileşenler
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
};

// Leaflet harita bileşenleri - Builder preview'da opsiyonel (lazy)
let MapScope: any = null;
 let NivoScope: any = null;

const EmptyMapScope = {
  MapContainer: () => null,
  TileLayer: () => null,
  Marker: () => null,
  Popup: () => null,
  CircleMarker: () => null,
  Polyline: () => null,
  Polygon: () => null,
  // Hooks - boş placeholder
  useMap: () => null,
  useMapEvents: () => null,
  useMapEvent: () => null,
  L: null,
};
 
 // Nivo placeholder
 const EmptyNivoScope = {
   // Mevcut
   ResponsiveSankey: () => null,
   ResponsiveSunburst: () => null,
   ResponsiveChord: () => null,
   ResponsiveRadar: () => null,
   ResponsiveFunnel: () => null,
   ResponsiveChoropleth: () => null,
   ResponsiveGeoMap: () => null,
   
   // Yeni bileşenler
   ResponsiveBar: () => null,
   ResponsiveLine: () => null,
   ResponsivePie: () => null,
   ResponsiveScatterPlot: () => null,
   ResponsiveCalendar: () => null,
   ResponsiveCalendarCanvas: () => null,
   ResponsiveCirclePacking: () => null,
   ResponsiveCirclePackingCanvas: () => null,
   ResponsiveHeatMap: () => null,
   ResponsiveHeatMapCanvas: () => null,
   ResponsiveMarimekko: () => null,
   ResponsiveNetwork: () => null,
   ResponsiveNetworkCanvas: () => null,
   ResponsiveParallelCoordinates: () => null,
   ResponsiveParallelCoordinatesCanvas: () => null,
   ResponsiveRadialBar: () => null,
   ResponsiveStream: () => null,
   ResponsiveSwarmPlot: () => null,
   ResponsiveSwarmPlotCanvas: () => null,
   ResponsiveTreeMap: () => null,
   ResponsiveTreeMapCanvas: () => null,
   ResponsiveTreeMapHtml: () => null,
   ResponsiveVoronoi: () => null,
   ResponsiveWaffle: () => null,
   ResponsiveWaffleCanvas: () => null,
   ResponsiveWaffleHtml: () => null,
   ResponsiveBump: () => null,
   ResponsiveAreaBump: () => null,
   ResponsiveBullet: () => null,
   
   useTheme: () => ({}),
   getTheme: () => ({})
 };

const initMapScope = async () => {
  if (MapScope) return MapScope;

  try {
    const [reactLeaflet, L] = await Promise.all([
      import('react-leaflet'),
      import('leaflet'),
    ]);

    // Leaflet CSS
    await import('leaflet/dist/leaflet.css');

    // Default marker icon fix
    // @ts-ignore
    delete L.default.Icon.Default.prototype._getIconUrl;
    L.default.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    MapScope = {
      MapContainer: reactLeaflet.MapContainer,
      TileLayer: reactLeaflet.TileLayer,
      Marker: reactLeaflet.Marker,
      Popup: reactLeaflet.Popup,
      CircleMarker: reactLeaflet.CircleMarker,
      Polyline: reactLeaflet.Polyline,
      Polygon: reactLeaflet.Polygon,
      // Hooks
      useMap: reactLeaflet.useMap,
      useMapEvents: reactLeaflet.useMapEvents,
      useMapEvent: reactLeaflet.useMapEvent,
      L: L.default,
    };

    return MapScope;
  } catch (e) {
    console.warn('Leaflet yüklenemedi (builder preview):', e);
    return null;
  }
};
 
 // Nivo lazy loading
 const initNivoScope = async () => {
   if (NivoScope) return NivoScope;
   
   try {
     const [
       nivoSankey, nivoSunburst, nivoChord, nivoRadar, nivoGeo, nivoFunnel,
       nivoBar, nivoLine, nivoPie, nivoScatterplot, nivoCalendar,
       nivoCirclePacking, nivoHeatmap, nivoMarimekko, nivoNetwork,
       nivoParallelCoordinates, nivoRadialBar, nivoStream, nivoSwarmplot,
       nivoTreemap, nivoVoronoi, nivoWaffle, nivoBump, nivoBullet,
       _nivoCore
     ] = await Promise.all([
       import('@nivo/sankey'),
       import('@nivo/sunburst'),
       import('@nivo/chord'),
       import('@nivo/radar'),
       import('@nivo/geo'),
       import('@nivo/funnel'),
       import('@nivo/bar'),
       import('@nivo/line'),
       import('@nivo/pie'),
       import('@nivo/scatterplot'),
       import('@nivo/calendar'),
       import('@nivo/circle-packing'),
       import('@nivo/heatmap'),
       import('@nivo/marimekko'),
       import('@nivo/network'),
       import('@nivo/parallel-coordinates'),
       import('@nivo/radial-bar'),
       import('@nivo/stream'),
       import('@nivo/swarmplot'),
       import('@nivo/treemap'),
       import('@nivo/voronoi'),
       import('@nivo/waffle'),
       import('@nivo/bump'),
       import('@nivo/bullet'),
       import('@nivo/core')
     ]);
     
     NivoScope = {
       // Mevcut bileşenler
       ResponsiveSankey: nivoSankey.ResponsiveSankey,
       ResponsiveSunburst: nivoSunburst.ResponsiveSunburst,
       ResponsiveChord: nivoChord.ResponsiveChord,
       ResponsiveRadar: nivoRadar.ResponsiveRadar,
       ResponsiveFunnel: nivoFunnel.ResponsiveFunnel,
       ResponsiveChoropleth: nivoGeo.ResponsiveChoropleth,
       ResponsiveGeoMap: nivoGeo.ResponsiveGeoMap,
       
       // Yeni bileşenler
       ResponsiveBar: nivoBar.ResponsiveBar,
       ResponsiveLine: nivoLine.ResponsiveLine,
       ResponsivePie: nivoPie.ResponsivePie,
       ResponsiveScatterPlot: nivoScatterplot.ResponsiveScatterPlot,
       ResponsiveCalendar: nivoCalendar.ResponsiveCalendar,
       ResponsiveCalendarCanvas: nivoCalendar.ResponsiveCalendarCanvas,
       ResponsiveCirclePacking: nivoCirclePacking.ResponsiveCirclePacking,
       ResponsiveCirclePackingCanvas: nivoCirclePacking.ResponsiveCirclePackingCanvas,
       ResponsiveHeatMap: nivoHeatmap.ResponsiveHeatMap,
       ResponsiveHeatMapCanvas: nivoHeatmap.ResponsiveHeatMapCanvas,
       ResponsiveMarimekko: nivoMarimekko.ResponsiveMarimekko,
       ResponsiveNetwork: nivoNetwork.ResponsiveNetwork,
       ResponsiveNetworkCanvas: nivoNetwork.ResponsiveNetworkCanvas,
       ResponsiveParallelCoordinates: nivoParallelCoordinates.ResponsiveParallelCoordinates,
       ResponsiveParallelCoordinatesCanvas: nivoParallelCoordinates.ResponsiveParallelCoordinatesCanvas,
       ResponsiveRadialBar: nivoRadialBar.ResponsiveRadialBar,
       ResponsiveStream: nivoStream.ResponsiveStream,
       ResponsiveSwarmPlot: nivoSwarmplot.ResponsiveSwarmPlot,
       ResponsiveSwarmPlotCanvas: nivoSwarmplot.ResponsiveSwarmPlotCanvas,
       ResponsiveTreeMap: nivoTreemap.ResponsiveTreeMap,
       ResponsiveTreeMapCanvas: nivoTreemap.ResponsiveTreeMapCanvas,
       ResponsiveTreeMapHtml: nivoTreemap.ResponsiveTreeMapHtml,
       ResponsiveVoronoi: nivoVoronoi.ResponsiveVoronoi,
       ResponsiveWaffle: nivoWaffle.ResponsiveWaffle,
       ResponsiveWaffleCanvas: nivoWaffle.ResponsiveWaffleCanvas,
       ResponsiveWaffleHtml: nivoWaffle.ResponsiveWaffleHtml,
       ResponsiveBump: nivoBump.ResponsiveBump,
       ResponsiveAreaBump: nivoBump.ResponsiveAreaBump,
       ResponsiveBullet: nivoBullet.ResponsiveBullet,
       
       // Tema oluşturucu (dark/light mode uyumu)
       getTheme: (isDark: boolean) => ({
         background: 'transparent',
         textColor: isDark ? 'hsl(0 0% 90%)' : 'hsl(0 0% 20%)',
         fontSize: 11,
         axis: {
           domain: { line: { stroke: isDark ? 'hsl(0 0% 30%)' : 'hsl(0 0% 70%)', strokeWidth: 1 } },
           ticks: { 
             line: { stroke: isDark ? 'hsl(0 0% 30%)' : 'hsl(0 0% 70%)', strokeWidth: 1 },
             text: { fill: isDark ? 'hsl(0 0% 60%)' : 'hsl(0 0% 40%)' }
           },
           legend: { text: { fill: isDark ? 'hsl(0 0% 70%)' : 'hsl(0 0% 30%)' } }
         },
         grid: { line: { stroke: isDark ? 'hsl(0 0% 20%)' : 'hsl(0 0% 90%)', strokeWidth: 1 } },
         legends: { text: { fill: isDark ? 'hsl(0 0% 70%)' : 'hsl(0 0% 30%)' } },
         tooltip: {
           container: {
             background: isDark ? 'hsl(220 10% 15%)' : 'hsl(0 0% 100%)',
             color: isDark ? 'hsl(0 0% 90%)' : 'hsl(0 0% 20%)',
             fontSize: 12,
             borderRadius: 4,
             boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
           }
         },
         labels: { text: { fill: isDark ? 'hsl(0 0% 90%)' : 'hsl(0 0% 20%)' } }
       })
     };
     
     return NivoScope;
   } catch (e) {
     console.warn('Nivo yüklenemedi (builder preview):', e);
     return null;
   }
 };

// Custom widget kodlarının kullanabilmesi için UI scope (Dialog vb.)
const UIScope = {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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

// Widget tipi
interface WidgetForEdit {
  id: string;
  widget_key: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  size: string;
  default_page: string;
  builder_config?: any;
}

interface CustomCodeWidgetBuilderProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSave?: () => void;
  editingWidget?: WidgetForEdit | null;
  editWidgetId?: string; // URL'den gelen widget id
  isFullPage?: boolean; // Tam sayfa modu
  onClose?: () => void; // Tam sayfa modunda geri butonu için
}

// Dinamik icon renderer
const DynamicIcon = ({ iconName, className }: { iconName: string; className?: string }) => {
  const Icon = (LucideIcons as any)[iconName];
  if (!Icon) return <LayoutGrid className={className} />;
  return <Icon className={className} />;
};

// Varsayılan kod şablonu
const getDefaultCodeTemplate = () => `// Widget bileşeni - data ve colors prop'u ile veri alır

function Widget({ data, colors }) {
  if (!data || data.length === 0) {
    return React.createElement('div', 
      { className: 'flex items-center justify-center h-48 text-muted-foreground' },
      'Veri bulunamadı'
    );
  }

  // Renk helper - ZORUNLU
  var getColor = function(index) {
    return colors && colors[index % colors.length] 
      ? colors[index % colors.length] 
      : 'hsl(var(--primary))';
  };

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
    React.createElement('div', { className: 'text-2xl font-bold text-foreground' }, formatCurrency(toplamBakiye)),
    React.createElement('div', { className: 'text-sm text-muted-foreground mt-1' }, data.length + ' kayıt')
  );
}

return Widget;
`;

// Wizard adım tanımları
const WIZARD_STEPS = [
  { id: 0, key: 'data', title: 'Veri Kaynağı', icon: Database, description: 'Widget bilgileri ve veri seçimi' },
  { id: 1, key: 'ai', title: 'AI Kod Üret', icon: Sparkles, description: 'AI ile kod üretimi (opsiyonel)' },
  { id: 2, key: 'code', title: 'Kod Düzenle', icon: Code, description: 'Kodu düzenle ve iyileştir' },
  { id: 3, key: 'preview', title: 'Önizle & Kaydet', icon: Eye, description: 'Son kontrol ve kaydetme' },
];

// Chat mesaj tipi
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function CustomCodeWidgetBuilder({ open, onOpenChange, onSave, editingWidget, editWidgetId, isFullPage = false, onClose }: CustomCodeWidgetBuilderProps) {
  const { widgets } = useWidgets();
  const { createWidget, updateWidget, isLoading: isSaving } = useWidgetAdmin();
  const { activeDataSources, getDataSourceById, isLoading: isDataSourcesLoading, dataSources } = useDataSources();
  const { relationships, getRelationshipsForDataSource } = useDataSourceRelationships();
  const { activeCategories, isLoading: isCategoriesLoading, getCategoryBySlug } = useWidgetCategories();
  const { user } = useAuth();
  const { impersonatedUserId, isImpersonating } = useImpersonation();
  
  // Wizard state
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  
  // Widget temel bilgileri
  const [widgetKey, setWidgetKey] = useState('custom_widget_' + Date.now());
  const [widgetName, setWidgetName] = useState('Özel Widget');
  const [widgetDescription, setWidgetDescription] = useState('');
  const [widgetIcon, setWidgetIcon] = useState('Code');
  const [widgetSize, setWidgetSize] = useState<'sm' | 'md' | 'lg' | 'xl' | 'full'>('lg');
  const [widgetCategory, setWidgetCategory] = useState<string>('dashboard');
  

  // Veri kaynağı (tek kaynak modu)
  const [selectedDataSourceId, setSelectedDataSourceId] = useState<string | null>(null);
  const selectedDataSource = selectedDataSourceId ? getDataSourceById(selectedDataSourceId) : null;
  
  // Multi-query modu
  const [isMultiQueryMode, setIsMultiQueryMode] = useState(false);
  const [multiQuery, setMultiQuery] = useState<MultiQueryConfig | null>(null);
  const [mergedQueryData, setMergedQueryData] = useState<Record<string, any[]>>({});
  
  // JSON veri ve kod
  const [sampleData, setSampleData] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [customCode, setCustomCode] = useState(getDefaultCodeTemplate());
  const [jsonPreviewCount, setJsonPreviewCount] = useState(10);
  const [codeError, setCodeError] = useState<string | null>(null);

  // Custom code preview'da Map scope (opsiyonel)
  const [mapScope, setMapScope] = useState<any>(EmptyMapScope);
   const [nivoScope, setNivoScope] = useState<any>(EmptyNivoScope);

  useEffect(() => {
    let cancelled = false;
    const needsMap = /(^|[^a-zA-Z0-9_])Map\./.test(customCode);
    if (!needsMap) {
      setMapScope(EmptyMapScope);
      return;
    }
    initMapScope().then((scope) => {
      if (!cancelled) setMapScope(scope || EmptyMapScope);
    });
    return () => {
      cancelled = true;
    };
  }, [customCode]);
   
   // Nivo lazy loading
   useEffect(() => {
     let cancelled = false;
     if (!customCode || !/(^|[^a-zA-Z0-9_])Nivo\./.test(customCode)) {
       setNivoScope(EmptyNivoScope);
       return;
     }
     initNivoScope().then((scope) => {
       if (cancelled) return;
       setNivoScope(scope || EmptyNivoScope);
     });
     return () => { cancelled = true; };
   }, [customCode]);
  
  // AI kod üretimi
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  
  // AI Chat
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  
  // Kopyalama durumu
  const [copied, setCopied] = useState(false);
  
  // Widget şablon seçimi
  const [showWidgetTemplates, setShowWidgetTemplates] = useState(false);
  
  // DIA Model Referansları
  const [diaModelLinks, setDiaModelLinks] = useState<DiaModelReference[]>([]);
  const [newModelLink, setNewModelLink] = useState('');
  const [showModelLinks, setShowModelLinks] = useState(false);
  
  // AI Zorunlulukları
  const [aiRequirements, setAiRequirements] = useState<AIRequirement[]>(DEFAULT_AI_REQUIREMENTS);
  const [customRules, setCustomRules] = useState<string[]>([]);
  const [newCustomRule, setNewCustomRule] = useState('');
  const [showAiRequirements, setShowAiRequirements] = useState(false);
  
  // Örnek Widget Seçimi Modal
  const [showExampleWidgetModal, setShowExampleWidgetModal] = useState(false);
  const [selectedExampleWidget, setSelectedExampleWidget] = useState<string | null>(null);
  
  // Tam Prompt Görüntüleme Modal
  const [showFullPromptModal, setShowFullPromptModal] = useState(false);
  const [fullPromptContent, setFullPromptContent] = useState('');
  
  // AI Metadata State (YENİ)
  const [aiSuggestedTags, setAiSuggestedTags] = useState<string[]>([]);
  const [shortDescription, setShortDescription] = useState('');
  const [longDescription, setLongDescription] = useState('');
  const [technicalNotes, setTechnicalNotes] = useState<TechnicalNotes | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isCapturingPreview, setIsCapturingPreview] = useState(false);

  // Adım geçiş kontrolü
  const canProceed = useCallback((step: number) => {
    switch(step) {
      case 0: // Veri Kaynağı
        if (isMultiQueryMode) {
          return multiQuery && multiQuery.queries.length > 0 && Object.keys(mergedQueryData).length > 0;
        }
        return sampleData.length > 0;
      case 1: // AI Kod Üret - opsiyonel
        return true;
      case 2: // Kod Düzenle
        return !codeError && customCode.trim().length > 0;
      case 3: // Önizle & Kaydet
        return true;
      default:
        return false;
    }
  }, [isMultiQueryMode, multiQuery, mergedQueryData, sampleData, codeError, customCode]);

  // Adım değiştir
  const goToStep = (step: number) => {
    if (step < currentStep || completedSteps.includes(step) || canProceed(currentStep)) {
      // Mevcut adımı tamamlandı olarak işaretle
      if (!completedSteps.includes(currentStep) && canProceed(currentStep)) {
        setCompletedSteps(prev => [...prev, currentStep]);
      }
      setCurrentStep(step);
    }
  };

  const handleNext = () => {
    if (currentStep < WIZARD_STEPS.length - 1 && canProceed(currentStep)) {
      if (!completedSteps.includes(currentStep)) {
        setCompletedSteps(prev => [...prev, currentStep]);
      }
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  // Düzenleme modunda widget verilerini yükle
  useEffect(() => {
    // dataSources henüz yüklenmediyse bekle
    if (editingWidget && open && !isDataSourcesLoading && dataSources.length > 0) {
      const config = editingWidget.builder_config;
      setWidgetKey(editingWidget.widget_key);
      setWidgetName(editingWidget.name);
      setWidgetDescription(editingWidget.description || '');
      setWidgetIcon(editingWidget.icon || 'Code');
      setWidgetSize((editingWidget.size as any) || 'lg');
      // Kategori olarak yükle (eski default_page değerini kullan)
      setWidgetCategory(editingWidget.default_page || 'dashboard');
      
      if (config?.customCode) {
        setCustomCode(config.customCode);
        // Düzenleme modunda ilk 3 adımı tamamlandı say
        setCompletedSteps([0, 1, 2]);
        setCurrentStep(2); // Kod düzenleme adımına git
      }
      
      // DIA Model linkleri yükle
      if (config?.diaModelLinks && Array.isArray(config.diaModelLinks)) {
        setDiaModelLinks(config.diaModelLinks);
      }
      
      // AI zorunlulukları yükle
      if (config?.aiRequirements && Array.isArray(config.aiRequirements)) {
        setAiRequirements(prev => prev.map(r => ({
          ...r,
          isActive: r.isDefault || config.aiRequirements.includes(r.id)
        })));
      }
      
      // Özel AI kuralları yükle
      if (config?.customAiRules && Array.isArray(config.customAiRules)) {
        setCustomRules(config.customAiRules);
      }
      
      if (config?.multiQuery) {
        setIsMultiQueryMode(true);
        setMultiQuery(config.multiQuery);
        loadMultiQueryData(config.multiQuery);
      } else if (config?.dataSourceId) {
        setIsMultiQueryMode(false);
        setSelectedDataSourceId(config.dataSourceId);
        const ds = getDataSourceById(config.dataSourceId);
        if (ds) {
          if (ds.last_sample_data) {
            setSampleData(ds.last_sample_data as any[]);
          } else {
            fetchDataFromSource(ds);
          }
        }
      }
    } else if (!editingWidget && open) {
      // Yeni widget - form sıfırla
      setWidgetKey('custom_widget_' + Date.now());
      setWidgetName('Özel Widget');
      setWidgetDescription('');
      setWidgetIcon('Code');
      setWidgetSize('lg');
      setWidgetCategory('dashboard');
      setCustomCode(getDefaultCodeTemplate());
      setSelectedDataSourceId(null);
      setIsMultiQueryMode(false);
      setMultiQuery(null);
      setMergedQueryData({});
      setSampleData([]);
      setChatHistory([]);
      setCurrentStep(0);
      setCompletedSteps([]);
      // Yeni alanları sıfırla
      setDiaModelLinks([]);
      setNewModelLink('');
      setAiRequirements(DEFAULT_AI_REQUIREMENTS);
      setCustomRules([]);
      setNewCustomRule('');
      setSelectedFilterFields([]);
    }
  }, [editingWidget, open, isDataSourcesLoading, dataSources, getDataSourceById]);

  // Multi-query verilerini yükle
  const loadMultiQueryData = async (config: MultiQueryConfig) => {
    if (!config?.queries?.length) return;
    
    setIsLoadingData(true);
    const dataMap: Record<string, any[]> = {};
    
    try {
      for (const query of config.queries) {
        if (query.dataSourceId) {
          const ds = getDataSourceById(query.dataSourceId);
          
          if (ds?.last_sample_data && ds.last_sample_data.length > 0) {
            // Cache'den oku
            dataMap[query.id] = ds.last_sample_data as any[];
            console.log(`[BuilderPreview] Query ${query.id}: Cache HIT (${ds.last_sample_data.length} kayıt)`);
          } else if (ds) {
            // Cache boş - DIA API'den çek
            console.log(`[BuilderPreview] Query ${query.id}: Cache MISS, fetching from DIA...`);
            try {
              const response = await supabase.functions.invoke('dia-api-test', {
                body: {
                  module: ds.module,
                  method: ds.method,
                  filters: ds.filters || [],
                  sorts: ds.sorts || [],
                  limit: Math.min(ds.limit_count || 100, 100),
                  ...(isImpersonating && impersonatedUserId ? { targetUserId: impersonatedUserId } : {}),
                },
              });
              
              if (response.data?.success && response.data?.sampleData) {
                dataMap[query.id] = response.data.sampleData;
                console.log(`[BuilderPreview] Query ${query.id}: DIA returned ${response.data.sampleData.length} kayıt`);
              } else {
                console.warn(`[BuilderPreview] Query ${query.id}: DIA returned no data`, response.data?.error);
                dataMap[query.id] = [];
              }
            } catch (err) {
              console.error(`[BuilderPreview] Query ${query.id}: DIA fetch error`, err);
              dataMap[query.id] = [];
            }
          } else {
            console.warn(`[BuilderPreview] Query ${query.id}: DataSource not found`);
            dataMap[query.id] = [];
          }
        }
      }
      
      setMergedQueryData(dataMap);
      
      const primaryQuery = config.queries.find(q => q.id === config.primaryQueryId) || config.queries[0];
      if (primaryQuery && dataMap[primaryQuery.id]) {
        setSampleData(dataMap[primaryQuery.id]);
      }
      
      const totalRecords = Object.values(dataMap).reduce((sum, arr) => sum + arr.length, 0);
      toast.success(`${Object.keys(dataMap).length} kaynak, toplam ${totalRecords} kayıt yüklendi`);
    } catch (err: any) {
      toast.error('Veri yükleme hatası: ' + err.message);
    } finally {
      setIsLoadingData(false);
    }
  };
  
  // Multi-query için zengin veri yapısı
  const getMultiQueryJsonData = useCallback(() => {
    if (!isMultiQueryMode || !multiQuery?.queries?.length) {
      return sampleData;
    }
    
    const result: Record<string, any> = {
      _meta: {
        isMultiQuery: true,
        queryCount: multiQuery.queries.length,
        queries: multiQuery.queries.map(q => ({
          id: q.id,
          name: q.name,
          dataSourceId: q.dataSourceId,
          dataSourceName: q.dataSourceName,
          fields: mergedQueryData[q.id]?.[0] ? Object.keys(mergedQueryData[q.id][0]) : [],
          recordCount: mergedQueryData[q.id]?.length || 0,
        })),
      },
    };
    
    multiQuery.queries.forEach(q => {
      const key = q.name || `query_${q.id.slice(0, 8)}`;
      result[key] = mergedQueryData[q.id] || [];
    });
    
    return result;
  }, [isMultiQueryMode, multiQuery, mergedQueryData, sampleData]);

  // Veri kaynağı seçildiğinde
  const handleDataSourceSelect = async (dataSource: DataSourceType | null) => {
    if (dataSource) {
      setSelectedDataSourceId(dataSource.id);
      
      if (dataSource.last_sample_data) {
        setSampleData(dataSource.last_sample_data as any[]);
        toast.success('Önbellek verisi yüklendi');
        return;
      }
      
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
          module: dataSource.module,
          method: dataSource.method,
          filters: dataSource.filters || [],
          sorts: dataSource.sorts || [],
          selectedColumns: dataSource.selected_columns || [],
          limit: Math.min(dataSource.limit_count || 100, 100),
          ...(isImpersonating && impersonatedUserId ? { targetUserId: impersonatedUserId } : {}),
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

  // Kodu kopyala
  const copyCode = () => {
    navigator.clipboard.writeText(customCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Kod kopyalandı');
  };

  // Veri analizi fonksiyonu
  const analyzeDataForAI = useCallback((data: any[]) => {
    if (!data || data.length === 0) return {};
    
    const fields = Object.keys(data[0]);
    const analysis: Record<string, any> = {};
    
    fields.forEach(field => {
      const values = data.map(d => d[field]).filter(v => v != null);
      const numericValues = values.filter(v => typeof v === 'number' || !isNaN(parseFloat(v)));
      
      const detectType = () => {
        if (values.length === 0) return 'empty';
        const first = values[0];
        if (typeof first === 'number') return 'number';
        if (typeof first === 'boolean') return 'boolean';
        if (typeof first === 'string') {
          if (!isNaN(Date.parse(first)) && first.includes('-')) return 'date';
          if (!isNaN(parseFloat(first)) && values.every(v => !isNaN(parseFloat(v)))) return 'numeric-string';
        }
        return 'string';
      };
      
      const fieldType = detectType();
      
      analysis[field] = {
        type: fieldType,
        uniqueCount: new Set(values).size,
        nullCount: data.filter(d => d[field] == null).length,
        sampleValues: [...new Set(values)].slice(0, 5),
      };
      
      if (numericValues.length > 0 && (fieldType === 'number' || fieldType === 'numeric-string')) {
        const nums = numericValues.map(v => typeof v === 'number' ? v : parseFloat(v));
        analysis[field].min = Math.min(...nums);
        analysis[field].max = Math.max(...nums);
        analysis[field].avg = Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
        analysis[field].sum = Math.round(nums.reduce((a, b) => a + b, 0) * 100) / 100;
      }
      
      if (fieldType === 'date') {
        const dates = values.map(v => new Date(v)).filter(d => !isNaN(d.getTime()));
        if (dates.length > 0) {
          analysis[field].minDate = new Date(Math.min(...dates.map(d => d.getTime()))).toISOString().split('T')[0];
          analysis[field].maxDate = new Date(Math.max(...dates.map(d => d.getTime()))).toISOString().split('T')[0];
        }
      }
    });
    
    return analysis;
  }, []);

  // Sayı formatlama
  const formatNumber = (value: number) => {
    if (Math.abs(value) >= 1000000) return (value / 1000000).toFixed(1) + 'M';
    if (Math.abs(value) >= 1000) return (value / 1000).toFixed(1) + 'K';
    return value.toLocaleString('tr-TR');
  };

  // AI ile kod üret
  const generateCodeWithAI = async () => {
    if (!aiPrompt.trim()) {
      toast.error('Lütfen ne tür bir widget istediğinizi açıklayın');
      return;
    }

    const hasData = isMultiQueryMode 
      ? Object.keys(mergedQueryData).length > 0 
      : sampleData.length > 0;
    
    if (!hasData) {
      toast.error('Önce veri kaynağı seçip veri yükleyin');
      return;
    }

    setIsGeneratingCode(true);
    try {
      let systemPrompt: string;
      let dataToSend: any;
      
      if (isMultiQueryMode && multiQuery?.queries?.length) {
        const queryAnalyses = multiQuery.queries.map(q => {
          const qData = mergedQueryData[q.id] || [];
          const analysis = qData.length > 0 ? analyzeDataForAI(qData) : {};
          return {
            queryName: q.name,
            queryId: q.id,
            dataSourceName: q.dataSourceName,
            recordCount: qData.length,
            fields: qData[0] ? Object.keys(qData[0]) : [],
            fieldStats: analysis,
            sampleRecord: qData[0] || null,
          };
        });
        
        systemPrompt = `MULTI-QUERY VERİ YAPISI:
Bu widget birden fazla veri kaynağından besleniyor.

SORGULAR:
${queryAnalyses.map(qa => `
📊 ${qa.queryName} (${qa.recordCount} kayıt)
   Alanlar: ${qa.fields.join(', ')}`).join('\n')}

Kullanıcı isteği: ${buildEnhancedPrompt()}`;

        dataToSend = getMultiQueryJsonData();
      } else {
        const dataAnalysis = analyzeDataForAI(sampleData);
        
        systemPrompt = `Veri Analizi:
- Toplam kayıt: ${sampleData.length}
- Alan istatistikleri:
${Object.entries(dataAnalysis).map(([field, stats]) => {
  const s = stats as any;
  let info = `  • ${field} (${s.type}): ${s.uniqueCount} benzersiz değer`;
  if (s.min !== undefined) info += `, min: ${formatNumber(s.min)}, max: ${formatNumber(s.max)}, toplam: ${formatNumber(s.sum)}`;
  if (s.minDate) info += `, tarih aralığı: ${s.minDate} - ${s.maxDate}`;
  return info;
}).join('\n')}

Örnek kayıt: ${JSON.stringify(sampleData[0], null, 2)}

Kullanıcı isteği: ${buildEnhancedPrompt()}`;

        dataToSend = sampleData.slice(0, 3);
      }

      const response = await supabase.functions.invoke('ai-code-generator', {
        body: {
          prompt: systemPrompt,
          sampleData: dataToSend,
          mode: 'generate',
          isMultiQuery: isMultiQueryMode,
          useMetadata: true, // YENİ: Metadata üretimini aktifleştir
        },
      });

      if (response.error) throw response.error;
      
      const generatedCode = response.data?.code || response.data?.content;
      const metadata = response.data?.metadata;
      const aiMetadata = response.data?.aiMetadata; // YENİ: AI tarafından üretilen metadata
      
      if (generatedCode) {
        setCustomCode(generatedCode);
        
        // AI Metadata'yı state'lere aktar
        if (aiMetadata) {
          // Widget adını AI'dan al
          if (aiMetadata.suggestedName) {
            setWidgetName(aiMetadata.suggestedName);
            // Widget key'i de addan oluştur
            const cleanedName = aiMetadata.suggestedName
              .toLowerCase()
              .replace(/[^a-z0-9ğüşıöçĞÜŞİÖÇ\s]/g, '')
              .replace(/[ğ]/g, 'g').replace(/[ü]/g, 'u').replace(/[ş]/g, 's')
              .replace(/[ı]/g, 'i').replace(/[ö]/g, 'o').replace(/[ç]/g, 'c')
              .replace(/\s+/g, '_');
            setWidgetKey('ai_' + cleanedName + '_' + Date.now().toString(36));
          }
          
          // Widget ikonunu AI'dan al
          if (aiMetadata.suggestedIcon) {
            setWidgetIcon(aiMetadata.suggestedIcon);
          }
          
          // Önerilen etiketler
          if (aiMetadata.suggestedTags?.length) {
            setAiSuggestedTags(aiMetadata.suggestedTags);
            // İlk etiket kategori olarak kullanılır
            if (aiMetadata.suggestedTags[0]) {
              setWidgetCategory(aiMetadata.suggestedTags[0]);
            }
          }
          
          // Kısa açıklama - hem widgetDescription hem shortDescription'a yaz
          if (aiMetadata.shortDescription) {
            setShortDescription(aiMetadata.shortDescription);
            setWidgetDescription(aiMetadata.shortDescription);
          }
          
          if (aiMetadata.longDescription) {
            setLongDescription(aiMetadata.longDescription);
          }
          if (aiMetadata.technicalNotes) {
            setTechnicalNotes(aiMetadata.technicalNotes);
          }
        }
        
        // Metadata bilgisi ile toast göster
        let toastMessage = 'Kod üretildi!';
        if (metadata?.wasPartial) {
          toastMessage = `Kod ${metadata.totalAttempts} parçada üretildi (${metadata.codeLength} karakter)`;
          if (!metadata.isComplete) {
            toastMessage += ' ⚠️ Kod tam olmayabilir';
          }
        }
        if (metadata?.hasAiMetadata) {
          toastMessage += ' + Metadata';
        }
        
        setChatHistory([
          { role: 'user', content: aiPrompt },
          { role: 'assistant', content: toastMessage }
        ]);
        // Otomatik olarak kod düzenleme adımına geç
        if (!completedSteps.includes(1)) {
          setCompletedSteps(prev => [...prev, 1]);
        }
        setCurrentStep(2);
        
        // Tam olmayan kod uyarısı
        if (metadata?.wasPartial && !metadata?.isComplete) {
          toast.warning('Kod tamamlanamadı. Lütfen kontrol edip gerekirse Chat ile düzeltin.', {
            duration: 5000,
          });
        } else {
          toast.success(toastMessage + ' Kod düzenleme adımına geçildi.');
        }
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

  // Widget kaydet
  const handleSave = async () => {
    if (!widgetKey || !widgetName) {
      toast.error('Widget key ve adı zorunludur');
      return;
    }

    if (isMultiQueryMode) {
      if (!multiQuery || multiQuery.queries.length === 0) {
        toast.error('En az bir sorgu tanımlamalısınız');
        return;
      }
    } else {
      if (!selectedDataSourceId) {
        toast.error('Bir veri kaynağı seçmelisiniz');
        return;
      }
    }

    const moduleValue = (selectedDataSource?.module || 'scf') as 'bcs' | 'fat' | 'gts' | 'scf' | 'sis' | 'stk';
    
    const builderConfig: Record<string, any> = {
      customCode: customCode,
      visualization: {
        type: 'custom' as const,
        isCustomCode: true,
      },
      // Yeni alanlar
      diaModelLinks: diaModelLinks.length > 0 ? diaModelLinks : undefined,
      aiRequirements: aiRequirements.filter(r => r.isActive && !r.isDefault).map(r => r.id),
      customAiRules: customRules.length > 0 ? customRules : undefined,
    };
    
    if (isMultiQueryMode && multiQuery) {
      builderConfig.multiQuery = multiQuery;
      builderConfig.isMultiQuery = true;
    } else {
      builderConfig.dataSourceId = selectedDataSourceId;
      builderConfig.dataSourceSlug = selectedDataSource?.slug;
      builderConfig.diaApi = {
        module: moduleValue,
        method: selectedDataSource?.method || 'carikart_listele',
        parameters: {},
      };
    }

    const formData: WidgetFormData = {
      widget_key: widgetKey,
      name: widgetName,
      description: shortDescription || widgetDescription, // Kısa açıklamayı description olarak kullan
      category: aiSuggestedTags[0] || widgetCategory as any, // İlk etiket kategori olarak
      type: 'chart',
      data_source: 'genel',
      size: widgetSize,
      icon: widgetIcon,
      default_page: (aiSuggestedTags[0] || widgetCategory || 'dashboard') as any, // İlk etiket
      default_visible: true,
      available_filters: [],
      default_filters: {},
      min_height: '',
      grid_cols: null,
      is_active: true,
      is_default: false,
      sort_order: 100,
      builder_config: builderConfig as any,
      // AI tarafından üretilen etiketler widget_tags tablosuna kaydedilecek
      tags: aiSuggestedTags.length > 0 ? aiSuggestedTags : ['dashboard'],
      // AI Metadata alanları
      short_description: shortDescription || undefined,
      long_description: longDescription || undefined,
      technical_notes: technicalNotes || undefined,
      preview_image: previewImage || undefined,
      ai_suggested_tags: aiSuggestedTags.length > 0 ? aiSuggestedTags : undefined,
    };

    if (editingWidget) {
      const success = await updateWidget(editingWidget.id, formData);
      if (success) {
        toast.success('Widget güncellendi!');
        onSave?.();
        onOpenChange(false);
      }
    } else {
      const success = await createWidget(formData);
      if (success) {
        toast.success('Widget oluşturuldu!');
        onSave?.();
        onOpenChange(false);
      }
    }
  };

  // Dinamik kod çalıştırma ile önizleme
  const PreviewResult = useMemo(() => {
    if (!customCode.trim() || sampleData.length === 0) {
      return { component: null, error: null };
    }
    
    try {
      const fn = new Function(
        'React',
        'data',
        'LucideIcons',
        'Recharts',
        'colors',
        'filters',
        'UI',
        'Map',
        'multiData',
        'Nivo',
        customCode
      );
      
      const previewColors = [
        'hsl(220, 70%, 50%)',
        'hsl(200, 80%, 50%)',
        'hsl(180, 70%, 45%)',
        'hsl(160, 75%, 45%)',
        'hsl(140, 60%, 40%)',
        'hsl(120, 50%, 45%)',
        'hsl(100, 45%, 50%)',
        'hsl(280, 70%, 55%)',
      ];
      
      const previewMultiData = isMultiQueryMode && multiQuery?.queries?.length
        ? multiQuery.queries.map((q) => mergedQueryData[q.id] || [])
        : null;

       const WidgetComponent = fn(React, sampleData, LucideIcons, RechartsScope, previewColors, {}, UIScope, mapScope, previewMultiData, nivoScope);
      
      if (typeof WidgetComponent !== 'function') {
        return { 
          component: null, 
          error: 'Widget fonksiyonu bulunamadı. Kodunuzda "return Widget;" olmalı.' 
        };
      }
      
      return { component: WidgetComponent, error: null, colors: previewColors };
    } catch (err: any) {
      return { component: null, error: err.message };
    }
  }, [customCode, sampleData, mapScope, isMultiQueryMode, multiQuery, mergedQueryData, nivoScope]);

  // Error state'i güncelle
  useEffect(() => {
    setCodeError(PreviewResult.error);
  }, [PreviewResult.error]);

  // Stepper Header Component
  const StepperHeader = () => (
    <div className="px-4 md:px-6 py-4 border-b bg-muted/30">
      <div className="flex items-center justify-between">
        {WIZARD_STEPS.map((step, idx) => {
          const isCompleted = completedSteps.includes(step.id);
          const isCurrent = currentStep === step.id;
          const isClickable = idx < currentStep || isCompleted || (idx === currentStep);
          
          return (
            <React.Fragment key={step.id}>
              <button
                onClick={() => isClickable && goToStep(step.id)}
                disabled={!isClickable}
                className={cn(
                  "flex items-center gap-2 md:gap-3 px-2 md:px-4 py-2 rounded-lg transition-all",
                  isCurrent && "bg-primary text-primary-foreground shadow-md",
                  isCompleted && !isCurrent && "bg-success/10 text-success",
                  !isCurrent && !isCompleted && "text-muted-foreground",
                  isClickable && !isCurrent && "hover:bg-muted cursor-pointer",
                  !isClickable && "cursor-not-allowed opacity-50"
                )}
              >
                <div className={cn(
                  "w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center text-xs md:text-sm font-semibold shrink-0",
                  isCurrent && "bg-primary-foreground text-primary",
                  isCompleted && !isCurrent && "bg-success text-success-foreground",
                  !isCurrent && !isCompleted && "bg-muted-foreground/20"
                )}>
                  {isCompleted && !isCurrent ? (
                    <Check className="h-3 w-3 md:h-4 md:w-4" />
                  ) : (
                    step.id + 1
                  )}
                </div>
                <div className="hidden md:block text-left">
                  <div className="text-sm font-medium">{step.title}</div>
                  <div className="text-xs opacity-70">{step.description}</div>
                </div>
                <step.icon className="h-4 w-4 md:hidden" />
              </button>
              
              {idx < WIZARD_STEPS.length - 1 && (
                <div className={cn(
                  "flex-1 h-0.5 mx-1 md:mx-2",
                  completedSteps.includes(step.id) ? "bg-success" : "bg-border"
                )} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );

  // Step 1: Veri Kaynağı
  const renderStep1 = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
      {/* Sol: Widget Bilgileri */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <LayoutGrid className="h-4 w-4" />
              Widget Bilgileri
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Widget Key</Label>
                <Input
                  value={widgetKey}
                  onChange={(e) => setWidgetKey(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                  placeholder="ai_widget_key"
                  className="h-9"
                  disabled
                />
                <span className="text-[10px] text-muted-foreground">AI tarafından oluşturulur</span>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Widget Adı</Label>
                <Input
                  value={widgetName}
                  onChange={(e) => setWidgetName(e.target.value)}
                  placeholder="AI tarafından oluşturulacak"
                  className="h-9"
                />
                <span className="text-[10px] text-muted-foreground">AI tarafından önerilir</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Açıklama</Label>
              <Input
                value={widgetDescription}
                onChange={(e) => setWidgetDescription(e.target.value)}
                placeholder="AI tarafından oluşturulacak"
                className="h-9"
              />
              <span className="text-[10px] text-muted-foreground">AI kısa açıklama üretir</span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Boyut</Label>
              <Select value={widgetSize} onValueChange={(v: any) => setWidgetSize(v)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WIDGET_SIZES.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* AI Önerilen Etiketler gösterimi */}
            {aiSuggestedTags.length > 0 && (
              <div className="p-2 bg-muted/30 rounded-lg">
                <Label className="text-xs text-muted-foreground">AI Önerilen Etiketler</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {aiSuggestedTags.map((tag, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* AI Önerilen İkon gösterimi */}
            {widgetIcon && widgetIcon !== 'Code' && (
              <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
                <DynamicIcon iconName={widgetIcon} className="h-5 w-5" />
                <span className="text-xs text-muted-foreground">AI Önerilen İkon: {widgetIcon}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                Veri Kaynağı
              </span>
              <div className="flex items-center gap-2">
                <Label htmlFor="multi-mode" className="text-xs font-normal">Çoklu</Label>
                <Switch
                  id="multi-mode"
                  checked={isMultiQueryMode}
                  onCheckedChange={(checked) => {
                    setIsMultiQueryMode(checked);
                    if (!checked) {
                      setMultiQuery(null);
                      setMergedQueryData({});
                    }
                  }}
                />
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!isMultiQueryMode ? (
              <div className="space-y-3">
                <DataSourceSelector
                  selectedId={selectedDataSourceId}
                  onSelect={handleDataSourceSelect}
                  hideHeader={true}
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
                      {isLoadingData ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    </Button>
                    {sampleData.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {sampleData.length} kayıt
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <MultiQueryBuilder
                  multiQuery={multiQuery}
                  onChange={(config) => {
                    setMultiQuery(config);
                    if (config) loadMultiQueryData(config);
                  }}
                />
                {multiQuery?.queries?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {multiQuery.queries.map(q => (
                      <Badge key={q.id} variant="outline" className="text-xs">
                        {q.name}: {mergedQueryData[q.id]?.length || 0}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sağ: JSON Önizleme */}
      <Card className="flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileJson className="h-4 w-4" />
              JSON Veri Önizleme
            </span>
            <div className="flex items-center gap-2">
              {sampleData.length > 0 && (
                <>
                  <Slider
                    value={[jsonPreviewCount]}
                    onValueChange={([val]) => setJsonPreviewCount(val)}
                    min={5}
                    max={Math.min(100, sampleData.length)}
                    step={5}
                    className="w-20"
                  />
                  <span className="text-xs font-mono w-6">{jsonPreviewCount}</span>
                </>
              )}
              <Button size="sm" variant="ghost" onClick={() => {
                const jsonData = isMultiQueryMode ? getMultiQueryJsonData() : sampleData;
                navigator.clipboard.writeText(JSON.stringify(jsonData, null, 2));
                toast.success('JSON kopyalandı');
              }}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden">
          <ScrollArea className="h-full border rounded-lg">
            <pre className="p-3 text-xs font-mono whitespace-pre-wrap">
              {isMultiQueryMode && multiQuery?.queries?.length ? (
                JSON.stringify(getMultiQueryJsonData(), null, 2)
              ) : sampleData.length > 0 ? (
                JSON.stringify(sampleData.slice(0, jsonPreviewCount), null, 2)
              ) : (
                'Veri kaynağı seçin...'
              )}
            </pre>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );

  // Tüm kullanılabilir alanlar - ana sorgu + birleşik sorgular
  const getAllAvailableFields = useCallback(() => {
    const fields: { key: string; source: string; sourceType: 'main' | 'merged' | 'calculated' }[] = [];
    
    if (isMultiQueryMode && multiQuery?.queries?.length) {
      // Multi-query modunda tüm sorguların alanlarını topla
      multiQuery.queries.forEach(q => {
        const queryData = mergedQueryData[q.id] || [];
        if (queryData.length > 0 && queryData[0]) {
          Object.keys(queryData[0]).forEach(key => {
            if (!fields.some(f => f.key === key)) {
              fields.push({ key, source: q.name || q.dataSourceName || 'Sorgu', sourceType: q.id === multiQuery.primaryQueryId ? 'main' : 'merged' });
            }
          });
        }
      });
    } else if (sampleData.length > 0 && sampleData[0]) {
      // Tek sorgu modunda
      Object.keys(sampleData[0]).forEach(key => {
        fields.push({ key, source: selectedDataSource?.name || 'Ana Sorgu', sourceType: 'main' });
      });
    }
    
    return fields.sort((a, b) => a.key.localeCompare(b.key, 'tr'));
  }, [isMultiQueryMode, multiQuery, mergedQueryData, sampleData, selectedDataSource]);

  // Filtre olarak seçilen alanlar
  const [selectedFilterFields, setSelectedFilterFields] = useState<string[]>([]);
  const [fieldSearchTerm, setFieldSearchTerm] = useState('');

  // Alanları filtrele
  const filteredFields = useMemo(() => {
    const allFields = getAllAvailableFields();
    if (!fieldSearchTerm.trim()) return allFields;
    return allFields.filter(f => 
      f.key.toLowerCase().includes(fieldSearchTerm.toLowerCase())
    );
  }, [getAllAvailableFields, fieldSearchTerm]);

  // Filtre alanı toggle
  const toggleFilterField = (fieldKey: string) => {
    setSelectedFilterFields(prev => 
      prev.includes(fieldKey) 
        ? prev.filter(f => f !== fieldKey)
        : [...prev, fieldKey]
    );
  };

  // DIA Model Link ekleme
  const addDiaModelLink = () => {
    if (!newModelLink.trim()) return;
    if (!newModelLink.includes('doc.dia.com.tr')) {
      toast.error('Geçerli bir DIA dokümantasyon linki girin');
      return;
    }
    if (diaModelLinks.some(l => l.url === newModelLink)) {
      toast.error('Bu link zaten eklenmiş');
      return;
    }
    const modelName = extractModelNameFromUrl(newModelLink);
    setDiaModelLinks(prev => [...prev, { url: newModelLink.trim(), modelName }]);
    setNewModelLink('');
    toast.success(`${modelName} eklendi`);
  };

  // AI zorunluluğu toggle
  const toggleAiRequirement = (id: string) => {
    setAiRequirements(prev => prev.map(r => 
      r.id === id && !r.isDefault ? { ...r, isActive: !r.isActive } : r
    ));
  };

  // Özel kural ekleme
  const addCustomRule = () => {
    if (!newCustomRule.trim()) return;
    if (customRules.includes(newCustomRule.trim())) {
      toast.error('Bu kural zaten eklenmiş');
      return;
    }
    setCustomRules(prev => [...prev, newCustomRule.trim()]);
    setNewCustomRule('');
    toast.success('Kural eklendi');
  };

  // AI prompt'unu zenginleştir (DIA linkleri + zorunluluklar + örnek widget)
  // Seçili örnek widget kodunu veritabanından çek
  const [exampleWidgetCode, setExampleWidgetCode] = useState<string | null>(null);
  
  useEffect(() => {
    if (!selectedExampleWidget) {
      setExampleWidgetCode(null);
      return;
    }
    
    const fetchExampleCode = async () => {
      try {
        const { data, error } = await supabase
          .from('widgets')
          .select('builder_config')
          .eq('widget_key', selectedExampleWidget)
          .single();
        
        if (error) throw error;
        
        const code = (data?.builder_config as any)?.customCode;
        setExampleWidgetCode(code || null);
      } catch (err) {
        console.error('Error fetching example widget code:', err);
        setExampleWidgetCode(null);
      }
    };
    
    fetchExampleCode();
  }, [selectedExampleWidget]);
  
  // Veri modeli ilişkilerini prompt için hazırla
  const getDataModelContext = useCallback(() => {
    if (!selectedDataSourceId) return null;
    
    const sourceRelationships = getRelationshipsForDataSource(selectedDataSourceId);
    if (!sourceRelationships || sourceRelationships.length === 0) return null;
    
    const relatedSources = sourceRelationships.map(rel => {
      const isSource = rel.source_data_source_id === selectedDataSourceId;
      const relatedId = isSource ? rel.target_data_source_id : rel.source_data_source_id;
      const relatedDS = getDataSourceById(relatedId);
      
      return {
        name: relatedDS?.name || 'Bilinmeyen',
        slug: relatedDS?.slug || '',
        relationField: isSource ? rel.source_field : rel.target_field,
        targetField: isSource ? rel.target_field : rel.source_field,
        type: rel.relationship_type,
        crossFilter: rel.cross_filter_direction,
        recordCount: relatedDS?.last_record_count || 0,
        sampleFields: relatedDS?.last_fields?.slice(0, 10) || [],
      };
    });
    
    return { relationships: sourceRelationships, relatedSources };
  }, [selectedDataSourceId, getRelationshipsForDataSource, getDataSourceById]);
  
  const buildEnhancedPrompt = useCallback(() => {
    let prompt = aiPrompt;
    
    // Seçili örnek widget kodu
    if (selectedExampleWidget && exampleWidgetCode) {
      prompt += '\n\n📋 ÖRNEK REFERANS WIDGET:\n';
      prompt += 'Aşağıdaki widget kodunu yapı ve stil açısından örnek al:\n';
      prompt += '```javascript\n' + exampleWidgetCode + '\n```\n';
      prompt += 'Bu widget\'ın responsive legend, renk paleti kullanımı ve container yapısını benzer şekilde uygula.';
    }
    
    // VERİ MODELİ İLİŞKİLERİ - YENİ!
    const dataModelContext = getDataModelContext();
    if (dataModelContext && dataModelContext.relatedSources.length > 0) {
      prompt += '\n\n═══════════════════════════════════════════════════════════════\n';
      prompt += '                    VERİ MODELİ İLİŞKİLERİ\n';
      prompt += '═══════════════════════════════════════════════════════════════\n\n';
      prompt += `📊 Mevcut Veri Kaynağı: ${selectedDataSource?.name || 'Seçili Kaynak'}\n`;
      prompt += `   Alanlar: ${selectedDataSource?.last_fields?.slice(0, 15).join(', ') || '...'}\n\n`;
      prompt += '🔗 İlişkili Veri Kaynakları:\n';
      dataModelContext.relatedSources.forEach(rel => {
        prompt += `   • ${rel.name} → ${rel.relationField} = ${rel.targetField} (${rel.type})\n`;
        prompt += `     Cross-filter: ${rel.crossFilter}, ${rel.recordCount} kayıt\n`;
        if (rel.sampleFields.length > 0) {
          prompt += `     Alanlar: ${rel.sampleFields.join(', ')}...\n`;
        }
      });
      prompt += '\n💡 Bu ilişkileri kullanarak veri birleştirmesi yapabilirsin.\n';
    }
    
    // DIA Model linkleri ekle
    if (diaModelLinks.length > 0) {
      prompt += '\n\n📚 Referans DIA Modelleri:\n';
      diaModelLinks.forEach(link => {
        prompt += `- ${link.modelName}: ${link.url}\n`;
      });
      prompt += '\nBu modellerin alanlarını ve veri tiplerini dikkate al.';
    }
    
    // Aktif zorunlulukları ekle
    const activeRules = aiRequirements.filter(r => r.isActive && !r.isDefault);
    if (activeRules.length > 0 || customRules.length > 0) {
      prompt += '\n\n⚙️ EK ZORUNLU KURALLAR:\n';
      activeRules.forEach(rule => {
        prompt += `- ${rule.promptAddition}\n`;
      });
      customRules.forEach(rule => {
        prompt += `- ${rule}\n`;
      });
    }
    
    // Tooltip ve border hatırlatıcı - HER ZAMAN EKLE
    prompt += '\n\n🔴 MUTLAKA UYULMASI GEREKEN KURALLAR:\n';
    prompt += '- Ana container\'da "border border-border" KULLANMA! Sadece "h-full flex flex-col" yeterli.\n';
    prompt += '- Recharts.Tooltip her zaman wrapperStyle: { zIndex: 9999 } ile kullanılmalı.\n';
    prompt += '- Custom Tooltip div\'ine de style: { zIndex: 9999 } ekle.\n';
    prompt += '\n🪟 POPUP/MODAL HEADER DÜZENI (KRİTİK!):\n';
    prompt += '- DialogContent X butonu sağ üstte absolute pozisyonlu olarak otomatik eklenir.\n';
    prompt += '- Header div\'ine MUTLAKA "pr-12" (padding-right) ekle! Bu X butonuna yer açar.\n';
    prompt += '- Header yapısı: flex items-center justify-between p-3 border-b border-border gap-4 pr-12\n';
    prompt += '- Sol: başlık + badge (min-w-0, truncate). Orta: flex-1 text-right (tutar/bilgi). \n';
    prompt += '- Örnek: React.createElement(\'div\', { className: \'flex items-center justify-between p-3 border-b border-border gap-4 pr-12\' }, ...)\n';
    prompt += '- ÖNEMLİ: Bilgiler ve X butonu ASLA üst üste binmemeli!\n';
    
    return prompt;
  }, [aiPrompt, selectedExampleWidget, exampleWidgetCode, selectedDataSource, getDataModelContext, diaModelLinks, aiRequirements, customRules]);

  // Tam prompt oluşturma - AI'ye gönderilen tüm içerik
  const generateFullPromptPreview = useCallback(() => {
    const hasData = isMultiQueryMode 
      ? Object.keys(mergedQueryData).length > 0 
      : sampleData.length > 0;
    
    if (!hasData) {
      return '⚠️ Önce veri kaynağı seçilmeli';
    }

    let fullPrompt = '';
    
    // Multi-query modu
    if (isMultiQueryMode && multiQuery?.queries?.length) {
      const queryAnalyses = multiQuery.queries.map(q => {
        const qData = mergedQueryData[q.id] || [];
        const analysis = qData.length > 0 ? analyzeDataForAI(qData) : {};
        return {
          queryName: q.name,
          queryId: q.id,
          dataSourceName: q.dataSourceName,
          recordCount: qData.length,
          fields: qData[0] ? Object.keys(qData[0]) : [],
          fieldStats: analysis,
          sampleRecord: qData[0] || null,
        };
      });
      
      const querySections = queryAnalyses.map(qa => {
        const statsLines = Object.entries(qa.fieldStats || {}).map(([field, stats]) => {
          const s = stats as any;
          let info = '   • ' + field + ' (' + s.type + '): ' + s.uniqueCount + ' benzersiz değer';
          if (s.min !== undefined) info += ', min: ' + formatNumber(s.min) + ', max: ' + formatNumber(s.max) + ', toplam: ' + formatNumber(s.sum);
          if (s.minDate) info += ', tarih aralığı: ' + s.minDate + ' - ' + s.maxDate;
          return info;
        }).join('\n');
        
        return '📊 ' + qa.queryName + ' (' + qa.recordCount + ' kayıt)\n' +
               '   Veri Kaynağı: ' + qa.dataSourceName + '\n' +
               '   Alanlar: ' + qa.fields.join(', ') + '\n\n' +
               '   Alan İstatistikleri:\n' + statsLines + '\n\n' +
               '   Örnek Kayıt:\n   ' + JSON.stringify(qa.sampleRecord, null, 2);
      }).join('\n\n');
      
      fullPrompt = '═══════════════════════════════════════════════════════════════\n' +
                   '                    MULTI-QUERY VERİ YAPISI\n' +
                   '═══════════════════════════════════════════════════════════════\n\n' +
                   'Bu widget birden fazla veri kaynağından besleniyor.\n\n' +
                   'SORGULAR:\n' + querySections + '\n\n' +
                   '═══════════════════════════════════════════════════════════════\n' +
                   '                    KULLANICI İSTEĞİ\n' +
                   '═══════════════════════════════════════════════════════════════\n\n' +
                   buildEnhancedPrompt();

    } else {
      // Tek kaynak modu
      const dataAnalysis = analyzeDataForAI(sampleData);
      
      const statsLines = Object.entries(dataAnalysis).map(([field, stats]) => {
        const s = stats as any;
        let info = '  • ' + field + ' (' + s.type + '): ' + s.uniqueCount + ' benzersiz değer';
        if (s.min !== undefined) info += ', min: ' + formatNumber(s.min) + ', max: ' + formatNumber(s.max) + ', toplam: ' + formatNumber(s.sum);
        if (s.minDate) info += ', tarih aralığı: ' + s.minDate + ' - ' + s.maxDate;
        return info;
      }).join('\n');
      
      fullPrompt = '═══════════════════════════════════════════════════════════════\n' +
                   '                    VERİ ANALİZİ\n' +
                   '═══════════════════════════════════════════════════════════════\n\n' +
                   'Veri Kaynağı: ' + (selectedDataSource?.name || 'Bilinmeyen') + '\n' +
                   'Toplam Kayıt: ' + sampleData.length + '\n' +
                   'API: ' + (selectedDataSource?.module || '?') + '/' + (selectedDataSource?.method || '?') + '\n\n' +
                   'ALAN İSTATİSTİKLERİ:\n' + statsLines + '\n\n' +
                   'ÖRNEK KAYIT:\n' + JSON.stringify(sampleData[0], null, 2) + '\n\n' +
                   '═══════════════════════════════════════════════════════════════\n' +
                   '                    KULLANICI İSTEĞİ\n' +
                   '═══════════════════════════════════════════════════════════════\n\n' +
                   buildEnhancedPrompt();
    }

    // AI Zorunlulukları bilgisi
    fullPrompt += '\n\n═══════════════════════════════════════════════════════════════\n' +
                  '                    AI SİSTEM PROMPT (ÖN TANIMLI)\n' +
                  '═══════════════════════════════════════════════════════════════\n\n' +
                  'Bu istek aşağıdaki sabit kurallarla AI\'ye gönderilir:\n\n' +
                  '📋 KOD YAPISI:\n' +
                  '   - Sadece JavaScript (TypeScript yok)\n' +
                  '   - JSX yok, sadece React.createElement\n' +
                  '   - function Widget({ data, colors, filters }) formatı\n' +
                  '   - En sonda "return Widget;" zorunlu\n\n' +
                  '🎨 RENK SİSTEMİ:\n' +
                  '   - Sabit renkler yasak (text-white, #RRGGBB, rgb() vb.)\n' +
                  '   - CSS değişkenleri zorunlu: text-foreground, bg-card, text-success, text-destructive\n' +
                  '   - Grafik renkleri: colors prop\'undan getColor(index) ile\n\n' +
                  '📊 GRAFİK KURALLARI:\n' +
                  '   - Ana container: h-full flex flex-col\n' +
                  '   - Grafik container: flex-1 h-full min-h-0 relative\n' +
                  '   - Donut ortası: overlay div ile (PieChart dışında)\n' +
                  '   - Bar/Line: CartesianGrid, XAxis, YAxis zorunlu\n\n' +
                  '💰 PARA BİRİMİ:\n' +
                  '   - formatCurrency helper zorunlu\n' +
                  '   - TRY varsayılan, çoklu para birimi destekli\n\n' +
                  '📅 TARİH KRONOLOJİSİ (aktifse):\n' +
                  '   - fillMissingDates helper ile eksik günleri 0 ile doldur';

    return fullPrompt;
  }, [isMultiQueryMode, multiQuery, mergedQueryData, sampleData, selectedDataSource, buildEnhancedPrompt, analyzeDataForAI, formatNumber]);

  // Step 2: AI Kod Üret
  const renderStep2 = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
      {/* Sol: AI Prompt (2/3) */}
      <Card className="lg:col-span-2 flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI ile Widget Kodu Üret
          </CardTitle>
          <CardDescription className="text-xs">
            Ne tür bir widget istediğinizi açıklayın. Sağdaki alanlara tıklayarak prompt'a ekleyebilirsiniz.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col gap-3 overflow-hidden">
          <ScrollArea className="flex-1">
            {/* Örnek Widget Seç - Büyüteç ile Modal */}
            <div className="mb-3">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full justify-between h-8"
                onClick={() => setShowExampleWidgetModal(true)}
              >
                <span className="flex items-center gap-2 text-xs">
                  <LucideIcons.Layers className="h-3.5 w-3.5" />
                  Örnek Widget Seç
                  {selectedExampleWidget && (
                    <Badge variant="secondary" className="text-[10px] h-4">1</Badge>
                  )}
                </span>
                <LucideIcons.Search className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
              
              {selectedExampleWidget && (
                <div className="mt-2 p-2 border rounded-lg bg-muted/30">
                  <Badge variant="outline" className="text-xs gap-1">
                    <Check className="h-3 w-3" />
                    {selectedExampleWidget}
                    <X 
                      className="h-3 w-3 cursor-pointer hover:text-destructive ml-1" 
                      onClick={() => setSelectedExampleWidget(null)}
                    />
                  </Badge>
                </div>
              )}
              
              {/* Örnek Widget Seçim Modal */}
              <ExampleWidgetPickerModal
                open={showExampleWidgetModal}
                onOpenChange={setShowExampleWidgetModal}
                selectedWidgetKey={selectedExampleWidget}
                onSelect={setSelectedExampleWidget}
                excludeWidgetId={editingWidget?.id}
              />
            </div>

            {/* DIA Model Referansları */}
            <Collapsible open={showModelLinks} onOpenChange={setShowModelLinks} className="mb-3">
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="w-full justify-between h-8">
                  <span className="flex items-center gap-2 text-xs">
                    <LucideIcons.BookOpen className="h-3.5 w-3.5" />
                    DIA Model Referansları
                    {diaModelLinks.length > 0 && (
                      <Badge variant="secondary" className="text-[10px] h-4">{diaModelLinks.length}</Badge>
                    )}
                  </span>
                  <LucideIcons.ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showModelLinks && "rotate-180")} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 p-3 border rounded-lg bg-muted/30 space-y-2">
                {diaModelLinks.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {diaModelLinks.map((link, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs gap-1">
                        <a href={link.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                          {link.modelName}
                        </a>
                        <X 
                          className="h-3 w-3 cursor-pointer hover:text-destructive" 
                          onClick={() => setDiaModelLinks(prev => prev.filter((_, i) => i !== idx))}
                        />
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    value={newModelLink}
                    onChange={(e) => setNewModelLink(e.target.value)}
                    placeholder="https://doc.dia.com.tr/doku.php?id=gelistirici:models:..."
                    className="flex-1 h-8 text-xs"
                    onKeyDown={(e) => e.key === 'Enter' && addDiaModelLink()}
                  />
                  <Button size="sm" variant="secondary" onClick={addDiaModelLink} className="h-8 px-3">
                    <LucideIcons.Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* AI Prompt */}
            <Textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Örnek: Vade yaşlandırma grafiği oluştur. X ekseninde vade dilimleri (90+ gün, 60-90, 30-60, 0-30, bugün, gelecek) Y ekseninde toplam bakiye göster..."
              className="min-h-[150px] resize-none"
            />
            
            {/* AI Zorunlulukları */}
            <Collapsible open={showAiRequirements} onOpenChange={setShowAiRequirements} className="mt-3">
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="w-full justify-between h-8">
                  <span className="flex items-center gap-2 text-xs">
                    <LucideIcons.Settings2 className="h-3.5 w-3.5" />
                    AI Zorunlulukları
                    <Badge variant="secondary" className="text-[10px] h-4">
                      {aiRequirements.filter(r => r.isActive).length + customRules.length}
                    </Badge>
                  </span>
                  <LucideIcons.ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showAiRequirements && "rotate-180")} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 p-3 border rounded-lg bg-muted/30 space-y-3">
                {/* Varsayılan kurallar (kilitli) */}
                <div className="space-y-2">
                  <div className="text-[10px] font-medium text-muted-foreground uppercase">Varsayılan (Değiştirilemez)</div>
                  {aiRequirements.filter(r => r.isDefault).map(rule => (
                    <div key={rule.id} className="flex items-start gap-2 text-xs opacity-60">
                      <Checkbox checked={true} disabled className="mt-0.5" />
                      <div>
                        <span className="font-medium">{rule.label}</span>
                        <span className="text-muted-foreground ml-1">- {rule.description}</span>
                      </div>
                    </div>
                  ))}
                </div>
                
                <Separator />
                
                {/* Seçilebilir kurallar */}
                <div className="space-y-2">
                  <div className="text-[10px] font-medium text-muted-foreground uppercase">Seçilebilir</div>
                  {aiRequirements.filter(r => !r.isDefault).map(rule => (
                    <div 
                      key={rule.id} 
                      className="flex items-start gap-2 text-xs cursor-pointer hover:bg-accent/50 rounded p-1 -m-1"
                      onClick={() => toggleAiRequirement(rule.id)}
                    >
                      <Checkbox checked={rule.isActive} className="mt-0.5" />
                      <div>
                        <span className="font-medium">{rule.label}</span>
                        <span className="text-muted-foreground ml-1">- {rule.description}</span>
                      </div>
                    </div>
                  ))}
                </div>
                
                <Separator />
                
                {/* Özel kurallar */}
                <div className="space-y-2">
                  <div className="text-[10px] font-medium text-muted-foreground uppercase">Özel Kurallar</div>
                  {customRules.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {customRules.map((rule, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs gap-1">
                          {rule.length > 30 ? rule.slice(0, 30) + '...' : rule}
                          <X 
                            className="h-3 w-3 cursor-pointer hover:text-destructive" 
                            onClick={() => setCustomRules(prev => prev.filter((_, i) => i !== idx))}
                          />
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Input
                      value={newCustomRule}
                      onChange={(e) => setNewCustomRule(e.target.value)}
                      placeholder='Örn: "Negatif değerleri kırmızı göster"'
                      className="flex-1 h-8 text-xs"
                      onKeyDown={(e) => e.key === 'Enter' && addCustomRule()}
                    />
                    <Button size="sm" variant="secondary" onClick={addCustomRule} className="h-8 px-3">
                      <LucideIcons.Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </ScrollArea>
          
          {/* Inline butonlar sadece Dialog modunda göster - tam sayfada bottom bar'da */}
          {!isFullPage && (
            <div className="flex items-center gap-2 pt-2 border-t">
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
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFullPromptContent(generateFullPromptPreview());
                  setShowFullPromptModal(true);
                }}
                className="gap-2"
              >
                <LucideIcons.FileText className="h-4 w-4" />
                Prompt'u Göster
              </Button>
              
              {sampleData.length === 0 && (
                <span className="text-xs text-destructive">
                  Önce veri kaynağı seçin
                </span>
              )}
            </div>
          )}
          
          {/* Tam sayfa modunda sadece uyarı göster */}
          {isFullPage && sampleData.length === 0 && (
            <div className="pt-2 border-t">
              <span className="text-xs text-destructive">
                Önce veri kaynağı seçin
              </span>
            </div>
          )}

          {/* Seçili Filtre Alanları */}
          {selectedFilterFields.length > 0 && (
            <div className="p-3 bg-muted/50 rounded-lg border">
              <div className="text-xs font-medium mb-2 flex items-center gap-2">
                <LucideIcons.Filter className="h-3 w-3" />
                Widget Filtre Alanları ({selectedFilterFields.length})
              </div>
              <div className="flex flex-wrap gap-1">
                {selectedFilterFields.map(field => (
                  <Badge 
                    key={field} 
                    variant="secondary" 
                    className="text-xs cursor-pointer hover:bg-destructive/20"
                    onClick={() => toggleFilterField(field)}
                  >
                    {field}
                    <X className="h-3 w-3 ml-1" />
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sağ: Kullanılabilir Alanlar (1/3) */}
      <Card className="flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <LucideIcons.ListFilter className="h-4 w-4" />
            Kullanılabilir Alanlar
            <Badge variant="secondary" className="text-xs ml-auto">
              {getAllAvailableFields().length}
            </Badge>
          </CardTitle>
          <CardDescription className="text-xs">
            Tıkla: prompt'a ekle • Sağ tık: filtre olarak seç
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col gap-3 overflow-hidden">
          {/* Arama */}
          <div className="relative">
            <LucideIcons.Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Alan ara..."
              value={fieldSearchTerm}
              onChange={(e) => setFieldSearchTerm(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>

          {/* Alan Listesi */}
          <ScrollArea className="flex-1">
            {filteredFields.length > 0 ? (
              <div className="space-y-1 pr-2">
                {filteredFields.map(field => {
                  const isFilterSelected = selectedFilterFields.includes(field.key);
                  return (
                    <div
                      key={field.key}
                      className={cn(
                        "group flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors cursor-pointer",
                        "hover:bg-accent",
                        isFilterSelected && "bg-primary/10 border border-primary/30"
                      )}
                      onClick={() => setAiPrompt(prev => prev + ` ${field.key}`)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        toggleFilterField(field.key);
                      }}
                    >
                      {/* Tip ikonu */}
                      <div className="shrink-0">
                        {field.sourceType === 'main' ? (
                          <LucideIcons.Database className="h-3 w-3 text-primary" />
                        ) : field.sourceType === 'merged' ? (
                          <LucideIcons.Link2 className="h-3 w-3 text-blue-500" />
                        ) : (
                          <LucideIcons.Calculator className="h-3 w-3 text-amber-500" />
                        )}
                      </div>
                      
                      {/* Alan adı */}
                      <span className="flex-1 truncate font-mono text-xs">{field.key}</span>
                      
                      {/* Filtre ikonu */}
                      {isFilterSelected ? (
                        <LucideIcons.Filter className="h-3 w-3 text-primary shrink-0" />
                      ) : (
                        <LucideIcons.Plus className="h-3 w-3 opacity-0 group-hover:opacity-50 shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : sampleData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center py-8">
                  <LucideIcons.Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Veri yüklenmedi</p>
                  <p className="text-xs">Önceki adımda veri kaynağı seçin</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground text-sm">
                Eşleşen alan bulunamadı
              </div>
            )}
          </ScrollArea>

          {/* Alt bilgi */}
          <div className="text-[10px] text-muted-foreground border-t pt-2">
            <div className="flex items-center gap-1.5 mb-1">
              <LucideIcons.Database className="h-3 w-3 text-primary" />
              <span>Ana Sorgu</span>
              <LucideIcons.Link2 className="h-3 w-3 text-blue-500 ml-2" />
              <span>Birleşik</span>
            </div>
            <span>Sağ tık ile filtre alanı olarak işaretle</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Step 3: Kod Düzenle
  const renderStep3 = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
      {/* Sol: Kod Editörü (2/3) */}
      <Card className="lg:col-span-2 flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Code className="h-4 w-4" />
              Kod Editörü
            </span>
            <div className="flex items-center gap-2">
              {codeError ? (
                <Badge variant="destructive" className="text-xs gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Hata
                </Badge>
              ) : customCode.trim() && (
                <Badge variant="outline" className="text-xs gap-1 bg-success/10 text-success">
                  <Check className="h-3 w-3" />
                  Geçerli
                </Badge>
              )}
              <Button size="sm" variant="ghost" onClick={copyCode}>
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col gap-3">
          <Textarea
            value={customCode}
            onChange={(e) => setCustomCode(e.target.value)}
            className="flex-1 font-mono text-xs resize-none min-h-[300px]"
            placeholder="Widget kodunuzu buraya yazın..."
          />
          
          {codeError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">{codeError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Sağ: AI Chat (1/3) */}
      <Card className="flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            AI ile Geliştir
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col gap-3">
          {/* Chat geçmişi */}
          {chatHistory.length > 0 && (
            <ScrollArea className="flex-1 border rounded-lg p-2 bg-muted/30 max-h-40">
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
          
          {/* Hızlı eylemler */}
          <div className="flex flex-wrap gap-1">
            {['🎨 Renkler', '🌍 Türkçe', '✨ Animasyon', '🌙 Dark'].map((action, i) => (
              <Button
                key={i}
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => setChatInput(
                  action.includes('Renk') ? 'Renkleri daha canlı yap' :
                  action.includes('Türkçe') ? 'Metinleri Türkçeleştir' :
                  action.includes('Animasyon') ? 'Hover animasyonları ekle' :
                  'Dark mode uyumlu yap'
                )}
              >
                {action}
              </Button>
            ))}
          </div>
          
          {/* Input */}
          <div className="flex gap-2">
            <Textarea 
              value={chatInput} 
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendChatMessage();
                }
              }}
              placeholder="Değişiklik isteği..."
              disabled={isChatLoading}
              className="min-h-[60px] resize-none text-xs"
            />
            <Button 
              size="icon" 
              onClick={sendChatMessage}
              disabled={isChatLoading || !chatInput.trim()}
              className="shrink-0"
            >
              {isChatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Önizleme görseli yakala (html2canvas)
  const capturePreviewImage = async () => {
    const previewElement = document.getElementById('widget-preview-container');
    if (!previewElement) {
      toast.error('Önizleme alanı bulunamadı');
      return;
    }
    
    setIsCapturingPreview(true);
    try {
      const canvas = await html2canvas(previewElement, {
        backgroundColor: null,
        scale: 0.5, // Düşük çözünürlük (thumbnail)
        logging: false,
        useCORS: true,
      });
      
      const imageData = canvas.toDataURL('image/png');
      setPreviewImage(imageData);
      toast.success('Önizleme görseli oluşturuldu');
    } catch (err) {
      console.error('Preview capture error:', err);
      toast.error('Görsel oluşturulamadı');
    } finally {
      setIsCapturingPreview(false);
    }
  };

  // Step 4: Önizle & Kaydet
  const renderStep4 = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
      {/* Sol: Önizleme (2/3) */}
      <Card className="lg:col-span-2 flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <DynamicIcon iconName={widgetIcon} className="h-4 w-4" />
              {widgetName}
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={capturePreviewImage}
              disabled={isCapturingPreview || !PreviewResult.component}
              className="gap-2 text-xs"
            >
              {isCapturingPreview ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <LucideIcons.Camera className="h-3 w-3" />
              )}
              {previewImage ? 'Görseli Güncelle' : 'Önizleme Görseli Oluştur'}
            </Button>
          </div>
          {shortDescription && (
            <CardDescription className="text-xs">{shortDescription}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="flex-1">
          {sampleData.length === 0 ? (
            <div className="border-2 border-dashed rounded-lg p-4 min-h-[300px] flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Veri yüklenmedi</p>
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
            <div id="widget-preview-container" className="h-[420px] border rounded-lg p-4 flex flex-col bg-card">
              <ErrorBoundary fallback={
                <div className="text-destructive text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Widget render hatası
                </div>
              }>
                {React.createElement(PreviewResult.component, { data: sampleData, colors: PreviewResult.colors, filters: {} })}
              </ErrorBoundary>
            </div>
          ) : (
            <div className="border-2 border-dashed rounded-lg p-4 min-h-[300px] flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Code className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Kod yazılmadı</p>
              </div>
            </div>
          )}
          
          {/* Önizleme görseli thumbnail */}
          {previewImage && (
            <div className="mt-3 flex items-center gap-3 p-2 bg-muted/30 rounded-lg">
              <img 
                src={previewImage} 
                alt="Widget önizleme" 
                className="h-12 w-20 object-cover rounded border"
              />
              <div className="flex-1 text-xs text-muted-foreground">
                Marketplace önizleme görseli hazır
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPreviewImage(null)}
                className="h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sağ: Özet + Metadata (1/3) */}
      <ScrollArea className="h-full">
        <div className="space-y-4 pr-2">
          {/* Widget Özeti */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Widget Özeti
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Key:</span>
                <span className="font-mono text-xs">{widgetKey}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ad:</span>
                <span className="font-medium">{widgetName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Boyut:</span>
                <Badge variant="outline">{widgetSize}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Kategori:</span>
                <Badge variant="outline">{getCategoryBySlug(widgetCategory)?.name || widgetCategory}</Badge>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Veri Kaynağı:</span>
                <span className="text-xs">
                  {isMultiQueryMode ? `${multiQuery?.queries?.length || 0} sorgu` : selectedDataSource?.name || '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Kayıt:</span>
                <span className="font-medium">{sampleData.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Kod Durumu:</span>
                {codeError ? (
                  <Badge variant="destructive" className="text-xs">Hatalı</Badge>
                ) : (
                  <Badge variant="outline" className="text-xs bg-success/10 text-success">Geçerli</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* AI Metadata - Kısa Açıklama */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <LucideIcons.FileText className="h-4 w-4" />
                Kısa Açıklama
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                placeholder="Widget'ın kısa açıklaması (Marketplace'de görünür)"
                className="text-sm"
                maxLength={100}
              />
              <div className="text-[10px] text-muted-foreground mt-1 text-right">
                {shortDescription.length}/100
              </div>
            </CardContent>
          </Card>

          {/* AI Önerilen Etiketler */}
          {aiSuggestedTags.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <LucideIcons.Tags className="h-4 w-4" />
                  Önerilen Etiketler
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1">
                  {aiSuggestedTags.map((tag, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Teknik Notlar */}
          {technicalNotes && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <LucideIcons.Wrench className="h-4 w-4" />
                  Teknik Notlar
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                {/* Kullanılan Alanlar */}
                {technicalNotes.usedFields && technicalNotes.usedFields.length > 0 && (
                  <Collapsible>
                    <CollapsibleTrigger className="flex items-center gap-2 text-muted-foreground hover:text-foreground w-full">
                      <LucideIcons.ChevronRight className="h-3 w-3" />
                      Kullanılan Alanlar ({technicalNotes.usedFields.length})
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pl-4 pt-2 space-y-1">
                      {technicalNotes.usedFields.map((field, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <span className="font-mono text-primary">{field.name}</span>
                          <span className="text-muted-foreground">({field.type})</span>
                          <span>- {field.usage}</span>
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Hesaplamalar */}
                {technicalNotes.calculations && technicalNotes.calculations.length > 0 && (
                  <Collapsible>
                    <CollapsibleTrigger className="flex items-center gap-2 text-muted-foreground hover:text-foreground w-full">
                      <LucideIcons.ChevronRight className="h-3 w-3" />
                      Hesaplamalar ({technicalNotes.calculations.length})
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pl-4 pt-2 space-y-1">
                      {technicalNotes.calculations.map((calc, idx) => (
                        <div key={idx}>
                          <span className="font-medium">{calc.name}:</span>
                          <span className="font-mono text-primary ml-1">{calc.formula}</span>
                          {calc.description && (
                            <span className="text-muted-foreground ml-1">- {calc.description}</span>
                          )}
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Veri Akışı */}
                {technicalNotes.dataFlow && (
                  <Collapsible>
                    <CollapsibleTrigger className="flex items-center gap-2 text-muted-foreground hover:text-foreground w-full">
                      <LucideIcons.ChevronRight className="h-3 w-3" />
                      Veri Akışı
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pl-4 pt-2">
                      <p className="text-muted-foreground">{technicalNotes.dataFlow}</p>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </CardContent>
            </Card>
          )}

          {/* Uzun Açıklama */}
          {longDescription && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <LucideIcons.BookOpen className="h-4 w-4" />
                  Detaylı Açıklama
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground whitespace-pre-wrap max-h-32 overflow-y-auto">
                  {longDescription}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );

  // Tam sayfa modu için content
  const builderContent = (
    <div className={cn(
      "flex flex-col",
      isFullPage ? "h-full pb-16" : "h-[95vh] md:h-[90vh]"
    )}>
      {/* Header - Dialog modunda DialogHeader kullanılır, tam sayfada üstte göster */}
      {!isFullPage && (
        <DialogHeader className="px-4 md:px-6 py-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Code className="h-5 w-5 text-primary" />
            {editingWidget ? 'Widget Düzenle' : 'Yeni Widget Oluştur'}
          </DialogTitle>
        </DialogHeader>
      )}
      
      {isFullPage && (
        <div className="px-4 md:px-6 py-3 border-b shrink-0 flex items-center justify-between bg-card">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onClose}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                {editingWidget ? 'Widget Düzenle' : 'AI Widget Builder'}
              </h1>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </Button>
        </div>
      )}

      {/* Stepper */}
      <StepperHeader />

      {/* Content */}
      <div className={cn(
        "flex-1 overflow-auto p-4",
        isFullPage && currentStep === 1 ? "pb-4" : ""
      )}>
        {currentStep === 0 && renderStep1()}
        {currentStep === 1 && renderStep2()}
        {currentStep === 2 && renderStep3()}
        {currentStep === 3 && renderStep4()}
      </div>

      {/* Footer Navigation - Dialog modu */}
      {!isFullPage && (
        <div className="px-4 md:px-6 py-3 border-t shrink-0 flex items-center justify-between">
          <Button 
            variant="outline" 
            onClick={handleBack}
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Geri
          </Button>
          
          <div className="flex items-center gap-2">
            {currentStep === 1 && (
              <Button 
                variant="ghost" 
                onClick={handleNext}
                className="text-muted-foreground"
              >
                Atla →
              </Button>
            )}
            
            {currentStep < WIZARD_STEPS.length - 1 ? (
              <Button 
                onClick={handleNext}
                disabled={!canProceed(currentStep)}
                className="gap-2"
              >
                İleri
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button 
                onClick={handleSave}
                disabled={isSaving || codeError !== null}
                className="gap-2"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {editingWidget ? 'Widget Güncelle' : 'Widget Oluştur'}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
  
  // Fixed Bottom Bar Component - Tam sayfa modu için
  const FixedBottomBar = () => (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t shadow-lg">
      <div className="flex items-center justify-between px-4 md:px-6 py-3 max-w-screen-2xl mx-auto">
        {/* Sol: Geri/İptal */}
        <Button 
          variant="outline" 
          onClick={currentStep === 0 ? onClose : handleBack}
          className="gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          {currentStep === 0 ? 'İptal' : 'Geri'}
        </Button>
        
        {/* Orta: Step 2'de AI butonları */}
        {currentStep === 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFullPromptContent(generateFullPromptPreview());
                setShowFullPromptModal(true);
              }}
              className="gap-2"
            >
              <LucideIcons.FileText className="h-4 w-4" />
              <span className="hidden md:inline">Prompt'u Göster</span>
            </Button>
            
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
              {isGeneratingCode ? 'Üretiliyor...' : 'AI ile Kod Üret'}
            </Button>
          </div>
        )}
        
        {/* Sağ: İleri/Kaydet */}
        <div className="flex items-center gap-2">
          {currentStep === 1 && (
            <Button 
              variant="ghost" 
              onClick={handleNext}
              className="text-muted-foreground"
            >
              Atla →
            </Button>
          )}
          
          {currentStep < WIZARD_STEPS.length - 1 ? (
            <Button 
              onClick={handleNext}
              disabled={!canProceed(currentStep)}
              className="gap-2"
            >
              İleri
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button 
              onClick={handleSave}
              disabled={isSaving || codeError !== null}
              className="gap-2"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editingWidget ? 'Güncelle' : 'Oluştur'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  // Tam sayfa modunda sadece content döndür + Fixed Bottom Bar
  if (isFullPage) {
    return (
      <>
        {builderContent}
        
        {/* Fixed Bottom Bar */}
        <FixedBottomBar />
        
        {/* Tam Prompt Görüntüleme Modal */}
        <Dialog open={showFullPromptModal} onOpenChange={setShowFullPromptModal}>
          <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <LucideIcons.FileText className="h-5 w-5 text-primary" />
                AI'ye Gönderilen Tam Prompt
              </DialogTitle>
              <DialogDescription>
                Bu içeriği kopyalayıp başka AI'lere (ChatGPT, Claude vb.) gönderebilirsiniz.
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex-1 min-h-0">
              <ScrollArea className="h-[55vh] border rounded-lg">
                <pre className="p-4 text-xs font-mono whitespace-pre-wrap bg-muted/30">
                  {fullPromptContent}
                </pre>
              </ScrollArea>
            </div>
            
            <DialogFooter className="flex items-center gap-2">
              <div className="text-xs text-muted-foreground mr-auto">
                {fullPromptContent.length.toLocaleString('tr-TR')} karakter
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(fullPromptContent);
                  toast.success('Prompt panoya kopyalandı!');
                }}
                className="gap-2"
              >
                <Copy className="h-4 w-4" />
                Kopyala
              </Button>
              <Button variant="secondary" onClick={() => setShowFullPromptModal(false)}>
                Kapat
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Dialog modu (mevcut davranış)
  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] md:w-full h-[95vh] md:h-[90vh] flex flex-col p-0 gap-0">
        {builderContent}
      </DialogContent>
    </Dialog>
    
    {/* Tam Prompt Görüntüleme Modal */}
    <Dialog open={showFullPromptModal} onOpenChange={setShowFullPromptModal}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LucideIcons.FileText className="h-5 w-5 text-primary" />
            AI'ye Gönderilen Tam Prompt
          </DialogTitle>
          <DialogDescription>
            Bu içeriği kopyalayıp başka AI'lere (ChatGPT, Claude vb.) gönderebilirsiniz.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-[55vh] border rounded-lg">
            <pre className="p-4 text-xs font-mono whitespace-pre-wrap bg-muted/30">
              {fullPromptContent}
            </pre>
          </ScrollArea>
        </div>
        
        <DialogFooter className="flex items-center gap-2">
          <div className="text-xs text-muted-foreground mr-auto">
            {fullPromptContent.length.toLocaleString('tr-TR')} karakter
          </div>
          <Button
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(fullPromptContent);
              toast.success('Prompt panoya kopyalandı!');
            }}
            className="gap-2"
          >
            <Copy className="h-4 w-4" />
            Kopyala
          </Button>
          <Button variant="secondary" onClick={() => setShowFullPromptModal(false)}>
            Kapat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
