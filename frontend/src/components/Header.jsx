import { Search, RefreshCw, LogOut, Settings, HelpCircle, Menu, Columns3, Layout, ShieldCheck } from 'lucide-react';

export default function Header({ 
  account, 
  onRefresh, 
  onLogout, 
  searchQuery, 
  setSearchQuery, 
  isRefreshing, 
  onOpenSettings,
  onOpenVault,
  layoutMode,
  onToggleLayout,
  onOpenCommandBar,
  onToggleSidebar
}) {
  return (
    <header className="h-14 bg-white dark:bg-[#111318] px-4 flex items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800/80 select-none">
      {/* Brand & Menu */}
      <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
        <button 
          onClick={onToggleSidebar}
          title="Colapsar o expandir barra lateral"
          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400 transition-colors"
        >
          <Menu className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2">
          {/* Logo Octupass Mail */}
          <div className="w-7 h-7 rounded-lg bg-slate-900 dark:bg-slate-100 flex items-center justify-center text-white dark:text-slate-900 font-bold text-sm shadow-xs tracking-tight">
            O
          </div>
          <span className="text-base font-semibold text-slate-900 dark:text-slate-100 tracking-tight">Octupass</span>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-widest border border-slate-200 dark:border-slate-700">Mail</span>
        </div>
      </div>

      {/* Barra de búsqueda central refinada */}
      <div className="flex-1 max-w-xl">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar en el correo..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-[#181b21] hover:bg-slate-100/70 dark:hover:bg-[#1f232b] focus:bg-white dark:focus:bg-[#181b21] text-slate-800 dark:text-slate-100 placeholder-slate-400 text-sm rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-400 dark:focus:ring-slate-600 transition-all border border-slate-200/80 dark:border-slate-800 focus:border-slate-400"
          />
        </div>
      </div>

      {/* Acciones y Perfil */}
      <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
        {/* Atajo visual a Command Bar */}
        <button
          onClick={onOpenCommandBar}
          title="Abrir Command Bar (⌘K / Ctrl+K)"
          className="hidden md:flex items-center gap-2 px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-xs font-medium transition-colors border border-gray-200/60 dark:border-gray-700 mr-1"
        >
          <span>Comandos</span>
          <kbd className="font-mono text-[10px] bg-white dark:bg-gray-900 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700 text-gray-500">⌘K</kbd>
        </button>

        {/* Toggle Tri-Panel / Estándar (solo escritorio) */}
        <button
          onClick={onToggleLayout}
          title={layoutMode === 'tripanel' ? 'Cambiar a Bandeja Estándar' : 'Activar Espacio Tri-Panel (Linear style)'}
          className={`hidden md:flex p-2 rounded-full transition-colors ${
            layoutMode === 'tripanel'
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
              : 'hover:bg-gray-200/70 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300'
          }`}
        >
          {layoutMode === 'tripanel' ? (
            <Columns3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          ) : (
            <Layout className="w-5 h-5" />
          )}
        </button>

        <button
          onClick={onRefresh}
          title="Actualizar bandeja"
          className={`p-1.5 sm:p-2 hover:bg-gray-200/70 dark:hover:bg-gray-800 rounded-full text-gray-600 dark:text-gray-300 transition-colors ${
            isRefreshing ? 'animate-spin text-blue-600' : ''
          }`}
        >
          <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        <button
          onClick={onOpenSettings}
          title="Configuración"
          className="p-1.5 sm:p-2 hover:bg-gray-200/70 dark:hover:bg-gray-800 rounded-full text-gray-600 dark:text-gray-300 transition-colors"
        >
          <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {onOpenVault && (
          <button
            onClick={onOpenVault}
            title="Bóveda de Seguridad Forense (Ctrl+Shift+V)"
            className="hidden sm:flex p-2 hover:bg-amber-100/70 dark:hover:bg-amber-950/40 rounded-full text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
          >
            <ShieldCheck className="w-5 h-5" />
          </button>
        )}

        <div className="h-5 w-px bg-gray-300 dark:bg-gray-700 mx-0.5 hidden sm:block" />

        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="hidden lg:flex flex-col items-end">
            <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
              {account?.display_name || account?.email}
            </span>
            <span className="text-[11px] text-gray-500 dark:text-gray-400">{account?.email}</span>
          </div>

          <div
            title={account?.email}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-600 text-white font-medium flex items-center justify-center text-xs shadow-sm ring-1 ring-white dark:ring-gray-800"
          >
            {(account?.display_name || account?.email || 'U')[0].toUpperCase()}
          </div>

          <button
            onClick={onLogout}
            title="Cerrar sesión"
            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/40 text-gray-500 hover:text-red-600 rounded-full transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
