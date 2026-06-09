/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient, RealtimeChannel } from "@supabase/supabase-js";

// ==========================================
// 1. Critical Capacitor Version Bug Fix (The Interceptor Polyfill)
// ==========================================
if (typeof window !== "undefined") {
  const win = window as any;
  win.Capacitor = win.Capacitor || {};
  win.Capacitor.Plugins = win.Capacitor.Plugins || {};
  if (!win.Capacitor.Plugins.App) {
    win.Capacitor.Plugins.App = { addListener: () => Promise.resolve({ remove: () => {} }) };
  }
  const patchedApp = win.Capacitor.Plugins.App;
  Object.defineProperty(win.Capacitor.Plugins, "App", {
    get: () => patchedApp,
    set: (nativeAppPlugin: any) => {
      if (nativeAppPlugin && nativeAppPlugin.addListener) {
        const realAddListener = nativeAppPlugin.addListener;
        patchedApp.addListener = function (...args: any[]) {
          const res = realAddListener.apply(nativeAppPlugin, args);
          if (!res || typeof res.then !== "function") return Promise.resolve(res || { remove: () => {} });
          return res;
        };
      }
    },
    configurable: true,
  });
}

// ==========================================
// 2. Types & Interfaces
// ==========================================
export interface User {
  id: string | number;
  name: string;
  pin: string;
  role: "admin" | "auctioneer" | "collector";
}

export interface Buyer {
  id: string | number;
  nickname: string;
  lifetime_debt: number;
  credit_limit: number;
}

export interface Source {
  id: string | number;
  name: string;
  rate_per_kg: number;
  date: string;
  is_completed: boolean;
  is_archived: boolean;
}

export interface Transaction {
  id: string | number;
  source_id: string | number;
  buyer_id: string | number;
  weight: number;
  price_per_kg: number;
  total_price: number;
  date: string;
  fish_type: string;
  added_by: string;
}

export interface DailyCollection {
  id: string | number;
  buyer_id: string | number;
  date: string;
  total_owed_today: number;
  amount_paid: number;
  is_rolled_over: boolean;
  is_approved: boolean;
  created_at?: string;
}

export interface SourcePayment {
  id: string | number;
  source_id: string | number;
  date: string;
  total_kg: number;
  rate_per_kg: number;
  sale_total: number;
  amount_paid_to_source: number;
  commission: number;
  is_settled: boolean;
}

export interface Setting {
  key: string;
  value: string;
}

export interface NFCData {
  users: User[];
  buyers: Buyer[];
  sources: Source[];
  transactions: Transaction[];
  daily_collections: DailyCollection[];
  source_payments: SourcePayment[];
  settings: Setting[];
}

export interface QueueItem {
  id: string | number;
  table: keyof NFCData;
  action: "insert" | "update" | "delete" | "upsert";
  payload: any;
  timestamp: number;
}

// ==========================================
// 3. Supabase Client Setup & Demo Mode Flag
// ==========================================
const metaEnv = (import.meta as any).env || {};
const supabaseUrl = metaEnv.VITE_SUPABASE_URL || "";
const supabaseAnonKey = metaEnv.VITE_SUPABASE_ANON_KEY || "";

// We operate in Demo/Local mode if real keys aren't configured.
const isDemoModeOnly = !supabaseUrl || !supabaseAnonKey || supabaseUrl.includes("placeholder-project");

export const supabase = createClient(
  supabaseUrl || "https://local-placeholder-url-for-nfc.supabase.co",
  supabaseAnonKey || "local-placeholder-anon-key"
);

// Check if client claims database connection is configured
export function isSyncConfigured(): boolean {
  return !isDemoModeOnly;
}

// Check network online status (with optional virtual simulated offline toggle)
export function isOnline(): boolean {
  if (typeof window !== "undefined") {
    const simulatedOffline = localStorage.getItem("nfc_simulated_offline") === "true";
    if (simulatedOffline) return false;
    return window.navigator.onLine;
  }
  return true;
}

