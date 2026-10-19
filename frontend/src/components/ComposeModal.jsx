import React, { useState, useEffect } from 'react';
import { X, Paperclip, Send, Trash, Loader2, BookOpen, ChevronDown, Sparkles, Wand2, Maximize2, Minimize2 } from 'lucide-react';
import { apiRequest } from '../services/api';
import RichTextEditor from './RichTextEditor';
import ContactAutocomplete from './ContactAutocomplete';

const DEFAULT_TEMPLATES = [
  {
    title: 'Agradecimiento por cotización',
    subject: 'Confirmación de solicitud de cotización - Advantage / Fitness Life',
    body: '<p>Estimado/a cliente,</p><p>Agradecemos su interés en nuestras soluciones y equipos. Hemos recibido su requerimiento y nuestro equipo comercial se encuentra preparando la propuesta formal detallada.</p><p>Quedamos atentos a cualquier duda adicional.</p>'
  },
  {
    title: 'Datos bancarios para pago',
    subject: 'Información y datos bancarios para transferencia',
    body: '<p>Hola,</p><p>Adjuntamos los datos para realizar la transferencia correspondiente:</p><ul><li><strong>Beneficiario:</strong> ADVANTA SCIENCE S.A.S</li><li><strong>NIT:</strong> 901.xxx.xxx-x</li><li><strong>Banco:</strong> Bancolombia</li><li><strong>Tipo de Cuenta:</strong> Cuenta Corriente # xxx-xxxxxx-xx</li></ul><p>Por favor remítenos el soporte una vez efectuado el pago.</p>'
  },
  {
    title: 'Seguimiento de propuesta',
    subject: 'Seguimiento a su propuesta comercial',
    body: '<p>Hola,</p><p>Espero que te encuentres muy bien. Te escribo para dar seguimiento a la cotización enviada anteriormente y conocer si pudiste revisarla o si tienes alguna inquietud en la que podamos apoyarte.</p>'
  }
];

const AI_QUICK_ACTIONS = [
  {
    title: 'Formal y Corporativo',
    desc: 'Hacer el tono más formal y respetuoso',
    generate: (current) => `<p>Estimado/a cliente,</p><p>Es un placer saludarle. Me pongo en comunicación formal para brindarle la información requerida de manera clara y oportuna.</p><p>Quedamos a su entera disposición ante cualquier consulta técnica o comercial adicional.</p>`
  },
  {
    title: 'Confirmar y agendar reunión',
    desc: 'Proponer reunión técnica de 20 minutos',
    generate: (current) => `<p>Hola,</p><p>Recibido con gusto. Me gustaría coordinar un breve espacio de 20 minutos para revisar los detalles técnicos y responder inquietudes de primera mano.</p><p>¿Tendrías disponibilidad mañana en horas de la mañana?</p>`
  },
  {
    title: 'Cierre de cotización con descuento',
    desc: 'Respuesta con incentivo de cierre comercial',
    generate: (current) => `<p>Estimado/a,</p><p>Para facilitar su toma de decisión durante este periodo, podemos ofrecerle un descuento comercial exclusivo del 5% si confirmamos la orden de compra en los próximos 3 días hábiles.</p><p>Quedo atento a su confirmación para generar la proforma final.</p>`
  }
];

