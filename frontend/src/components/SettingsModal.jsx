import React from 'react';
import DOMPurify from 'dompurify';
import { 
  X, User, Mail, Moon, Sun, Monitor, Bell, BellOff, 
  FileText, Shield, Key, Save, Check 
} from 'lucide-react';

export default function SettingsModal({
  isOpen,
  onClose,
  theme,
  setTheme,
  signature,
  setSignature,
  desktopNotifications,
  setDesktopNotifications,
  account
}) {
  const [localSignature, setLocalSignature] = React.useState(signature);
  const [savedSuccess, setSavedSuccess] = React.useState(false);

  React.useEffect(() => {
    setLocalSignature(signature);
  }, [signature]);

  if (!isOpen) return null;

  const handleSaveSignature = () => {
    setSignature(localSignature);
    localStorage.setItem('user_signature', localSignature);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const toggleNotifications = async () => {
    if (!desktopNotifications) {
      if ("Notification" in window) {
        const perm = await Notification.requestPermission();
        if (perm === "granted") {
          setDesktopNotifications(true);
          localStorage.setItem('notifications_enabled', 'true');
        }
      }
    } else {
      setDesktopNotifications(false);
      localStorage.setItem('notifications_enabled', 'false');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white dark:bg-[#202124] w-full max-w-xl rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between select-none">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
              Configuración de Octupass Mail
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido con pestañas/secciones */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm">
          {/* 1. Información de la Cuenta */}
          <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Cuenta Corporativa Activa
            </h4>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-sm">
                {(account?.display_name || account?.email || 'U')[0].toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-gray-800 dark:text-gray-100">{account?.display_name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{account?.email}</p>
              </div>
            </div>
            <div className="mt-3 text-[11px] text-gray-400 flex items-center gap-3 border-t border-gray-200 dark:border-gray-700 pt-2">
              <span>IMAP: {account?.imap_host}:{account?.imap_port} (SSL)</span>
              <span>•</span>
              <span>SMTP: {account?.smtp_host}:{account?.smtp_port}</span>
            </div>
          </div>

          {/* 2. Tema / Modo Oscuro */}
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Apariencia (Tema)
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-xs font-medium transition-all ${
                  theme === 'light'
                    ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <Sun className="w-4 h-4" /> Claro
              </button>

              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-xs font-medium transition-all ${
                  theme === 'dark'
                    ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <Moon className="w-4 h-4" /> Oscuro
              </button>

              <button
                type="button"
                onClick={() => setTheme('system')}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-xs font-medium transition-all ${
                  theme === 'system'
                    ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <Monitor className="w-4 h-4" /> Sistema
              </button>
            </div>
          </div>

          {/* 3. Notificaciones de Escritorio */}
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Notificaciones de Escritorio
            </h4>
            <div className="flex items-center justify-between p-3.5 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-3">
                {desktopNotifications ? (
                  <Bell className="w-5 h-5 text-blue-600" />
                ) : (
                  <BellOff className="w-5 h-5 text-gray-400" />
                )}
                <div>
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-100">
                    Avisos de nuevos correos
                  </p>
                  <p className="text-[11px] text-gray-500">
                    Recibe notificaciones en tu Mac cuando llegue un correo nuevo.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={toggleNotifications}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  desktopNotifications
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                {desktopNotifications ? 'Activadas' : 'Desactivadas'}
              </button>
            </div>
          </div>

          {/* 4. Firma Corporativa Editable */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Firma de Correo Automática (HTML)
              </h4>
              <button
                onClick={handleSaveSignature}
                className="flex items-center gap-1 text-xs text-blue-600 font-semibold hover:text-blue-700"
              >
                {savedSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-green-600" /> Guardado
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" /> Guardar firma
                  </>
                )}
              </button>
            </div>
            <textarea
              rows="4"
              value={localSignature}
              onChange={(e) => setLocalSignature(e.target.value)}
              className="w-full p-3 font-mono text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 dark:text-gray-100"
              placeholder="Escribe o pega aquí el código HTML de tu firma corporativa..."
            />
            {/* Vista previa de la firma */}
            <div className="mt-2 p-3 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 rounded-xl">
              <span className="text-[10px] text-gray-400 block mb-1 uppercase font-semibold">Vista Previa:</span>
              <div 
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(localSignature, { FORBID_TAGS: ['form', 'input', 'iframe', 'style'] }) }}
                className="text-xs"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
          >
            Aceptar y Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