// ==========================================
// 4. Initial Seed Data
// ==========================================
const INITIAL_SEED_DATA: NFCData = {
  users: [
    { id: "u-1", name: "Apon Das", pin: "2255", role: "admin" },
    { id: "u-2", name: "Rafi Ahmed", pin: "1122", role: "auctioneer" },
    { id: "u-3", name: "Subrata Roy", pin: "3344", role: "collector" },
  ],
  buyers: [
    { id: "b-1", nickname: "Moni Fish Co.", lifetime_debt: 54000, credit_limit: 150000 },
    { id: "b-2", nickname: "Bhai Bhai Enterprise", lifetime_debt: 125000, credit_limit: 200000 },
    { id: "b-3", nickname: "Haji Traders", lifetime_debt: 12000, credit_limit: 80000 },
    { id: "b-4", nickname: "Siddique & Sons", lifetime_debt: 0, credit_limit: 50000 },
  ],
  sources: [
    { id: "s-1", name: "Digha Estuary Trawler 04", rate_per_kg: 250, date: "2026-06-09", is_completed: false, is_archived: false },
    { id: "s-2", name: "Vizag Harbor Hatchery A", rate_per_kg: 180, date: "2026-06-08", is_completed: true, is_archived: false },
    { id: "s-3", name: "Mandapam Fish Depot", rate_per_kg: 310, date: "2026-06-09", is_completed: false, is_archived: false },
  ],
  transactions: [
    { id: "t-1", source_id: "s-1", buyer_id: "b-1", weight: 120, price_per_kg: 255, total_price: 30600, date: "2026-06-09", fish_type: "Hilsha (Ilish)", added_by: "Apon Das" },
    { id: "t-2", source_id: "s-2", buyer_id: "b-2", weight: 300, price_per_kg: 190, total_price: 57000, date: "2026-06-08", fish_type: "Rui/Katla", added_by: "Rafi Ahmed" },
  ],
  daily_collections: [
    { id: "c-1", buyer_id: "b-2", date: "2026-06-09", total_owed_today: 57000, amount_paid: 25000, is_rolled_over: false, is_approved: true },
    { id: "c-2", buyer_id: "b-1", date: "2026-06-09", total_owed_today: 30600, amount_paid: 0, is_rolled_over: false, is_approved: false },
  ],
  source_payments: [
    { id: "p-1", source_id: "s-2", date: "2026-06-08", total_kg: 300, rate_per_kg: 180, sale_total: 57000, amount_paid_to_source: 50000, commission: 2000, is_settled: true },
  ],
  settings: [
    { key: "halkhata_pin", value: "9988" },
  ],
};

const CACHE_KEY = "nfc_offline_cache";
const QUEUE_KEY = "nfc_offline_queue";

// Helper to get local cache
export function getLocalCache(): NFCData {
  if (typeof window === "undefined") return INITIAL_SEED_DATA;
  const stored = localStorage.getItem(CACHE_KEY);
  if (!stored) {
    localStorage.setItem(CACHE_KEY, JSON.stringify(INITIAL_SEED_DATA));
    return INITIAL_SEED_DATA;
  }
  try {
    return JSON.parse(stored);
  } catch (e) {
    return INITIAL_SEED_DATA;
  }
}

// Helper to save local cache (updates offline copy)
export function saveLocalCache(data: NFCData) {
  if (typeof window !== "undefined") {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  }
}

