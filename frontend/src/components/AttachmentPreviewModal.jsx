import React from 'react';
import { X, Download, FileText, ExternalLink } from 'lucide-react';

export default function AttachmentPreviewModal({ isOpen, onClose, attachment, messageUid, folder }) {
  if (!isOpen || !attachment) return null;

  const ext = attachment.filename.split('.').pop().toLowerCase();
  const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext);
  const isPdf = ext === 'pdf';

  const baseDir = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1).replace(/\/public\/$/, '/');
  const previewUrl = `${baseDir}backend/api/attachment.php?uid=${messageUid}&part=${attachment.part}&encoding=${attachment.encoding}&name=${encodeURIComponent(attachment.filename)}&folder=${encodeURIComponent(folder)}&inline=1`;
  const downloadUrl = `${baseDir}backend/api/attachment.php?uid=${messageUid}&part=${attachment.part}&encoding=${attachment.encoding}&name=${encodeURIComponent(attachment.filename)}&folder=${encodeURIComponent(folder)}`;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex flex-col z-50 p-4 md:p-8 animate-fadeIn select-none">
      {/* Barra superior del visor estilo Gmail */}
      <div className="flex items-center justify-between text-white pb-4">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-blue-400" />
          <span className="font-medium text-sm truncate max-w-md">{attachment.filename}</span>
          <span className="text-xs text-gray-400">({(attachment.size / 1024).toFixed(1)} KB)</span>
        </div>

        <div className="flex items-center gap-3">
          <a
            href={downloadUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-semibold text-white transition-colors"
          >
            <Download className="w-4 h-4" /> Descargar
          </a>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 rounded-full text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Contenedor del Visor */}
      <div className="flex-1 bg-white dark:bg-[#1a1b1e] rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center p-2 relative">
        {isImage ? (
          <img
            src={previewUrl}
            alt={attachment.filename}
            className="max-h-full max-w-full object-contain rounded-lg"
          />
        ) : isPdf ? (
          <iframe
            src={previewUrl}
            title={attachment.filename}
            className="w-full h-full border-0 rounded-lg"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-8 text-gray-500">
            <FileText className="w-16 h-16 mb-4 text-gray-400 stroke-1" />
            <h4 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Vista previa no disponible para este formato
            </h4>
            <p className="text-xs text-gray-400 mb-4 max-w-sm">
              Puedes descargar el archivo directamente para abrirlo con tu aplicación de escritorio predeterminada.
            </p>
            <a
              href={downloadUrl}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center gap-2"
            >
              <Download className="w-4 h-4" /> Descargar {attachment.filename}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
