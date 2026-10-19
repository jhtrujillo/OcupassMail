import React, { useState } from 'react';
import { Mail, Server, Shield, Lock, User, ChevronDown, ChevronUp, AlertCircle, Loader2 } from 'lucide-react';
import { apiRequest } from '../services/api';

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  
  // Opciones avanzadas de servidor
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [imapHost, setImapHost] = useState('imap.dreamhost.com');
  const [imapPort, setImapPort] = useState(993);
  const [smtpHost, setSmtpHost] = useState('smtp.dreamhost.com');
  const [smtpPort, setSmtpPort] = useState(587);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isGmail, setIsGmail] = useState(false);

  const handleEmailChange = (val) => {
    setEmail(val);
    const domain = val.split('@')[1]?.toLowerCase() || '';
    if (domain === 'gmail.com' || domain === 'googlemail.com') {
      setIsGmail(true);
      setImapHost('imap.gmail.com');
      setImapPort(993);
      setSmtpHost('smtp.gmail.com');
      setSmtpPort(465);
    } else if (domain.includes('dreamhost') || domain.includes('advantascience') || domain.includes('gytc')) {
      setIsGmail(false);
      setImapHost('imap.dreamhost.com');
      setImapPort(993);
      setSmtpHost('smtp.dreamhost.com');
      setSmtpPort(587);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await apiRequest('login.php', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          display_name: displayName,
          imap_host: imapHost,
          imap_port: imapPort,
          smtp_host: smtpHost,
          smtp_port: smtpPort
        })
      });

      if (res.success) {
        onLoginSuccess(res.account);
      }
    } catch (err) {
      setError(err.message || 'Error al conectar con el servidor de correo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f4f9] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-[480px] bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
        {/* Header con icono y título */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-900 text-white mb-3 shadow-sm">
            <span className="text-2xl font-bold">O</span>
          </div>
          <h1 className="text-2xl font-semibold text-gray-800">Octupass Mail</h1>
          <p className="text-sm text-gray-500 mt-1">Conéctate a tu correo empresarial</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-700 text-sm animate-shake">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wider">
              Correo Electrónico (Empresarial o Gmail)
            </label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                placeholder="tu@empresa.com o tu@gmail.com"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all pl-11"
              />
              <User className="w-5 h-5 text-gray-400 absolute left-3.5 top-3.5" />
            </div>
          </div>

          {isGmail && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl text-xs text-blue-800 dark:text-blue-300 space-y-1 animate-fade-in">
              <p className="font-semibold flex items-center gap-1.5">
                <span>⚡ Cuenta Gmail detectada</span>
              </p>
              <p className="text-[11px] leading-relaxed text-blue-700 dark:text-blue-400">
                Google requiere usar una <strong>Contraseña de Aplicación de 16 letras</strong> (no tu clave habitual).
                Puedes generarla en 1 clic en{' '}
                <a 
                  href="https://myaccount.google.com/apppasswords" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="underline font-bold hover:text-blue-950 dark:hover:text-white"
                >
                  myaccount.google.com/apppasswords
                </a>.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wider">
              {isGmail ? 'Contraseña de Aplicación (16 letras de Google)' : 'Contraseña'}
            </label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isGmail ? 'xxxx xxxx xxxx xxxx' : '••••••••••••'}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all pl-11"
              />
              <Lock className="w-5 h-5 text-gray-400 absolute left-3.5 top-3.5" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wider">
              Nombre Visible (Opcional)
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ej. Juan Pérez"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
          </div>

          {/* Toggle de Configuración de Servidores */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center justify-between w-full text-xs font-medium text-blue-600 hover:text-blue-700 py-1"
            >
              <span className="flex items-center gap-1.5">
                <Server className="w-4 h-4" /> Configuración de Servidores (DreamHost)
              </span>
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showAdvanced && (
              <div className="mt-3 p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-3 text-xs">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="text-gray-500 block mb-1">Servidor IMAP</label>
                    <input
                      type="text"
                      value={imapHost}
                      onChange={(e) => setImapHost(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-800"
                    />
                  </div>
                  <div>
                    <label className="text-gray-500 block mb-1">Puerto</label>
                    <input
                      type="number"
                      value={imapPort}
                      onChange={(e) => setImapPort(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="text-gray-500 block mb-1">Servidor SMTP</label>
                    <input
                      type="text"
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-800"
                    />
                  </div>
                  <div>
                    <label className="text-gray-500 block mb-1">Puerto</label>
                    <input
                      type="number"
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-800"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-gray-400">
                  Valores estándar para DreamHost: IMAP 993 (SSL) / SMTP 587 (STARTTLS).
                </p>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 py-3.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium text-sm transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> Conectando al buzón...
              </>
            ) : (
              'Iniciar Sesión'
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-gray-400 flex items-center justify-center gap-1">
          <Shield className="w-3.5 h-3.5" /> Conexión directa y cifrada SSL/TLS con DreamHost
        </div>
      </div>
    </div>
  );
}
