// Super Admin Dashboard - Genel İstatistikler ve Grafikler
import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Boxes, Database, Shield, Crown, BarChart3, HardDrive, Tag } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface DashboardStats {
  totalUsers: number;
  demoUsers: number;
  licensedUsers: number;
  expiredUsers: number;
  activeWidgets: number;
  aiWidgets: number;
  totalDataSources: number;
  totalCategories: number;
  serverDistribution: { name: string; count: number }[];
  // New
  totalRecords: number;
  totalSizeBytes: number;
  serverDataUsage: { name: string; records: number; sizeMB: number }[];
  tagDistribution: { name: string; count: number; color: string }[];
}

const TAG_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-1, 220 70% 50%))',
  'hsl(var(--chart-2, 160 60% 45%))',
  'hsl(var(--chart-3, 30 80% 55%))',
  'hsl(var(--chart-4, 280 65% 60%))',
  'hsl(var(--chart-5, 340 75% 55%))',
  'hsl(var(--destructive))',
  'hsl(var(--muted-foreground))',
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const [profilesRes, widgetsRes, dsRes, catRes, tagStatsRes] = await Promise.all([
        supabase.from('profiles').select('user_id, license_type, license_expires_at, dia_sunucu_adi, firma_adi'),
        supabase.from('widgets').select('id, is_active, builder_config'),
        supabase.from('data_sources').select('id'),
        supabase.from('widget_categories').select('id'),
        supabase.from('widget_tags').select('category_id, widget_categories(name)'),
      ]);

      // Chunked fetch for cache stats (bypass 1000 row limit)
      const PAGE_SIZE = 5000;
      const cacheRows: { sunucu_adi: string }[] = [];
      let offset = 0;
      while (true) {
        const { data: page } = await supabase
          .from('company_data_cache')
          .select('sunucu_adi')
          .eq('is_deleted', false)
          .range(offset, offset + PAGE_SIZE - 1);
        if (!page || page.length === 0) break;
        cacheRows.push(...page);
        if (page.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      }

      const profiles = profilesRes.data || [];
      const widgets = widgetsRes.data || [];
      const now = new Date();

      const demoUsers = profiles.filter(p => p.license_type === 'demo').length;
      const expiredUsers = profiles.filter(p => p.license_expires_at && new Date(p.license_expires_at) < now).length;
      const licensedUsers = profiles.length - demoUsers;

      // Server distribution (users)
      const serverMap = new Map<string, number>();
      profiles.forEach(p => {
        const key = p.dia_sunucu_adi || 'Bağlantısız';
        serverMap.set(key, (serverMap.get(key) || 0) + 1);
      });
      const serverDistribution = Array.from(serverMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

      // Cache data stats per server (already fetched via chunked loop above)
      const serverCacheMap = new Map<string, number>();
      cacheRows.forEach((row) => {
        const key = row.sunucu_adi || 'Bilinmiyor';
        serverCacheMap.set(key, (serverCacheMap.get(key) || 0) + 1);
      });
      const totalRecords = cacheRows.length;
      
      // Approximate size: we can't get exact size from client, so estimate ~1KB per record
      // For accurate data we'd need an RPC, but this gives a reasonable estimate
      const estimatedBytesPerRecord = 1024;
      const totalSizeBytes = totalRecords * estimatedBytesPerRecord;

      const serverDataUsage = Array.from(serverCacheMap.entries())
        .map(([name, records]) => ({ 
          name, 
          records, 
          sizeMB: parseFloat((records * estimatedBytesPerRecord / (1024 * 1024)).toFixed(1)) 
        }))
        .sort((a, b) => b.records - a.records);

      // Tag distribution
      const tagMap = new Map<string, number>();
      (tagStatsRes.data || []).forEach((row: any) => {
        const catName = row.widget_categories?.name || 'Bilinmiyor';
        tagMap.set(catName, (tagMap.get(catName) || 0) + 1);
      });
      const tagDistribution = Array.from(tagMap.entries())
        .map(([name, count], i) => ({ name, count, color: TAG_COLORS[i % TAG_COLORS.length] }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 12);

      setStats({
        totalUsers: profiles.length,
        demoUsers,
        licensedUsers,
        expiredUsers,
        activeWidgets: widgets.filter(w => w.is_active).length,
        aiWidgets: widgets.filter(w => w.builder_config).length,
        totalDataSources: dsRes.data?.length || 0,
        totalCategories: catRes.data?.length || 0,
        serverDistribution,
        totalRecords,
        totalSizeBytes,
        serverDataUsage,
        tagDistribution,
      });
    } catch (err) {
      console.error('Stats load error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const licenseChartData = [
    { name: 'Lisanslı', value: stats.licensedUsers, color: 'hsl(var(--primary))' },
    { name: 'Demo', value: stats.demoUsers, color: 'hsl(var(--muted-foreground))' },
    { name: 'Süresi Dolmuş', value: stats.expiredUsers, color: 'hsl(var(--destructive))' },
  ].filter(d => d.value > 0);

  return (
    <div className="p-6 overflow-auto h-full space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              <span className="text-xs">Toplam Kullanıcı</span>
            </div>
            <p className="text-3xl font-bold">{stats.totalUsers}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.licensedUsers} lisanslı · {stats.demoUsers} demo
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Boxes className="h-4 w-4" />
              <span className="text-xs">Aktif Widget</span>
            </div>
            <p className="text-3xl font-bold">{stats.activeWidgets}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.aiWidgets} AI ile üretilmiş
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Database className="h-4 w-4" />
              <span className="text-xs">Veri Kaynağı</span>
            </div>
            <p className="text-3xl font-bold">{stats.totalDataSources}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.totalCategories} etiket
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <HardDrive className="h-4 w-4" />
              <span className="text-xs">Toplam Veri</span>
            </div>
            <p className="text-3xl font-bold">{stats.totalRecords.toLocaleString('tr-TR')}</p>
            <p className="text-xs text-muted-foreground mt-1">
              ~{formatBytes(stats.totalSizeBytes)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-destructive mb-1">
              <Shield className="h-4 w-4" />
              <span className="text-xs">Süresi Dolmuş</span>
            </div>
            <p className="text-3xl font-bold">{stats.expiredUsers}</p>
            <p className="text-xs text-muted-foreground mt-1">lisans yenilenmeli</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* License Distribution Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Crown className="h-4 w-4 text-primary" />
              Lisans Dağılımı
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={licenseChartData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                    {licenseChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number, name: string) => [`${value} kullanıcı`, name]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-2">
              {licenseChartData.map((d, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-muted-foreground">{d.name} ({d.value})</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Widget Tag Distribution Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" />
              Widget Etiket Dağılımı
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.tagDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="count">
                    {stats.tagDistribution.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number, name: string) => [`${value} widget`, name]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2">
              {stats.tagDistribution.slice(0, 6).map((d, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-muted-foreground">{d.name} ({d.count})</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Server Data Usage Bar */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Sunucu Veri Kullanımı
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.serverDataUsage} layout="vertical" margin={{ left: 0, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip 
                    formatter={(value: number, name: string) => {
                      if (name === 'records') return [`${value.toLocaleString('tr-TR')} kayıt`, 'Kayıt'];
                      return [`${value} MB`, 'Boyut'];
                    }} 
                  />
                  <Bar dataKey="records" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Server User Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Sunucu Başına Kullanıcı
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.serverDistribution} layout="vertical" margin={{ left: 0, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip formatter={(value: number) => [`${value} kullanıcı`]} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Summary table for server data */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-primary" />
              Sunucu Veri Detayı
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[180px] overflow-auto">
              {stats.serverDataUsage.map((s, i) => (
                <div key={i} className="flex items-center justify-between text-sm border-b border-border pb-1.5 last:border-0">
                  <span className="font-medium">{s.name}</span>
                  <div className="flex items-center gap-4 text-muted-foreground text-xs">
                    <span>{s.records.toLocaleString('tr-TR')} kayıt</span>
                    <span className="text-primary font-medium">{s.sizeMB} MB</span>
                  </div>
                </div>
              ))}
              {stats.serverDataUsage.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Henüz veri yok</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
