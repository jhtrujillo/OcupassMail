import React, { useState, useEffect } from 'react';
import { X, UserPlus, Search, Mail, Phone, Building, Trash2, Edit2, Check, Loader2 } from 'lucide-react';
import { apiRequest } from '../services/api';

export default function ContactsModal({ isOpen, onClose, onSelectContactToMail }) {
  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Campos de nuevo contacto
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadContacts();
    }
  }, [isOpen]);

  const loadContacts = async () => {
    setLoading(true);
    try {
      const res = await apiRequest('contacts.php');
      setContacts(res.contacts || []);
    } catch (e) {
      console.error('Error cargando contactos:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveContact = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const res = await apiRequest('contacts.php', {
        method: 'POST',
        body: JSON.stringify({ name, email, phone, company })
      });

      if (res.success) {
        setName('');
        setEmail('');
        setPhone('');
        setCompany('');
        setShowAddForm(false);
        setMessage('Contacto guardado con éxito');
        setTimeout(() => setMessage(''), 3000);
        loadContacts();
      }
    } catch (err) {
      setMessage(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteContact = async (id) => {
    if (!id) return;
    if (!window.confirm('¿Deseas eliminar este contacto guardado?')) return;

    try {
      await apiRequest(`contacts.php?id=${id}`, { method: 'DELETE' });
      loadContacts();
    } catch (e) {
      console.error(e);
    }
  };

  if (!isOpen) return null;

  const filtered = contacts.filter((c) =>
    (c.name && c.name.toLowerCase().includes(search.toLowerCase())) ||
    (c.email && c.email.toLowerCase().includes(search.toLowerCase())) ||
    (c.company && c.company.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn select-none">
      <div className="bg-white dark:bg-[#202124] w-full max-w-2xl rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
              Libreta de Contactos Corporativos
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold">
              {contacts.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-all"
            >
              <UserPlus className="w-4 h-4" /> {showAddForm ? 'Cerrar Formulario' : 'Nuevo Contacto'}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-500 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notificación de éxito o error */}
        {message && (
          <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs text-center border-b border-blue-100 dark:border-blue-900 font-medium">
            {message}
          </div>
        )}

        {/* Formulario para agregar contacto */}
        {showAddForm && (
          <form onSubmit={handleSaveContact} className="p-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-gray-500 mb-1">Nombre Completo *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Carlos Gómez"
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#1a1b1e] border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-gray-500 mb-1">Correo Electrónico *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="carlos@empresa.com"
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#1a1b1e] border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-gray-500 mb-1">Teléfono / WhatsApp</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+57 300 123 4567"
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#1a1b1e] border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-gray-500 mb-1">Empresa</label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Ej: Gimnasio BodyTech"
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#1a1b1e] border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100"
              />
            </div>

            <div className="col-span-2 flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg font-medium flex items-center gap-1.5"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Guardar en Base de Datos
              </button>
            </div>
          </form>
        )}

        {/* Buscador de Contactos */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, correo o empresa..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-800 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Lista de Contactos */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-12 text-gray-400">
              <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2" />
              <p className="text-xs">Cargando contactos...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center p-12 text-gray-400 text-xs">
              No se encontraron contactos.
            </div>
          ) : (
            filtered.map((c, idx) => (
              <div
                key={idx}
                className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {(c.name || c.email)[0].toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {c.name}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mt-0.5">
                      <Mail className="w-3 h-3" /> {c.email}
                    </p>
                    {(c.phone || c.company) && (
                      <p className="text-[11px] text-gray-400 flex items-center gap-2 mt-1">
                        {c.company && (
                          <span className="flex items-center gap-1">
                            <Building className="w-3 h-3" /> {c.company}
                          </span>
                        )}
                        {c.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {c.phone}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      onSelectContactToMail(c.email);
                      onClose();
                    }}
                    className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                  >
                    <Mail className="w-3.5 h-3.5" /> Enviar Correo
                  </button>

                  {c.id && (
                    <button
                      onClick={() => handleDeleteContact(c.id)}
                      title="Eliminar de contactos"
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
