/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import {
  loadAll,
  getLocalOptimisticData,
  executeWrite,
  processQueue,
  getQueue,
  isOnline,
  isSyncConfigured,
  clearAllLocalState,
  setupRealtimeSubscriptions,
  NFCData,
  QueueItem
} from "../db";

interface DataContextType {
  data: NFCData | null;
  queue: QueueItem[];
  loading: boolean;
  online: boolean;
  simulatedOffline: boolean;
  syncConfigured: boolean;
  theme: "light" | "dark" | "system";
  setTheme: (t: "light" | "dark" | "system") => void;
  activeTheme: "light" | "dark";
  appDate: string;
  setAppDate: (d: string) => void;
  refreshData: () => Promise<void>;
  write: <K extends keyof NFCData>(
    table: K,
    action: "insert" | "update" | "upsert" | "delete",
    payload: any
  ) => Promise<boolean>;
  writeBatch: (
    items: {
      table: keyof NFCData;
      action: "insert" | "update" | "upsert" | "delete";
      payload: any;
    }[]
  ) => Promise<boolean>;
  toggleNetworkSimulation: () => void;
  triggerSync: () => Promise<{ success: boolean; processed: number; remaining: number }>;
  resetToDefault: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isFirstLoadRef = useRef(true);
  const [data, setData] = useState<NFCData | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(isOnline());
  const [simulatedOffline, setSimulatedOffline] = useState(false);
  const [syncConfigured] = useState(isSyncConfigured());

  // Theme states
  const [theme, setThemeState] = useState<"light" | "dark" | "system">("system");
  const [activeTheme, setActiveTheme] = useState<"light" | "dark">("dark");
  const [appDate, setAppDateState] = useState<string>("2026-06-09");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("nfc_theme_mode") as "light" | "dark" | "system" | null;
      if (savedTheme) {
        setThemeState(savedTheme);
      }
      const savedDate = localStorage.getItem("nfc_app_date");
      if (savedDate) {
        setAppDateState(savedDate);
      }
    }
  }, []);

  const setAppDate = (d: string) => {
    setAppDateState(d);
    if (typeof window !== "undefined") {
      localStorage.setItem("nfc_app_date", d);
    }
  };

  const setTheme = (t: "light" | "dark" | "system") => {
    setThemeState(t);
    if (typeof window !== "undefined") {
      localStorage.setItem("nfc_theme_mode", t);
    }
  };

  useEffect(() => {
    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = () => {
        setActiveTheme(mediaQuery.matches ? "dark" : "light");
      };
      handleChange(); // Evaluate initial value
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    } else {
      setActiveTheme(theme);
    }
  }, [theme]);

  // Synchronize HTML classes with the theme changes
  useEffect(() => {
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      if (activeTheme === "light") {
        root.classList.add("theme-light");
        root.classList.remove("theme-dark");
        root.classList.add("light");
        root.classList.remove("dark");
      } else {
        root.classList.add("theme-dark");
        root.classList.remove("theme-light");
        root.classList.add("dark");
        root.classList.remove("light");
      }
    }
  }, [activeTheme]);


  // Check state on loading
  useEffect(() => {
    if (typeof window !== "undefined") {
      setSimulatedOffline(localStorage.getItem("nfc_simulated_offline") === "true");
    }
  }, []);

  const refreshData = useCallback(async () => {
    // 1. Instant optimistic state update from local cache (0ms)
    try {
      const allDataLocal = getLocalOptimisticData();
      setData(allDataLocal);
      setQueue(getQueue());
      setOnline(isOnline());
    } catch (e) {
      console.warn("Local cache aggregator failed", e);
    }

    // 2. Only show main loading spinner on initial app launch
    const isFirstLoad = isFirstLoadRef.current;
    if (isFirstLoad) {
      setLoading(true);
    }

    try {
      // 3. Perform silent, asynchronous cloud database fetches
      const allDataRemote = await loadAll();
      setData(allDataRemote);
      setQueue(getQueue());
      setOnline(isOnline());
    } catch (e) {
      console.error("Failed to background-refresh application data", e);
    } finally {
      if (isFirstLoad) {
        setLoading(false);
        isFirstLoadRef.current = false;
      }
    }
  }, []);

  // Sync data initially
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Establish Supabase Real-time table subscription listeners
  useEffect(() => {
    const unsubscribe = setupRealtimeSubscriptions(() => {
      loadAll().then((freshData) => {
        setData(freshData);
        setQueue(getQueue());
      });
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // Listener to keep sync state & queue reactive
  useEffect(() => {
    const handleQueueUpdated = () => {
      setQueue(getQueue());
      // Re-load data to parse optimistic queue updates correctly
      loadAll().then((freshData) => {
        setData(freshData);
      });
    };

    const handleOnlineStatus = () => {
      setOnline(isOnline());
    };

    if (typeof window !== "undefined") {
      window.addEventListener("queue_updated", handleQueueUpdated);
      window.addEventListener("online", handleOnlineStatus);
      window.addEventListener("offline", handleOnlineStatus);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("queue_updated", handleQueueUpdated);
        window.removeEventListener("online", handleOnlineStatus);
        window.removeEventListener("offline", handleOnlineStatus);
      }
    };
  }, []);

  // Automatically trigger background queue sync when online and there's items in queue
  useEffect(() => {
    if (online && queue.length > 0 && syncConfigured) {
      const autoSyncTimer = setTimeout(() => {
        processQueue()
          .then((res) => {
            if (res && res.processed > 0) {
              console.log(`[AutoSync] Background processed ${res.processed} items.`);
              refreshData();
            }
          })
          .catch((err) => console.error("[AutoSync] Automated sync error:", err));
      }, 2000);
      return () => clearTimeout(autoSyncTimer);
    }
  }, [online, queue.length, syncConfigured, refreshData]);

  // Write wrapping executes mutation with state refreshing
  const write = async <K extends keyof NFCData>(
    table: K,
    action: "insert" | "update" | "upsert" | "delete",
    payload: any
  ) => {
    const res = await executeWrite(table, action, payload);
    await refreshData();
    return res.success;
  };

  const writeBatch = async (
    items: {
      table: keyof NFCData;
      action: "insert" | "update" | "upsert" | "delete";
      payload: any;
    }[]
  ) => {
    for (const item of items) {
      await executeWrite(item.table, item.action, item.payload);
    }
    await refreshData();
    return true;
  };

  // Toggle simulate online/offline
  const toggleNetworkSimulation = () => {
    const current = localStorage.getItem("nfc_simulated_offline") === "true";
    localStorage.setItem("nfc_simulated_offline", (!current).toString());
    setSimulatedOffline(!current);
    const updatedOnline = isOnline();
    setOnline(updatedOnline);
    
    // Dispatch offline/online event
    window.dispatchEvent(new Event(updatedOnline ? "online" : "offline"));
    refreshData();
  };

  // Manual Trigger Sync
  const triggerSync = async () => {
    const result = await processQueue();
    await refreshData();
    return result;
  };

  // Nuke local cache to defaults
  const resetToDefault = () => {
    clearAllLocalState();
    refreshData();
  };

  return (
    <DataContext.Provider
      value={{
        data,
        queue,
        loading,
        online,
        simulatedOffline,
        syncConfigured,
        theme,
        setTheme,
        activeTheme,
        appDate,
        setAppDate,
        refreshData,
        write,
        writeBatch,
        toggleNetworkSimulation,
        triggerSync,
        resetToDefault,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error("useData must be used within a DataProvider context");
  }
  return context;
};
