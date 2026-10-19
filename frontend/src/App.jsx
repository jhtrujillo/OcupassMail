import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import MessageList from './components/MessageList';
import MessageDetail from './components/MessageDetail';
import ComposeModal from './components/ComposeModal';
import SettingsModal from './components/SettingsModal';
import ContactsModal from './components/ContactsModal';
import CommandBar from './components/CommandBar';
import Login from './components/Login';
import AuditVaultModal from './components/AuditVaultModal';
import CreateFolderOrLabelModal from './components/CreateFolderOrLabelModal';
import { apiRequest } from './services/api';

export default function App() {
  const [account, setAccount] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Modo de Espacio de Trabajo: 'standard' o 'tripanel' (Superhuman / Linear style)
  const [layoutMode, setLayoutMode] = useState(() => localStorage.getItem('app_layout_mode') || 'tripanel');
  const [isCommandBarOpen, setIsCommandBarOpen] = useState(false);
  const [isVaultOpen, setIsVaultOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === 'true');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Tema y Preferencias
  const [theme, setTheme] = useState(localStorage.getItem('app_theme') || 'system');
  const [signature, setSignature] = useState(
    localStorage.getItem('user_signature') || ''
  );
  const [desktopNotifications, setDesktopNotifications] = useState(
    localStorage.getItem('notifications_enabled') !== 'false'
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isContactsOpen, setIsContactsOpen] = useState(false);

  // Carpetas y mensajes
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState('INBOX');
  const [messages, setMessages] = useState([]);
  const [totalMessages, setTotalMessages] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage] = useState(25);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Ancho ajustable de la columna de correos (por defecto más amplia: 460px)
  const [listWidth, setListWidth] = useState(() => {
    const saved = localStorage.getItem('app_list_width');
    return saved ? parseInt(saved, 10) : 460;
  });
  const [isResizing, setIsResizing] = useState(false);

  // Detalle del mensaje e hilo
  const [selectedUid, setSelectedUid] = useState(null);
  const [messageDetail, setMessageDetail] = useState(null);
  const [threadDetail, setThreadDetail] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Modal de redacción
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeInitialData, setComposeInitialData] = useState(null);

  // Modal para crear carpeta o etiqueta
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Etiquetas personalizadas con colores
  const [labels, setLabels] = useState([]);
  const [activeLabel, setActiveLabel] = useState(null);

  // Notificación flotante con Deshacer (Undo Send)
  const [toastMessage, setToastMessage] = useState(null);

  // 1. Aplicar clase dark al documento
  useEffect(() => {
    localStorage.setItem('app_theme', theme);
    const root = document.documentElement;
    if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // 2. Verificar sesión activa al inicio y escuchar atajos globales (Cmd+K, C, etc.)
  useEffect(() => {
    checkAuth();
    if (desktopNotifications && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    // Abrir automáticamente la Bóveda de Seguridad si la URL contiene ?vault=1 o #vault
    if (window.location.search.includes('vault=1') || window.location.hash.includes('vault')) {
      setIsVaultOpen(true);
    }

    const handleKeyDown = (e) => {
      // Atajo secreto a Bóveda Forense: Ctrl + Shift + V o Cmd + Shift + V
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        setIsVaultOpen((prev) => !prev);
        return;
      }

      // Ignorar si el usuario está escribiendo en un input, textarea o contenteditable
      const target = e.target;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandBarOpen((prev) => !prev);
        return;
      }

      if (!isInput) {
        if (e.key.toLowerCase() === 'c' && !e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          setComposeInitialData(null);
          setIsComposeOpen(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Manejador del arrastre para redimensionar la columna de mensajes
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      // Ancho mínimo: 320px, Ancho máximo: 720px o el 55% de la pantalla
      const newWidth = Math.min(Math.max(320, e.clientX - 240), Math.min(760, window.innerWidth * 0.6));
      setListWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isResizing) {
        setIsResizing(false);
        setListWidth((current) => {
          localStorage.setItem('app_list_width', current.toString());
          return current;
        });
      }
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  const checkAuth = async () => {
    try {
      const res = await apiRequest('login.php');
      if (res.authenticated) {
        setAccount(res.account);
        loadFolders();
        loadLabels();
        loadMessages('INBOX', 1, '');
      }
    } catch (err) {
      console.error('Error al verificar sesión:', err);
    } finally {
      setCheckingAuth(false);
    }
  };

  // Garantizar que si la cuenta está autenticada pero los mensajes aún no se han cargado, se carguen de inmediato
  useEffect(() => {
    if (account && messages.length === 0 && !loadingMessages) {
      loadMessages(selectedFolder || 'INBOX', 1, searchQuery);
    }
  }, [account]);

  // Cargar etiquetas personalizadas
  const loadLabels = async () => {
    try {
      const res = await apiRequest('labels.php?action=list');
      if (res.success && res.labels) {
        setLabels(res.labels);
      }
    } catch (err) {
      console.error('Error cargando etiquetas:', err);
    }
  };

  // Alternar o asignar una etiqueta a un hilo/conversación
  const handleToggleLabel = async (cleanSubject, labelId) => {
    if (!cleanSubject || !labelId) return;
    try {
      const res = await apiRequest('labels.php?action=toggle', {
        method: 'POST',
        body: JSON.stringify({ clean_subject: cleanSubject, label_id: labelId })
      });
      if (res.success) {
        // Actualizar el estado local de mensajes
        setMessages((prev) =>
          prev.map((m) => {
            if ((m.cleanSubject || m.subject) === cleanSubject) {
              const currentLabels = m.labels || [];
              const exists = currentLabels.some((l) => l.id === labelId);
              let updatedLabels;
              if (exists) {
                updatedLabels = currentLabels.filter((l) => l.id !== labelId);
              } else {
                const labelObj = labels.find((l) => l.id === labelId);
                updatedLabels = labelObj ? [...currentLabels, labelObj] : currentLabels;
              }
              return { ...m, labels: updatedLabels };
            }
            return m;
          })
        );
        // Actualizar mensaje detalle actual si coincide
        if (messageDetail && (messageDetail.cleanSubject || messageDetail.subject) === cleanSubject) {
          setMessageDetail((prev) => {
            if (!prev) return prev;
            const currentLabels = prev.labels || [];
            const exists = currentLabels.some((l) => l.id === labelId);
            let updatedLabels;
            if (exists) {
              updatedLabels = currentLabels.filter((l) => l.id !== labelId);
            } else {
              const labelObj = labels.find((l) => l.id === labelId);
              updatedLabels = labelObj ? [...currentLabels, labelObj] : currentLabels;
            }
            return { ...prev, labels: updatedLabels };
          });
        }
        // Refrescar conteos de etiquetas en segundo plano
        loadLabels();
      }
    } catch (err) {
      console.error('Error al modificar etiqueta:', err);
    }
  };

  // Asignar etiqueta en lote a múltiples mensajes seleccionados
  const handleBulkAssignLabel = async (uids, labelId) => {
    if (!uids || uids.length === 0 || !labelId) return;
    try {
      // Obtener los cleanSubjects de los mensajes seleccionados
      const cleanSubjects = messages
        .filter((m) => uids.includes(m.uid))
        .map((m) => m.cleanSubject || m.subject);

      const res = await apiRequest('labels.php?action=bulk_assign', {
        method: 'POST',
        body: JSON.stringify({ clean_subjects: cleanSubjects, label_id: labelId })
      });
      if (res.success) {
        setToastMessage('Etiqueta aplicada a los correos seleccionados.');
        setTimeout(() => setToastMessage(null), 3000);
        loadMessages(selectedFolder, page, searchQuery, true);
        loadLabels();
      }
    } catch (err) {
      console.error('Error en etiquetado masivo:', err);
    }
  };

  // 2.1 Actualizar título de la pestaña del navegador con conteo y nombre de marca
  useEffect(() => {
    const inboxFolder = folders.find((f) => f.id === 'INBOX' || f.type === 'inbox');
    const unseenCount = inboxFolder ? inboxFolder.unseen : 0;
    if (unseenCount > 0) {
      document.title = `(${unseenCount.toLocaleString()}) Octupass Mail`;
    } else {
      document.title = 'Octupass Mail';
    }
  }, [folders]);

  // 3. Polling silencioso cada 30s para nuevos correos y notificaciones de escritorio
  useEffect(() => {
    if (!account) return;

    const interval = setInterval(async () => {
      try {
        // Consultar con DreamHost directamente omitiendo caché para detectar si entró algo nuevo
        const res = await apiRequest(`messages.php?folder=INBOX&page=1&perPage=5&refresh=1`);
        if (res.messages && res.messages.length > 0) {
          const firstMsg = res.messages[0];
          
          // Si el mensaje más reciente es nuevo y no estaba en la lista visible
          if (firstMsg.unseen && messages.length > 0 && firstMsg.uid !== messages[0].uid) {
            // Reproducir sonido sutil de notificación
            try {
              const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
              const osc = audioCtx.createOscillator();
              const gain = audioCtx.createGain();
              osc.connect(gain);
              gain.connect(audioCtx.destination);
              osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
              gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
              osc.start();
              osc.stop(audioCtx.currentTime + 0.4);
            } catch (soundErr) {}

            // Alerta de escritorio en Mac
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification(`Nuevo correo de ${firstMsg.from?.name || firstMsg.from?.email}`, {
                body: firstMsg.subject || '(Sin asunto)',
                icon: '/public/favicon.ico'
              });
            }

            // Actualizar la bandeja y las carpetas automáticamente en pantalla
            loadMessages(selectedFolder, page, searchQuery);
            loadFolders();
          }
        }
      } catch (e) {
        // Ignorar fallos de red esporádicos en segundo plano
      }
    }, 30000); // Cada 30 segundos

    return () => clearInterval(interval);
  }, [account, messages, selectedFolder, page, searchQuery]);

  // 4. Cargar carpetas
  const loadFolders = async (forceRefresh = false) => {
    try {
      const res = await apiRequest(`folders.php${forceRefresh ? '?refresh=1' : ''}`);
      if (res.folders) {
        setFolders(res.folders);
      }
    } catch (err) {
      console.error('Error cargando carpetas:', err);
    }
  };

  const [loadingMore, setLoadingMore] = useState(false);

  // 5. Cargar mensajes (recarga o cambio de carpeta)
  const loadMessages = async (folder = selectedFolder, p = 1, query = searchQuery, forceRefresh = false) => {
    setLoadingMessages(true);
    setPage(p);
    try {
      const params = new URLSearchParams({
        folder: folder,
        page: p.toString(),
        perPage: perPage.toString(),
        search: query
      });
      if (forceRefresh) {
        params.append('refresh', '1');
      }
      const res = await apiRequest(`messages.php?${params.toString()}`);
      setMessages(res.messages || []);
      setTotalMessages(res.total || 0);
      if (forceRefresh) {
        loadFolders(true);
      }
    } catch (err) {
      console.error('Error cargando mensajes:', err);
    } finally {
      setLoadingMessages(false);
      setIsRefreshing(false);
    }
  };

  // 5.1 Carga infinita al deslizar con la rueda del mouse hacia el final
  const loadMoreMessages = async () => {
    if (loadingMessages || loadingMore) return;
    if (messages.length >= totalMessages && totalMessages > 0) return;

    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({
        folder: selectedFolder,
        page: nextPage.toString(),
        perPage: perPage.toString(),
        search: searchQuery
      });
      const res = await apiRequest(`messages.php?${params.toString()}`);
      if (res.messages && res.messages.length > 0) {
        setMessages((prev) => {
          const existingUids = new Set(prev.map((m) => m.uid));
          const newOnes = res.messages.filter((m) => !existingUids.has(m.uid));
          return [...prev, ...newOnes];
        });
        setPage(nextPage);
      }
      if (res.total) {
        setTotalMessages(res.total);
      }
    } catch (err) {
      console.error('Error cargando más mensajes:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  // 5. Seleccionar mensaje para detalle
  const handleSelectMessage = async (uid) => {
    setSelectedUid(uid);
    setLoadingDetail(true);
    setThreadDetail([]);
    try {
      const params = new URLSearchParams({
        uid: uid.toString(),
        folder: selectedFolder
      });
      const res = await apiRequest(`message.php?${params.toString()}`);
      setMessageDetail(res.message);
      setThreadDetail(res.thread || [res.message]);

      setMessages((prev) =>
        prev.map((m) => (m.uid === uid ? { ...m, unseen: false, unreadCount: 0 } : m))
      );

      // Actualizar el contador de no leídos en la barra lateral
      setFolders((prev) =>
        prev.map((f) => (f.id === selectedFolder ? { ...f, unseen: Math.max(0, f.unseen - 1) } : f))
      );
    } catch (err) {
      console.error('Error al abrir correo:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  // 6. Destacar / Desmarcar mensaje
  const handleToggleStar = async (uid, shouldStar) => {
    try {
      await apiRequest(`message.php?uid=${uid}&folder=${encodeURIComponent(selectedFolder)}`, {
        method: 'POST',
        body: JSON.stringify({ action: shouldStar ? 'star' : 'unstar' })
      });
      setMessages((prev) =>
        prev.map((m) => (m.uid === uid ? { ...m, flagged: shouldStar } : m))
      );
    } catch (err) {
      console.error('Error al cambiar estrella:', err);
    }
  };

  // 7. Acciones Masivas (Marcar varios como leídos, no leídos o papelera)
  const handleBulkAction = async (uids, action) => {
    try {
      for (const uid of uids) {
        await apiRequest(`message.php?uid=${uid}&folder=${encodeURIComponent(selectedFolder)}`, {
          method: 'POST',
          body: JSON.stringify({ action, allInConversation: true })
        });
      }
      if (action === 'restore' && selectedFolder.toLowerCase().includes('trash')) {
        setSelectedFolder('INBOX');
        loadMessages('INBOX', 1, searchQuery, true);
      } else {
        loadMessages(selectedFolder, 1, searchQuery, true);
      }
      loadFolders(true);
    } catch (err) {
      console.error('Error en acción masiva:', err);
    }
  };

  // 8. Eliminar mensaje / conversación completa a papelera
  const handleDeleteMessage = async () => {
    if (!selectedUid) return;
    try {
      await apiRequest(`message.php?uid=${selectedUid}&folder=${encodeURIComponent(selectedFolder)}`, {
        method: 'POST',
        body: JSON.stringify({ action: 'trash', allInConversation: true })
      });
      setSelectedUid(null);
      setMessageDetail(null);
      setThreadDetail([]);
      loadMessages(selectedFolder, 1, searchQuery, true);
      loadFolders(true);
    } catch (err) {
      console.error('Error al mover a papelera:', err);
    }
  };

  // Mover conversación completa a una carpeta destino
  const handleMoveMessage = async (targetFolderId) => {
    if (!selectedUid || !targetFolderId) return;
    try {
      await apiRequest(`message.php?uid=${selectedUid}&folder=${encodeURIComponent(selectedFolder)}`, {
        method: 'POST',
        body: JSON.stringify({ action: 'move', targetFolder: targetFolderId, allInConversation: true })
      });
      const targetFolderObj = folders.find(f => f.id === targetFolderId);
      setToastMessage(`Conversación movida a "${targetFolderObj?.name || targetFolderId}".`);
      setTimeout(() => setToastMessage(null), 4000);
      setSelectedUid(null);
      setMessageDetail(null);
      setThreadDetail([]);
      loadMessages(selectedFolder, 1, searchQuery, true);
      loadFolders(true);
    } catch (err) {
      console.error('Error al mover correo:', err);
      alert(err.message || 'Error al mover el correo');
    }
  };

  // Mover correos en lote a una carpeta destino
  const handleBulkMove = async (uids, targetFolderId) => {
    if (!uids || uids.length === 0 || !targetFolderId) return;
    try {
      for (const uid of uids) {
        await apiRequest(`message.php?uid=${uid}&folder=${encodeURIComponent(selectedFolder)}`, {
          method: 'POST',
          body: JSON.stringify({ action: 'move', targetFolder: targetFolderId, allInConversation: true })
        });
      }
      const targetFolderObj = folders.find(f => f.id === targetFolderId);
      setToastMessage(`${uids.length} correos movidos a "${targetFolderObj?.name || targetFolderId}".`);
      setTimeout(() => setToastMessage(null), 4000);
      loadMessages(selectedFolder, 1, searchQuery, true);
      loadFolders(true);
    } catch (err) {
      console.error('Error al mover en lote:', err);
      alert(err.message || 'Error al mover correos');
    }
  };

  // 8.1 Restaurar conversación completa desde la papelera a INBOX
  const handleRestoreMessage = async () => {
    if (!selectedUid) return;
    try {
      await apiRequest(`message.php?uid=${selectedUid}&folder=${encodeURIComponent(selectedFolder)}`, {
        method: 'POST',
        body: JSON.stringify({ action: 'restore', allInConversation: true })
      });
      setToastMessage('Conversación restaurada a Recibidos con éxito.');
      setTimeout(() => setToastMessage(null), 4000);
      setSelectedUid(null);
      setMessageDetail(null);
      setThreadDetail([]);

      // Si estábamos en la papelera, cambiar de vuelta a Recibidos para ver la conversación restaurada
      if (selectedFolder.toLowerCase().includes('trash')) {
        setSelectedFolder('INBOX');
        loadMessages('INBOX', 1, searchQuery, true);
      } else {
        loadMessages(selectedFolder, 1, searchQuery, true);
      }
      loadFolders(true);
    } catch (err) {
      console.error('Error al restaurar mensaje:', err);
    }
  };

  // 8.2 Eliminar conversación definitivamente de la papelera
  const handlePermanentDeleteMessage = async () => {
    if (!selectedUid) return;
    if (!window.confirm('¿Estás seguro de que deseas eliminar toda esta conversación definitivamente?')) return;
    try {
      await apiRequest(`message.php?uid=${selectedUid}&folder=${encodeURIComponent(selectedFolder)}`, {
        method: 'POST',
        body: JSON.stringify({ action: 'delete', allInConversation: true })
      });
      setToastMessage('Conversación eliminada definitivamente.');
      setTimeout(() => setToastMessage(null), 4000);
      setSelectedUid(null);
      setMessageDetail(null);
      setThreadDetail([]);
      loadMessages();
      loadFolders();
    } catch (err) {
      console.error('Error al eliminar definitivamente:', err);
    }
  };

  // 9. Responder a mensaje (Reply)
  const handleReply = (msg) => {
    const parentMsgId = msg.messageId || '';
    const refs = (msg.references ? `${msg.references} ` : '') + parentMsgId;
    setComposeInitialData({
      to: msg.from?.email,
      cc: '',
      subject: msg.subject?.startsWith('Re:') ? msg.subject : `Re: ${msg.cleanSubject || msg.subject}`,
      inReplyTo: parentMsgId,
      references: refs.trim(),
      bodyHtml: `<p></p><blockquote style="border-left: 2px solid #1a73e8; padding-left: 10px; margin-left: 0; color: #666;">
        <p><strong>El ${msg.date}, ${msg.from?.name || msg.from?.email} escribió:</strong></p>
        ${msg.html || msg.plain || ''}
      </blockquote>`
    });
    setIsComposeOpen(true);
  };

  // 10. Responder a todos (Reply All)
  const handleReplyAll = (msg) => {
    // Destinatarios originales To y Cc excepto uno mismo
    const myEmail = (account?.email || '').toLowerCase();
    const otherRecipients = [];

    if (msg.to && Array.isArray(msg.to)) {
      msg.to.forEach((t) => {
        const e = (t.email || '').toLowerCase();
        if (e && e !== myEmail && e !== (msg.from?.email || '').toLowerCase()) {
          otherRecipients.push(t.email);
        }
      });
    }

    if (msg.cc && Array.isArray(msg.cc)) {
      msg.cc.forEach((c) => {
        const e = (c.email || '').toLowerCase();
        if (e && e !== myEmail && !otherRecipients.includes(c.email)) {
          otherRecipients.push(c.email);
        }
      });
    }

    const parentMsgId = msg.messageId || '';
    const refs = (msg.references ? `${msg.references} ` : '') + parentMsgId;

    setComposeInitialData({
      to: msg.from?.email,
      cc: otherRecipients.join(', '),
      subject: msg.subject?.startsWith('Re:') ? msg.subject : `Re: ${msg.cleanSubject || msg.subject}`,
      inReplyTo: parentMsgId,
      references: refs.trim(),
      bodyHtml: `<p></p><blockquote style="border-left: 2px solid #1a73e8; padding-left: 10px; margin-left: 0; color: #666;">
        <p><strong>El ${msg.date}, ${msg.from?.name || msg.from?.email} escribió:</strong></p>
        ${msg.html || msg.plain || ''}
      </blockquote>`
    });
    setIsComposeOpen(true);
  };

  // 11. Reenviar mensaje (Forward)
  const handleForward = (msg) => {
    const toNames = msg.to?.map((t) => t.name || t.email).join(', ') || '';
    const parentMsgId = msg.messageId || '';
    const refs = (msg.references ? `${msg.references} ` : '') + parentMsgId;

    setComposeInitialData({
      to: '',
      cc: '',
      subject: msg.subject?.startsWith('Fwd:') ? msg.subject : `Fwd: ${msg.cleanSubject || msg.subject}`,
      inReplyTo: parentMsgId,
      references: refs.trim(),
      bodyHtml: `<p></p><br><hr style="border: 0; border-top: 1px solid #ccc; margin: 15px 0;"><div style="color: #444; font-size: 13px;">
        <p><strong>---------- Mensaje reenviado ----------</strong><br>
        <strong>De:</strong> ${msg.from?.name || ''} &lt;${msg.from?.email || ''}&gt;<br>
        <strong>Fecha:</strong> ${msg.date}<br>
        <strong>Asunto:</strong> ${msg.subject}<br>
        <strong>Para:</strong> ${toNames}</p>
      </div><br>${msg.html || msg.plain || ''}`
    });
    setIsComposeOpen(true);
  };

  // Abrir modal de creación de carpeta o etiqueta
  const handleOpenCreateModal = () => {
    setIsCreateModalOpen(true);
  };

  const handleCreatedFolderOrLabel = (type, item) => {
    if (type === 'label') {
      setToastMessage(`Etiqueta "${item?.name || 'nueva'}" creada con éxito.`);
      setTimeout(() => setToastMessage(null), 3000);
      loadLabels();
    } else {
      setToastMessage(`Carpeta "${item}" creada en el servidor.`);
      setTimeout(() => setToastMessage(null), 3000);
      loadFolders(true);
    }
  };

  // 10. Cerrar sesión
  const handleLogout = async () => {
    try {
      await apiRequest('login.php', { method: 'DELETE' });
      setAccount(null);
      setMessages([]);
      setSelectedUid(null);
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
    }
  };

  if (checkingAuth) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#f0f4f9] dark:bg-[#1a1b1e]">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-600 dark:text-gray-300 font-medium text-sm">Cargando Octupass Mail...</p>
      </div>
    );
  }

  if (!account) {
    return (
      <Login
        onLoginSuccess={(acc) => {
          setAccount(acc);
          loadFolders();
          loadLabels();
          loadMessages('INBOX', 1, '');
        }}
      />
    );
  }

  return (
    <div className="h-full h-[100dvh] flex flex-col bg-[#f6f8fc] dark:bg-[#1a1b1e] text-gray-900 dark:text-gray-100 overflow-hidden select-none">
      {/* Header Superior */}
      <Header
        account={account}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        isRefreshing={isRefreshing}
        layoutMode={layoutMode}
        onToggleLayout={() => {
          setLayoutMode(prev => {
            const next = prev === 'tripanel' ? 'standard' : 'tripanel';
            localStorage.setItem('app_layout_mode', next);
            return next;
          });
        }}
        onOpenCommandBar={() => setIsCommandBarOpen(true)}
        onToggleSidebar={() => {
          if (window.innerWidth < 768) {
            setIsMobileSidebarOpen(prev => !prev);
          } else {
            setIsSidebarCollapsed(prev => {
              const next = !prev;
              localStorage.setItem('sidebar_collapsed', next.toString());
              return next;
            });
          }
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenVault={() => setIsVaultOpen(true)}
        onRefresh={() => {
          setIsRefreshing(true);
          loadFolders();
          loadMessages();
        }}
        onLogout={handleLogout}
      />

      {/* Cuerpo principal */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Backdrop para cerrar barra lateral en móviles */}
        {isMobileSidebarOpen && (
          <div 
            onClick={() => setIsMobileSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-2xs md:hidden animate-fade-in"
          />
        )}

        {/* Barra lateral: Drawer flotante en móviles / Estándar colapsable en escritorio */}
        <div className={`
          fixed inset-y-0 left-0 z-50 transform md:static md:z-auto md:translate-x-0 transition-transform duration-200 ease-in-out flex flex-col h-full
          ${isMobileSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}
        `}>
          <Sidebar
            folders={folders}
            selectedFolder={selectedFolder}
            isCollapsed={isSidebarCollapsed}
            onCreateFolder={handleOpenCreateModal}
            labels={labels}
            activeLabel={activeLabel}
            onSelectLabel={(labelId) => {
              setActiveLabel(labelId);
              setSelectedUid(null);
              setMessageDetail(null);
            }}
            onOpenContacts={() => {
              setIsMobileSidebarOpen(false);
              setIsContactsOpen(true);
            }}
            onCloseMobile={() => setIsMobileSidebarOpen(false)}
            onSelectFolder={(folderId) => {
              setSelectedFolder(folderId);
              setActiveLabel(null);
              setSelectedUid(null);
              setMessageDetail(null);
              setPage(1);
              setIsMobileSidebarOpen(false); // Cierre automático al seleccionar carpeta en móvil
              loadMessages(folderId, 1, searchQuery);
            }}
            onOpenCompose={() => {
              setIsMobileSidebarOpen(false);
              setComposeInitialData(null);
              setIsComposeOpen(true);
            }}
          />
        </div>

        {/* MODO TRIPANEL (Linear/Superhuman Style): Lista de correos y Lector lado a lado */}
        {layoutMode === 'tripanel' ? (
          <div className="flex-1 flex overflow-hidden w-full max-w-full">
            {/* Columna 2: Lista de mensajes compacta y estilizada con ancho dinámico */}
            <div 
              style={{
                width: typeof window !== 'undefined' && window.innerWidth >= 768 ? `${listWidth}px` : '100%'
              }}
              className={`${
                selectedUid ? 'hidden md:flex' : 'flex'
              } w-full md:w-auto flex-shrink-0 flex-col overflow-hidden relative max-w-full`}
            >
              <MessageList
                messages={messages}
                total={totalMessages}
                page={page}
                perPage={perPage}
                folder={selectedFolder}
                activeLabel={activeLabel}
                availableLabels={labels}
                availableFolders={folders}
                onPageChange={(newPage) => {
                  setPage(newPage);
                  loadMessages(selectedFolder, newPage, searchQuery);
                }}
                onLoadMore={loadMoreMessages}
                loadingMore={loadingMore}
                onSelectMessage={handleSelectMessage}
                onToggleStar={handleToggleStar}
                onBulkAction={handleBulkAction}
                onBulkAssignLabel={handleBulkAssignLabel}
                onBulkMove={handleBulkMove}
                onRefresh={loadMessages}
                loading={loadingMessages}
                selectedUid={selectedUid}
                layoutMode="tripanel"
              />
            </div>

            {/* Barra Vertical Divisora Redimensionable (Arrastrable a los lados) */}
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                setIsResizing(true);
              }}
              className="hidden md:flex items-center justify-center w-1.5 hover:w-2 bg-transparent hover:bg-blue-500/20 active:bg-blue-500/40 cursor-col-resize transition-all z-20 group relative border-r border-gray-200/80 dark:border-gray-800"
              title="Arrastra para cambiar el ancho de la lista"
            >
              {/* Indicador sutil de agarre */}
              <div className="w-0.5 h-8 rounded-full bg-gray-300 dark:bg-gray-600 group-hover:bg-blue-500 group-active:bg-blue-600 transition-colors" />
            </div>

            {/* Columna 3: Lector de correo abierto o estado vacío elegante */}
            <div className={`${
              !selectedUid ? 'hidden md:flex' : 'flex'
            } flex-1 flex-col overflow-hidden w-full max-w-full`}>
              {selectedUid ? (
                <MessageDetail
                  message={messageDetail}
                  thread={threadDetail}
                  folder={selectedFolder}
                  availableLabels={labels}
                  availableFolders={folders}
                  onToggleLabel={handleToggleLabel}
                  onMoveToFolder={handleMoveMessage}
                  loading={loadingDetail}
                  onBack={() => {
                    setSelectedUid(null);
                    setMessageDetail(null);
                    setThreadDetail([]);
                  }}
                  onDelete={handleDeleteMessage}
                  onRestore={handleRestoreMessage}
                  onPermanentDelete={handlePermanentDeleteMessage}
                  onReply={handleReply}
                  onReplyAll={handleReplyAll}
                  onForward={handleForward}
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-[#202124] rounded-2xl border border-gray-200/80 dark:border-gray-800 shadow-xs m-2 ml-0 p-8 text-center select-none">
                  <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-4 text-blue-600 dark:text-blue-400">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-1">
                    Espacio de Trabajo Octupass
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mb-4 leading-relaxed">
                    Selecciona un correo de la lista para ver su conversación completa, respuestas de clientes y ficha CRM lateral instantáneamente.
                  </p>
                  <div className="flex items-center gap-2 text-[11px] text-gray-400">
                    <kbd className="font-mono bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-2 py-0.5 rounded">⌘K</kbd>
                    <span>para atajos rápidos</span>
                    <span className="mx-1">•</span>
                    <kbd className="font-mono bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-2 py-0.5 rounded">C</kbd>
                    <span>para redactar</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* MODO ESTÁNDAR: Vista individual (Bandeja completa o Mensaje individual) */
          <>
            {selectedUid ? (
              <MessageDetail
                message={messageDetail}
                thread={threadDetail}
                folder={selectedFolder}
                availableLabels={labels}
                availableFolders={folders}
                onToggleLabel={handleToggleLabel}
                onMoveToFolder={handleMoveMessage}
                loading={loadingDetail}
                onBack={() => {
                  setSelectedUid(null);
                  setMessageDetail(null);
                  setThreadDetail([]);
                }}
                onDelete={handleDeleteMessage}
                onRestore={handleRestoreMessage}
                onPermanentDelete={handlePermanentDeleteMessage}
                onReply={handleReply}
                onReplyAll={handleReplyAll}
                onForward={handleForward}
              />
            ) : (
              <MessageList
                messages={messages}
                total={totalMessages}
                page={page}
                perPage={perPage}
                folder={selectedFolder}
                activeLabel={activeLabel}
                availableLabels={labels}
                availableFolders={folders}
                onPageChange={(newPage) => {
                  setPage(newPage);
                  loadMessages(selectedFolder, newPage, searchQuery);
                }}
                onLoadMore={loadMoreMessages}
                loadingMore={loadingMore}
                onSelectMessage={handleSelectMessage}
                onToggleStar={handleToggleStar}
                onBulkAction={handleBulkAction}
                onBulkAssignLabel={handleBulkAssignLabel}
                onBulkMove={handleBulkMove}
                onRefresh={loadMessages}
                loading={loadingMessages}
                selectedUid={selectedUid}
                layoutMode="standard"
              />
            )}
          </>
        )}
      </div>

      {/* Modal Flotante de Redacción */}
      <ComposeModal
        isOpen={isComposeOpen}
        initialData={composeInitialData}
        account={account}
        onClose={() => setIsComposeOpen(false)}
        onSent={() => {
          setToastMessage('Mensaje enviado.');
          setTimeout(() => setToastMessage(null), 6000);
          loadMessages();
          loadFolders();
        }}
      />

      {/* Barra Flotante de Notificación / Deshacer estilo Gmail */}
      {toastMessage && (
        <div className="fixed bottom-6 left-8 bg-[#202124] text-white px-5 py-3 rounded-xl shadow-2xl z-50 flex items-center gap-4 text-xs animate-slide-up border border-gray-700">
          <span>{toastMessage}</span>
          <button
            onClick={() => {
              setToastMessage('Acción deshecha.');
              setTimeout(() => setToastMessage(null), 2500);
            }}
            className="text-blue-400 font-bold hover:underline"
          >
            Deshacer
          </button>
        </div>
      )}

      {/* Modal de Configuración y Personalización */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        account={account}
        theme={theme}
        setTheme={setTheme}
        signature={signature}
        setSignature={setSignature}
        desktopNotifications={desktopNotifications}
        setDesktopNotifications={setDesktopNotifications}
      />

      {/* Modal de Contactos Corporativos */}
      <ContactsModal
        isOpen={isContactsOpen}
        onClose={() => setIsContactsOpen(false)}
        onSelectContactToMail={(contactEmail) => {
          setComposeInitialData({ to: contactEmail });
          setIsComposeOpen(true);
        }}
      />

      {/* Command Bar (⌘K / Ctrl+K) */}
      <CommandBar
        isOpen={isCommandBarOpen}
        onClose={() => setIsCommandBarOpen(false)}
        onOpenCompose={() => {
          setComposeInitialData(null);
          setIsComposeOpen(true);
        }}
        onSelectFolder={(folderId) => {
          setSelectedFolder(folderId);
          setSelectedUid(null);
          setMessageDetail(null);
          setPage(1);
          loadMessages(folderId, 1, searchQuery);
        }}
        onRefresh={() => {
          setIsRefreshing(true);
          loadFolders();
          loadMessages();
        }}
        onToggleTheme={() => setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenContacts={() => setIsContactsOpen(true)}
        currentTheme={theme}
        selectedFolder={selectedFolder}
        selectedUid={selectedUid}
        onReplyCurrent={() => {
          if (messageDetail) handleReply(messageDetail);
        }}
        folders={folders}
      />

      {/* Modal de Bóveda de Seguridad & Recuperación Forense */}
      <AuditVaultModal
        isOpen={isVaultOpen}
        onClose={() => setIsVaultOpen(false)}
        onRestored={() => {
          setToastMessage('¡Correo y adjuntos restaurados con éxito a Recibidos!');
          setTimeout(() => setToastMessage(null), 5000);
          loadMessages();
          loadFolders();
        }}
      />

      {/* Modal para Crear Carpeta IMAP o Etiqueta con Color */}
      <CreateFolderOrLabelModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={handleCreatedFolderOrLabel}
      />
    </div>
  );
}
