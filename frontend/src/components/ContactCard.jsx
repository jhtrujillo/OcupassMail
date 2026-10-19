import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Mail, 
  Phone, 
  MessageSquare, 
  Send, 
  FileText, 
  Tag, 
  Calendar, 
  CheckCircle2, 
  ExternalLink,
  Plus,
  Trash2,
  Clock,
  Briefcase
} from 'lucide-react';

export default function ContactCard({ 
  contact, 
  onClose, 
  onSendMail 
}) {
  const email = contact?.email || '';
  const name = contact?.name || email.split('@')[0] || 'Contacto';
  const domain = email.includes('@') ? email.split('@')[1] : '';

  // Almacenamiento local persistente por email para notas y etiquetas CRM
  const storageKey = `crm_contact_${email.toLowerCase()}`;
  
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [tag, setTag] = useState('Cliente'); // 'Lead', 'Cliente', 'Proveedor', 'Interno'
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState('');

  useEffect(() => {
    if (!email) return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const data = JSON.parse(saved);
        setPhone(data.phone || '');
        setCompany(data.company || (domain ? domain.toUpperCase().split('.')[0] : ''));
        setTag(data.tag || 'Cliente');
        setNotes(data.notes || []);
      } else {
        setPhone('');
        setCompany(domain ? domain.toUpperCase().split('.')[0] : '');
        setTag('Cliente');
        setNotes([]);
      }
    } catch (e) {
      console.error(e);
    }
  }, [email, storageKey]);

  const saveCrmData = (updated) => {
    try {
      const current = {
        phone,
        company,
        tag,
        notes,
        ...updated
      };
      localStorage.setItem(storageKey, JSON.stringify(current));
    } catch (e) {}
  };

  const handleAddNote = (e) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    const item = {
      id: Date.now(),
      text: newNote.trim(),
      date: new Date().toLocaleDateString('es-CO', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    };
    const updatedNotes = [item, ...notes];
    setNotes(updatedNotes);
    setNewNote('');
    saveCrmData({ notes: updatedNotes });
  };

  const handleDeleteNote = (id) => {
    const updated = notes.filter(n => n.id !== id);
    setNotes(updated);
    saveCrmData({ notes: updated });
  };

  const handlePhoneChange = (val) => {
    setPhone(val);
    saveCrmData({ phone: val });
  };

  const handleTagChange = (val) => {
    setTag(val);
    saveCrmData({ tag: val });
  };

  const handleCompanyChange = (val) => {
    setCompany(val);
    saveCrmData({ company: val });
  };

  // Enlace directo de WhatsApp
  const cleanPhone = phone.replace(/[^\d+]/g, '');
  const waUrl = cleanPhone ? `https://wa.me/${cleanPhone.startsWith('+') ? cleanPhone.slice(1) : cleanPhone}` : null;

  return (
    <div className="w-80 max-w-full h-full border-l border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-[#1a1b1e] flex flex-col overflow-y-auto p-4 select-text relative">
      {/* Botón Cerrar Panel CRM */}
      {onClose && (
        <button
          onClick={onClose}
          title="Cerrar Ficha CRM"
          className="absolute top-3 right-3 p-1.5 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          <span className="text-xs font-bold">✕</span>
        </button>
      )}

      {/* Encabezado del Perfil CRM */}
      <div className="flex flex-col items-center text-center pb-4 border-b border-gray-200 dark:border-gray-800">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xl flex items-center justify-center shadow-md mb-2.5">
          {name[0]?.toUpperCase()}
        </div>
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm leading-tight">
          {name}
        </h3>
        <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 break-all">
          {email}
        </span>

        {/* Etiqueta de clasificación CRM */}
        <div className="mt-3 flex items-center gap-1.5">
          {['Lead', 'Cliente', 'Proveedor', 'Interno'].map((t) => (
            <button
              key={t}
              onClick={() => handleTagChange(t)}
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full transition-all ${
                tag === t
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-gray-200/70 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Acciones directas (Email & WhatsApp) */}
      <div className="grid grid-cols-2 gap-2 my-4">
        <button
          onClick={() => onSendMail(email)}
          className="flex items-center justify-center gap-1.5 py-2 px-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 transition-all shadow-xs"
        >
          <Mail className="w-3.5 h-3.5 text-blue-500" />
          Escribir
        </button>

        {waUrl ? (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            WhatsApp
          </a>
        ) : (
          <button
            onClick={() => {
              const num = window.prompt('Ingresa el número celular o WhatsApp con código de país (ej. +573001234567):');
              if (num) handlePhoneChange(num);
            }}
            className="flex items-center justify-center gap-1.5 py-2 px-3 bg-white dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl text-xs text-gray-500 hover:text-emerald-600 transition-all"
          >
            <Phone className="w-3.5 h-3.5 text-emerald-500" />
            + WhatsApp
          </button>
        )}
      </div>

      {/* Ficha de Información de la Empresa / Teléfono */}
      <div className="space-y-3 bg-white dark:bg-[#202124] p-3.5 rounded-xl border border-gray-200/80 dark:border-gray-800 shadow-xs mb-4">
        <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
          Ficha del Contacto
        </div>

        <div>
          <label className="text-[11px] text-gray-500 dark:text-gray-400 block mb-1">
            Empresa / Organización
          </label>
          <div className="flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={company}
              onChange={(e) => handleCompanyChange(e.target.value)}
              placeholder="Nombre de la empresa"
              className="flex-1 bg-transparent text-xs text-gray-800 dark:text-gray-200 focus:outline-none border-b border-transparent focus:border-blue-500 py-0.5"
            />
          </div>
        </div>

        <div>
          <label className="text-[11px] text-gray-500 dark:text-gray-400 block mb-1">
            Teléfono directo
          </label>
          <div className="flex items-center gap-2">
            <Phone className="w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder="+57 300 000 0000"
              className="flex-1 bg-transparent text-xs text-gray-800 dark:text-gray-200 focus:outline-none border-b border-transparent focus:border-blue-500 py-0.5"
            />
          </div>
        </div>
      </div>

      {/* Bitácora de Notas y Acuerdos CRM */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
          <span>Notas Comerciales</span>
          <span>{notes.length}</span>
        </div>

        {/* Input para agregar nota */}
        <form onSubmit={handleAddNote} className="mb-3">
          <div className="relative">
            <input
              type="text"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Agregar nota rápida (ej. Cotización aprobada)..."
              className="w-full bg-white dark:bg-[#202124] border border-gray-200 dark:border-gray-700 text-xs rounded-xl pl-3 pr-8 py-2 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-xs"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1.5 p-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </form>

        {/* Lista de notas */}
        <div className="space-y-2 overflow-y-auto flex-1 max-h-56 pr-0.5">
          {notes.length === 0 ? (
            <div className="text-center py-6 text-xs text-gray-400">
              Sin notas registradas para este contacto.
            </div>
          ) : (
            notes.map((note) => (
              <div
                key={note.id}
                className="p-2.5 bg-white dark:bg-[#202124] rounded-xl border border-gray-100 dark:border-gray-800/80 shadow-xs text-xs group"
              >
                <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {note.date}
                  </span>
                  <button
                    onClick={() => handleDeleteNote(note.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                <p className="text-gray-700 dark:text-gray-300 leading-snug">
                  {note.text}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