// Helper to get sync queue
export function getQueue(): QueueItem[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(QUEUE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch (e) {
    return [];
  }
}

// Helper to save sync queue
export function saveQueue(queue: QueueItem[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }
}

// ==========================================
// 5. Offline Queue Engine Logic
// ==========================================

/**
 * Optimistic UI Updates: Reads cache, fetches from Supabase if online/configured.
 * Then, merges any items in the local queue into the result.
 */
export async function loadAll(): Promise<NFCData> {
  let fetched: NFCData = getLocalCache();

  if (!isDemoModeOnly && isOnline()) {
    try {
      const keys: (keyof NFCData)[] = ["users", "buyers", "sources", "transactions", "daily_collections", "source_payments", "settings"];
      const results = await Promise.all(
        keys.map(async (key) => {
          const { data, error } = await supabase.from(key).select("*");
          if (error) throw error;
          return { key, data: data || [] };
        })
      );

      const dbData = {} as NFCData;
      results.forEach(({ key, data }) => {
        dbData[key] = data as any;
      });

      // Save to local cache
      fetched = dbData;
      saveLocalCache(fetched);
    } catch (e) {
      console.warn("Supabase fetch failed. Falling back to local offline cache.", e);
      fetched = getLocalCache();
    }
  } else {
    fetched = getLocalCache();
  }

  // OPTIMISTIC UPDATE: Merge nfc_offline_queue into fetched data before returning to caller
  const queue = getQueue();
  if (queue.length > 0) {
    // Deep clone to prevent mutating cache reference directly
    const merged: NFCData = JSON.parse(JSON.stringify(fetched));

    queue.forEach((item) => {
      const tableKey = item.table;
      
      if (!merged[tableKey]) {
        merged[tableKey] = [];
      }

      const tableList = merged[tableKey] as any[];

      switch (item.action) {
        case "insert":
          // Prevent duplicates by checking id
          if (!tableList.some((x) => x.id === item.id)) {
            tableList.push(item.payload);
          }
          break;

        case "update":
        case "upsert": {
          const idx = tableList.findIndex((x) => x.id === item.id);
          if (idx !== -1) {
            tableList[idx] = { ...tableList[idx], ...item.payload };
          } else {
            tableList.push(item.payload);
          }
          break;
        }

        case "delete":
          merged[tableKey] = tableList.filter((x) => x.id !== item.id) as any;
          break;
      }
    });

    return merged;
  }

  return fetched;
}

/**
 * Executes a write operation. Tries to push immediately.
 * Intercepts locally upon failure/offline, adding item to queue.
 */
export async function executeWrite<K extends keyof NFCData>(
  table: K,
  action: "insert" | "update" | "upsert" | "delete",
  payload: any
): Promise<{ success: boolean; data: any; queued: boolean }> {
  // If no ID is defined on insertions, create one for tracking
  if ((action === "insert" || action === "upsert") && !payload.id) {
    payload.id = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  }

  const itemId = payload.id || payload.key || ""; 

  // Try writing online first
  if (!isDemoModeOnly && isOnline()) {
    try {
      let response: any = null;
      if (action === "insert") {
        const { id, ...payloadWithoutId } = payload; // let db assign actual serial or uuid if needed
        const { data, error } = await supabase.from(table).insert([payloadWithoutId]).select();
        if (error) throw error;
        response = data?.[0] || payload;
      } else if (action === "update") {
        const { error, data } = await supabase.from(table).update(payload).eq("id", itemId).select();
        if (error) throw error;
        response = data?.[0] || payload;
      } else if (action === "upsert") {
        const { error, data } = await supabase.from(table).upsert([payload]).select();
        if (error) throw error;
        response = data?.[0] || payload;
      } else if (action === "delete") {
        const { error } = await supabase.from(table).delete().eq("id", itemId);
        if (error) throw error;
        response = { id: itemId };
      }

      // Success online: Also apply to local cache
      await syncLocalCacheItem(table, action, response || payload);
      return { success: true, data: response || payload, queued: false };
    } catch (e) {
      console.warn(`Supabase write to '${table}' failed. Cruising offline queue fallback.`, e);
    }
  }

  // OFFLINE BACKUP MODE
  const queue = getQueue();
  const queueItem: QueueItem = {
    id: itemId,
    table,
    action,
    payload,
    timestamp: Date.now(),
  };

  // Add key transaction item
  queue.push(queueItem);
  saveQueue(queue);

  // Directly update local offline cache as well
  await syncLocalCacheItem(table, action, payload);

  // Fire event to notify application components about state shifts
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("queue_updated"));
  }

  return { success: true, data: payload, queued: true };
}

/**
 * Triggers queue resolution. Iterates the list, mappings temp IDs, syncs to server.
 */