export default function ComposeModal({ isOpen, onClose, initialData = null, onSent, account }) {
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [showAiOptions, setShowAiOptions] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  const applyTemplate = (tpl) => {
    setSubject(tpl.subject);
    setBodyHtml(tpl.body + getSignature());
    setShowTemplates(false);
  };

  const applyAiAction = (action) => {
    const generated = action.generate(bodyHtml);
    setBodyHtml(generated + getSignature());
    setShowAiOptions(false);
  };

  // Firma corporativa configurable en localStorage
  const getSignature = () => {
    const saved = localStorage.getItem('user_signature');
    if (saved !== null) return saved;
    // Firma por defecto profesional
    const name = account?.display_name || 'Ventas Advantage';
    const email = account?.email || 'ventas@advantascience.com';
    return `<br><br><div style="font-family: Arial, sans-serif; color: #333; border-top: 1px solid #e0e0e0; padding-top: 8px; margin-top: 16px;">
      <strong style="color: #1a73e8; font-size: 14px;">${name}</strong><br>
      <span style="color: #666; font-size: 12px;">Advanta Science / Fitness Life S.A.S</span><br>
      <span style="color: #888; font-size: 12px;">✉️ ${email} | 🌐 <a href="https://advantascience.com" style="color: #1a73e8; text-decoration: none;">advantascience.com</a></span>
    </div>`;
  };

  const [inReplyTo, setInReplyTo] = useState('');
  const [references, setReferences] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setTo(initialData.to || '');
        setCc(initialData.cc || '');
        setShowCc(!!initialData.cc);
        setSubject(initialData.subject || '');
        setInReplyTo(initialData.inReplyTo || '');
        setReferences(initialData.references || '');
        setBodyHtml(initialData.bodyHtml || (initialData.body ? initialData.body.replace(/\n/g, '<br>') : '') + getSignature());
      } else {
        setTo('');
        setCc('');
        setShowCc(false);
        setSubject('');
        setInReplyTo('');
        setReferences('');
        setBodyHtml('<p></p>' + getSignature());
      }
      setAttachments([]);
      setError('');
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  // Manejo de Drag & Drop de archivos
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      setAttachments((prev) => [...prev, ...files]);
    }
  };

  // Manejo de pegado de imágenes directo desde el portapapeles (Cmd+V)
  const handlePaste = (e) => {
    if (e.clipboardData && e.clipboardData.items) {
      const items = e.clipboardData.items;
      const pastedFiles = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const file = new File([blob], `captura_${Date.now()}.png`, { type: blob.type });
            pastedFiles.push(file);
          }
        }
      }
      if (pastedFiles.length > 0) {
        setAttachments((prev) => [...prev, ...pastedFiles]);
      }
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setAttachments([...attachments, ...files]);
  };

  const removeAttachment = (index) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!to.trim()) {
      setError('Por favor indica un destinatario');
      return;
    }

    setSending(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('to', to);
      formData.append('cc', cc);
      formData.append('subject', subject);
      formData.append('body_html', bodyHtml);
      formData.append('body_text', bodyHtml.replace(/<[^>]*>/g, ' '));
      if (inReplyTo) formData.append('in_reply_to', inReplyTo);
      if (references) formData.append('references', references);

      attachments.forEach((file) => {
        formData.append('attachments[]', file);
      });

      const res = await apiRequest('send.php', {
        method: 'POST',
        body: formData
      });

      if (res.success) {
        onSent && onSent();
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Error al enviar el correo');
    } finally {
      setSending(false);
    }
  };

  return (
    <div 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPaste={handlePaste}
      className={`fixed ${
        isMaximized 
          ? 'inset-4 md:inset-8 w-auto h-auto rounded-2xl' 
          : 'bottom-0 right-6 md:right-10 w-[95vw] sm:w-[680px] md:w-[760px] h-[78vh] min-h-[560px] max-h-[820px] rounded-t-2xl'
      } bg-white dark:bg-[#111318] shadow-2xl border ${
        isDragging ? 'border-2 border-blue-500 bg-blue-50/20' : 'border-slate-300 dark:border-slate-800'
      } z-50 flex flex-col overflow-hidden transition-all duration-200`}
    >
      {/* Indicador visual al arrastrar archivos */}
      {isDragging && (
        <div className="absolute inset-0 bg-blue-50/90 z-50 flex flex-col items-center justify-center pointer-events-none">
          <Paperclip className="w-12 h-12 text-blue-600 animate-bounce mb-2" />
          <p className="text-sm font-semibold text-blue-800">Suelta los archivos aquí para adjuntarlos</p>
        </div>
      )}

      {/* Barra superior de la ventana modal */}
      <div className="bg-slate-100/90 dark:bg-slate-900 px-4 py-2.5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 select-none">
        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
          {inReplyTo ? 'Responder mensaje' : 'Mensaje nuevo'}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 transition-colors"
            title={isMaximized ? 'Restaurar tamaño normal' : 'Maximizar ventana'}
          >
            {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 hover:text-red-600 transition-colors"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-2 bg-red-50 text-red-700 text-xs text-center border-b border-red-100">
          {error}
        </div>
      )}

      {/* Formulario de redacción */}
      <form onSubmit={handleSend} className="flex flex-col flex-1 overflow-hidden">
        {/* Destinatario */}
        <div className="flex items-center px-4 py-2 border-b border-gray-100 text-sm">
          <span className="text-gray-400 w-12 text-xs">Para:</span>
          <ContactAutocomplete
            value={to}
            onChange={setTo}
            required={true}
            placeholder="destinatario@empresa.com"
          />
          {!showCc && (
            <button
              type="button"
              onClick={() => setShowCc(true)}
              className="text-xs text-gray-400 hover:text-gray-600 ml-2"
            >
              Cc
            </button>
          )}
        </div>

        {/* CC */}
        {showCc && (
          <div className="flex items-center px-4 py-2 border-b border-gray-100 text-sm">
            <span className="text-gray-400 w-12 text-xs">Cc:</span>
            <ContactAutocomplete
              value={cc}
              onChange={setCc}
              placeholder="copia@empresa.com"
            />
          </div>
        )}

        {/* Asunto */}
        <div className="flex items-center px-4 py-2 border-b border-gray-100 text-sm">
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Asunto"
            className="w-full outline-none text-gray-800 text-sm font-medium"
          />
        </div>

        {/* Editor WYSIWYG */}
        <RichTextEditor
          content={bodyHtml}
          onChange={setBodyHtml}
          placeholder="Escribe tu mensaje aquí..."
        />

        {/* Archivos Adjuntos */}
        {attachments.length > 0 && (
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 flex flex-wrap gap-2 max-h-24 overflow-y-auto">
            {attachments.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-gray-200 rounded-md text-xs text-gray-700 shadow-2xs"
              >
                <Paperclip className="w-3 h-3 text-gray-400" />
                <span className="truncate max-w-[150px]">{file.name}</span>
                <span className="text-[10px] text-gray-400">({(file.size / 1024).toFixed(0)}KB)</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(idx)}
                  className="text-gray-400 hover:text-red-500 ml-1"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Barra de herramientas inferior */}
        <div className="px-4 py-2.5 bg-white dark:bg-[#111318] border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={sending}
              className="flex items-center gap-2 px-5 py-2 bg-slate-900 hover:bg-slate-800 active:bg-black text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 rounded-full text-xs font-semibold transition-all shadow-sm disabled:opacity-50"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Enviando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" /> Enviar
                </>
              )}
            </button>

            <label 
              title="Adjuntar archivos (o arrástralos aquí)"
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 hover:text-slate-700 dark:text-slate-400 cursor-pointer transition-colors"
            >
              <Paperclip className="w-4 h-4" />
              <input
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            {/* Selector de Plantillas Rápidas */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowTemplates(!showTemplates)}
                className="flex items-center gap-1 px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 transition-colors"
                title="Insertar plantilla rápida"
              >
                <BookOpen className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300" />
                <span>Plantillas</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {showTemplates && (
                <div className="absolute left-0 bottom-full mb-2 w-64 bg-white dark:bg-[#1a1d24] rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 animate-slide-up">
                  <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Respuestas Rápidas
                  </div>
                  {DEFAULT_TEMPLATES.map((tpl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => applyTemplate(tpl)}
                      className="w-full px-3 py-2 text-left text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors block truncate"
                    >
                      {tpl.title}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Asistente AI Copilot */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowAiOptions(!showAiOptions)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors shadow-2xs"
                title="AI Copilot: Sugerencias y respuestas inteligentes"
              >
                <Sparkles className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                <span>AI Copilot</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {showAiOptions && (
                <div className="absolute left-0 bottom-full mb-2 w-72 bg-white dark:bg-[#1a1d24] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 animate-slide-up">
                  <div className="px-3.5 py-2.5 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 flex items-center justify-between">
                    <span className="text-xs font-bold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> AI Redactor Comercial
                    </span>
                    <span className="text-[10px] bg-white/20 dark:bg-black/10 px-1.5 py-0.5 rounded font-mono">B2B</span>
                  </div>
                  <div className="p-1 space-y-1">
                    {AI_QUICK_ACTIONS.map((action, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => applyAiAction(action)}
                        className="w-full p-2.5 text-left rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group"
                      >
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white flex items-center justify-between">
                          <span>{action.title}</span>
                          <Wand2 className="w-3 h-3 opacity-0 group-hover:opacity-100 text-slate-600 dark:text-slate-300 transition-opacity" />
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                          {action.desc}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            title="Descartar borrador"
            className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Trash className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
