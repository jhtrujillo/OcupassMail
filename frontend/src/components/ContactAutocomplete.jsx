import React, { useState, useEffect, useRef } from 'react';
import { User, Mail } from 'lucide-react';
import { apiRequest } from '../services/api';

export default function ContactAutocomplete({ value, onChange, placeholder = "destinatario@empresa.com", required = false }) {
  const [contacts, setContacts] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  // Cargar lista de contactos desde la API una sola vez
  useEffect(() => {
    async function loadContacts() {
      try {
        const res = await apiRequest('contacts.php');
        if (res.contacts) {
          setContacts(res.contacts);
        }
      } catch (e) {
        console.error('Error cargando sugerencias de contactos:', e);
      }
    }
    loadContacts();
  }, []);

  // Filtrar sugerencias en base al texto escrito
  useEffect(() => {
    if (!value || value.trim().length === 0) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    const query = value.toLowerCase().trim();
    // Si contiene comas (múltiples destinatarios), sugerir sobre el último fragmento
    const parts = query.split(',');
    const currentPart = parts[parts.length - 1].trim();

    if (currentPart.length > 0) {
      const filtered = contacts.filter((c) =>
        (c.name && c.name.toLowerCase().includes(currentPart)) ||
        (c.email && c.email.toLowerCase().includes(currentPart))
      );
      setSuggestions(filtered);
      setIsOpen(filtered.length > 0);
    } else {
      setSuggestions([]);
      setIsOpen(false);
    }
  }, [value, contacts]);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (contact) => {
    const parts = value.split(',');
    parts.pop(); // Quitar fragmento incompleto
    const prefix = parts.length > 0 ? parts.join(', ').trim() + ', ' : '';
    const newValue = `${prefix}${contact.email}`;
    onChange(newValue);
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative flex-1">
      <input
        type="text"
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full outline-none text-gray-800 text-sm"
      />

      {/* Menú flotante de sugerencias estilo Gmail */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute left-0 top-full mt-1 w-full max-w-sm bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden divide-y divide-gray-100 max-h-56 overflow-y-auto animate-fadeIn">
          {suggestions.map((c, idx) => (
            <div
              key={idx}
              onClick={() => handleSelect(c)}
              className="px-3.5 py-2.5 hover:bg-blue-50 cursor-pointer flex items-center gap-3 transition-colors text-left"
            >
              <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                {(c.name || c.email)[0].toUpperCase()}
              </div>
              <div className="truncate">
                <p className="text-xs font-semibold text-gray-800 truncate">{c.name}</p>
                <p className="text-[11px] text-gray-500 truncate">{c.email}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
