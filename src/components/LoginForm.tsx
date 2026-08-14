import React, { useState, FormEvent } from 'react';
import { supabase } from '../supabaseClient';
import { toast } from 'react-hot-toast';
import { ShieldCheck } from 'lucide-react';
import { Language } from '../types';
import { t } from '../translations';

interface LoginFormProps {
  lang: Language;
  onLoginSuccess: () => void;
}

export default function LoginForm({ lang, onLoginSuccess }: LoginFormProps) {
  const dict = t[lang];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error('Please enter both email and password.');
      return;
    }
    setIsSubmitting(true);
    const loadingToast = toast.loading('Signing in...');
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error(error.message || dict.invalidPass, { id: loadingToast });
      } else {
        toast.success('Signed in successfully!', { id: loadingToast });
        onLoginSuccess();
      }
    } catch (err: any) {
      toast.error(err.message || 'An unexpected error occurred.', { id: loadingToast });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-[60vh] sm:min-h-[70vh]">
      <div className="w-full max-w-md bg-white dark:bg-[#1c1c1e] p-6 sm:p-8 rounded-2xl sm:rounded-3xl shadow-sm border border-gray-200/50 dark:border-gray-800/50 animate-in fade-in zoom-in-95">
        <div className="text-center mb-6 sm:mb-8">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4">
            <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{dict.adminAuth}</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-50 dark:bg-[#2c2c2e] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
              placeholder="admin@example.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">{dict.password}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-50 dark:bg-[#2c2c2e] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
              placeholder="••••••••"
              required
            />
          </div>
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 font-medium transition-colors mt-2 sm:mt-0 cursor-pointer disabled:opacity-50 text-sm sm:text-base flex justify-center items-center h-12"
          >
            {isSubmitting ? 'Signing in...' : dict.login}
          </button>
        </form>
      </div>
    </div>
  );
}
