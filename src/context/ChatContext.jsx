import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const ChatContext = createContext(null);

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

const LEGACY_STORAGE_KEY = 'focusflow_synced_chat_sessions_v1';
const GUEST_STORAGE_KEY = 'focusflow_chat_sessions_guest';

const getStorageKey = (currentUser) => {
  if (!currentUser) return null;
  if (currentUser.isGuest) return GUEST_STORAGE_KEY;
  return `focusflow_chat_sessions_${currentUser.uid}`;
};

const createDefaultSession = () => ({
  id: `sess_${Date.now()}`,
  title: 'Neues Gespräch',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  contextScope: 'general',
  contextId: null,
  contextTitle: 'Allgemein',
  contextAttachments: [],
  model: 'gemini-3.6-flash',
  messages: []
});

const normalizeSessions = (candidate) => {
  if (!Array.isArray(candidate) || candidate.length === 0) return null;

  return candidate.map((session) => ({
    ...session,
    messages: Array.isArray(session.messages)
      ? session.messages.map((message) => (
        message.isStreaming
          ? { ...message, isStreaming: false, cancelled: true }
          : message
      ))
      : []
  }));
};

const loadSessionsFromLocal = (currentUser) => {
  if (!currentUser) return [createDefaultSession()];

  const key = getStorageKey(currentUser);
  if (!key) return [createDefaultSession()];

  try {
    let saved = localStorage.getItem(key);

    // Migration alter Daten für angemeldete Nutzer (nur einmalig ausführen):
    // Verhindert Datenverlust und sorgt dafür, dass der alte globale Schlüssel danach gelöscht wird,
    // damit keine privaten Sitzungen in den Gast-Modus oder an Dritte lecken.
    if (!saved && !currentUser.isGuest) {
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        saved = legacy;
        try {
          localStorage.setItem(key, legacy);
          localStorage.removeItem(LEGACY_STORAGE_KEY);
        } catch (e) {
          console.warn('[ChatContext] Migration warning:', e);
        }
      }
    }

    if (saved) {
      const parsed = JSON.parse(saved);
      const normalized = normalizeSessions(parsed);
      if (normalized) return normalized;
    }
  } catch (e) {
    console.warn('[ChatContext] Fehler beim Laden aus LocalStorage:', e);
  }
  return [createDefaultSession()];
};

