import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  DEFAULT_ENVIRONMENT_ID, ENVIRONMENTS, ENVIRONMENT_IDS, getEnvironment, getEnvironmentNav, isEnvironmentId, normalizeEnabled, resolveActive,
} from '../lib/environments';

const ACTIVE_KEY = 'focusflow_environment';
const ENABLED_KEY = 'focusflow_environments_enabled';

const read = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // gilt dann nur für diese Sitzung
  }
};

function readEnabled() {
  try {
    return normalizeEnabled(JSON.parse(read(ENABLED_KEY) || 'null'));
  } catch {
    return normalizeEnabled(null);
  }
}

// Ohne Provider (z. B. in isolierten Tests) gilt die App wie bisher: nur Allgemein
const FALLBACK = {
  activeEnvironmentId: DEFAULT_ENVIRONMENT_ID,
  activeEnvironment: ENVIRONMENTS[DEFAULT_ENVIRONMENT_ID],
  nav: getEnvironmentNav(DEFAULT_ENVIRONMENT_ID),
  enabledIds: [DEFAULT_ENVIRONMENT_ID],
  enabledEnvironments: [ENVIRONMENTS[DEFAULT_ENVIRONMENT_ID]],
  setActiveEnvironment: () => {},
  setEnvironmentEnabled: () => {},
};

const EnvironmentContext = createContext(null);

/**
 * Aktive Umgebung und welche Umgebungen eingeschaltet sind, je Gerät im Browser gemerkt.
 * Muss außerhalb von DataProvider stehen: Der legt neue Dinge in der aktiven Umgebung an.
 */
export function EnvironmentProvider({ children }) {
  const [enabledIds, setEnabledIds] = useState(readEnabled);
  const [storedActive, setStoredActive] = useState(() => {
    const stored = read(ACTIVE_KEY);
    return isEnvironmentId(stored) ? stored : DEFAULT_ENVIRONMENT_ID;
  });

  // Gespeicherte Umgebung ist inzwischen ausgeschaltet oder unfertig: Allgemein
  const activeEnvironmentId = resolveActive(storedActive, enabledIds);

  const setActiveEnvironment = useCallback((id) => {
    if (!isEnvironmentId(id)) return;
    setStoredActive(id);
    write(ACTIVE_KEY, id);
  }, []);

  const setEnvironmentEnabled = useCallback((id, enabled) => {
    if (!isEnvironmentId(id) || id === DEFAULT_ENVIRONMENT_ID) return;
    setEnabledIds((prev) => {
      const next = normalizeEnabled(enabled ? [...prev, id] : prev.filter((x) => x !== id));
      write(ENABLED_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const value = useMemo(() => ({
    activeEnvironmentId,
    activeEnvironment: getEnvironment(activeEnvironmentId),
    nav: getEnvironmentNav(activeEnvironmentId),
    enabledIds,
    enabledEnvironments: ENVIRONMENT_IDS.filter((id) => enabledIds.includes(id)).map((id) => ENVIRONMENTS[id]),
    setActiveEnvironment,
    setEnvironmentEnabled,
  }), [activeEnvironmentId, enabledIds, setActiveEnvironment, setEnvironmentEnabled]);

  return <EnvironmentContext.Provider value={value}>{children}</EnvironmentContext.Provider>;
}

export function useEnvironment() {
  return useContext(EnvironmentContext) || FALLBACK;
}
