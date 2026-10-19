import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, ShieldAlert, Lock, Unlock, Search, Download, 
  ArchiveRestore, RefreshCw, X, AlertTriangle, FileText, CheckCircle2 
} from 'lucide-react';
import { apiRequest, API_BASE } from '../services/api';
import SafeEmailBody from './SafeEmailBody';

export default function AuditVaultModal({ isOpen, onClose, onRestored }) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const [messages, setMessages] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState(null);

  // Verificar estado inicial al abrir
  useEffect(() => {
    if (isOpen) {
      checkVaultStatus();
    } else {
      setSelectedId(null);
      setDetail(null);
      setPin('');
      setPinError(null);
    }
  }, [isOpen]);

  const checkVaultStatus = async () => {
    try {
      const data = await apiRequest('vault.php?action=status');
      if (data.unlocked) {
        setIsUnlocked(true);
        loadVaultMessages('');
      } else {
        setIsUnlocked(false);
      }
    } catch (e) {
      setIsUnlocked(false);
    }
  };

  const handleUnlock = async (e) => {
    e?.preventDefault();
    if (!pin) return;
    setLoading(true);
    setPinError(null);
    try {
      const data = await apiRequest('vault.php?action=unlock', {
        method: 'POST',
        body: JSON.stringify({ pin })
      });
      if (data.success) {
        setIsUnlocked(true);
        setPin('');
        loadVaultMessages('');
      } else {
        setPinError(data.message || 'PIN o contraseña incorrecta');
      }
    } catch (err) {
      setPinError(err.message || 'Error de conexión con el servidor de seguridad');
    } finally {
      setLoading(false);
    }
  };

  const handleLock = async () => {
    try {
      await apiRequest('vault.php?action=lock', { method: 'POST' });
      setIsUnlocked(false);
      setSelectedId(null);
      setDetail(null);
    } catch (e) {}
  };

  const loadVaultMessages = async (searchTerm = '') => {
    setLoading(true);
    try {
      const q = encodeURIComponent(searchTerm);
      const data = await apiRequest(`vault.php?action=list&search=${q}`);
      setMessages(data.messages || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Error al cargar bóveda:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id) => {
    setSelectedId(id);
    setLoadingDetail(true);
    setRestoreSuccess(null);
    try {
      const data = await apiRequest(`vault.php?action=detail&id=${id}`);
      setDetail(data.message || null);
    } catch (err) {
      console.error('Error al cargar detalle archivado:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleRestore = async () => {
    if (!detail) return;
    if (!window.confirm(`¿Deseas restaurar este correo ("${detail.subject}") a la Bandeja de Entrada (INBOX)?`)) return;
    
    setRestoring(true);
    try {
      const data = await apiRequest('vault.php?action=restore', {
        method: 'POST',
        body: JSON.stringify({ archive_id: detail.id, target_folder: 'INBOX' })
      });
      if (data.success) {
        setRestoreSuccess('¡Correo y adjuntos restaurados con éxito al buzón INBOX!');
        if (onRestored) onRestored();
      } else {
        alert(data.message || 'Error al restaurar');
      }
    } catch (err) {
      alert(err.message || 'Error de conexión al restaurar correo');
    } finally {
      setRestoring(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden">
        
        {/* Cabecera de la Bóveda */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Bóveda de Seguridad & Recuperación Forense
                </h2>
                {isUnlocked && (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400">
                    Desbloqueada
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Custodia permanente de correos y archivos adjuntos eliminados por usuarios
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isUnlocked && (
              <button
                onClick={handleLock}
                title="Bloquear bóveda"
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Bloquear</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CONTENIDO: Vista Bloqueada vs Desbloqueada */}
        {!isUnlocked ? (
          /* Pantalla de Bloqueo por PIN */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4">
              <Lock className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">
              Autorización Requerida
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
              Esta sección contiene registros forenses confidenciales de correos y archivos adjuntos eliminados. Ingresa el PIN maestro o tu contraseña corporativa para desbloquear.
            </p>

            <form onSubmit={handleUnlock} className="w-full space-y-4">
              <div>
                <input
                  type="password"
                  placeholder="PIN maestro o contraseña del buzón"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-center tracking-widest font-semibold"
                />
              </div>

              {pinError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl text-red-600 dark:text-red-400 text-xs flex items-center gap-2 text-left">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{pinError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !pin}
                className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                <span>Desbloquear Bóveda</span>
              </button>
            </form>
          </div>
        ) : (
          /* Pantalla Desbloqueada: Buscador, Lista y Visor */
          <div className="flex-1 flex overflow-hidden">
            
            {/* Panel Izquierdo: Lista de Correos Eliminados */}
            <div className="w-2/5 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900">
              {/* Buscador */}
              <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar por asunto, remitente o texto..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      loadVaultMessages(e.target.value);
                    }}
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <button
                  onClick={() => loadVaultMessages(search)}
                  title="Refrescar lista"
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Conteo */}
              <div className="px-4 py-2 bg-slate-50/60 dark:bg-slate-950/20 text-[11px] font-semibold text-slate-500 flex justify-between items-center">
                <span>{total} correos custodiados</span>
              </div>

              {/* Lista */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
                {messages.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    No se encontraron correos archivados
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      onClick={() => loadDetail(msg.id)}
                      className={`p-3.5 cursor-pointer transition-colors ${
                        selectedId === msg.id 
                          ? 'bg-amber-50 dark:bg-amber-950/30 border-l-4 border-amber-500' 
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                          {msg.from_name || msg.from_email}
                        </span>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap">
                          {msg.deleted_at?.split(' ')[0]}
                        </span>
                      </div>
                      <div className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate mb-1">
                        {msg.subject || '(Sin asunto)'}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          msg.deletion_type === 'permanent_delete'
                            ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                        }`}>
                          {msg.deletion_type === 'permanent_delete' ? 'Borrado Definitivo' : 'Papelera'}
                        </span>
                        {Number(msg.attachments_count) > 0 && (
                          <span className="text-[10px] text-blue-600 dark:text-blue-400 flex items-center gap-0.5 font-semibold">
                            <FileText className="w-3 h-3" />
                            {msg.attachments_count} adjunto(s)
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Panel Derecho: Visor Forense y Restauración */}
            <div className="w-3/5 flex flex-col bg-slate-50/30 dark:bg-slate-950/30 overflow-hidden">
              {loadingDetail ? (
                <div className="flex-1 flex items-center justify-center">
                  <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
                </div>
              ) : detail ? (
                <div className="flex-1 flex flex-col overflow-hidden">
                  
                  {/* Banner Forense Superior */}
                  <div className="p-4 bg-amber-500/10 dark:bg-amber-500/20 border-b border-amber-500/20 flex items-center justify-between gap-4">
                    <div className="text-xs space-y-0.5">
                      <div className="font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4 text-amber-600" />
                        <span>Registro de Auditoría Forense</span>
                      </div>
                      <div className="text-[11px] text-amber-800/80 dark:text-amber-400/80">
                        Eliminado el: <strong className="font-semibold">{detail.deleted_at}</strong> | Origen IP: <strong className="font-semibold">{detail.ip_address || 'Local'}</strong>
                      </div>
                    </div>

                    <button
                      onClick={handleRestore}
                      disabled={restoring}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50 whitespace-nowrap"
                    >
                      {restoring ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArchiveRestore className="w-4 h-4" />}
                      <span>Restaurar al Buzón</span>
                    </button>
                  </div>

                  {restoreSuccess && (
                    <div className="mx-4 mt-3 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                      <span>{restoreSuccess}</span>
                    </div>
                  )}

                  {/* Encabezados del Correo */}
                  <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
                      {detail.subject || '(Sin asunto)'}
                    </h3>
                    <div className="text-xs space-y-1 text-slate-600 dark:text-slate-400">
                      <div>
                        <strong className="text-slate-800 dark:text-slate-200">De:</strong> {detail.from_name} &lt;{detail.from_email}&gt;
                      </div>
                      <div>
                        <strong className="text-slate-800 dark:text-slate-200">Fecha original:</strong> {detail.date}
                      </div>
                    </div>

                    {/* Barra de Adjuntos Recuperados con Descarga Directa */}
                    {detail.attachments && detail.attachments.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                          Archivos Adjuntos Recuperados ({detail.attachments.length}):
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {detail.attachments.map((att) => (
                            <a
                              key={att.id}
                              href={`${API_BASE}/vault.php?action=download_attachment&attachment_id=${att.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/40 border border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>{att.filename}</span>
                              <span className="text-[10px] text-blue-500">
                                ({Math.round(att.filesize / 1024)} KB)
                              </span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Cuerpo del Mensaje */}
                  <div className="flex-1 p-6 overflow-y-auto bg-white dark:bg-slate-900">
                    {detail.body_html ? (
                      <SafeEmailBody html={detail.body_html} className="max-w-none text-xs text-slate-800 dark:text-slate-200" />
                    ) : (
                      <pre className="whitespace-pre-wrap font-sans text-xs text-slate-700 dark:text-slate-300">
                        {detail.body_plain || detail.snippet}
                      </pre>
                    )}
                  </div>

                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 text-xs">
                  <ShieldCheck className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-2" />
                  <span>Selecciona un correo de la lista izquierda para inspeccionar y restaurar</span>
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
