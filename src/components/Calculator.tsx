import { useState, useMemo, useEffect } from 'react';
import { PhoneModel, PhonePart, Language, Theme } from '../types';
import { t } from '../translations';
import { ChevronDown, Loader2, Smartphone, Battery, Zap, ShieldCheck, Tag, Wifi, Volume2, Power, Radio, Cpu, ScanFace, Trash2, Receipt, Search, X, CheckCircle2 } from 'lucide-react';
import { supabase } from '../supabaseClient';

interface CalculatorProps {
  models: PhoneModel[];
  selectedModelId: string;
  onSelectModel: (id: string) => void;
  lang: Language;
  theme?: Theme;
}

const formatMMK = (amount: number) => {
  return amount.toLocaleString('en-US') + ' MMK';
};

// O(N) mapping approach - Grouping keywords logically for better maintainability
const getPartIcon = (name: string) => {
  const lowerName = name.toLowerCase();

  // Biometrics & Security (Face ID, Touch ID)
  if (lowerName.includes('face') || lowerName.includes('biometric')) {
    // Face ID အတွက် မျက်နှာ Scan ဖတ်သည့်ပုံစံကို သုံးပြီး သီးသန့်အရောင် (ဥပမာ - Cyan သို့မဟုတ် Violet) ထားပေးပါ
    return <ScanFace className="w-5 h-5 text-violet-500" />;
  }

  // 1. Connectivity & Network (Wifi, Bluetooth, Network)
  if (lowerName.includes('wifi') || lowerName.includes('bluetooth') || lowerName.includes('network')) {
    return <Wifi className="w-5 h-5 text-blue-500" />;
  }

  // 2. Audio & Sound (Speaker, Ring, Mic, Ear Speaker)
  if (lowerName.includes('speaker') || lowerName.includes('ring') || lowerName.includes('mic')) {
    return <Volume2 className="w-5 h-5 text-indigo-500" />;
  }

  // 3. Power & Logic Board (No Power, Short, Power Key)
  if (lowerName.includes('power') || lowerName.includes('short')) {
    return <Power className="w-5 h-5 text-red-500" />;
  }

  // 4. IC & Board level repairs (Logic Layer Swap စသည်တို့အတွက်)
  if (lowerName.includes('board') || lowerName.includes('ic') || lowerName.includes('logic')) {
    return <Cpu className="w-5 h-5 text-purple-500" />;
  }

  // 5. Existing Core Parts
  if (lowerName.includes('battery')) {
    return <Battery className="w-5 h-5 text-emerald-500" />;
  }
  if (lowerName.includes('screen') || lowerName.includes('display') || lowerName.includes('glass')) {
    return <Smartphone className="w-5 h-5 text-sky-500" />;
  }
  if (lowerName.includes('flex') || lowerName.includes('cable') || lowerName.includes('charging')) {
    return <Zap className="w-5 h-5 text-amber-500" />;
  }

  // Fallback Icon (မသိတဲ့ Part အသစ်တွေလာရင် ပြရန်)
  return <ShieldCheck className="w-5 h-5 text-gray-400" />;
};

