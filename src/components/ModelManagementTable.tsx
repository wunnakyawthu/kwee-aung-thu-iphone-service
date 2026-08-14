import React, { useState, useRef } from 'react';
import { PhoneModel, PhonePart, Language } from '../types';
import { t } from '../translations';
import { supabase } from '../supabaseClient';
import { toast } from 'react-hot-toast';
import { 
  Trash2, 
  Edit2, 
  Plus, 
  Check, 
  X, 
  ChevronDown, 
  ChevronRight, 
  Package, 
  Shield, 
  Wrench, 
  DollarSign,
  Smartphone,
  AlertTriangle,
  Info,
  Upload,
  Download
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { PartsTable } from './PartsTable';

interface ModelManagementTableProps {
  models: PhoneModel[];
  setModels: (models: PhoneModel[]) => void;
  lang: Language;
}

export default function ModelManagementTable({ models, setModels, lang }: ModelManagementTableProps) {
  const dict = t[lang];
  
  // Core UI states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<PhoneModel>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingParts, setIsLoadingParts] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  
  // Accordion state to track expanded model IDs
  const [expandedRowIds, setExpandedRowIds] = useState<Record<string, boolean>>({});

  // Ref to handle auto-scrolling to the bottom of the parts list in the modal
  const partsEndRef = useRef<HTMLDivElement | null>(null);

  // Formatting helpers
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US').format(price) + ' MMK';
  };

  // Toggle row expand/collapse
  const toggleRow = (id: string) => {
    setExpandedRowIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Trigger database re-fetch to keep state synchronized
  const refreshModels = async () => {
    const { data: modelsData, error: modelsError } = await supabase
      .from('phone_models')
      .select('id, name, repair_parts(id, name, price, warranty_period)')
      .order('created_at', { ascending: true });

    if (modelsError) {
      console.error('Error fetching models:', modelsError);
      return;
    }

    if (modelsData) {
      const formattedModels: PhoneModel[] = modelsData.map((m: any) => ({
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
    }
  };

  // Export current list to Excel
  const handleExportExcel = () => {
    try {
      if (models.length === 0) {
        toast.error('No models available to export.');
        return;
      }

      const exportData = models.flatMap(model => {
        if (model.parts.length === 0) {
          return [{
            'Model Name': model.name,
            'Part Name': 'No parts registered',
            'Price (MMK)': 0,
            'Warranty': ''
          }];
        }
        return model.parts.map(part => ({
          'Model Name': model.name,
          'Part Name': part.name,
          'Price (MMK)': part.price,
          'Warranty': part.warrantyPeriod || ''
        }));
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Price List');
      XLSX.writeFile(workbook, 'Phone_Price_List.xlsx');
      
      toast.success('Excel price list downloaded successfully!');
    } catch (err: any) {
      console.error('Error exporting Excel:', err);
      toast.error('Failed to export Excel file.');
    }
  };

  // Import list from Excel
  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const loadingToast = toast.loading('Reading Excel file...');
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        if (!data) throw new Error('Could not read file data.');

        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

        if (jsonData.length === 0) {
          throw new Error('The Excel sheet appears to be empty.');
        }

        toast.loading('Processing and importing data into database...', { id: loadingToast });

        // Group & extract unique Model Names
        const uniqueModelNames = Array.from(
          new Set(
            jsonData
              .map((row: any) => {
                const nameVal = row['Model Name'] ?? row['model name'] ?? row['ModelName'] ?? row['Model'] ?? row['model'] ?? '';
                return String(nameVal).trim();
              })
              .filter(Boolean)
          )
        );

        if (uniqueModelNames.length === 0) {
          throw new Error('No valid "Model Name" column or entries found. Please ensure your Excel sheet has "Model Name" as a column header.');
        }

        // 1. Fetch existing models to prevent duplication
        const { data: existingModels, error: fetchErr } = await supabase
          .from('phone_models')
          .select('id, name');

        if (fetchErr) throw fetchErr;

        const existingMap = new Map<string, string>(); // lowercase name -> id
        existingModels?.forEach((m) => {
          existingMap.set(m.name.trim().toLowerCase(), m.id);
        });

        const newModelsToInsert: { id: string; name: string }[] = [];
        const modelNameToIdMap = new Map<string, string>(); // exact original name -> id

        for (const name of uniqueModelNames) {
          const lowerName = name.toLowerCase();
          if (existingMap.has(lowerName)) {
            modelNameToIdMap.set(name, existingMap.get(lowerName)!);
          } else {
            const newId = Date.now().toString() + '-' + Math.random().toString().slice(2, 8);
            newModelsToInsert.push({ id: newId, name: name });
            modelNameToIdMap.set(name, newId);
          }
        }

        // 2. Bulk insert new models
        if (newModelsToInsert.length > 0) {
          const { error: insErr } = await supabase.from('phone_models').insert(newModelsToInsert);
          if (insErr) throw insErr;
        }

        // 3. Fetch existing parts for these specific models to enable Smart Merge (Upsert/Update strategy)
        const modelIdsToFetch = Array.from(modelNameToIdMap.values());
        let existingParts: any[] = [];
        if (modelIdsToFetch.length > 0) {
          const { data: fetchPartsData, error: partsFetchErr } = await supabase
            .from('repair_parts')
            .select('id, model_id, name, price, warranty_period')
            .in('model_id', modelIdsToFetch);
          if (partsFetchErr) throw partsFetchErr;
          existingParts = fetchPartsData || [];
        }

        // Create a fast lookup map: "modelId_lowercasePartName" -> existing part database record
        const existingPartsMap = new Map<string, any>();
        existingParts.forEach((p: any) => {
          const key = `${p.model_id}_${p.name.trim().toLowerCase()}`;
          existingPartsMap.set(key, p);
        });

        // 4. Prepare batch upsert payload: merge Excel data with existing database parts
        const partsToUpsert: any[] = [];
        const processedKeysInBatch = new Set<string>();

        jsonData.forEach((row: any) => {
          const mNameVal = row['Model Name'] ?? row['model name'] ?? row['ModelName'] ?? row['Model'] ?? row['model'] ?? '';
          const pNameVal = row['Part Name'] ?? row['part name'] ?? row['PartName'] ?? row['Part'] ?? row['part'] ?? '';
          const priceRaw = row['Price (MMK)'] ?? row['price'] ?? row['Price'] ?? 0;
          const warrantyVal = row['Warranty'] ?? row['warranty'] ?? row['Warranty Period'] ?? row['warranty_period'] ?? '';

          const mName = String(mNameVal).trim();
          const pName = String(pNameVal).trim();
          const warranty = String(warrantyVal).trim();
          const price = typeof priceRaw === 'number' ? priceRaw : parseFloat(String(priceRaw).replace(/[^0-9.-]/g, '')) || 0;

          if (!mName || !pName) return;

          const modelId = modelNameToIdMap.get(mName);
          if (!modelId) return;

          const matchKey = `${modelId}_${pName.toLowerCase()}`;
          // De-duplicate multiple identical rows in the same imported spreadsheet
          if (processedKeysInBatch.has(matchKey)) return;
          processedKeysInBatch.add(matchKey);

          const existingPart = existingPartsMap.get(matchKey);

          if (existingPart) {
            // Smart Merge / Update: Retain the original database 'id' and update prices/warranties.
            // This leaves all other parts not declared in this row completely intact, avoiding global deletion!
            partsToUpsert.push({
              id: existingPart.id,
              model_id: modelId,
              name: pName, // Use the updated capitalization/spelling from Excel
              price: price,
              warranty_period: warranty
            });
          } else {
            // Smart Merge / Insert: Generate a brand new primary key UUID for newly introduced parts.
            partsToUpsert.push({
              id: Date.now().toString() + '-' + Math.random().toString().slice(2, 10),
              model_id: modelId,
              name: pName,
              price: price,
              warranty_period: warranty
            });
          }
        });

        // Execute batch upsert in a single round-trip O(1) database call for ultimate performance
        if (partsToUpsert.length > 0) {
          const { error: partsUpsertErr } = await supabase
            .from('repair_parts')
            .upsert(partsToUpsert);
          if (partsUpsertErr) throw partsUpsertErr;
        }

        // 5. Refresh models list
        await refreshModels();
        toast.success(`Imported ${uniqueModelNames.length} models and ${partsToUpsert.length} spare parts successfully!`, { id: loadingToast });

      } catch (err: any) {
        console.error('Error importing Excel:', err);
        toast.error(err.message || 'Failed to import Excel file. Check format and try again.', { id: loadingToast });
      } finally {
        // Clear input value so same file can be uploaded again if needed
        e.target.value = '';
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Trigger modal for Edit
  const handleEdit = async (model: PhoneModel) => {
    setEditingId(model.id);
    setIsAdding(false);
    setEditForm({ ...model, parts: [] });
    setIsModalOpen(true);
    setIsLoadingParts(true);
    
    try {
      const { data: partsData, error } = await supabase
        .from('repair_parts')
        .select('*')
        .eq('model_id', model.id);

      if (error) throw error;

      const formattedParts = (partsData || []).map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        warrantyPeriod: p.warranty_period
      }));

      setEditForm({ ...model, parts: formattedParts });
    } catch (err: any) {
      console.error('Error fetching parts:', err);
      toast.error('Failed to load parts from database.');
    } finally {
      setIsLoadingParts(false);
    }
  };

  // Trigger modal for Add
  const handleAddNewTrigger = () => {
    setIsAdding(true);
    setEditingId('new');
    setEditForm({ name: '', parts: [] });
    setIsModalOpen(true);
    setIsLoadingParts(false);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setEditForm({});
    setIsAdding(false);
  };

  // Inside Modal parts list modifiers
  const handleAddPart = () => {
    const newPart: PhonePart = { id: Date.now().toString(), name: '', price: 0, warrantyPeriod: '' };
    setEditForm(prev => ({
      ...prev,
      parts: [...(prev.parts || []), newPart]
    }));
    
    // Smooth scroll down to make sure the newly added empty input is immediately visible
    setTimeout(() => {
      partsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  };

  const handleRemovePart = (partId: string) => {
    setEditForm(prev => ({
      ...prev,
      parts: (prev.parts || []).filter(p => p.id !== partId)
    }));
  };

  const handlePartChange = (partId: string, field: 'name' | 'price' | 'warrantyPeriod', value: string | number) => {
    setEditForm(prev => ({
      ...prev,
      parts: (prev.parts || []).map(p => p.id === partId ? { ...p, [field]: value } : p)
    }));
  };

  // Process Model Add / Edit submission
  const saveEdit = async () => {
    if (!editForm.name?.trim()) {
      toast.error('Model name is required.');
      return;
    }
    
    setIsSaving(true);
    const loadingToast = toast.loading(isAdding ? 'Adding phone model...' : 'Saving phone model...');
    
    // Filter out parts with no name
    const validParts = (editForm.parts || []).filter(p => p.name.trim() !== '');
    const modelId = isAdding ? Date.now().toString() : editingId!;
    
    const newModel: PhoneModel = {
      id: modelId,
      name: editForm.name,
      parts: validParts
    };

    try {
      if (isAdding) {
        // Insert new model
        const { error: modelErr } = await supabase.from('phone_models').insert({ id: modelId, name: editForm.name });
        if (modelErr) throw modelErr;
      } else {
        // Update existing model name
        const { error: modelErr } = await supabase.from('phone_models').update({ name: editForm.name }).eq('id', modelId);
        if (modelErr) throw modelErr;
        // Clear old parts
        const { error: partsDelErr } = await supabase.from('repair_parts').delete().eq('model_id', modelId);
        if (partsDelErr) throw partsDelErr;
      }

      // Insert parts
      if (validParts.length > 0) {
        const { error: partsInsErr } = await supabase.from('repair_parts').insert(
          validParts.map(p => ({
            id: p.id.includes('-') || isNaN(Number(p.id)) ? p.id : (Date.now().toString() + Math.random().toString()),
            model_id: modelId,
            name: p.name,
            price: p.price,
            warranty_period: p.warrantyPeriod
          }))
        );
        if (partsInsErr) throw partsInsErr;
      }

      if (isAdding) {
        setModels([...models, newModel]);
        toast.success('New phone model added successfully!', { id: loadingToast });
      } else {
        setModels(models.map(m => m.id === modelId ? newModel : m));
        toast.success('Phone model updated successfully!', { id: loadingToast });
      }
      closeModal();
    } catch (e: any) {
      console.error('Error saving model:', e);
      toast.error(e.message || 'Failed to save phone model.', { id: loadingToast });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle deletion of a Phone Model
  const handleDelete = async (id: string) => {
    const originalModels = [...models];
    setModels(models.filter(m => m.id !== id));
    setConfirmDeleteId(null);
    const loadingToast = toast.loading('Deleting phone model...');
    
    try {
      const { error: partsDelErr } = await supabase.from('repair_parts').delete().eq('model_id', id);
      if (partsDelErr) throw partsDelErr;

      const { error: modelDelErr } = await supabase.from('phone_models').delete().eq('id', id);
      if (modelDelErr) throw modelDelErr;

      toast.success('Phone model deleted successfully!', { id: loadingToast });
    } catch (err: any) {
      console.error('Error deleting model:', err);
      setModels(originalModels);
      toast.error(err.message || 'Failed to delete model.', { id: loadingToast });
    }
  };

  return (
    <div className="space-y-6">
      {/* Table Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-white dark:bg-[#1c1c1e] p-4 sm:p-6 rounded-3xl shadow-sm border border-gray-200/50 dark:border-gray-800/50 gap-4">
        <div className="flex items-center space-x-3">
          <Smartphone className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{dict.phoneModelInventory || 'Phone Model Inventory'}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">Manage models, spare parts, rates, and warranties.</p>
          </div>
        </div>
        
        {/* Buttons Group - Stacked on Mobile, Row on Desktop */}
        <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Import Excel */}
          <label className="flex items-center justify-center space-x-2 bg-gray-50 hover:bg-gray-100 dark:bg-[#2c2c2e] dark:hover:bg-[#3c3c3e] text-gray-700 dark:text-gray-200 px-4 py-3 rounded-full text-sm font-semibold transition-all active:scale-95 cursor-pointer h-12 border border-gray-200/60 dark:border-gray-700/60 w-full sm:w-auto shrink-0 shadow-sm">
            <Upload className="w-4.5 h-4.5 text-gray-500 dark:text-gray-400" />
            <span>Import Excel</span>
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleImportExcel}
              className="hidden"
            />
          </label>
          
          {/* Export to Excel */}
          <button
            onClick={handleExportExcel}
            className="flex items-center justify-center space-x-2 bg-gray-50 hover:bg-gray-100 dark:bg-[#2c2c2e] dark:hover:bg-[#3c3c3e] text-gray-700 dark:text-gray-200 px-4 py-3 rounded-full text-sm font-semibold transition-all active:scale-95 cursor-pointer h-12 border border-gray-200/60 dark:border-gray-700/60 w-full sm:w-auto shrink-0 shadow-sm"
          >
            <Download className="w-4.5 h-4.5 text-gray-500 dark:text-gray-400" />
            <span>Export Excel</span>
          </button>
          
          {/* Add Model */}
          <button
            onClick={handleAddNewTrigger}
            className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-full text-sm font-bold transition-all active:scale-95 cursor-pointer h-12 shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 w-full sm:w-auto shrink-0"
          >
            <Plus className="w-5 h-5" />
            <span>{dict.addModel}</span>
          </button>
        </div>
      </div>

      {/* Main Grid Table (Visible on Desktop / md) */}
      <div className="hidden md:block bg-white dark:bg-[#1c1c1e] rounded-3xl shadow-sm border border-gray-200/50 dark:border-gray-800/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 dark:bg-[#2c2c2e]/50 border-b border-gray-200 dark:border-gray-800">
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 w-12"></th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{dict.modelName}</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{dict.parts}</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 text-right">{dict.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {models.map(model => {
                const isExpanded = !!expandedRowIds[model.id];
                return (
                  <React.Fragment key={model.id}>
                    {/* Parent Row */}
                    <tr 
                      className="hover:bg-gray-50/60 dark:hover:bg-[#2c2c2e]/40 transition-colors duration-150 cursor-pointer"
                      onClick={() => toggleRow(model.id)}
                    >
                      {/* Chevron Cell */}
                      <td className="px-6 py-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 transition-transform duration-200" />
                        ) : (
                          <ChevronRight className="w-5 h-5 transition-transform duration-200" />
                        )}
                      </td>
                      {/* Model Name */}
                      <td className="px-6 py-4 text-gray-900 dark:text-white font-semibold text-base">
                        {model.name}
                      </td>
                      {/* Parts Count Summary Badge */}
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200/40 dark:border-gray-700/40">
                          {model.parts.length} {model.parts.length === 1 ? 'Part' : 'Parts'}
                        </span>
                      </td>
                      {/* Actions */}
                      <td className="px-6 py-4 text-right space-x-1 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {confirmDeleteId === model.id ? (
                          <div className="flex items-center space-x-1 justify-end">
                            <span className="text-xs text-red-500 font-semibold mr-1 flex items-center space-x-1">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>Are you sure?</span>
                            </span>
                            <button 
                              onClick={() => handleDelete(model.id)} 
                              className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 transition-colors cursor-pointer inline-flex items-center"
                            >
                              Yes
                            </button>
                            <button 
                              onClick={() => setConfirmDeleteId(null)} 
                              className="px-3 py-1.5 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-medium hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors cursor-pointer inline-flex items-center"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end space-x-1">
                            <button 
                              onClick={() => handleEdit(model)} 
                              className="p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 rounded-xl transition-colors cursor-pointer inline-flex items-center h-10 w-10 justify-center border border-gray-200/10"
                              title="Edit model"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => setConfirmDeleteId(model.id)} 
                              className="p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 rounded-xl transition-colors cursor-pointer inline-flex items-center h-10 w-10 justify-center border border-gray-200/10"
                              title="Delete model"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>

                    {/* Expandable Sub-table containing specific parts */}
                    {isExpanded && (
                      <tr className="bg-gray-50/30 dark:bg-[#121214]/40 border-b border-gray-200/50 dark:border-gray-800/50">
                        <td colSpan={4} className="p-0">
                          <div className="px-6 py-4 animate-in fade-in slide-in-from-top-1 duration-200">
                            {model.parts.length > 0 ? (
                              <PartsTable
                                parts={model.parts}
                                onUpdatePart={async (partId, updatedData) => {
                                  const { error } = await supabase.from('repair_parts').update({
                                    price: updatedData.price,
                                    warranty_period: updatedData.warrantyPeriod
                                  }).eq('id', partId);
                                  
                                  if (error) {
                                    toast.error('Failed to update part');
                                    throw error;
                                  }
                                  
                                  setModels(models.map(m => m.id === model.id ? {
                                    ...m,
                                    parts: m.parts.map(p => p.id === partId ? { ...p, ...updatedData } : p)
                                  } : m));
                                  toast.success('Part updated successfully');
                                }}
                                onDeletePart={async (partId) => {
                                  const { error } = await supabase.from('repair_parts').delete().eq('id', partId);
                                  
                                  if (error) {
                                    toast.error('Failed to delete part');
                                    throw error;
                                  }
                                  
                                  setModels(models.map(m => m.id === model.id ? {
                                    ...m,
                                    parts: m.parts.filter(p => p.id !== partId)
                                  } : m));
                                  toast.success('Part deleted successfully');
                                }}
                              />
                            ) : (
                              <div className="bg-white dark:bg-[#1a1a1c] border border-gray-100 dark:border-gray-800/80 rounded-2xl p-8 text-center text-sm text-gray-400 dark:text-gray-500 italic flex items-center justify-center space-x-2 shadow-sm">
                                <Package className="w-4 h-4 text-gray-300 dark:text-gray-600" />
                                <span>No parts registered for this model.</span>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              
              {models.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <Package className="w-10 h-10 text-gray-300 dark:text-gray-600" />
                      <p className="text-gray-500 dark:text-gray-400 font-medium">No models found. Add one to get started.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card-based Accordion List (Visible only on mobile/tablet) */}
      <div className="md:hidden space-y-4">
        {models.map(model => {
          const isExpanded = !!expandedRowIds[model.id];
          return (
            <div 
              key={model.id} 
              className="bg-white dark:bg-[#1c1c1e] rounded-3xl p-4 border border-gray-200/50 dark:border-gray-800/50 shadow-sm space-y-3"
            >
              <div className="flex items-start justify-between">
                <div 
                  className="cursor-pointer flex-1 mr-2" 
                  onClick={() => toggleRow(model.id)}
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-base font-bold text-gray-900 dark:text-white">
                      {model.name}
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {model.parts.length} {model.parts.length === 1 ? 'Part' : 'Parts'} registered
                  </p>
                </div>
                
                {/* Actions with larger click areas */}
                <div className="flex items-center space-x-1 shrink-0">
                  {confirmDeleteId === model.id ? (
                    <div className="flex items-center space-x-1.5 bg-red-50 dark:bg-red-950/20 p-1.5 rounded-xl border border-red-100 dark:border-red-900/30">
                      <span className="text-[10px] text-red-500 font-bold px-1">Sure?</span>
                      <button 
                        onClick={() => handleDelete(model.id)} 
                        className="px-2.5 py-1 bg-red-600 text-white rounded-lg text-xs font-bold active:scale-95 transition-transform"
                      >
                        Yes
                      </button>
                      <button 
                        onClick={() => setConfirmDeleteId(null)} 
                        className="px-2.5 py-1 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-bold active:scale-95 transition-transform"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <>
                      <button 
                        onClick={() => handleEdit(model)} 
                        className="p-3 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 rounded-xl transition-all active:scale-95 cursor-pointer inline-flex items-center justify-center border border-gray-100 dark:border-gray-800/50 w-11 h-11"
                        title="Edit model"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => setConfirmDeleteId(model.id)} 
                        className="p-3 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 rounded-xl transition-all active:scale-95 cursor-pointer inline-flex items-center justify-center border border-gray-100 dark:border-gray-800/50 w-11 h-11"
                        title="Delete model"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Expandable sub-parts list on mobile */}
              {isExpanded && (
                <div className="pt-3 border-t border-gray-100 dark:border-gray-800 animate-in fade-in duration-200">
                  {model.parts.length > 0 ? (
                    <PartsTable
                      parts={model.parts}
                      onUpdatePart={async (partId, updatedData) => {
                        const { error } = await supabase.from('repair_parts').update({
                          price: updatedData.price,
                          warranty_period: updatedData.warrantyPeriod
                        }).eq('id', partId);
                        
                        if (error) {
                          toast.error('Failed to update part');
                          throw error;
                        }
                        
                        setModels(models.map(m => m.id === model.id ? {
                          ...m,
                          parts: m.parts.map(p => p.id === partId ? { ...p, ...updatedData } : p)
                        } : m));
                        toast.success('Part updated successfully');
                      }}
                      onDeletePart={async (partId) => {
                        const { error } = await supabase.from('repair_parts').delete().eq('id', partId);
                        
                        if (error) {
                          toast.error('Failed to delete part');
                          throw error;
                        }
                        
                        setModels(models.map(m => m.id === model.id ? {
                          ...m,
                          parts: m.parts.filter(p => p.id !== partId)
                        } : m));
                        toast.success('Part deleted successfully');
                      }}
                    />
                  ) : (
                    <div className="text-center text-xs text-gray-400 dark:text-gray-500 italic py-3">
                      No parts registered for this model.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {models.length === 0 && (
          <div className="bg-white dark:bg-[#1c1c1e] rounded-3xl p-8 text-center border border-gray-200/50 dark:border-gray-800/50 shadow-sm">
            <Package className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">No models found. Add one to get started.</p>
          </div>
        )}
      </div>

      {/* Sleek Modal for Add / Edit Phone Model */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
            onClick={closeModal}
          />
          
          {/* Modal Content Frame */}
          <div className="relative bg-white dark:bg-[#1c1c1e] w-full max-w-2xl rounded-3xl shadow-2xl border border-gray-200/50 dark:border-gray-800/50 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center p-5 sm:p-6 border-b border-gray-100 dark:border-gray-800 shrink-0">
              <div className="flex items-center space-x-2">
                <Wrench className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {isAdding ? dict.addModel : 'Edit Phone Model'}
                </h3>
              </div>
              <button 
                onClick={closeModal} 
                className="p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors cursor-pointer w-10 h-10 flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={(e) => { e.preventDefault(); saveEdit(); }} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              {/* Model Name Input */}
              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                  {dict.modelName} <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  required
                  value={editForm.name || ''} 
                  onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))} 
                  className="w-full bg-gray-50 dark:bg-[#2c2c2e] border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-base transition-all shadow-sm" 
                  placeholder="e.g. iPhone 15 Pro Max" 
                />
              </div>

              {/* Nested Parts Section */}
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-gray-800">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center space-x-1.5">
                    <span>{dict.parts}</span>
                    <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2.5 py-0.5 rounded-full text-xs font-bold">
                      {(editForm.parts || []).length}
                    </span>
                  </h4>
                </div>

                {isLoadingParts ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-3">
                    <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Retrieving parts from database...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(editForm.parts || []).map((part, index) => (
                      <div 
                        key={part.id} 
                        className="bg-gray-50/50 dark:bg-[#222224]/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-800/80 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:space-x-3"
                      >
                        {/* Number Indicator */}
                        <div className="hidden sm:flex items-center justify-center w-7 h-7 rounded-full bg-gray-200/50 dark:bg-gray-800 text-xs font-bold text-gray-500 dark:text-gray-400 shrink-0">
                          {index + 1}
                        </div>

                        {/* Part Name Field */}
                        <div className="flex-1 min-w-[150px]">
                          <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 mb-1 sm:hidden">
                            {dict.partName}
                          </label>
                          <input 
                            type="text" 
                            required
                            value={part.name} 
                            onChange={e => handlePartChange(part.id, 'name', e.target.value)} 
                            className="w-full bg-white dark:bg-[#2c2c2e] border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-base focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 dark:text-white" 
                            placeholder={dict.partName} 
                          />
                        </div>

                        {/* Price Field */}
                        <div className="w-full sm:w-36">
                          <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 mb-1 sm:hidden">
                            {dict.partPrice}
                          </label>
                          <input 
                            type="number" 
                            required
                            min="0"
                            value={part.price || ''} 
                            onChange={e => handlePartChange(part.id, 'price', Number(e.target.value))} 
                            className="w-full bg-white dark:bg-[#2c2c2e] border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-base focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 dark:text-white font-mono" 
                            placeholder={dict.partPrice} 
                          />
                        </div>

                        {/* Warranty Period Field */}
                        <div className="w-full sm:w-36">
                          <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 mb-1 sm:hidden">
                            {dict.warrantyPeriod}
                          </label>
                          <input 
                            type="text" 
                            value={part.warrantyPeriod || ''} 
                            onChange={e => handlePartChange(part.id, 'warrantyPeriod', e.target.value)} 
                            className="w-full bg-white dark:bg-[#2c2c2e] border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-base focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 dark:text-white" 
                            placeholder={dict.warrantyPeriod} 
                          />
                        </div>

                        {/* Delete Trash Button */}
                        <button 
                          type="button"
                          onClick={() => handleRemovePart(part.id)} 
                          className="p-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl shrink-0 cursor-pointer self-end sm:self-auto flex items-center justify-center transition-all active:scale-95 border border-red-200/20 w-full sm:w-auto h-11 sm:h-auto"
                          title={dict.removePart}
                        >
                          <Trash2 className="w-5 h-5 mr-1.5 sm:mr-0" />
                          <span className="sm:hidden text-sm font-semibold">Remove Part</span>
                        </button>
                      </div>
                    ))}

                    {/* Full width dashed "+ Add Part" Button at the BOTTOM of the list */}
                    {(!isLoadingParts && (editForm.parts || []).length > 0) && (
                      <button
                        type="button"
                        onClick={handleAddPart}
                        className="w-full flex items-center justify-center space-x-2 py-3.5 border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-2xl transition-all cursor-pointer text-sm font-semibold bg-gray-50/20 dark:bg-gray-800/10 hover:bg-blue-50/20 dark:hover:bg-blue-950/10 h-12 active:scale-95"
                      >
                        <Plus className="w-5 h-5 text-gray-400 group-hover:text-blue-500" />
                        <span>{dict.addPart}</span>
                      </button>
                    )}

                    {(!editForm.parts || editForm.parts.length === 0) && (
                      <div className="flex flex-col items-center justify-center py-10 px-4 border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl bg-gray-50/50 dark:bg-[#222224]/10">
                        <Package className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-2" />
                        <p className="text-sm text-gray-500 dark:text-gray-400 text-center font-bold">
                          No parts registered for this model yet.
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-1 mb-4">
                          Click below to configure parts for this model.
                        </p>
                        <button
                          type="button"
                          onClick={handleAddPart}
                          className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-sm h-10"
                        >
                          <Plus className="w-4 h-4" />
                          <span>{dict.addPart}</span>
                        </button>
                      </div>
                    )}

                    {/* Sentinel element to auto-scroll into view when adding part */}
                    <div ref={partsEndRef} />
                  </div>
                )}
              </div>
            </form>

            {/* Modal Footer Controls */}
            <div className="p-4 sm:p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-[#1a1a1c] flex flex-col sm:flex-row items-center justify-end gap-3 shrink-0">
              <button 
                type="button"
                onClick={closeModal} 
                disabled={isSaving}
                className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 px-5 rounded-xl text-base sm:text-sm font-bold transition-all active:scale-95 cursor-pointer h-12 w-full sm:w-auto flex items-center justify-center"
              >
                {dict.cancel}
              </button>
              <button 
                type="button"
                onClick={saveEdit}
                disabled={isSaving || isLoadingParts || !editForm.name?.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 rounded-xl text-base sm:text-sm font-bold transition-all active:scale-95 flex items-center justify-center space-x-2 cursor-pointer h-12 w-full sm:w-auto"
              >
                <Check className="w-5 h-5" />
                <span>{isSaving ? 'Saving...' : dict.save}</span>
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
