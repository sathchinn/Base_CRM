import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppLayout from '@/components/ttc/AppLayout';

import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Dashboard from '@/pages/Dashboard';
import Leads from '@/pages/Leads';
import LeadsKanban from '@/pages/LeadsKanban';
import WhatsAppCRM from '@/pages/WhatsAppCRM';
import TradingViewMarketing from '@/pages/TradingViewMarketing';
import Bookings from '@/pages/Bookings';
import Customers from '@/pages/Customers';
import Subscriptions from '@/pages/Subscriptions';
import Payments from '@/pages/Payments';
import Products from '@/pages/Products';
import AutomationCenter from '@/pages/AutomationCenter';
import Analytics from '@/pages/Analytics';
import TeamManagement from '@/pages/TeamManagement';
import Settings from '@/pages/Settings';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/leads-kanban" element={<LeadsKanban />} />
          <Route path="/whatsapp" element={<WhatsAppCRM />} />
          <Route path="/marketing" element={<TradingViewMarketing />} />
          <Route path="/bookings" element={<Bookings />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/subscriptions" element={<Subscriptions />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/products" element={<Products />} />
          <Route path="/automation" element={<AutomationCenter />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/team" element={<TeamManagement />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App