export async function processQueue(): Promise<{ success: boolean; processed: number; remaining: number }> {
  if (isDemoModeOnly || !isOnline()) {
    return { success: false, processed: 0, remaining: getQueue().length };
  }

  const queue = getQueue();
  if (queue.length === 0) return { success: true, processed: 0, remaining: 0 };

  const idTempMap: Record<string, any> = {};
  const remaining: QueueItem[] = [];
  let processedCount = 0;

  for (let item of queue) {
    try {
      // Resolve any parent records' temp IDs (e.g. buying from the source created two seconds ago)
      const resolvedPayload = resolveTempIds(item.payload, idTempMap);
      const itemId = idTempMap[item.id] || item.id;

      if (item.action === "insert") {
        // Stripe out temp ID
        const { id, ...supabasePayload } = resolvedPayload;
        const { data, error } = await supabase.from(item.table).insert([supabasePayload]).select();
        if (error) throw error;

        if (data && data[0]) {
          const dbId = data[0].id;
          if (item.id) {
            idTempMap[item.id] = dbId;
          }
        }
      } else if (item.action === "update") {
        const { error } = await supabase.from(item.table).update(resolvedPayload).eq("id", itemId);
        if (error) throw error;
      } else if (item.action === "upsert") {
        const { error } = await supabase.from(item.table).upsert([resolvedPayload]);
        if (error) throw error;
      } else if (item.action === "delete") {
        const { error } = await supabase.from(item.table).delete().eq("id", itemId);
        if (error) throw error;
      }

      processedCount++;
    } catch (err) {
      console.error(`Failed to process offline queue transaction item:`, item, err);
      remaining.push(item);
    }
  }

  saveQueue(remaining);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("queue_updated"));
  }

  // Pull fresh fully-synced values from Supabase back down
  await forceSyncFromServer();

  return {
    success: remaining.length === 0,
    processed: processedCount,
    remaining: remaining.length,
  };
}

/**
 * Helper to substitute mapped real database IDs from earlier inserts
 */
function resolveTempIds(payload: any, map: Record<string, any>): any {
  if (!payload || typeof payload !== "object") return payload;
  const newPayload = { ...payload };
  for (let key in newPayload) {
    const val = newPayload[key];
    if (typeof val === "string" && map[val]) {
      newPayload[key] = map[val];
    } else if (typeof val === "object" && val !== null) {
      newPayload[key] = resolveTempIds(val, map);
    }
  }
  return newPayload;
}

/**
 * Helper to keep local storage synced without waiting for network fetches
 */
async function syncLocalCacheItem<K extends keyof NFCData>(
  table: K,
  action: "insert" | "update" | "upsert" | "delete",
  payload: any
) {
  const cache = getLocalCache();
  const tableList = (cache[table] || []) as any[];
  const itemId = payload.id || payload.key || "";

  switch (action) {
    case "insert":
      if (!tableList.some((x) => x.id === itemId)) {
        tableList.push(payload);
      }
      break;
    case "update":
    case "upsert": {
      const idx = tableList.findIndex((x) => (payload.id ? x.id === itemId : x.key === itemId));
      if (idx !== -1) {
        tableList[idx] = { ...tableList[idx], ...payload };
      } else {
        tableList.push(payload);
      }
      break;
    }
    case "delete":
      cache[table] = tableList.filter((x) => x.id !== itemId) as any;
      break;
  }

  saveLocalCache(cache);
}

/**
 * Force fetch everything from the remote database and refresh local cache (ignores queue)
 */
export async function forceSyncFromServer(): Promise<boolean> {
  if (isDemoModeOnly || !isOnline()) return false;
  try {
    const keys: (keyof NFCData)[] = ["users", "buyers", "sources", "transactions", "daily_collections", "source_payments", "settings"];
    const results = await Promise.all(
      keys.map(async (key) => {
        const { data, error } = await supabase.from(key).select("*");
        if (error) throw error;
        return { key, data: data || [] };
      })
    );

    const dbData = {} as NFCData;
    results.forEach(({ key, data }) => {
      dbData[key] = data as any;
    });

    saveLocalCache(dbData);
    return true;
  } catch (err) {
    console.error("Force sync failed: ", err);
    return false;
  }
}

