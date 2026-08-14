import { Sun, Moon, Globe, ShieldCheck, Calculator as CalcIcon, Image as ImageIcon } from 'lucide-react';
import { Language, Theme, StoreSettings } from '../types';
import { t } from '../translations';

interface HeaderProps {
  theme: Theme;
  setTheme: (t: Theme) => void;
  lang: Language;
  setLang: (l: Language) => void;
  view: 'calc' | 'admin';
  setView: (v: 'calc' | 'admin') => void;
  storeSettings: StoreSettings;
}

export default function Header({ theme, setTheme, lang, setLang, view, setView, storeSettings }: HeaderProps) {
  const dict = t[lang];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-20 w-full bg-white/70 dark:bg-[#0a0a0c]/70 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
      <div className="max-w-5xl mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 mr-2">
          {storeSettings.logoUrl ? (
            <img src={storeSettings.logoUrl} alt="Store Logo" className="w-6 h-6 sm:w-8 sm:h-8 object-contain rounded shrink-0 dark:invert" />
          ) : (
            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-black dark:bg-white text-white dark:text-black rounded-md sm:rounded-lg flex items-center justify-center font-bold text-base sm:text-xl shrink-0">
              i
            </div>
          )}
          <span className="font-semibold text-lg sm:text-xl tracking-tight text-gray-900 dark:text-white truncate">
            {storeSettings.name || dict.title}
          </span>
        </div>

        <div className="flex items-center space-x-1 sm:space-x-4 shrink-0">
          <button
            onClick={() => setView('calc')}
            className={`flex items-center space-x-1.5 p-2 sm:px-3 sm:py-1.5 rounded-full text-sm font-medium transition-colors ${
              view === 'calc'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
            }`}
          >
            <CalcIcon className="w-4 h-4" />
            <span className="hidden sm:inline">{dict.calculator}</span>
          </button>
          
          <button
            onClick={() => setView('admin')}
            className={`flex items-center space-x-1.5 p-2 sm:px-3 sm:py-1.5 rounded-full text-sm font-medium transition-colors ${
              view === 'admin'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span className="hidden sm:inline">{dict.adminPanel}</span>
          </button>

          <div className="h-6 w-px bg-gray-300 dark:bg-gray-700 mx-1"></div>

          <button
            onClick={() => setLang(lang === 'en' ? 'mm' : 'en')}
            className="p-2 rounded-full text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors flex items-center justify-center"
            title="Toggle Language"
          >
            <Globe className="w-5 h-5" />
            <span className="ml-1.5 text-xs font-semibold uppercase">{lang}</span>
          </button>

          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="p-2 rounded-full text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors flex items-center justify-center"
            title="Toggle Theme"
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </header>
  );
}
