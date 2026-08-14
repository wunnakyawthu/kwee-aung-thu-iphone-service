/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { PhoneModel, Language, Theme, StoreSettings } from './types';
import Header from './components/Header';
import Calculator from './components/Calculator';
import AdminPanel from './components/AdminPanel';
import { supabase } from './supabaseClient';
import { Toaster } from 'react-hot-toast';
import { Smartphone, X } from 'lucide-react';

export default function App() {
  const [models, setModels] = useState<PhoneModel[]>([]);
  const [lang, setLang] = useState<Language>('en');
  const [theme, setTheme] = useState<Theme>('light');
  const [view, setView] = useState<'calc' | 'admin'>('calc');
  const [storeSettings, setStoreSettings] = useState<StoreSettings>({ name: '', logoUrl: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedModelId, setSelectedModelId] = useState<string>('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    
    // Fetch Settings
    const { data: settingsData, error: settingsError } = await supabase
      .from('store_settings')
      .select('*')
      .single();
      
    if (settingsData) {
      setStoreSettings({
        name: settingsData.name || '',
        logoUrl: settingsData.logo_url || '',
      });
    }

    // Fetch Models with Parts nested relation
    const { data: modelsData, error: modelsError } = await supabase
      .from('phone_models')
      .select('id, name, repair_parts(id, name, price, warranty_period)')
      .order('created_at', { ascending: true });

    if (modelsError) {
      console.error('Error fetching models:', modelsError);
    }

    if (modelsData) {
      const formattedModels = modelsData.map((m: any) => ({
        id: m.id,
        name: m.name,
        parts: (m.repair_parts || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          price: p.price,
          warrantyPeriod: p.warranty_period || ''
        }))
      }));
      setModels(formattedModels);
    } else {
      setModels([]); // Database မှာမရှိရင် ဘာမှမပြပါနဲ့
    }
    
    setIsLoading(false);
  };

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center dark:bg-black dark:text-white">Loading...</div>;
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-[#0a0a0c] text-gray-900 dark:text-gray-100 font-sans transition-colors duration-200 relative overflow-hidden">
      {/* 1. Ambient Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40rem] h-[40rem] bg-blue-400/20 dark:bg-blue-600/20 rounded-full blur-[100px] pointer-events-none z-0" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40rem] h-[40rem] bg-purple-400/20 dark:bg-purple-600/20 rounded-full blur-[100px] pointer-events-none z-0" />
      <div className="absolute top-[40%] left-[30%] w-[30rem] h-[30rem] bg-emerald-300/10 dark:bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none z-0" />

      {/* 2. Main Content */}
      <Toaster position="top-center" reverseOrder={false} />
      <Header theme={theme} setTheme={setTheme} lang={lang} setLang={setLang} view={view} setView={setView} storeSettings={storeSettings} />
      
      {/* Header ၏ အမြင့် h-20 (80px) နှင့် တိကျစွာ တူညီသော နေရာလွတ်ကို ဖန်တီးပေးခြင်းဖြစ်သည် */}
      <div className="h-20 w-full flex-shrink-0" />

      {/* Model Selection - Absolute Floating Glass Component */}
      {view === 'calc' && selectedModelId && (
        /* 
          h-0 နှင့် relative ကိုသုံးထားသောကြောင့် ဤ နေရာသည် အကျယ်/အမြင့် လုံးဝ မယူတော့ပါ။ 
          ထို့ကြောင့် နောက်ခံ Background ဝင်စရာ နေရာမရှိတော့ပါ။
        */
        <div className="w-full flex justify-center relative z-50 h-0">
          
          {/* absolute ဖြင့် လေထဲတွင် ဝဲနေစေပါသည်။ top-4 ဖြင့် အပေါ်မှ အနည်းငယ် ခွာထားပါသည်။ */}
          <div className="absolute top-4 inline-flex items-center gap-3 px-4 py-2 rounded-full 
                          bg-white/20 dark:bg-white/10 
                          backdrop-blur-md 
                          border border-white/40 dark:border-white/10 
                          shadow-[0_8px_32px_rgba(0,0,0,0.2)] 
                          transition-all duration-300">
            
            {/* Icon Area */}
            <div className="flex items-center justify-center w-7 h-7 bg-blue-600 rounded-full shadow-inner">
              <Smartphone className="w-3.5 h-3.5 text-white" />
            </div>
            
            {/* Text Area */}
            <div className="flex flex-col justify-center pr-2">
              <span className="text-[9px] font-bold text-gray-800 dark:text-gray-300 uppercase tracking-widest leading-none mb-1">
                Repairing
              </span>
              <span className="text-sm font-extrabold text-gray-900 dark:text-white leading-none">
                {models.find(m => m.id === selectedModelId)?.name}
              </span>
            </div>

            {/* Clear Button */}
            <button 
              onClick={() => setSelectedModelId('')} 
              className="flex items-center justify-center w-6 h-6 ml-1 text-gray-500 hover:text-red-500 hover:bg-red-500/20 rounded-full transition-colors focus:outline-none"
              aria-label="Clear selected model"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            
          </div>
        </div>
      )}

      {/* Scrollable Content - ဒီနေရာပဲ Scroll ဖြစ်မယ် */}
      <main className="flex-1 overflow-y-auto w-full relative z-10">
        <div className="max-w-5xl mx-auto p-4 md:p-6 pb-24 min-h-full flex flex-col">
          <div className="flex-grow">
            {view === 'calc' ? (
              <Calculator models={models} lang={lang} theme={theme} selectedModelId={selectedModelId} onSelectModel={setSelectedModelId} />
            ) : (
              <AdminPanel models={models} setModels={setModels} lang={lang} storeSettings={storeSettings} setStoreSettings={setStoreSettings} />
            )}
          </div>
          
          {/* 3. Developer & Copyright Footer */}
          <footer className="w-full p-4 md:p-6 text-center border-t border-gray-100/50 dark:border-gray-800/50 mt-12 bg-white/10 dark:bg-black/10 backdrop-blur-sm rounded-3xl mb-4">
            <div className="flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 text-xs md:text-sm text-gray-500 dark:text-gray-400 font-medium">
              <span>&copy; {new Date().getFullYear()} Apple Art. All Rights Reserved.</span>
              <span className="hidden md:inline text-gray-300 dark:text-gray-600">|</span>
              <span>
                Developed by{' '}
                <a 
                  href="https://www.facebook.com/wunna.kyaw.thu.wnkt?" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-gray-700 dark:text-gray-300 font-bold tracking-wide hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors duration-200 cursor-pointer"
                  title="Visit Wunna Kyaw Thu on Facebook"
                >
                  Wunna Kyaw Thu
                </a>
              </span>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}

