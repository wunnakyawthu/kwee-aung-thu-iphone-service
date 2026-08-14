import React, { useState } from 'react';
import { Edit2, Trash2, Check, X, AlertCircle } from 'lucide-react';

// Types definition for strict typing
interface Part {
  id: string;
  name: string;
  price: number;
  warrantyPeriod: string;
}

interface PartsTableProps {
  parts: Part[];
  onUpdatePart: (partId: string, updatedData: Partial<Part>) => Promise<void>;
  onDeletePart: (partId: string) => Promise<void>;
}

export const PartsTable: React.FC<PartsTableProps> = ({ parts, onUpdatePart, onDeletePart }) => {
  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ price: string; warrantyPeriod: string }>({ price: '', warrantyPeriod: '' });
  
  // Delete Confirmation State 
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // --- Edit Handlers ---
  const handleEditClick = (part: Part) => {
    setDeletingId(null); // Close any open delete prompts
    setEditingId(part.id);
    setEditForm({ price: part.price.toString(), warrantyPeriod: part.warrantyPeriod });
  };

  const handleSaveEdit = async (partId: string) => {
    try {
      // Basic validation
      const parsedPrice = parseInt(editForm.price.replace(/,/g, ''), 10);
      if (isNaN(parsedPrice)) throw new Error("Invalid price format");

      await onUpdatePart(partId, { 
        price: parsedPrice, 
        warrantyPeriod: editForm.warrantyPeriod 
      });
      setEditingId(null); // Exit edit mode on success
    } catch (error) {
      console.error("Failed to update part:", error);
      alert("ဈေးနှုန်း မှားယွင်းနေပါသည်။ (ဥပမာ - 100000 အနေဖြင့် ရိုက်ထည့်ပါ)");
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  // --- Delete Handlers ---
  const handleDeleteRequest = (partId: string) => {
    setEditingId(null); // Close any open edit inputs
    setDeletingId(partId);
  };

  const handleConfirmDelete = async (partId: string) => {
    try {
      await onDeletePart(partId);
      setDeletingId(null);
    } catch (error) {
      console.error("Delete failed", error);
    }
  };

  return (
    <div className="w-full bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden mt-3">
      <table className="w-full text-sm text-left">
        <thead className="bg-gray-50/50 dark:bg-gray-800/50 text-gray-500 font-medium">
          <tr>
            <th className="px-4 py-3">Part Name</th>
            <th className="px-4 py-3">Price (MMK)</th>
            <th className="px-4 py-3">Warranty</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {parts.map((part) => (
            <tr key={part.id} className="hover:bg-gray-50/30 dark:hover:bg-gray-800/30 transition-colors group">
              <td className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">{part.name}</td>
              
              {/* --- EDIT MODE --- */}
              {editingId === part.id ? (
                <>
                  <td className="px-4 py-2">
                    <input 
                      type="number"
                      value={editForm.price}
                      onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                      className="w-24 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input 
                      type="text"
                      value={editForm.warrantyPeriod}
                      onChange={(e) => setEditForm({ ...editForm, warrantyPeriod: e.target.value })}
                      className="w-24 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end items-center gap-2">
                      <button onClick={() => handleSaveEdit(part.id)} className="p-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-400 rounded-md transition-colors">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={handleCancelEdit} className="p-1.5 text-gray-500 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-400 rounded-md transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </>
              ) : 
              
              /* --- DELETE CONFIRMATION MODE --- */
              deletingId === part.id ? (
                <td colSpan={3} className="px-4 py-2 bg-red-50/30 dark:bg-red-900/20">
                  <div className="flex justify-end items-center gap-3">
                    <span className="flex items-center gap-1.5 text-red-600 font-medium text-xs dark:text-red-400">
                      <AlertCircle className="w-4 h-4" /> Are you sure?
                    </span>
                    <button 
                      onClick={() => handleConfirmDelete(part.id)}
                      className="px-3 py-1 text-xs font-bold text-white bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 rounded-md transition-colors"
                    >
                      Yes
                    </button>
                    <button 
                      onClick={() => setDeletingId(null)}
                      className="px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 rounded-md transition-colors"
                    >
                      No
                    </button>
                  </div>
                </td>
              ) : 
              
              /* --- VIEW MODE --- */
              (
                <>
                  <td className="px-4 py-3 font-semibold text-blue-600 dark:text-blue-400">
                    {part.price.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2.5 py-1 text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-full border border-blue-100 dark:border-blue-800">
                      {part.warrantyPeriod}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end items-center gap-2">
                      {/* Colored Edit Icon */}
                      <button 
                        onClick={() => handleEditClick(part)}
                        title="Edit"
                        className="p-1.5 text-blue-500 bg-blue-50/50 hover:bg-blue-100 hover:text-blue-700 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 dark:text-blue-400 dark:hover:text-blue-300 rounded-lg transition-all"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      
                      {/* Colored Delete Icon */}
                      <button 
                        onClick={() => handleDeleteRequest(part.id)}
                        title="Delete"
                        className="p-1.5 text-red-500 bg-red-50/50 hover:bg-red-100 hover:text-red-700 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400 dark:hover:text-red-300 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