// Clear all offline state & revert to initial seed
export function clearAllLocalState() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(QUEUE_KEY);
  }
}

// Setup automated window online listener and real-time re-syncing
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    // Force sync fresh values from server right away to be clean
    forceSyncFromServer()
      .then(() => {
        console.log("Automatically synched fresh database snapshot after recovering connection.");
      })
      .catch((e) => console.error("Force sync on connection recovery failed", e))
      .finally(() => {
        // Process queue on recovery
        processQueue()
          .then((res) => {
            if (res.processed > 0) {
              console.log(`Automatic sync completed. Processed ${res.processed} queued items.`);
            }
          })
          .catch((err) => console.error("Auto recovery queue process failed", err));
      });
  });
}

// ==========================================
// 6. Supabase Real-time Subscriptions & Authentication Logic
// ==========================================

/**
 * Custom authentication helper using Supabase table or local offline cache.
 */
export async function authenticateUserWithPIN(
  userId: string | number,
  pin: string
): Promise<{ success: boolean; user?: User }> {
  if (!isDemoModeOnly && isOnline()) {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .eq("pin", pin)
        .single();

      if (!error && data) {
        return { success: true, user: data as User };
      } else {
        console.warn("Authing user directly with Supabase users table query returned no match or error:", error);
      }
    } catch (e) {
      console.warn("Supabase PIN verification exception, falling back to local cache verification:", e);
    }
  }

  // Fallback to local cache PIN check for offline resiliency
  const cache = getLocalCache();
  const matchedUser = cache.users.find((u) => u.id === userId && u.pin === pin);
  if (matchedUser) {
    return { success: true, user: matchedUser };
  }
  return { success: false };
}

/**
 * Connects real-time Postgres subscription listeners to Supabase tables.
 * This runs client-side, updating the local cache and triggering UI re-renders.
 */
export function setupRealtimeSubscriptions(onUpdate?: () => void): () => void {
  if (isDemoModeOnly) {
    console.log("Running in Demo Mode: Supabase Realtime subscriptions skipped.");
    return () => {};
  }

  const tables: (keyof NFCData)[] = ["users", "buyers", "sources", "transactions", "daily_collections"];
  const activeChannels: RealtimeChannel[] = [];

  console.log("Setting up Supabase Real-time subscriptions for tables:", tables);

  tables.forEach((table) => {
    try {
      const channel = supabase
        .channel(`realtime-nfc-${table}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: table },
          async (payload: any) => {
            console.log(`Real-time change detected on database table '${table}':`, payload);

            let action: "insert" | "update" | "delete" | "upsert" = "upsert";
            let payloadItem = payload.new;

            if (payload.eventType === "INSERT") {
              action = "insert";
            } else if (payload.eventType === "UPDATE") {
              action = "update";
            } else if (payload.eventType === "DELETE") {
              action = "delete";
              payloadItem = payload.old;
            }

            if (payloadItem) {
              await syncLocalCacheItem(table, action, payloadItem);

              // Trigger reactive UI state re-rendering in DataContext & React
              if (typeof window !== "undefined") {
                window.dispatchEvent(new Event("queue_updated"));
              }
              if (onUpdate) {
                onUpdate();
              }
            }
          }
        )
        .subscribe((status, err) => {
          console.log(`Supabase Real-time subscription status for '${table}': ${status}`, err || "");
        });

      activeChannels.push(channel);
    } catch (err) {
      console.error(`Failed to subscribe to Supabase Real-time changes for table '${table}':`, err);
    }
  });

  // Gracefully handle reconnection:
  const handleConnectionRecovery = () => {
    console.log("Connectivity regained. Supabase Real-time subscriptions verifying status.");
  };

  if (typeof window !== "undefined") {
    window.addEventListener("online", handleConnectionRecovery);
  }

  // Return clean unsubscription cleanup function
  return () => {
    console.log("Cleaning up active Supabase Real-time subscriptions.");
    activeChannels.forEach((channel) => {
      supabase.removeChannel(channel);
    });
    if (typeof window !== "undefined") {
      window.removeEventListener("online", handleConnectionRecovery);
    }
  };
}
