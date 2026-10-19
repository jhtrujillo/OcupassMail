import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Mail, 
  Send, 
  Inbox, 
  Star, 
  Trash2, 
  RefreshCw, 
  Moon, 
  Sun, 
  Users, 
  Settings, 
  HelpCircle,
  FileText,
  CornerUpLeft,
  ArrowRight
} from 'lucide-react';

export default function CommandBar({
  isOpen,
  onClose,
  onOpenCompose,
  onSelectFolder,
  onRefresh,
  onToggleTheme,
  onOpenSettings,
  onOpenContacts,
  currentTheme,
  selectedFolder,
  selectedUid,
  onReplyCurrent,
  folders = []
}) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Lista base de acciones de productividad
  const baseActions = [
    {
      id: 'compose',
      label: 'Redactar nuevo correo',
      category: 'Acción rápida',
      shortcut: 'C',
      icon: <Send className="w-4 h-4 text-blue-500" />,
      perform: () => {
        onClose();
        onOpenCompose();
      }
    },
    ...(selectedUid && onReplyCurrent ? [{
      id: 'reply',
      label: 'Responder al correo abierto',
      category: 'Acción rápida',
      shortcut: 'R',
      icon: <CornerUpLeft className="w-4 h-4 text-emerald-500" />,
      perform: () => {
        onClose();
        onReplyCurrent();
      }
    }] : []),
    {
      id: 'refresh',
      label: 'Sincronizar y actualizar correos',
      category: 'Acción rápida',
      shortcut: 'U',
      icon: <RefreshCw className="w-4 h-4 text-blue-400" />,
      perform: () => {
        onClose();
        onRefresh();
      }
    },
    {
      id: 'theme',
      label: currentTheme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro',
      category: 'Preferencias',
      shortcut: 'T',
      icon: currentTheme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />,
      perform: () => {
        onClose();
        onToggleTheme();
      }
    },
    {
      id: 'contacts',
      label: 'Abrir Libreta de Contactos Corporativos',
      category: 'Productividad',
      shortcut: 'G C',
      icon: <Users className="w-4 h-4 text-emerald-500" />,
      perform: () => {
        onClose();
        onOpenContacts();
      }
    },
    {
      id: 'settings',
      label: 'Abrir Ajustes y Firma Corporativa',
      category: 'Preferencias',
      shortcut: 'G S',
      icon: <Settings className="w-4 h-4 text-gray-400" />,
      perform: () => {
        onClose();
        onOpenSettings();
      }
    },
    {
      id: 'go-inbox',
      label: 'Ir a Bandeja de Entrada (INBOX)',
      category: 'Navegación',
      shortcut: 'G I',
      icon: <Inbox className="w-4 h-4 text-blue-600" />,
      perform: () => {
        onClose();
        onSelectFolder('INBOX');
      }
    },
    {
      id: 'go-sent',
      label: 'Ir a Elementos Enviados (Sent)',
      category: 'Navegación',
      shortcut: 'G E',
      icon: <Send className="w-4 h-4 text-emerald-600" />,
      perform: () => {
        onClose();
        const sentFolder = folders.find(f => f.id.toLowerCase().includes('sent'))?.id || 'INBOX.Sent';
        onSelectFolder(sentFolder);
      }
    },
    {
      id: 'go-trash',
      label: 'Ir a Papelera (Trash)',
      category: 'Navegación',
      shortcut: 'G T',
      icon: <Trash2 className="w-4 h-4 text-red-500" />,
      perform: () => {
        onClose();
        const trashFolder = folders.find(f => f.id.toLowerCase().includes('trash'))?.id || 'INBOX.Trash';
        onSelectFolder(trashFolder);
      }
    }
  ];

  // Agregar carpetas dinámicas a las acciones
  folders.forEach(f => {
    if (!['inbox', 'sent', 'trash'].some(k => f.id.toLowerCase().includes(k))) {
      baseActions.push({
        id: `folder-${f.id}`,
        label: `Ir a carpeta: ${f.name}`,
        category: 'Carpetas',
        shortcut: '',
        icon: <Mail className="w-4 h-4 text-gray-400" />,
        perform: () => {
          onClose();
          onSelectFolder(f.id);
        }
      });
    }
  });

  const filtered = baseActions.filter(action => 
    action.label.toLowerCase().includes(query.toLowerCase()) ||
    action.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filtered.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + (filtered.length || 1)) % (filtered.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].perform();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-start justify-center pt-24 px-4 transition-opacity animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-xl bg-white dark:bg-[#1e2024] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700/80 overflow-hidden flex flex-col transform transition-all animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input con Buscador Linear style */}
        <div className="flex items-center px-4 py-3.5 border-b border-gray-100 dark:border-gray-800">
          <Search className="w-5 h-5 text-gray-400 mr-3 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un comando o busca una acción... (ej. redactar, bandeja, oscuro)"
            className="w-full bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none"
          />
          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-700 ml-2">
            ESC
          </span>
        </div>

        {/* Lista de Acciones */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">
              No se encontraron comandos para "{query}"
            </div>
          ) : (
            filtered.map((action, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={action.id}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={action.perform}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer text-sm transition-all ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800/70'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={isSelected ? 'text-white' : ''}>
                      {action.icon}
                    </span>
                    <span className="font-medium">{action.label}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${
                      isSelected 
                        ? 'bg-blue-700/60 text-blue-100' 
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                    }`}>
                      {action.category}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {action.shortcut && (
                      <kbd className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold ${
                        isSelected
                          ? 'bg-blue-700 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-700'
                      }`}>
                        {action.shortcut}
                      </kbd>
                    )}
                    <ArrowRight className={`w-3.5 h-3.5 opacity-60 ${isSelected ? 'block' : 'hidden'}`} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer con atajos de ayuda */}
        <div className="px-4 py-2.5 bg-gray-50 dark:bg-[#17181b] border-t border-gray-100 dark:border-gray-800/80 flex items-center justify-between text-[11px] text-gray-400">
          <div className="flex items-center gap-3">
            <span><kbd className="font-mono bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded">↑</kbd> <kbd className="font-mono bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded">↓</kbd> navegar</span>
            <span><kbd className="font-mono bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded">↵</kbd> ejecutar</span>
          </div>
          <span className="font-medium text-gray-500 dark:text-gray-400">Octupass Command Bar</span>
        </div>
      </div>
    </div>
  );
}
