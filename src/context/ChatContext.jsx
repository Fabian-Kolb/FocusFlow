import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
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

const STORAGE_KEY = 'focusflow_synced_chat_sessions_v1';

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

export const ChatProvider = ({ children }) => {
  const { user } = useAuth();
  const [activeModel, setActiveModel] = useState('gemini-3.6-flash');

  // Load initial sessions from localStorage
  const [sessions, setSessions] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('[ChatContext] Fehler beim Laden aus LocalStorage:', e);
    }
    return [createDefaultSession()];
  });

  const [activeSessionId, setActiveSessionId] = useState(() => {
    return sessions[0]?.id || `sess_${Date.now()}`;
  });

  // Sync to Firestore for authenticated users
  useEffect(() => {
    if (!user || user.isGuest || !db) return;

    let isMounted = true;
    const loadFromFirestore = async () => {
      try {
        const docRef = doc(db, 'users', user.uid, 'chat_data', 'sessions');
        const snap = await getDoc(docRef);
        if (snap.exists() && isMounted) {
          const data = snap.data();
          if (Array.isArray(data?.sessions) && data.sessions.length > 0) {
            setSessions(data.sessions);
            if (data.activeSessionId) {
              setActiveSessionId(data.activeSessionId);
            }
          }
        }
      } catch (err) {
        console.warn('[ChatContext] Firestore-Sync Fehler:', err);
      }
    };

    loadFromFirestore();
    return () => { isMounted = false; };
  }, [user]);

  // Persist to LocalStorage and Firestore
  const persistSessions = useCallback((updatedSessions, activeId) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSessions));
    } catch (e) {
      console.warn('[ChatContext] LocalStorage Speichern fehlgeschlagen:', e);
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
          if (isFirstUserMsg && message.content) {
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
              if (pCount > 0 && rCount > 0) updatedContextTitle = `${pCount} Proj., ${rCount} Erinn.`;
              else if (pCount > 0) updatedContextTitle = `${pCount} Projekte`;
              else updatedContextTitle = `${rCount} Erinnerungen`;
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
  const updateStreamingMessage = useCallback((sessionId, messageId, streamedContent, isStreaming = true, actionResults = null) => {
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
                    ...(actionResults !== null ? { actionResults } : {})
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

  const value = {
    sessions,
    activeSession,
    activeSessionId,
    activeModel,
    setActiveModel,
    createNewSession,
    selectSession,
    deleteSession,
    addMessageToSession,
    removeSessionAttachment,
    updateStreamingMessage,
    getSessionsForScope
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};

