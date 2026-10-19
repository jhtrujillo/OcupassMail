import React from 'react';
import { Pen, Inbox, Send, File, Trash2, AlertOctagon, Star, Folder, Users, Tag, Plus } from 'lucide-react';

export default function Sidebar({ 
  folders, 
  selectedFolder, 
  onSelectFolder, 
  onOpenCompose, 
  onCreateFolder, 
  onOpenContacts,
  labels = [],
  activeLabel = null,
  onSelectLabel,
  isCollapsed = false,
  onCloseMobile
}) {
  const getIcon = (type, iconName) => {
    switch (type) {
      case 'inbox': return <Inbox className="w-4 h-4" />;
      case 'sent': return <Send className="w-4 h-4" />;
      case 'drafts': return <File className="w-4 h-4" />;
      case 'trash': return <Trash2 className="w-4 h-4" />;
      case 'spam': return <AlertOctagon className="w-4 h-4" />;
      default: return <Folder className="w-4 h-4" />;
    }
  };

  return (
    <aside className={`${
      isCollapsed ? 'w-16' : 'w-56'
    } bg-slate-50/80 dark:bg-[#111318] flex flex-col p-2.5 select-none flex-shrink-0 border-r border-slate-200/80 dark:border-slate-800/80 transition-all duration-200 ease-in-out`}>
      {/* Botón flotante Redactar estilo Gmail / Google Sans */}
      <button
        onClick={onOpenCompose}
        title="Redactar nuevo correo"
        className={`flex items-center ${
          isCollapsed ? 'justify-center p-2.5 w-10 h-10' : 'gap-2.5 px-5 py-3 w-full justify-center'
        } bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-2xl shadow-xs transition-all mb-3 font-medium text-sm`}
      >
        <Pen className="w-4 h-4 flex-shrink-0" />
        {!isCollapsed && <span>Redactar</span>}
      </button>

      {/* Lista de Carpetas */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto pr-0.5">
        {/* Carpetas Principales del Sistema */}
        {folders.filter(f => f.type !== 'custom').map((folder) => {
          const isSelected = selectedFolder === folder.id;
          return (
            <button
              key={folder.id}
              onClick={() => {
                onSelectFolder(folder.id);
                if (onCloseMobile) onCloseMobile();
              }}
              title={folder.name}
              className={`w-full flex items-center ${
                isCollapsed ? 'justify-center px-2 py-2.5' : 'justify-between px-3 py-2'
              } rounded-xl text-sm font-medium transition-all ${
                isSelected
                  ? 'bg-slate-200/80 text-slate-900 dark:bg-slate-800 dark:text-slate-100 font-semibold shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-3 truncate">
                <span className={isSelected ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}>
                  {getIcon(folder.type, folder.icon)}
                </span>
                {!isCollapsed && <span className="truncate">{folder.name}</span>}
              </div>

              {!isCollapsed && (folder.unseen > 0 || (folder.threads ?? folder.total) > 0) && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-md font-semibold transition-colors ${
                    folder.unseen > 0
                      ? isSelected
                        ? 'bg-blue-600 text-white dark:bg-blue-500 dark:text-white shadow-2xs'
                        : 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold'
                      : isSelected
                        ? 'bg-slate-300/80 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                        : 'bg-slate-100 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-normal'
                  }`}
                >
                  {folder.unseen > 0 ? folder.unseen : (folder.threads ?? folder.total)}
                </span>
              )}
            </button>
          );
        })}

        {/* Carpetas Personalizadas Creadas por el Usuario */}
        {folders.some(f => f.type === 'custom') && !isCollapsed && (
          <div className="pt-2.5 pb-0.5">
            <div className="flex items-center justify-between px-3 mb-1 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              <span>Carpetas</span>
              <button 
                onClick={onCreateFolder} 
                title="Crear nueva carpeta o etiqueta"
                className="hover:text-slate-700 dark:hover:text-slate-200 p-0.5"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-0.5">
              {folders.filter(f => f.type === 'custom').map((folder) => {
                const isSelected = selectedFolder === folder.id;
                return (
                  <button
                    key={folder.id}
                    onClick={() => {
                      onSelectFolder(folder.id);
                      if (onCloseMobile) onCloseMobile();
                    }}
                    title={folder.name}
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-[13px] font-medium transition-all ${
                      isSelected
                        ? 'bg-slate-200/80 text-slate-900 dark:bg-slate-800 dark:text-slate-100 font-semibold shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Folder className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      <span className="truncate">{folder.name}</span>
                    </div>

                    {(folder.unseen > 0 || (folder.threads ?? folder.total) > 0) && (
                      <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-semibold">
                        {folder.unseen > 0 ? folder.unseen : (folder.threads ?? folder.total)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Sección de Etiquetas con Colores */}
        {labels.length > 0 && !isCollapsed && (
          <div className="pt-3 pb-1">
            <div className="flex items-center justify-between px-3 mb-1 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              <span>Etiquetas</span>
              <button 
                onClick={onCreateFolder} 
                title="Crear nueva etiqueta o carpeta"
                className="hover:text-slate-700 dark:hover:text-slate-200 p-0.5"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-0.5">
              {labels.map((lbl) => {
                const isSelected = activeLabel === lbl.id;
                return (
                  <button
                    key={lbl.id}
                    onClick={() => {
                      onSelectLabel && onSelectLabel(isSelected ? null : lbl.id);
                      if (onCloseMobile) onCloseMobile();
                    }}
                    title={`Filtrar por etiqueta: ${lbl.name}`}
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-[13px] font-medium transition-all ${
                      isSelected
                        ? 'bg-slate-200/80 text-slate-900 dark:bg-slate-800 dark:text-slate-100 font-semibold shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: lbl.color || '#3b82f6' }}
                      />
                      <span className="truncate">{lbl.name}</span>
                    </div>
                    {lbl.count > 0 && (
                      <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-semibold">
                        {lbl.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="pt-2 pb-1">
          <div className="h-px bg-slate-200 dark:bg-slate-800 my-1 mx-2" />
          <button
            onClick={() => {
              onOpenContacts();
              if (onCloseMobile) onCloseMobile();
            }}
            title="Libreta de Contactos"
            className={`w-full flex items-center ${
              isCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2'
            } rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200 transition-colors`}
          >
            <Users className="w-4 h-4 text-slate-500" />
            {!isCollapsed && <span>Contactos</span>}
          </button>
        </div>
      </nav>

      {/* Botón para crear nueva etiqueta/carpeta */}
      {!isCollapsed && (
        <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between px-3 text-xs text-slate-500 dark:text-slate-400">
          <span className="font-medium">Octupass • Mail</span>
          <button
            onClick={onCreateFolder}
            title="Crear nueva carpeta o etiqueta"
            className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline flex items-center gap-1 font-semibold"
          >
            + Nueva
          </button>
        </div>
      )}
    </aside>
  );
}
