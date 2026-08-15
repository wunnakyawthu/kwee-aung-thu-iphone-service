import React, { useState, FormEvent } from 'react';
import { StoreSettings, Language } from '../types';
import { t } from '../translations';
import { supabase } from '../supabaseClient';
import { toast } from 'react-hot-toast';
import { Settings, Save, KeyRound, Key } from 'lucide-react';

interface StoreSettingsFormProps {
  lang: Language;
  storeSettings: StoreSettings;
  setStoreSettings: (settings: StoreSettings) => void;
  onLogout: () => void;
}

export default function StoreSettingsForm({ lang, storeSettings, setStoreSettings, onLogout }: StoreSettingsFormProps) {
  const dict = t[lang];
  
  // Branding States
  const [name, setName] = useState(storeSettings.name);
  const [logoUrl, setLogoUrl] = useState(storeSettings.logoUrl);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Security States (Only Passwords Now)
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingSecurity, setIsUpdatingSecurity] = useState(false);

  // Handle Logo Upload
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle Branding Save (Updated with current admin session email)
  const handleSaveBranding = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Store name cannot be empty.');
      return;
    }
    
    setIsSavingSettings(true);
    const loadingToast = toast.loading('Saving store branding...');
    
    try {
      // လက်ရှိ Login ဝင်ထားသော Admin ၏ user data ကို ယူခြင်း
      const { data: { user } } = await supabase.auth.getUser();
      const adminEmail = user?.email || 'admin@example.com';

      const { error } = await supabase.from('store_settings').upsert({
        id: 1,
        name: name,
        logo_url: logoUrl,
        admin_username: adminEmail, // ဘယ်သူ့အကောင့်နဲ့ ပြောင်းတယ်ဆိုတာကို ထည့်သွင်းခြင်း
      });

      if (error) throw error;

      setStoreSettings({ name, logoUrl });
      toast.success('Store branding saved successfully!', { id: loadingToast });
    } catch (err: any) {
      console.error('Error saving settings:', err);
      toast.error(err.message || 'Failed to save settings.', { id: loadingToast });
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Handle Password Update (Email removed due to Supabase Free Tier limitations)
  const handleUpdateSecurity = async (e: FormEvent) => {
    e.preventDefault();
    
    // 1. Validation (Fail Fast Principle)
    if (!newPassword) {
      toast.error('Please enter a new password.');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match!');
      return;
    }

    setIsUpdatingSecurity(true);
    const loadingToast = toast.loading('Updating password...');
    
    try {
      // 2. Update Password via Supabase Auth
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      
      if (error) throw error;

      // 3. Success & Secure Auto-Logout
      toast.success('Password updated successfully! Please login again.', { 
        id: loadingToast,
        duration: 4000 
      });
      
      setNewPassword('');
      setConfirmPassword('');

      // Force re-login by signing out and refreshing the page
      setTimeout(async () => {
        try {
          await supabase.auth.signOut();
        } catch (signOutErr) {
          console.error('Error during auto-logout:', signOutErr);
        }
        window.location.reload();
      }, 2000);

    } catch (err: any) {
      console.error('Error updating password:', err);
      toast.error(err.message || 'Failed to update password.', { id: loadingToast });
    } finally {
      setIsUpdatingSecurity(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      
      {/* 1. Store Branding Form */}
      <div className="bg-white dark:bg-[#1c1c1e] rounded-3xl shadow-sm border border-gray-200/50 dark:border-gray-800/50 overflow-hidden p-4 sm:p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Settings className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{dict.storeBranding || 'Store Branding'}</h3>
        </div>
        <form onSubmit={handleSaveBranding} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{dict.storeName || 'Store Name'}</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. iRepair Shop"
              className="w-full bg-gray-50 dark:bg-[#2c2c2e] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Store Logo (PNG/JPG)</label>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              {logoUrl && (
                <img src={logoUrl} alt="Preview" className="w-12 h-12 object-contain rounded-xl border border-gray-200/50 dark:border-gray-700 bg-white dark:bg-black shrink-0" />
              )}
              <input
                type="file"
                accept="image/png, image/jpeg"
                onChange={handleLogoUpload}
                className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-gray-100 dark:file:bg-[#2c2c2e] file:text-gray-700 dark:file:text-gray-300 hover:file:bg-gray-200 dark:hover:file:bg-[#3c3c3e] transition-colors cursor-pointer"
              />
            </div>
          </div>
          <div className="flex pt-2">
            <button 
              type="submit" 
              disabled={isSavingSettings} 
              className="bg-gray-900 hover:bg-black dark:bg-white dark:hover:bg-gray-100 disabled:opacity-50 dark:text-black text-white px-6 rounded-xl font-bold active:scale-95 transition-all flex items-center space-x-2 cursor-pointer w-full justify-center sm:w-auto h-12 text-base shadow-sm"
            >
              <Save className="w-5 h-5" />
              <span>{isSavingSettings ? 'Saving...' : 'Save Branding'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* 2. Security Form (Password Only) */}
      <div className="bg-white dark:bg-[#1c1c1e] rounded-3xl shadow-sm border border-gray-200/50 dark:border-gray-800/50 overflow-hidden p-4 sm:p-6">
        <div className="flex items-center space-x-2 mb-4">
          <KeyRound className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{dict.updatePassword || 'Update Password'}</h3>
        </div>
        <form onSubmit={handleUpdateSecurity} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center space-x-1.5">
              <Key className="w-4 h-4 text-gray-400" />
              <span>New Password</span>
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Min 6 characters"
              className="w-full bg-gray-50 dark:bg-[#2c2c2e] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
              minLength={6}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center space-x-1.5">
              <Key className="w-4 h-4 text-gray-400" />
              <span>Confirm New Password</span>
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="w-full bg-gray-50 dark:bg-[#2c2c2e] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
              minLength={6}
            />
          </div>
          <div className="flex pt-2">
            <button 
              type="submit" 
              disabled={isUpdatingSecurity || !newPassword || !confirmPassword} 
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 rounded-xl font-bold active:scale-95 transition-all flex items-center space-x-2 cursor-pointer w-full justify-center sm:w-auto h-12 text-base shadow-md shadow-blue-500/10 hover:shadow-blue-500/20"
            >
              <KeyRound className="w-5 h-5" />
              <span>{isUpdatingSecurity ? 'Updating...' : 'Change Password'}</span>
            </button>
          </div>
        </form>
      </div>
      
    </div>
  );
}
