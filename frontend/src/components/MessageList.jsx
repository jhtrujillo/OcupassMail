import React, { useState, useRef, useEffect } from 'react';
import { Star, Paperclip, ChevronLeft, ChevronRight, Inbox, MailCheck, Trash2, MailQuestion, RefreshCw, ArchiveRestore, Tag, Check, FolderInput, Folder, ArrowDown } from 'lucide-react';

export default function MessageList({
  messages,
  total,
  page,
  perPage,
  folder,
  activeLabel = null,
  availableLabels = [],
  availableFolders = [],
  onPageChange,
  onLoadMore,
  loadingMore,
  onSelectMessage,
  onToggleStar,
  onBulkAction,
  onBulkAssignLabel,
  onBulkMove,
  onRefresh,
  loading,
  selectedUid,
  layoutMode = 'standard' // 'standard' o 'tripanel'
}) {
  const [selectedUids, setSelectedUids] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'unread', 'starred'
  const [showBulkLabelMenu, setShowBulkLabelMenu] = useState(false);
  const [showBulkMoveMenu, setShowBulkMoveMenu] = useState(false);

  // Estados para Pull-to-refresh (Móvil) y Rueda hacia arriba (Desktop)
  const [pullY, setPullY] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const scrollContainerRef = useRef(null);
  const wheelCooldown = useRef(0);

  const totalPages = Math.ceil(total / perPage) || 1;
  const startCount = total === 0 ? 0 : 1;
  const endCount = messages.length;

  // Manejo de scroll para paginación infinita al bajar
  const handleScroll = (e) => {
    if (!onLoadMore || loadingMore || loading) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 180) {
      if (messages.length < total) {
        onLoadMore();
      }
    }
  };

  // 1. Gesto en Computador: Rueda del mouse hacia arriba estando en el tope (scrollTop === 0)
  const handleWheel = (e) => {
    if (loading || pullRefreshing || !onRefresh) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    // Si ya estamos arriba de todo y el usuario gira la rueda hacia arriba con intención (e.deltaY < -25)
    if (container.scrollTop <= 0 && e.deltaY < -25) {
      const now = Date.now();
      // Evitar múltiples disparos seguidos (cooldown de 3 segundos)
      if (now - wheelCooldown.current > 3000) {
        wheelCooldown.current = now;
        setPullRefreshing(true);
        // Llamar a refrescar correo
        Promise.resolve(onRefresh(folder, page, '', true)).finally(() => {
          setTimeout(() => setPullRefreshing(false), 600);
        });
      }
    }
  };

  // 2. Gesto en Celular: Pull-to-refresh deslizando el dedo hacia abajo
  const handleTouchStart = (e) => {
    const container = scrollContainerRef.current;
    if (container && container.scrollTop <= 0) {
      touchStartY.current = e.touches[0].clientY;
      setIsPulling(true);
    } else {
      touchStartY.current = 0;
      setIsPulling(false);
    }
  };

  const handleTouchMove = (e) => {
    if (!isPulling || loading || pullRefreshing || !touchStartY.current) return;
    const container = scrollContainerRef.current;
    if (container && container.scrollTop > 0) return;

    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartY.current;
    if (diff > 0) {
      // Amortiguación suave estilo iOS/Android (fricción)
      const dampened = Math.min(Math.pow(diff, 0.85) * 1.5, 90);
      setPullY(dampened);
    }
  };

  const handleTouchEnd = () => {
    if (!isPulling) return;
    setIsPulling(false);
    if (pullY >= 55 && !pullRefreshing && onRefresh) {
      setPullRefreshing(true);
      setPullY(45);
      Promise.resolve(onRefresh(folder, page, '', true)).finally(() => {
        setTimeout(() => {
          setPullRefreshing(false);
          setPullY(0);
        }, 500);
      });
    } else {
      setPullY(0);
    }
  };

  // Filtrado en vivo de mensajes según etiqueta activa y filtro rápido (no leídos / destacados)
  const filteredMessages = messages.filter((msg) => {
    if (activeLabel) {
      const hasLabel = (msg.labels || []).some((l) => l.id === activeLabel);
      if (!hasLabel) return false;
    }
    if (activeFilter === 'unread') return msg.unseen;
    if (activeFilter === 'starred') return msg.flagged;
    return true;
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const today = new Date();
    
    if (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    ) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedUids(messages.map((m) => m.uid));
    } else {
      setSelectedUids([]);
    }
  };

  const handleSelectOne = (e, uid) => {
    e.stopPropagation();
    if (selectedUids.includes(uid)) {
      setSelectedUids(selectedUids.filter((id) => id !== uid));
    } else {
      setSelectedUids([...selectedUids, uid]);
    }
  };

  const executeBulk = (action) => {
    if (selectedUids.length === 0) return;
    onBulkAction(selectedUids, action);
    setSelectedUids([]);
  };

  const allSelected = messages.length > 0 && selectedUids.length === messages.length;

  return (
    <div className={`flex-1 flex flex-col bg-white dark:bg-[#111318] ${
      layoutMode === 'tripanel' ? 'h-full border-r border-slate-200/80 dark:border-slate-800/80' : 'md:rounded-2xl border-0 md:border md:border-slate-200/80 dark:md:border-slate-800/80 shadow-2xs md:m-2 md:ml-0'
    } overflow-hidden w-full max-w-full`}>
      {/* Barra de herramientas superior */}
      <div className="min-h-12 border-b border-slate-200/80 dark:border-slate-800/80 px-2 sm:px-3 flex items-center justify-between text-slate-500 dark:text-slate-400 text-[13px] select-none flex-shrink-0 bg-white dark:bg-[#111318] gap-1 overflow-x-auto no-scrollbar">
        {selectedUids.length > 0 ? (
          /* BARRA CONTEXTUAL ELEGANTE CUANDO HAY SELECCIÓN */
          <div className="flex-1 flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                checked={allSelected}
                onChange={handleSelectAll}
                className="rounded text-slate-900 dark:text-slate-100 focus:ring-0 w-4 h-4 cursor-pointer accent-slate-900" 
              />
              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md whitespace-nowrap border border-slate-200/80 dark:border-slate-700">
                {selectedUids.length} seleccionados
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => executeBulk('read')}
                title="Marcar como leídos"
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1 text-[11px] font-medium"
              >
                <MailCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Leído</span>
              </button>
              <button
                onClick={() => executeBulk('unread')}
                title="Marcar como no leídos"
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1 text-[11px] font-medium"
              >
                <MailQuestion className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">No leído</span>
              </button>
              {folder && folder.toLowerCase().includes('trash') ? (
                <>
                  <button
                    onClick={() => executeBulk('restore')}
                    title="Restaurar seleccionados a Recibidos"
                    className="p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg text-emerald-600 dark:text-emerald-400 transition-colors flex items-center gap-1 text-[11px] font-medium"
                  >
                    <ArchiveRestore className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Restaurar</span>
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`¿Eliminar definitivamente los ${selectedUids.length} correos seleccionados?`)) {
                        executeBulk('delete');
                      }
                    }}
                    title="Eliminar definitivamente de la papelera"
                    className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg text-red-600 dark:text-red-400 transition-colors flex items-center gap-1 text-[11px] font-medium"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Eliminar</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => executeBulk('trash')}
                  title="Mover a papelera"
                  className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg text-red-600 dark:text-red-400 transition-colors flex items-center gap-1 text-[11px] font-medium"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Papelera</span>
                </button>
              )}

              {/* Menú de Etiquetado Masivo */}
              {availableLabels.length > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowBulkLabelMenu(!showBulkLabelMenu)}
                    title="Asignar etiqueta a los seleccionados"
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1 text-[11px] font-medium"
                  >
                    <Tag className="w-3.5 h-3.5 text-blue-600" />
                    <span className="hidden sm:inline">Etiqueta</span>
                  </button>

                  {showBulkLabelMenu && (
                    <div className="absolute right-0 mt-1.5 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-1 z-30 animate-fade-in">
                      <div className="px-3 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        Aplicar etiqueta
                      </div>
                      {availableLabels.map((lbl) => (
                        <button
                          key={lbl.id}
                          type="button"
                          onClick={() => {
                            if (onBulkAssignLabel) {
                              onBulkAssignLabel(selectedUids, lbl.id);
                            }
                            setShowBulkLabelMenu(false);
                            setSelectedUids([]);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: lbl.color }}
                          />
                          <span className="truncate">{lbl.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {/* Menú de Mover Masivo a Carpeta */}
              {availableFolders.length > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowBulkMoveMenu(!showBulkMoveMenu)}
                    title="Mover o archivar los correos seleccionados a una carpeta"
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1 text-[11px] font-medium"
                  >
                    <FolderInput className="w-3.5 h-3.5 text-amber-500" />
                    <span className="hidden sm:inline">Mover</span>
                  </button>

                  {showBulkMoveMenu && (
                    <div className="absolute right-0 mt-1.5 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-1 z-30 animate-fade-in max-h-60 overflow-y-auto">
                      <div className="px-3 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        Mover a Carpeta
                      </div>
                      {availableFolders.filter(f => f.id !== folder).map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => {
                            if (onBulkMove) {
                              onBulkMove(selectedUids, f.id);
                            }
                            setShowBulkMoveMenu(false);
                            setSelectedUids([]);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
                        >
                          <Folder className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                          <span className="truncate">{f.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={() => setSelectedUids([])}
                title="Cancelar selección"
                className="ml-1 p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-600 text-xs px-2"
              >
                ✕
              </button>
            </div>
          </div>
        ) : (
          /* BARRA NORMAL: Checkbox + Refrescar + Filtros Rápidos + Paginación */
          <div className="flex-1 flex items-center justify-between gap-1 overflow-hidden">
            <div className="flex items-center gap-2 flex-shrink-0">
              <input 
                type="checkbox" 
                checked={allSelected}
                onChange={handleSelectAll}
                className="rounded text-slate-900 focus:ring-0 w-4 h-4 cursor-pointer accent-slate-900" 
              />
              <button
                onClick={onRefresh}
                title="Refrescar lista"
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Filtros Rápidos (Todos / No leídos / Destacados) */}
            <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg text-xs font-medium flex-shrink-0 border border-slate-200/50 dark:border-slate-700/50">
              <button
                onClick={() => setActiveFilter('all')}
                className={`px-2.5 py-0.5 rounded-md transition-all ${
                  activeFilter === 'all'
                    ? 'bg-white dark:bg-[#181b21] text-slate-900 dark:text-slate-100 font-semibold shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setActiveFilter('unread')}
                className={`px-2.5 py-0.5 rounded-md transition-all ${
                  activeFilter === 'unread'
                    ? 'bg-white dark:bg-[#181b21] text-slate-900 dark:text-slate-100 font-semibold shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                No leídos
              </button>
              <button
                onClick={() => setActiveFilter('starred')}
                className={`px-2.5 py-0.5 rounded-md transition-all ${
                  activeFilter === 'starred'
                    ? 'bg-white dark:bg-[#181b21] text-amber-600 dark:text-amber-400 font-semibold shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                ★
              </button>
            </div>

            {/* Contador y Paginación */}
            <div className="flex items-center gap-1 text-xs flex-shrink-0">
              <span 
                className="whitespace-nowrap text-slate-500 dark:text-slate-400 font-medium"
                title={`${messages.length} conversaciones visibles`}
              >
                {endCount > 0 ? `${endCount} de ${endCount}` : '0'}
              </span>
              <div className="flex items-center">
                <button
                  onClick={() => onPageChange(page - 1)}
                  disabled={page <= 1 || loading}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md disabled:opacity-30 disabled:hover:bg-transparent text-slate-500"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onPageChange(page + 1)}
                  disabled={page >= totalPages || loading}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md disabled:opacity-30 disabled:hover:bg-transparent text-slate-500"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Lista de Correos con Pull-to-refresh en móvil y Rueda arriba en desktop */}
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="flex-1 overflow-y-auto relative"
      >
        {/* Indicador visual de Pull-to-Refresh y Rueda hacia arriba */}
        {(pullY > 0 || pullRefreshing) && (
          <div 
            style={{ 
              height: pullRefreshing ? '48px' : `${pullY}px`,
              transition: isPulling ? 'none' : 'height 0.25s ease-out'
            }}
            className="w-full flex items-center justify-center overflow-hidden bg-slate-50 dark:bg-[#14161c] border-b border-slate-200/60 dark:border-slate-800/60"
          >
            <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300 py-2">
              <RefreshCw className={`w-4 h-4 text-blue-600 dark:text-blue-400 ${pullRefreshing ? 'animate-spin' : ''}`} />
              <span>
                {pullRefreshing 
                  ? 'Verificando si hay correos nuevos...' 
                  : pullY >= 55 
                    ? 'Suelta para verificar correos' 
                    : 'Desliza hacia abajo para verificar'}
              </span>
            </div>
          </div>
        )}

        {loading && !pullRefreshing ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-xs">Cargando mensajes...</p>
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400 px-4 text-center">
            <Inbox className="w-10 h-10 stroke-[1.2] mb-2 text-gray-300 dark:text-gray-600" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {messages.length === 0 ? 'No hay mensajes en esta carpeta' : 'No hay mensajes con este filtro'}
            </p>
            <p className="text-xs text-gray-400 mt-1 mb-3">
              {messages.length === 0 
                ? 'Puedes refrescar para sincronizar con el servidor' 
                : 'Prueba cambiando o limpiando el filtro activo'}
            </p>
            {messages.length > 0 && activeFilter !== 'all' ? (
              <button
                onClick={() => setActiveFilter('all')}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium rounded-lg transition-colors border border-slate-200 dark:border-slate-700 shadow-2xs"
              >
                Mostrar todos los correos
              </button>
            ) : messages.length === 0 ? (
              <button
                onClick={() => onRefresh && onRefresh(folder, 1, '')}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors shadow-2xs"
              >
                Refrescar bandeja
              </button>
            ) : null}
          </div>
        ) : layoutMode === 'tripanel' ? (
          /* MODO TRIPANEL: Cards Verticales Limpias Estilo Superhuman / Linear */
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {filteredMessages.map((msg) => {
              const isUnread = msg.unseen;
              const isSelected = selectedUids.includes(msg.uid);
              const isCurrentOpen = selectedUid && selectedUid === msg.uid;

              return (
                <div
                  key={msg.uid}
                  onClick={() => onSelectMessage(msg.uid)}
                  className={`p-3.5 cursor-pointer transition-all relative border-l-4 ${
                    isCurrentOpen
                      ? 'border-slate-900 dark:border-slate-100 bg-slate-100/90 dark:bg-[#1a1d24] shadow-xs'
                      : isUnread
                      ? 'border-transparent bg-white dark:bg-[#111318] hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      : 'border-transparent bg-slate-50/50 dark:bg-[#0d0f12] hover:bg-slate-100/70 dark:hover:bg-slate-800/30 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {/* Fila 1: Remitente + Fecha + Check/Star */}
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onClick={(e) => handleSelectOne(e, msg.uid)}
                        onChange={() => {}}
                        className="rounded text-slate-900 focus:ring-0 w-4 h-4 cursor-pointer flex-shrink-0 dark:bg-slate-800 dark:border-slate-700"
                      />
                      <span className={`text-[13.5px] truncate ${
                        isUnread ? 'font-bold text-slate-900 dark:text-slate-100' : 'font-medium text-slate-700 dark:text-slate-300'
                      }`}>
                        {msg.sendersSummary || msg.from?.name || msg.from?.email || 'Desconocido'}
                      </span>
                      {msg.threadCount > 1 && (
                        <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 bg-slate-200/80 dark:bg-slate-800 px-1.5 py-0.2 rounded-full flex-shrink-0">
                          {msg.threadCount}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleStar(msg.uid, !msg.flagged);
                        }}
                        className="text-slate-400 hover:text-amber-500"
                      >
                        <Star className={`w-4 h-4 ${msg.flagged ? 'text-amber-500 fill-amber-500' : 'stroke-current'}`} />
                      </button>
                      <span className="text-xs text-slate-400 whitespace-nowrap font-medium">
                        {formatDate(msg.date)}
                      </span>
                    </div>
                  </div>

                  {/* Fila 2: Asunto y Etiquetas */}
                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                    <span className={`text-[13px] truncate ${
                      isUnread ? 'font-bold text-slate-900 dark:text-slate-100' : 'font-normal text-slate-800 dark:text-slate-200'
                    }`}>
                      {msg.cleanSubject || msg.subject || '(Sin asunto)'}
                    </span>
                    {msg.hasAttachments && (
                      <Paperclip className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    )}
                    {msg.labels && msg.labels.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        {msg.labels.map((lbl) => (
                          <span
                            key={lbl.id}
                            style={{
                              backgroundColor: `${lbl.color}18`,
                              color: lbl.color,
                              borderColor: `${lbl.color}40`
                            }}
                            className="text-[10px] font-semibold px-1.5 py-0.2 rounded-md border flex items-center gap-1"
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: lbl.color }}
                            />
                            {lbl.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Fila 3: Snippet / Extracto de texto */}
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 leading-normal">
                    {msg.snippet || 'Sin vista previa'}
                  </p>
                </div>
              );
            })}
            {loadingMore && (
              <div className="py-3 flex items-center justify-center gap-2 text-slate-400 dark:text-slate-500 text-xs bg-slate-50/50 dark:bg-slate-900/30">
                <div className="w-4 h-4 border-2 border-slate-900 dark:border-slate-100 border-t-transparent rounded-full animate-spin"></div>
                <span>Cargando más correos...</span>
              </div>
            )}
          </div>
        ) : (
          /* MODO ESTÁNDAR: Fila horizontal clásica ancha */
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {filteredMessages.map((msg) => {
              const isUnread = msg.unseen;
              const isSelected = selectedUids.includes(msg.uid);
              const isCurrentOpen = selectedUid && selectedUid === msg.uid;

              return (
                <div
                  key={msg.uid}
                  onClick={() => onSelectMessage(msg.uid)}
                  className={`group flex items-center gap-3 px-4 py-2.5 relative cursor-pointer transition-all ${
                    isCurrentOpen
                      ? 'bg-slate-100/90 dark:bg-[#1a1d24] border-l-4 border-slate-900 dark:border-slate-100 shadow-xs'
                      : isSelected
                      ? 'bg-slate-200/60 dark:bg-slate-800/60'
                      : isUnread
                      ? 'bg-white dark:bg-[#111318] font-bold text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      : 'bg-slate-50/40 dark:bg-[#0d0f12] text-slate-700 dark:text-slate-300 font-normal hover:bg-slate-100/70 dark:hover:bg-slate-800/30'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onClick={(e) => handleSelectOne(e, msg.uid)}
                    onChange={() => {}}
                    className="rounded text-slate-900 focus:ring-0 w-4 h-4 cursor-pointer dark:bg-slate-800 dark:border-slate-700"
                  />

                  {/* Estrella de favoritos */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleStar(msg.uid, !msg.flagged);
                    }}
                    className="text-slate-400 hover:text-amber-500 p-0.5"
                  >
                    <Star
                      className={`w-4 h-4 ${
                        msg.flagged ? 'text-amber-500 fill-amber-500' : 'stroke-current'
                      }`}
                    />
                  </button>

                  {/* Remitentes / Participantes */}
                  <div className="w-32 sm:w-48 md:w-56 truncate text-sm flex-shrink-0 flex items-center gap-1.5">
                    <span className="truncate">
                      {msg.sendersSummary || msg.from?.name || msg.from?.email || 'Desconocido'}
                    </span>
                    {msg.threadCount > 1 && (
                      <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 bg-slate-200/80 dark:bg-slate-800 px-1.5 py-0.2 rounded-full flex-shrink-0">
                        {msg.threadCount}
                      </span>
                    )}
                  </div>

                  {/* Asunto, Etiquetas y Snippet */}
                  <div className="flex-1 min-w-0 truncate text-sm flex items-center gap-1.5 sm:gap-2">
                    <span className={isUnread ? 'font-bold text-slate-900 dark:text-slate-100 truncate' : 'font-normal text-slate-800 dark:text-slate-200 truncate'}>
                      {msg.cleanSubject || msg.subject || '(Sin asunto)'}
                    </span>
                    {msg.labels && msg.labels.length > 0 && (
                      <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
                        {msg.labels.map((lbl) => (
                          <span
                            key={lbl.id}
                            style={{
                              backgroundColor: `${lbl.color}18`,
                              color: lbl.color,
                              borderColor: `${lbl.color}40`
                            }}
                            className="text-[11px] font-semibold px-1.5 py-0.2 rounded-md border flex items-center gap-1"
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: lbl.color }}
                            />
                            {lbl.name}
                          </span>
                        ))}
                      </div>
                    )}
                    <span className="text-slate-400 dark:text-slate-500 font-normal truncate hidden md:inline">
                      — {msg.snippet}
                    </span>
                  </div>

                  {/* Icono de adjunto */}
                  {msg.hasAttachments && (
                    <Paperclip className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                  )}

                  {/* Fecha */}
                  <div className="text-xs text-slate-500 dark:text-slate-400 text-right flex-shrink-0 font-medium whitespace-nowrap">
                    {formatDate(msg.date)}
                  </div>
                </div>
              );
            })}
            {loadingMore && (
              <div className="py-3 flex items-center justify-center gap-2 text-gray-400 dark:text-gray-500 text-xs bg-gray-50/50 dark:bg-gray-800/30">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <span>Cargando más correos...</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Barra de Paginación Inferior (Visible y protegida contra la barra de Safari / Chrome en móviles) */}
      <div 
        style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}
        className="min-h-12 border-t border-slate-200 dark:border-slate-800 px-3 py-2 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-[#14161c] flex-shrink-0 z-20 shadow-xs"
      >
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          Pág. {page} de {totalPages} <span className="text-slate-400 font-normal hidden sm:inline">({total} correos)</span>
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1 || loading}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-100 font-semibold text-xs text-slate-800 dark:text-slate-100 transition-colors shadow-2xs border border-slate-200 dark:border-slate-700 active:scale-95"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Anterior</span>
          </button>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages || loading}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 disabled:opacity-30 disabled:hover:bg-slate-900 font-semibold text-xs transition-colors shadow-2xs active:scale-95"
          >
            <span>Siguiente</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
