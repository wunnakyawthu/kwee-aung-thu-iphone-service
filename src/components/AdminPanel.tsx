import React, { useState, useEffect } from 'react';
import { PhoneModel, Language, StoreSettings } from '../types';
import { t } from '../translations';
import { LogOut, ShieldCheck } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { toast } from 'react-hot-toast';

// Child components
import LoginForm from './LoginForm';
import StoreSettingsForm from './StoreSettingsForm';
import ModelManagementTable from './ModelManagementTable';

interface AdminPanelProps {
  models: PhoneModel[];
  setModels: (models: PhoneModel[]) => void;
  lang: Language;
  storeSettings: StoreSettings;
  setStoreSettings: (settings: StoreSettings) => void;
}

export default function AdminPanel({
  models,
  setModels,
  lang,
  storeSettings,
  setStoreSettings,
}: AdminPanelProps) {
  const dict = t[lang];
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSessionLoading, setIsSessionLoading] = useState(true);

  // Securely fetch active Supabase auth session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
      setIsSessionLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    const logoutToast = toast.loading('Signing out...');
    try {
      await supabase.auth.signOut();
      setIsAuthenticated(false);
      toast.success('Signed out successfully!', { id: logoutToast });
    } catch (err: any) {
      console.error('Error logging out:', err);
      toast.error(err.message || 'Error signing out.', { id: logoutToast });
    }
  };

  if (isSessionLoading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <LoginForm
        lang={lang}
        onLoginSuccess={() => setIsAuthenticated(true)}
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center bg-white dark:bg-[#1c1c1e] p-6 rounded-3xl border border-gray-200/50 dark:border-gray-800/50 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              {dict.adminPanel}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Logged in as Administrator
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center space-x-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 px-4 py-2.5 rounded-full text-sm font-medium transition-colors cursor-pointer h-10 shadow-sm shrink-0"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">{dict.logout}</span>
        </button>
      </div>

      {/* Store Settings Form Section */}
      <StoreSettingsForm
        lang={lang}
        storeSettings={storeSettings}
        setStoreSettings={setStoreSettings}
        onLogout={handleLogout}
      />

      {/* Model Management CRUD Table Section */}
      <ModelManagementTable
        models={models}
        setModels={setModels}
        lang={lang}
      />
    </div>
  );
}
