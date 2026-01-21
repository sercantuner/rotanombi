import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/hooks/useTheme";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { UserSettingsProvider } from "@/contexts/UserSettingsContext";
import { DiaDataCacheProvider } from "@/contexts/DiaDataCacheContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { TeamManagementPage } from "@/pages/TeamManagementPage";
import AdminPage from "@/pages/AdminPage";
import SuperAdminPage from "@/pages/SuperAdminPage";
import { DynamicPage } from "@/components/pages/DynamicPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Wrapper component - AuthContext içinden userId'yi alıp DiaDataCacheProvider'a geçirir
function AppWithCache({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return (
    <DiaDataCacheProvider userId={user?.id}>
      {children}
    </DiaDataCacheProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <UserSettingsProvider>
              <AppWithCache>
                <Routes>
                  {/* Default redirect to dashboard */}
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  
                  {/* Main app routes with layout */}
                  <Route path="/dashboard" element={<AppLayout><DashboardPage /></AppLayout>} />
                  <Route path="/ayarlar" element={<AppLayout><SettingsPage /></AppLayout>} />
                  <Route path="/admin" element={<AppLayout><AdminPage /></AppLayout>} />
                  <Route path="/super-admin" element={<AppLayout><SuperAdminPage /></AppLayout>} />
                  <Route path="/takim" element={<AppLayout><TeamManagementPage /></AppLayout>} />
                  
                  {/* Dynamic user pages */}
                  <Route path="/page/:pageSlug" element={<AppLayout><DynamicPage /></AppLayout>} />
                  
                  {/* Alias for settings (English path) */}
                  <Route path="/settings" element={<Navigate to="/ayarlar" replace />} />
                  
                  {/* Login page (standalone, no layout) */}
                  <Route path="/login" element={<LoginPage />} />
                  
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </AppWithCache>
            </UserSettingsProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