export const ChatProvider = ({ children }) => {
  const { user } = useAuth();
  const [activeModel, setActiveModel] = useState('gemini-3.6-flash');

  // Load initial sessions from user-scoped storage
  const [sessions, setSessions] = useState(() => loadSessionsFromLocal(user));

  const [activeSessionId, setActiveSessionId] = useState(() => {
    return sessions[0]?.id || `sess_${Date.now()}`;
  });

  // Re-sync / reload sessions when auth status changes (Account login, Gastmodus oder Logout)
  useEffect(() => {
    let isMounted = true;

    // 1. Wenn ausgeloggt (kein User): Sofortiger Reset des Zustands auf ein frisches Standard-Gespräch
    if (!user) {
      const fresh = [createDefaultSession()];
      setSessions(fresh);
      setActiveSessionId(fresh[0].id);
      return;
    }

    // 2. Gast-Modus: Strikt isolierte Gast-Sitzungen laden (kein Zugriff auf Firestore, kein Zugriff auf Account-Sessions)
    if (user.isGuest) {
      const guestSessions = loadSessionsFromLocal(user);
      setSessions(guestSessions);
      setActiveSessionId(guestSessions[0]?.id || `sess_${Date.now()}`);
      return;
    }

    // 3. Angemeldeter Account: Benutzerspezifischen Cache aus LocalStorage laden
    const cached = loadSessionsFromLocal(user);
    setSessions(cached);
    setActiveSessionId(cached[0]?.id || `sess_${Date.now()}`);

    // Anschließend mit Firestore abgleichen
    if (!db) return;

    const loadFromFirestore = async () => {
      try {
        const docRef = doc(db, 'users', user.uid, 'chat_data', 'sessions');
        const snap = await getDoc(docRef);
        if (snap.exists() && isMounted) {
          const data = snap.data();
          const normalizedSessions = normalizeSessions(data?.sessions);
          if (normalizedSessions) {
            setSessions(normalizedSessions);
            if (data.activeSessionId) {
              setActiveSessionId(data.activeSessionId);
            }
            const key = getStorageKey(user);
            if (key) {
              localStorage.setItem(key, JSON.stringify(normalizedSessions));
            }
          }
        }
      } catch (err) {
        console.warn('[ChatContext] Firestore-Sync Fehler:', err);
      }
    };

    loadFromFirestore();
    return () => { isMounted = false; };
  }, [user?.uid, user?.isGuest]);

  // Persist to user-scoped LocalStorage and Firestore
  const persistSessions = useCallback((updatedSessions, activeId) => {
    const storageKey = getStorageKey(user);
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(updatedSessions));
      } catch (e) {
        console.warn('[ChatContext] LocalStorage Speichern fehlgeschlagen:', e);
      }
    }

    if (user && !user.isGuest && db) {
      try {
        const docRef = doc(db, 'users', user.uid, 'chat_data', 'sessions');
        setDoc(docRef, {
          sessions: updatedSessions,
          activeSessionId: activeId,
          lastUpdated: new Date().toISOString()
        }, { merge: true }).catch((err) => {
          console.warn('[ChatContext] Firestore async save warning:', err);
        });
      } catch (err) {
        console.warn('[ChatContext] Firestore error:', err);
      }
    }
  }, [user]);

  // Create new session
  const createNewSession = useCallback(({
    contextScope = 'general',
    contextId = null,
    contextTitle = null,
    contextAttachments = [],
    model = activeModel,
    initialTitle = 'Neues Gespräch'
  } = {}) => {
    const newSession = {
      id: `sess_${Date.now()}`,
      title: initialTitle,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      contextScope: contextScope === 'global' ? 'general' : contextScope,
      contextId,
      contextTitle: contextTitle || (contextScope === 'general' ? 'Allgemein' : 'Projekt'),
      contextAttachments: Array.isArray(contextAttachments) ? contextAttachments : [],
      model: model || activeModel,
      messages: []
    };

    setSessions((prev) => {
      const updated = [newSession, ...prev];
      persistSessions(updated, newSession.id);
      return updated;
    });

    setActiveSessionId(newSession.id);
    return newSession;
  }, [activeModel, persistSessions]);

  // Eigener Chat "Projektanlegung: …" mit einem Entwurf, den Hand und Fio gemeinsam bearbeiten
  const createDraftSession = useCallback(({ title, source, draft }) => {
    const now = new Date().toISOString();
    const newSession = {
      id: `sess_${Date.now()}`,
      title: `Projektanlegung: ${title}`.slice(0, 60),
      createdAt: now,
      updatedAt: now,
      contextScope: 'draft',
      contextId: null,
      contextTitle: 'Entwurf',
      contextAttachments: [],
      model: activeModel,
      draft,
      draftSource: source,
      draftStatus: 'open', // 'open' | 'confirmed'
      draftAwaitingDetail: true, // erst Detailtiefe wählen, dann legt Fio los
      draftDetail: null, // 'coarse' | 'balanced' | 'fine'
      draftPendingStart: false,
      draftVersions: [{ id: `v_${Date.now()}`, label: 'Start', at: now, draft }],
      messages: []
    };
    setSessions((prev) => {
      const updated = [newSession, ...prev];
      persistSessions(updated, newSession.id);
      return updated;
    });
    setActiveSessionId(newSession.id);
    return newSession;
  }, [activeModel, persistSessions]);

  // Entwurf ändern. `label` legt zusätzlich eine Version an (z. B. nach einem Prompt); Handänderungen überschreiben nur den Stand.
  const updateSessionDraft = useCallback((sessionId, nextDraft, { label = null, extra = {} } = {}) => {
    setSessions((prev) => {
      const now = new Date().toISOString();
      const updated = prev.map((sess) => {
        if (sess.id !== sessionId) return sess;
        const versions = label
          ? [...(sess.draftVersions || []), { id: `v_${Date.now()}`, label, at: now, draft: nextDraft }].slice(-20)
          : sess.draftVersions;
        return { ...sess, draft: nextDraft, draftVersions: versions, updatedAt: now, ...extra };
      });
      persistSessions(updated, sessionId);
      return updated;
    });
  }, [persistSessions]);

  // Select session
  const selectSession = useCallback((sessionId) => {
    setActiveSessionId(sessionId);
    persistSessions(sessions, sessionId);
  }, [sessions, persistSessions]);

  // Delete session
  const deleteSession = useCallback((sessionId) => {
    setSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== sessionId);
      let nextActiveId = activeSessionId;

      if (filtered.length === 0) {
        const fresh = createDefaultSession();
        nextActiveId = fresh.id;
        persistSessions([fresh], nextActiveId);
        setActiveSessionId(nextActiveId);
        return [fresh];
      }

      if (activeSessionId === sessionId) {
        nextActiveId = filtered[0].id;
        setActiveSessionId(nextActiveId);
      }

      persistSessions(filtered, nextActiveId);
      return filtered;
    });
  }, [activeSessionId, persistSessions]);

  // Add a message to a session and accumulate contextAttachments into session
  const addMessageToSession = useCallback((sessionId, message) => {
    setSessions((prev) => {
      const now = new Date().toISOString();
      const updated = prev.map((sess) => {
        if (sess.id === sessionId) {
          const isFirstUserMsg = message.role === 'user' && sess.messages.filter(m => m.role === 'user').length === 0;
          let smartTitle = sess.title;
          if (isFirstUserMsg && message.content && sess.contextScope !== 'draft') {
            const cleanText = message.content.replace(/\n+/g, ' ').trim();
            smartTitle = cleanText.length > 38 ? cleanText.slice(0, 38) + '...' : cleanText;
          }

          // Accumulate unique context attachments into the session
          const existingContexts = sess.contextAttachments || [];
          const newAttachments = message.attachments || [];
          const mergedContexts = [...existingContexts];
          newAttachments.forEach((att) => {
            if (!mergedContexts.some(item => item.id === att.id && item.type === att.type)) {
              mergedContexts.push(att);
            }
          });

          // Update contextTitle if it now contains specific attachments
          let updatedContextTitle = sess.contextTitle;
          if (mergedContexts.length > 0 && (!sess.contextTitle || sess.contextTitle === 'Allgemein' || sess.contextTitle === 'Alle Daten')) {
            if (mergedContexts.length === 1) {
              updatedContextTitle = mergedContexts[0].title;
            } else {
              const pCount = mergedContexts.filter(c => c.type === 'project').length;
              const rCount = mergedContexts.filter(c => c.type === 'reminder').length;
              const cCount = mergedContexts.filter(c => c.type === 'calendar' || c.type === 'calendar_event').length;
              const parts = [];
              if (pCount > 0) parts.push(`${pCount} Proj.`);
              if (rCount > 0) parts.push(`${rCount} Erinn.`);
              if (cCount > 0) parts.push('Kalender');
              updatedContextTitle = parts.length > 0 ? parts.join(', ') : 'Fokus';
            }
          }

          return {
            ...sess,
            title: smartTitle,
            contextTitle: updatedContextTitle,
            contextAttachments: mergedContexts,
            updatedAt: now,
            messages: [
              ...sess.messages,
              {
                id: message.id || `msg_${Date.now()}`,
                role: message.role || 'user',
                content: message.content || '',
                attachments: message.attachments || [],
                timestamp: message.timestamp || now,
                isStreaming: !!message.isStreaming
              }
            ]
          };
        }
        return sess;
      });

      persistSessions(updated, sessionId);
      return updated;
    });
  }, [persistSessions]);

  // Remove a specific context attachment from a session
  const removeSessionAttachment = useCallback((sessionId, attachmentId, attachmentType) => {
    setSessions((prev) => {
      const updated = prev.map((sess) => {
        if (sess.id === sessionId) {
          const current = sess.contextAttachments || [];
          const filtered = current.filter(att => !(att.id === attachmentId && att.type === attachmentType));
          return {
            ...sess,
            contextAttachments: filtered,
            updatedAt: new Date().toISOString()
          };
        }
        return sess;
      });
      persistSessions(updated, sessionId);
      return updated;
    });
  }, [persistSessions]);

  // Update streaming message in session
  const updateStreamingMessage = useCallback((sessionId, messageId, streamedContent, isStreaming = true, actionResults = null, extraFields = {}) => {
    setSessions((prev) => {
      const updated = prev.map((sess) => {
        if (sess.id === sessionId) {
          return {
            ...sess,
            updatedAt: new Date().toISOString(),
            messages: sess.messages.map((msg) =>
              msg.id === messageId
                ? { 
                    ...msg, 
                    content: streamedContent !== undefined ? streamedContent : (msg.content || ''), 
                    isStreaming,
                    ...(actionResults !== null ? { actionResults } : {}),
                    ...(extraFields || {})
                  }
                : msg
            )
          };
        }
        return sess;
      });

      // Only persist to storage when streaming finishes
      if (!isStreaming) {
        persistSessions(updated, sessionId);
      }
      return updated;
    });
  }, [persistSessions]);

  // Filter sessions by context helper
  const getSessionsForScope = useCallback((scope = 'all', contextId = null) => {
    if (scope === 'all') return sessions;
    if (scope === 'general') return sessions.filter((s) => s.contextScope === 'general' || s.contextScope === 'global');
    if (scope === 'project') {
      if (contextId) return sessions.filter((s) => s.contextId === contextId);
      return sessions.filter((s) => s.contextScope === 'project' || s.contextScope === 'task' || s.contextScope === 'section');
    }
    return sessions;
  }, [sessions]);

  // Active Session object
  const activeSession = useMemo(() => {
    return sessions.find((s) => s.id === activeSessionId) || sessions[0] || createDefaultSession();
  }, [sessions, activeSessionId]);

  // Nachricht, die beim nächsten Öffnen von Fio in einem neuen Gespräch abgeschickt wird
  // (z. B. aus dem Eingabefeld "Frag Fio …" im Apps-Menü)
  // Der Text liegt in einer Ref, damit er genau einmal entnommen werden kann (StrictMode führt Effekte doppelt aus);
  // der State dient nur als Auslöser für den Effekt in Coach.jsx.
  const queuedPromptRef = useRef(null);
  const [queuedPrompt, setQueuedPrompt] = useState(null);
  const queuePrompt = useCallback((text) => {
    queuedPromptRef.current = text;
    setQueuedPrompt(text);
  }, []);
  const takeQueuedPrompt = useCallback(() => {
    const text = queuedPromptRef.current;
    queuedPromptRef.current = null;
    setQueuedPrompt(null);
    return text;
  }, []);

  const value = {
    sessions,
    activeSession,
    activeSessionId,
    activeModel,
    setActiveModel,
    createNewSession,
    createDraftSession,
    updateSessionDraft,
    selectSession,
    deleteSession,
    addMessageToSession,
    removeSessionAttachment,
    updateStreamingMessage,
    getSessionsForScope,
    queuedPrompt,
    queuePrompt,
    takeQueuedPrompt
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};
