// src/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

// 1. Environment variables များကို လုံခြုံစွာ ခေါ်ယူခြင်း
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 2. Fail-Fast Validation: 
// Configuration မမှန်ပါက App ကို တန်းရပ်ခိုင်းခြင်းဖြင့် မလိုလားအပ်သော Runtime error များကို ကာကွယ်သည်။
if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Supabase configuration is missing. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your environment variables.'
  );
}

// 3. Singleton Instance: 
// App တစ်ခုလုံးအတွက် Client တစ်ခုတည်းကိုသာ အသုံးပြုခြင်းဖြင့် Memory နှင့် Connection ကို သက်သာစေသည်။
export const supabase = createClient(supabaseUrl, supabaseKey);