export default function Calculator({ models, selectedModelId, onSelectModel, lang, theme = 'light' }: CalculatorProps) {
  const dict = t[lang];
  const [discounts, setDiscounts] = useState<Record<string, number>>({});
  const [selectedPartIds, setSelectedPartIds] = useState<Record<string, boolean>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleModelChange = (modelId: string) => {
    onSelectModel(modelId);
    setIsModalOpen(false);
  };

  const isDark = theme === 'dark';

  const groupedOptions = useMemo(() => {
    if (!models) return [];
    const groups: Record<string, { value: string; label: string }[]> = {};

    models.forEach(model => {
      // Model name ပေါ်မူတည်ပြီး Group ခွဲခြင်း (ဥပမာ: "iPhone 15" ဆိုရင် "iPhone 15 Series" လို့ခွဲမယ်)
      // သင့် Model နာမည် Format တွေက ညီဖို့တော့လိုပါတယ်
      const series = model.name.split(' ').slice(0, 2).join(' ') + ' Series'; 
      
      if (!groups[series]) groups[series] = [];
      groups[series].push({ value: model.id, label: model.name });
    });

    return Object.entries(groups).map(([series, items]) => ({
      label: series,
      options: items
    }));
  }, [models]);

  const selectedOption = useMemo(() => {
    for (const group of groupedOptions) {
      const found = group.options.find(o => o.value === selectedModelId);
      if (found) return found;
    }
    return null;
  }, [groupedOptions, selectedModelId]);

  const selectedModel = useMemo(() => 
    models.find(m => m.id === selectedModelId), 
  [models, selectedModelId]);

  const [parts, setParts] = useState<PhonePart[]>([]);
  const [isLoadingParts, setIsLoadingParts] = useState(false);

  // Fetch parts when model changes
  useEffect(() => {
    setDiscounts({});
    setSelectedPartIds({});
    
    if (!selectedModelId) {
      setParts([]);
      return;
    }

    const fetchParts = async () => {
      setIsLoadingParts(true);
      const { data, error } = await supabase
        .from('repair_parts')
        .select('*')
        .eq('model_id', selectedModelId);
      
      if (data) {
        setParts(data.map(p => ({
          id: p.id,
          name: p.name,
          price: p.price,
          warrantyPeriod: p.warranty_period
        })));
      } else {
        setParts([]);
      }
      setIsLoadingParts(false);
    };

    fetchParts();
  }, [selectedModelId]);

  const handleDiscountChange = (partId: string, value: number) => {
    setDiscounts(prev => ({ ...prev, [partId]: value }));
  };

  const togglePartSelection = (partId: string) => {
    setSelectedPartIds(prev => ({
      ...prev,
      [partId]: !prev[partId]
    }));
  };

  const clearSelection = () => {
    setSelectedPartIds({});
  };

  const totalBill = useMemo(() => {
    if (!selectedModel) return 0;
    return parts.reduce((sum, part) => {
      if (!selectedPartIds[part.id]) return sum;
      const d = discounts[part.id] || 0;
      return sum + (part.price * (1 - d / 100));
    }, 0);
  }, [selectedModel, parts, discounts, selectedPartIds]);

  const hasSelection = Object.values(selectedPartIds).some(Boolean);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-32">
      
      {/* Professional Empty State Design */}
      {!selectedModelId && (
        <div className="flex flex-col items-center justify-center min-h-[40vh] px-4 animate-in fade-in duration-700">
          
          {/* Icon Container - Floating Animation */}
          <div className="mb-8 p-5 rounded-3xl bg-white/40 dark:bg-white/5 backdrop-blur-xl border border-white/50 dark:border-white/10 shadow-sm animate-bounce-slow">
            <Smartphone className="w-10 h-10 text-blue-600 dark:text-blue-400" />
          </div>

          {/* Liquid Glass Button - Pulse Animation */}
          <button 
            onClick={() => setIsModalOpen(true)}
            className="group relative px-10 py-4 rounded-full 
                       bg-white/30 dark:bg-white/5 backdrop-blur-2xl 
                       border border-white/50 dark:border-white/10 
                       shadow-[0_8px_30px_rgba(0,0,0,0.04)]
                       hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] 
                       hover:scale-105 active:scale-95 transition-all duration-300
                       text-base font-semibold text-gray-700 dark:text-gray-200"
          >
            <span className="flex items-center gap-2">
              Select Model
              {/* Animated Dot */}
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-600"></span>
              </span>
            </span>
          </button>
        </div>
      )}

      {/* Model Selection Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsModalOpen(false)}>
          <div 
            className="bg-white dark:bg-[#1c1c1e] w-full max-w-sm md:max-w-md rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-gray-100 dark:border-gray-800"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 pb-2 flex items-center justify-between border-b border-gray-100 dark:border-gray-800 mb-4">
              <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">Select Model</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Models List */}
            <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-8">
              {groupedOptions.map((group) => (
                <div key={group.label} className="space-y-4">
                  {/* Series ခေါင်းစဉ် */}
                  <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800 pb-2">
                    {group.label}
                  </h3>
                  
                  {/* Grid Layout - 2 columns or 3 columns on larger screens */}
                  <div className="grid grid-cols-2 gap-3">
                    {group.options.map((model) => {
                      const isSelected = model.value === selectedModelId;
                      return (
                        <button
                          key={model.value}
                          onClick={() => handleModelChange(model.value)}
                          className={`flex flex-col items-center justify-center gap-3 p-4 rounded-2xl transition-all duration-200 border text-center ${
                            isSelected 
                              ? 'bg-blue-600/10 border-blue-500/30 shadow-md' 
                              : 'bg-gray-50 dark:bg-[#2c2c2e] border-transparent hover:bg-gray-100 dark:hover:bg-gray-800'
                          }`}
                        >
                          <Smartphone className={`w-6 h-6 ${isSelected ? 'text-blue-600' : 'text-gray-400'}`} />
                          <span className={`text-sm font-semibold ${isSelected ? 'text-blue-700' : 'text-gray-700 dark:text-gray-200'}`}>
                            {model.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* အောက်ပိုင်းမှ data များ */}
      {!!selectedModelId && (
        <>
          {isLoadingParts ? (
            <div className="flex justify-center py-12 text-blue-600">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : parts.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-white/50 dark:bg-[#1c1c1e]/50 rounded-3xl border border-dashed border-gray-300 dark:border-gray-800">
              No repair parts found for this model.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {parts.map(part => {
                const isSelected = !!selectedPartIds[part.id];
            const discount = discounts[part.id] || 0;
            const finalPrice = part.price * (1 - discount / 100);
            
            return (
              <div 
                key={part.id} 
                onClick={() => togglePartSelection(part.id)}
                className={`relative p-5 rounded-3xl transition-all duration-300 cursor-pointer backdrop-blur-xl border-2 flex flex-col gap-3
                  ${isSelected 
                    ? 'bg-blue-500/5 dark:bg-blue-400/10 border-blue-500/90 shadow-[0_8px_30px_rgba(59,130,246,0.15)] scale-[1.02]' 
                    : 'bg-white/20 dark:bg-white/5 border-white/40 dark:border-white/10 shadow-sm hover:bg-white/30 dark:hover:bg-white/10'
                  }`}
              >
                {/* Active Glow Effect */}
                {isSelected && <div className="absolute top-[-20%] right-[-20%] w-40 h-40 bg-blue-500/20 blur-3xl rounded-full pointer-events-none z-0" />}
                
                <div className="relative z-10 flex items-center gap-4 mb-5">
                  <div className="p-3.5 rounded-2xl bg-white/70 dark:bg-white/5 border border-white/50 dark:border-white/10 shadow-sm flex items-center justify-center shrink-0">
                    {getPartIcon(part.name)}
                  </div>
                  <h4 className={`font-bold text-lg line-clamp-2 transition-colors ${isSelected ? 'text-blue-700 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
                    {part.name}
                  </h4>
                </div>
                
                <div className="relative z-10 space-y-3 flex-grow">
                  {/* Price Section */}
                  <div className="flex justify-between items-center border-b border-gray-200/50 dark:border-gray-700/50 pb-2">
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{dict.originalPrice}</span>
                    <span className="font-extrabold text-lg text-gray-900 dark:text-white">
                      {part.price.toLocaleString()} <span className="text-sm">MMK</span>
                    </span>
                  </div>
                  
                  {/* Warranty Section (Modern Trust Badge) */}
                  {part.warrantyPeriod && (
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{dict.warranty}</span>
                      
                      {/* Warranty Section (Consistently Green Trust Badge) */}
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition-colors duration-300 bg-emerald-50/60 border-emerald-200/60 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800/50 dark:text-emerald-400">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>{part.warrantyPeriod}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="relative z-10 pt-3 border-t border-gray-100 dark:border-gray-800/60 mt-auto" onClick={(e) => e.stopPropagation()}>
                  <div className="relative">
                    <select
                      value={discount}
                      onChange={(e) => handleDiscountChange(part.id, Number(e.target.value))}
                      className={`w-full text-sm appearance-none border rounded-xl p-2.5 pr-8 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors cursor-pointer ${isSelected ? 'bg-white/60 dark:bg-black/30 border-blue-200 dark:border-blue-800/60 text-blue-900 dark:text-blue-100' : 'bg-gray-50 dark:bg-black border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white'}`}
                    >
                      <option value={0}>No Discount</option>
                      {[5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60].map(pct => (
                        <option key={pct} value={pct}>{pct}% Off</option>
                      ))}
                    </select>
                    <div className={`pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 ${isSelected ? 'text-blue-500' : 'text-gray-500'}`}>
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                {discount > 0 && (
                  <div className="relative z-10 pt-2 flex justify-between items-center text-sm">
                    <span className="text-gray-500">{dict.finalPrice}:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatMMK(finalPrice)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      </>
      )}

      {/* Total Bill & Actions (Floating Glass Island) */}
      {hasSelection && (
        // 1. Wrapper: pointer-events-none ဖြင့် ဘေးဘောင်လွတ်နေသော နေရာများကို ဖြတ်နှိပ်ခွင့်ပေးထားသည်
        <div className="fixed bottom-6 left-0 right-0 z-50 px-4 pointer-events-none">
          
          {/* 2. Main Floating Bar: pointer-events-auto ဖြင့် ဤနေရာကိုသာ နှိပ်ခွင့်ပြုသည် */}
          <div className="max-w-4xl mx-auto pointer-events-auto">
            <div className="bg-white/70 dark:bg-[#1c1c1e]/70 backdrop-blur-2xl border border-white/50 dark:border-gray-700/50 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.2)] rounded-[2rem] p-4 md:px-6 md:py-4 flex flex-col md:flex-row items-center justify-between gap-4 transition-all duration-300">
              
              {/* Left Section: Price Information */}
              <div className="flex flex-col items-center md:items-start w-full md:w-auto">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                    Total Estimate
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100/80 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/50 uppercase tracking-wider">
                    {/* iPhone 11 အစရှိသဖြင့် Dynamic လာမည့် နေရာ */}
                    {selectedModel?.name} 
                  </span>
                </div>
                <div className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-baseline gap-2">
                  {totalBill.toLocaleString()} 
                  <span className="text-lg md:text-xl font-bold text-gray-400 dark:text-gray-500">MMK</span>
                </div>
              </div>

              {/* Right Section: Action Buttons */}
              <div className="flex items-center justify-end w-full md:w-auto mt-2 md:mt-0">
                
                {/* Enhanced Clear Selection Button */}
                <button 
                  onClick={clearSelection} // သင့်၏ clear state function ကို ဤနေရာတွင် ထည့်ပါ
                  // UX: ပိုမိုမြင်သာစေရန် အနီနုရောင်နောက်ခံ၊ အရိပ် (Shadow) နှင့် နှိပ်လိုက်လျှင် scale အနည်းငယ်ကျုံ့သွားမည့် Effect များ ထည့်သွင်းထားသည်
                  className="flex-1 md:flex-none flex items-center justify-center gap-2.5 px-6 py-3 rounded-2xl text-sm font-bold text-red-600 bg-red-50 border border-red-100 shadow-sm hover:bg-red-100 hover:shadow-md dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20 dark:hover:bg-red-500/20 transition-all duration-200 active:scale-95"
                >
                  <Trash2 className="w-5 h-5" />
                  <span>Clear Selection</span>
                </button>

              </div>
              
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
