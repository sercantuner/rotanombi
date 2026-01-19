import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/hooks/useTheme";
import { AuthProvider } from "@/contexts/AuthContext";
import { UserSettingsProvider } from "@/contexts/UserSettingsContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { SalesPage } from "@/pages/SalesPage";
import { FinancePage } from "@/pages/FinancePage";
import { CustomersPage } from "@/pages/CustomersPage";
import { SettingsPage } from "@/pages/SettingsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <UserSettingsProvider>
              <Routes>
                {/* Default redirect to dashboard */}
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                
                {/* Main app routes with layout */}
                <Route path="/dashboard" element={<AppLayout><DashboardPage /></AppLayout>} />
                <Route path="/satis" element={<AppLayout><SalesPage /></AppLayout>} />
                <Route path="/finans" element={<AppLayout><FinancePage /></AppLayout>} />
                <Route path="/cari" element={<AppLayout><CustomersPage /></AppLayout>} />
                <Route path="/ayarlar" element={<AppLayout><SettingsPage /></AppLayout>} />
                
                {/* Alias for settings (English path) */}
                <Route path="/settings" element={<Navigate to="/ayarlar" replace />} />
                
                {/* Login page (standalone, no layout) */}
                <Route path="/login" element={<LoginPage />} />
                
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </UserSettingsProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
