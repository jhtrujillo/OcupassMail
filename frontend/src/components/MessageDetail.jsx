import React, { useState } from 'react';
import { ArrowLeft, Trash2, Mail, Star, Download, FileText, CornerUpLeft, CornerUpRight, Users, Printer, Eye, UserCheck, Sparkles, ArchiveRestore, Tag, Check, FolderInput, Folder } from 'lucide-react';
import AttachmentPreviewModal from './AttachmentPreviewModal';
import ContactCard from './ContactCard';

export default function MessageDetail({
  message,
  thread = [],
  folder,
  availableLabels = [],
  availableFolders = [],
  onToggleLabel,
  onMoveToFolder,
  onBack,
  onDelete,
  onRestore,
  onPermanentDelete,
  onReply,
  onReplyAll,
  onForward,
  loading
}) {
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [showCrm, setShowCrm] = useState(() => localStorage.getItem('show_crm_panel') !== 'false');
  const [showLabelMenu, setShowLabelMenu] = useState(false);
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const items = (thread && thread.length > 0) ? thread : (message ? [message] : []);
  const [expandedUids, setExpandedUids] = useState({});
  // Vista opcional: 'stack' (acordeón Gmail), 'split' (panel dividido mensaje seleccionado), 'bubbles' (chat estilo WhatsApp/iMessage)
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('thread_view_mode') || 'stack');
  const [selectedThreadMsg, setSelectedThreadMsg] = useState(null);

  const toggleCrm = () => {
    setShowCrm(prev => {
      localStorage.setItem('show_crm_panel', (!prev).toString());
      return !prev;
    });
  };

  const handleSetViewMode = (mode) => {
    setViewMode(mode);
    localStorage.setItem('thread_view_mode', mode);
  };

  React.useEffect(() => {
    if (items.length > 0) {
      const initial = {};
      items.forEach((m, idx) => {
        initial[`${m.folder || folder}_${m.uid}`] = (idx === items.length - 1) || items.length <= 2;
      });
      setExpandedUids(initial);
      setSelectedThreadMsg(items[items.length - 1]);
    }
  }, [message, thread]);

  const toggleExpand = (msgKey) => {
    setExpandedUids((prev) => ({
      ...prev,
      [msgKey]: !prev[msgKey]
    }));
  };

  if (loading || !message) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-[#111318] rounded-2xl border border-slate-200/80 dark:border-slate-800 m-2 ml-0">
        <div className="w-8 h-8 border-2 border-slate-900 dark:border-slate-100 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm text-slate-500 dark:text-slate-400">Cargando conversación...</p>
      </div>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadAttachment = (e, att, msgUid, msgFolder) => {
    e.stopPropagation();
    const baseDir = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1).replace(/\/public\/$/, '/');
    window.open(
      `${baseDir}backend/api/attachment.php?uid=${msgUid}&part=${att.part}&encoding=${att.encoding}&name=${encodeURIComponent(
        att.filename
      )}&folder=${encodeURIComponent(msgFolder || folder)}`,
      '_blank'
    );
  };

  const handlePreviewAttachment = (att, msgUid, msgFolder) => {
    setPreviewAttachment({
      ...att,
      msgUid,
      msgFolder: msgFolder || folder
    });
  };

  const mainSubject = message.cleanSubject || message.subject || '(Sin asunto)';

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-[#111318] md:rounded-2xl border-0 md:border md:border-slate-200/80 dark:md:border-slate-800 shadow-sm overflow-hidden md:m-2 md:ml-0 w-full max-w-full">
      {/* Barra de herramientas */}
      <div className="min-h-12 border-b border-slate-200 dark:border-slate-800 px-2 sm:px-3 py-1.5 flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 text-slate-600 dark:text-slate-300 text-xs no-print flex-shrink-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={onBack}
            title="Volver"
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />
          {folder && folder.toLowerCase().includes('trash') ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={onRestore}
                title="Restaurar a la bandeja de entrada"
                className="px-2.5 py-1 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-semibold rounded-lg transition-colors flex items-center gap-1.5 text-xs"
              >
                <ArchiveRestore className="w-4 h-4" />
                <span>Restaurar</span>
              </button>
              {onPermanentDelete && (
                <button
                  onClick={onPermanentDelete}
                  title="Eliminar definitivamente de la papelera"
                  className="px-2.5 py-1 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 font-semibold rounded-lg transition-colors flex items-center gap-1.5 text-xs"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Eliminar definitivamente</span>
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={onDelete}
              title="Mover a la papelera"
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-600 dark:text-slate-400 hover:text-red-600"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={handlePrint}
            title="Imprimir correo"
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-600 dark:text-slate-400"
          >
            <Printer className="w-4 h-4" />
          </button>

          {/* Menú de Etiquetas */}
          {availableLabels.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowLabelMenu(!showLabelMenu)}
                title="Etiquetar conversación"
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-600 dark:text-slate-400 hover:text-blue-600"
              >
                <Tag className="w-4 h-4" />
              </button>

              {showLabelMenu && (
                <div className="absolute left-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-1.5 z-30 animate-fade-in">
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Asignar Etiqueta
                  </div>
                  {availableLabels.map((lbl) => {
                    const isAssigned = (message?.labels || []).some(l => l.id === lbl.id);
                    return (
                      <button
                        key={lbl.id}
                        type="button"
                        onClick={() => {
                          onToggleLabel && onToggleLabel(message?.cleanSubject, lbl.id);
                          setShowLabelMenu(false);
                        }}
                        className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: lbl.color }}
                          />
                          <span>{lbl.name}</span>
                        </div>
                        {isAssigned && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 stroke-[3]" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Menú de Mover / Archivar a Carpeta */}
          {availableFolders.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowMoveMenu(!showMoveMenu)}
                title="Mover o archivar a una carpeta"
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-600 dark:text-slate-400 hover:text-amber-600"
              >
                <FolderInput className="w-4 h-4" />
              </button>

              {showMoveMenu && (
                <div className="absolute left-0 mt-2 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-1.5 z-30 animate-fade-in max-h-64 overflow-y-auto">
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Mover a Carpeta
                  </div>
                  {availableFolders.filter(f => f.id !== folder).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        onMoveToFolder && onMoveToFolder(f.id);
                        setShowMoveMenu(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
                    >
                      <Folder className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                      <span className="truncate">{f.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Selector de Modo de Vista de Hilo */}
          {items.length > 1 && (
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg ml-1 text-[11px] font-medium">
              <button
                type="button"
                onClick={() => handleSetViewMode('stack')}
                title="Vista en acordeón"
                className={`px-2 py-0.5 rounded-md transition-all ${
                  viewMode === 'stack'
                    ? 'bg-white dark:bg-[#1a1d24] text-slate-900 dark:text-slate-100 font-semibold shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Acordeón
              </button>
              <button
                type="button"
                onClick={() => handleSetViewMode('split')}
                title="Vista dividida"
                className={`px-2 py-0.5 rounded-md transition-all ${
                  viewMode === 'split'
                    ? 'bg-white dark:bg-[#1a1d24] text-slate-900 dark:text-slate-100 font-semibold shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Dividida
              </button>
              <button
                type="button"
                onClick={() => handleSetViewMode('bubbles')}
                title="Vista de chat"
                className={`px-2 py-0.5 rounded-md transition-all ${
                  viewMode === 'bubbles'
                    ? 'bg-white dark:bg-[#1a1d24] text-slate-900 dark:text-slate-100 font-semibold shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Chat
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => onReply(selectedThreadMsg || items[items.length - 1] || message)}
            title="Responder al último mensaje"
            className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-200 transition-colors"
          >
            <CornerUpLeft className="w-3.5 h-3.5" /> 
            <span className="hidden sm:inline">Responder</span>
          </button>
          <button
            onClick={() => onReplyAll(selectedThreadMsg || items[items.length - 1] || message)}
            title="Responder a todos"
            className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-200 transition-colors"
          >
            <Users className="w-3.5 h-3.5" /> 
            <span className="hidden md:inline">A todos</span>
          </button>
          <button
            onClick={() => onForward(selectedThreadMsg || items[items.length - 1] || message)}
            title="Reenviar conversación"
            className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-200 transition-colors"
          >
            <CornerUpRight className="w-3.5 h-3.5" /> 
            <span className="hidden md:inline">Reenviar</span>
          </button>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

          {/* Botón de Ficha CRM */}
          <button
            onClick={toggleCrm}
            title={showCrm ? "Ocultar Ficha CRM" : "Ver Ficha CRM del remitente"}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              showCrm 
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-2xs' 
                : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            <UserCheck className={`w-3.5 h-3.5 ${showCrm ? 'text-white dark:text-slate-900' : 'text-slate-500'}`} />
            <span>CRM</span>
          </button>
        </div>
      </div>

      {/* Contenedor Principal: Hilo de correos + Ficha CRM */}
      <div className="flex-1 flex overflow-hidden w-full">
        {/* Contenido de la conversación */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 printable-content w-full">
        {/* Asunto principal con distintivo de cantidad de mensajes y etiquetas */}
        <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6 pb-2 border-b border-slate-100 dark:border-slate-800 flex-wrap">
          <h2 className="text-xl font-medium text-slate-900 dark:text-slate-100">
            {mainSubject}
          </h2>
          {items.length > 1 && (
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {items.length} mensajes en este hilo
            </span>
          )}
          {message?.labels && message.labels.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {message.labels.map((lbl) => (
                <span
                  key={lbl.id}
                  style={{
                    backgroundColor: `${lbl.color}18`,
                    color: lbl.color,
                    borderColor: `${lbl.color}40`
                  }}
                  className="text-xs font-semibold px-2.5 py-0.5 rounded-md border flex items-center gap-1.5"
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: lbl.color }}
                  />
                  {lbl.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* VISTA 1: ACORDEÓN EXPANDIBLE (Estilo Clásico Gmail) */}
        {viewMode === 'stack' && (
          <div className="space-y-4">
            {items.map((msg, idx) => {
              const msgKey = `${msg.folder || folder}_${msg.uid}`;
              const isExpanded = !!expandedUids[msgKey];
              const isSentFolder = (msg.folder || '').toLowerCase().includes('sent');

              return (
                <div
                  key={msgKey}
                  className={`rounded-xl border transition-all ${
                    isExpanded
                      ? 'border-gray-200 dark:border-gray-700/80 bg-white dark:bg-[#1f2023] shadow-xs'
                      : 'border-gray-200/60 dark:border-gray-800 bg-gray-50/70 dark:bg-[#1a1b1e] hover:bg-gray-100/60 dark:hover:bg-gray-800/40 cursor-pointer'
                  }`}
                >
                  {/* Cabecera del Mensaje del Hilo */}
                  <div
                    onClick={() => toggleExpand(msgKey)}
                    className="p-4 flex items-center justify-between cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-full text-white font-medium flex items-center justify-center text-sm flex-shrink-0 ${
                        isSentFolder ? 'bg-emerald-600' : 'bg-blue-600'
                      }`}>
                        {(msg.from?.name || msg.from?.email || 'U')[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900 dark:text-gray-100 text-[14.5px] truncate">
                            {msg.from?.name || msg.from?.email}
                          </span>
                          {isSentFolder && (
                            <span className="text-[11px] font-medium bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.2 rounded">
                              Tú (Enviado)
                            </span>
                          )}
                          <span className="text-[13px] text-gray-500 dark:text-gray-400 truncate hidden sm:inline">
                            &lt;{msg.from?.email}&gt;
                          </span>
                        </div>
                        {!isExpanded && (
                          <p className="text-[13px] text-gray-500 dark:text-gray-400 truncate mt-0.5 max-w-xl">
                            {msg.plain ? msg.plain.substring(0, 100) : (msg.snippet || '')}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                        {msg.date}
                      </span>
                      {isExpanded && (
                        <div className="flex items-center gap-1 no-print" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => onReply(msg)}
                            title="Responder a este mensaje"
                            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-gray-500 hover:text-blue-600"
                          >
                            <CornerUpLeft className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onForward(msg)}
                            title="Reenviar este mensaje"
                            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-gray-500 hover:text-blue-600"
                          >
                            <CornerUpRight className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Contenido Completo Desplegado */}
                  {isExpanded && (
                    <div className="px-4 pb-5 pt-2 border-t border-gray-100 dark:border-gray-800">
                      <div className="text-[13px] text-gray-600 dark:text-gray-400 mb-4">
                        Para: {msg.to?.map((t) => t.name || t.email).join(', ') || 'Mí'}
                        {msg.cc && msg.cc.length > 0 && (
                          <span className="ml-2">
                            | Cc: {msg.cc.map((c) => c.name || c.email).join(', ')}
                          </span>
                        )}
                      </div>

                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-gray-100 dark:border-gray-800 no-print">
                          <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                            {msg.attachments.length} Archivo(s) Adjunto(s)
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {msg.attachments.map((att, aIdx) => (
                              <div
                                key={aIdx}
                                onClick={() => handlePreviewAttachment(att, msg.uid, msg.folder)}
                                className="flex items-center gap-2.5 px-3 py-2 bg-white dark:bg-[#1a1b1e] border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-400 hover:shadow-xs cursor-pointer text-xs"
                              >
                                <FileText className="w-4 h-4 text-gray-400" />
                                <span className="truncate max-w-[150px] font-medium text-gray-700 dark:text-gray-300">
                                  {att.filename}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => handleDownloadAttachment(e, att, msg.uid, msg.folder)}
                                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-400 hover:text-blue-600"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="prose dark:prose-invert max-w-none text-sm text-gray-800 dark:text-gray-200 leading-relaxed overflow-x-auto">
                        {msg.html ? (
                          <div
                            dangerouslySetInnerHTML={{ __html: msg.html }}
                            className="email-body-content"
                          />
                        ) : (
                          <pre className="font-sans whitespace-pre-wrap">{msg.plain}</pre>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* VISTA 2: PANEL DIVIDIDO CON LÍNEA DE TIEMPO LATERAL */}
        {viewMode === 'split' && (
          <div className="flex gap-4 min-h-[500px]">
            {/* Lista cronológica del hilo */}
            <div className="w-72 flex-shrink-0 space-y-2 border-r border-gray-100 dark:border-gray-800 pr-3">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-2">
                Historial del Hilo ({items.length})
              </span>
              {items.map((msg, idx) => {
                const isSelected = (selectedThreadMsg?.uid === msg.uid && selectedThreadMsg?.folder === msg.folder);
                const isSentFolder = (msg.folder || '').toLowerCase().includes('sent');

                return (
                  <div
                    key={`${msg.folder}_${msg.uid}`}
                    onClick={() => setSelectedThreadMsg(msg)}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      isSelected
                        ? 'border-slate-900 dark:border-slate-100 bg-slate-100/80 dark:bg-slate-800/60 shadow-xs'
                        : 'border-slate-200/70 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-[#111318]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className={`font-semibold truncate max-w-[130px] ${
                        isSelected ? 'text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300'
                      }`}>
                        {msg.from?.name || msg.from?.email}
                      </span>
                      {isSentFolder && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-medium">
                          Tú
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mb-1">
                      {msg.plain ? msg.plain.substring(0, 60) : (msg.snippet || '')}
                    </p>
                    <span className="text-[10px] text-slate-400 block">
                      #{idx + 1} · {msg.date}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Panel de lectura del mensaje seleccionado */}
            <div className="flex-1 bg-white dark:bg-[#111318] rounded-xl border border-slate-200/80 dark:border-slate-800 p-5">
              {selectedThreadMsg ? (
                <div>
                  <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full text-white font-medium flex items-center justify-center text-sm ${
                        (selectedThreadMsg.folder || '').toLowerCase().includes('sent') ? 'bg-slate-700' : 'bg-slate-900 dark:bg-slate-100 dark:text-slate-900'
                      }`}>
                        {(selectedThreadMsg.from?.name || selectedThreadMsg.from?.email || 'U')[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                          {selectedThreadMsg.from?.name || selectedThreadMsg.from?.email}
                        </div>
                        <div className="text-xs text-slate-400">
                          &lt;{selectedThreadMsg.from?.email}&gt;
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-400 block mb-1">{selectedThreadMsg.date}</span>
                      <button
                        onClick={() => onReply(selectedThreadMsg)}
                        className="text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium hover:underline inline-flex items-center gap-1"
                      >
                        <CornerUpLeft className="w-3 h-3" /> Responder
                      </button>
                    </div>
                  </div>

                  <div className="prose dark:prose-invert max-w-none text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                    {selectedThreadMsg.html ? (
                      <div dangerouslySetInnerHTML={{ __html: selectedThreadMsg.html }} className="email-body-content" />
                    ) : (
                      <pre className="font-sans whitespace-pre-wrap">{selectedThreadMsg.plain}</pre>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-slate-400 text-center py-20">Selecciona un mensaje del hilo</div>
              )}
            </div>
          </div>
        )}

        {/* VISTA 3: BURBUJAS DE CONVERSACIÓN (Estilo Chat / WhatsApp) */}
        {viewMode === 'bubbles' && (
          <div className="max-w-3xl mx-auto space-y-4 py-2">
            {items.map((msg, idx) => {
              const isSentFolder = (msg.folder || '').toLowerCase().includes('sent');

              return (
                <div
                  key={`${msg.folder}_${msg.uid}`}
                  className={`flex flex-col ${isSentFolder ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-2 mb-1 px-1">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {isSentFolder ? 'Tú (Enviado)' : (msg.from?.name || msg.from?.email)}
                    </span>
                    <span className="text-[10px] text-slate-400">{msg.date}</span>
                  </div>

                  <div
                    className={`max-w-[85%] rounded-2xl px-5 py-3.5 shadow-2xs text-sm leading-relaxed ${
                      isSentFolder
                        ? 'bg-slate-900 text-white rounded-tr-none dark:bg-slate-100 dark:text-slate-900'
                        : 'bg-slate-100 dark:bg-[#1a1d24] text-slate-900 dark:text-slate-100 rounded-tl-none border border-slate-200/50 dark:border-slate-800'
                    }`}
                  >
                    <div className="prose dark:prose-invert max-w-none text-sm break-words overflow-x-auto">
                      {msg.html ? (
                        <div dangerouslySetInnerHTML={{ __html: msg.html }} className="email-body-content" />
                      ) : (
                        <pre className="font-sans whitespace-pre-wrap">{msg.plain}</pre>
                      )}
                    </div>
                  </div>

                  <div className="mt-1 px-1">
                    <button
                      onClick={() => onReply(msg)}
                      className="text-[11px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors inline-flex items-center gap-1"
                    >
                      <CornerUpLeft className="w-3 h-3" /> Responder a este
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Acciones al pie del hilo */}
        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3 no-print">
          <button
            onClick={() => onReply(selectedThreadMsg || items[items.length - 1] || message)}
            className="flex items-center gap-2 px-5 py-2 rounded-full border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors shadow-2xs"
          >
            <CornerUpLeft className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span>Responder</span>
          </button>

          <button
            onClick={() => onReplyAll(selectedThreadMsg || items[items.length - 1] || message)}
            className="flex items-center gap-2 px-5 py-2 rounded-full border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors shadow-2xs"
          >
            <Users className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span>Responder a todos</span>
          </button>

          <button
            onClick={() => onForward(selectedThreadMsg || items[items.length - 1] || message)}
            className="flex items-center gap-2 px-5 py-2 rounded-full border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors shadow-2xs"
          >
            <CornerUpRight className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span>Reenviar</span>
          </button>
        </div>
        </div>

        {/* Ficha Lateral CRM Mini-Dossier */}
        {showCrm && (
          <ContactCard
            contact={selectedThreadMsg?.from || message.from}
            onClose={() => setShowCrm(false)}
            onSendMail={(contactEmail) => onReply({ from: { email: contactEmail } })}
          />
        )}
      </div>

      {/* Modal de Vista Previa de Adjunto */}
      {previewAttachment && (
        <AttachmentPreviewModal
          isOpen={!!previewAttachment}
          onClose={() => setPreviewAttachment(null)}
          attachment={previewAttachment}
          messageUid={previewAttachment.msgUid || message.uid}
          folder={previewAttachment.msgFolder || folder}
        />
      )}
    </div>
  );
}
