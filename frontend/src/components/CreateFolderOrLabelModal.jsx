import React, { useState } from 'react';
import { X, FolderPlus, Tag, Check, Loader2 } from 'lucide-react';
import { apiRequest } from '../services/api';

const PRESET_COLORS = [
  '#ef4444', // Rojo
  '#f97316', // Naranja
  '#f59e0b', // Ámbar
  '#10b981', // Esmeralda
  '#06b6d4', // Cian
  '#3b82f6', // Azul
  '#6366f1', // Índigo
  '#8b5cf6', // Púrpura
  '#ec4899', // Rosa
  '#64748b', // Slate
];

export default function CreateFolderOrLabelModal({ isOpen, onClose, onCreated }) {
  const [tab, setTab] = useState('label'); // 'label' | 'folder'
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError('');

    try {
      if (tab === 'label') {
        const res = await apiRequest('labels.php?action=create', {
          method: 'POST',
          body: JSON.stringify({ name: name.trim(), color })
        });
        if (res.success) {
          setName('');
          onCreated && onCreated('label', res.label);
          onClose();
        }
      } else {
        const formData = new FormData();
        formData.append('action', 'create');
        formData.append('name', name.trim());
        const res = await apiRequest('manage_folder.php', {
          method: 'POST',
          body: formData
        });
        if (res.success) {
          setName('');
          onCreated && onCreated('folder', name.trim());
          onClose();
        }
      }
    } catch (err) {
      setError(err.message || 'Error al procesar la solicitud');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-2xs p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
        
        {/* Encabezado */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300">
              {tab === 'label' ? <Tag className="w-4 h-4 text-blue-600" /> : <FolderPlus className="w-4 h-4 text-amber-600" />}
            </div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {tab === 'label' ? 'Crear Nueva Etiqueta' : 'Crear Nueva Carpeta IMAP'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Pestañas de Selección: Etiqueta vs Carpeta */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 p-1 m-4 mb-2 rounded-xl border border-slate-200/60 dark:border-slate-800">
          <button
            type="button"
            onClick={() => { setTab('label'); setError(''); }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              tab === 'label'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Tag className="w-3.5 h-3.5 text-blue-500" />
            <span>Etiqueta con Color</span>
          </button>
          <button
            type="button"
            onClick={() => { setTab('folder'); setError(''); }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              tab === 'folder'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <FolderPlus className="w-3.5 h-3.5 text-amber-500" />
            <span>Carpeta Servidor IMAP</span>
          </button>
        </div>

        {error && (
          <div className="mx-4 mb-2 p-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-4 pt-1 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              {tab === 'label' ? 'Nombre de la Etiqueta' : 'Nombre de la Carpeta'}
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={tab === 'label' ? 'Ej. Cotización Pendiente, Cliente VIP...' : 'Ej. Proyectos 2026, Proveedores...'}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-100"
            />
          </div>

          {/* Selector de color solo para etiquetas */}
          {tab === 'label' && (
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                Color de Identificación
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    style={{ backgroundColor: c }}
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform ${
                      color === c ? 'scale-110 ring-2 ring-offset-2 ring-slate-900 dark:ring-offset-slate-900 shadow-sm' : 'hover:scale-105 opacity-80 hover:opacity-100'
                    }`}
                  >
                    {color === c && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 text-xs font-semibold shadow-xs disabled:opacity-40 flex items-center gap-1.5 transition-all"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{tab === 'label' ? 'Crear Etiqueta' : 'Crear Carpeta'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
