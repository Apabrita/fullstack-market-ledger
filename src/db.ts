/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { 
  getFirestore, doc, setDoc, deleteDoc, getDocs, collection, onSnapshot, writeBatch
} from "firebase/firestore";
// @ts-ignore
import firebaseConfig from '../firebase-applet-config.json';

// ==========================================
// 1. Critical Capacitor Version Bug Fix
// ==========================================
if (typeof window !== "undefined") {
  const win = window as any;
  win.Capacitor = win.Capacitor || {};
  win.Capacitor.Plugins = win.Capacitor.Plugins || {};
  if (!win.Capacitor.Plugins.App) {
    win.Capacitor.Plugins.App = { addListener: () => Promise.resolve({ remove: () => {} }) };
  }
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
  date: string;
  is_completed: boolean;
  is_archived: boolean;
  rate_per_kg?: number;
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
  sale_total: number;
  amount_paid_to_source: number;
  commission: number;
  is_settled: boolean;
  items_json?: string;
  rate_per_kg?: number;
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
// 3. Firebase Architecture Sync Setup
// ==========================================
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Mock legacy config indicators, Firebase is always pre-configured via applet
const isFirebaseInitialized = true; 

export function isSyncConfigured(): boolean {
  return isFirebaseInitialized;
}

export function getCredentials(): { url: string; anonKey: string } {
  return { url: "firebase", anonKey: "firebase" }; // Dummy stubs to maintain interface
}

export function saveCredentials(url: string, key: string) {}
export function clearCredentials() {}

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
    { id: "u-1", name: "Admin Setup", pin: "2255", role: "admin" },
    { id: "u-2", name: "Auctioneer Setup", pin: "1122", role: "auctioneer" },
    { id: "u-3", name: "Collector Setup", pin: "3344", role: "collector" }
  ],
  buyers: [],
  sources: [],
  transactions: [],
  daily_collections: [],
  source_payments: [],
  settings: [
    { key: "halkhata_pin", value: "9988" }
  ],
};

const CACHE_KEY = "nfc_offline_cache";
const QUEUE_KEY = "nfc_offline_queue";

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

export function saveLocalCache(data: NFCData) {
  if (typeof window !== "undefined") {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  }
}

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

export function saveQueue(queue: QueueItem[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }
}

// ==========================================
// 5. Offline Queue Engine Logic
// ==========================================

export async function loadAll(): Promise<NFCData> {
  let fetched: NFCData = getLocalCache();

  if (isFirebaseInitialized && isOnline()) {
    try {
      const keys: (keyof NFCData)[] = ["users", "buyers", "sources", "transactions", "daily_collections", "source_payments", "settings"];
      const dbData = {} as NFCData;

      const fetchCloud = Promise.all(
        keys.map(async (key) => {
          try {
            const snapshot = await getDocs(collection(db, key));
            const records: any[] = [];
            snapshot.forEach((docSnap) => records.push(docSnap.data()));
            dbData[key] = records as any;
          } catch(error) {
             // Retain the existing local cache values on query error rather than wiping it!
             dbData[key] = ((fetched && fetched[key]) ? fetched[key] : []) as any;
             console.warn(`Firebase query failed on table '${key}':`, error);
          }
        })
      );

      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Cloud fetch timeout")), 10000));
      await Promise.race([fetchCloud, timeout]);

      // DO NOT SEED MOCK DATA AUTOMATICALLY
      // It can falsely trigger if Firebase refuses connection (e.g. offline + clean local cache), 
      // thus over-writing user's actual database when they return online.

      fetched = dbData;
      saveLocalCache(fetched);
    } catch (e) {
      console.warn("Firebase fetch failed... reverting to local cache.", e);
      fetched = getLocalCache();
    }
  } else {
    fetched = getLocalCache();
  }

  if (!fetched.users || fetched.users.length === 0) {
    fetched.users = INITIAL_SEED_DATA.users;
    saveLocalCache(fetched);
  }

  // OPTIMISTIC UPDATE: Merge active offline queues
  const queue = getQueue();
  if (queue.length > 0) {
    const merged: NFCData = JSON.parse(JSON.stringify(fetched));

    queue.forEach((item) => {
      const tableKey = item.table;
      if (!merged[tableKey]) merged[tableKey] = [];
      const tableList = merged[tableKey] as any[];

      switch (item.action) {
        case "insert":
          if (!tableList.some((x) => String(x.id || (x as any).key) === String(item.id))) {
            tableList.push(item.payload);
          }
          break;

        case "update":
        case "upsert": {
          const idx = tableList.findIndex((x) => String(x.id || (x as any).key) === String(item.id));
          if (idx !== -1) {
            tableList[idx] = { ...tableList[idx], ...item.payload };
          } else {
            tableList.push(item.payload);
          }
          break;
        }

        case "delete":
          merged[tableKey] = tableList.filter((x) => String(x.id || (x as any).key) !== String(item.id)) as any;
          break;
      }
    });

    return merged;
  }

  return fetched;
}

export function getLocalOptimisticData(): NFCData {
  const fetched = getLocalCache();
  const queue = getQueue();
  if (queue.length > 0) {
    const merged: NFCData = JSON.parse(JSON.stringify(fetched));
    queue.forEach((item) => {
      const tableKey = item.table;
      if (!merged[tableKey]) merged[tableKey] = [];
      const tableList = merged[tableKey] as any[];

      switch (item.action) {
        case "insert":
          if (!tableList.some((x) => String(x.id || (x as any).key) === String(item.id))) {
            tableList.push(item.payload);
          }
          break;

        case "update":
        case "upsert": {
          const idx = tableList.findIndex((x) => String(x.id || (x as any).key) === String(item.id));
          if (idx !== -1) {
            tableList[idx] = { ...tableList[idx], ...item.payload };
          } else {
            tableList.push(item.payload);
          }
          break;
        }

        case "delete":
          merged[tableKey] = tableList.filter((x) => String(x.id || (x as any).key) !== String(item.id)) as any;
          break;
      }
    });

    return merged;
  }
  return fetched;
}

const VALID_TABLE_COLUMNS: Record<keyof NFCData, string[]> = {
  users: ["id", "name", "pin", "role"],
  buyers: ["id", "nickname", "lifetime_debt", "credit_limit"],
  sources: ["id", "name", "date", "is_completed", "is_archived"],
  transactions: ["id", "source_id", "buyer_id", "weight", "price_per_kg", "total_price", "date", "fish_type", "added_by", "timestamp"],
  daily_collections: ["id", "buyer_id", "date", "total_owed_today", "amount_paid", "is_rolled_over", "is_approved", "created_at"],
  source_payments: ["id", "source_id", "date", "total_kg", "sale_total", "amount_paid_to_source", "commission", "is_settled", "items_json"],
  settings: ["key", "value"],
};

function sanitizePayload(table: keyof NFCData, payload: any): any {
  if (!payload || typeof payload !== "object") return payload;
  const validKeys = VALID_TABLE_COLUMNS[table];
  if (!validKeys) return payload;
  
  const sanitized: any = {};
  for (const key of validKeys) {
    if (payload[key] !== undefined) {
      sanitized[key] = payload[key];
    }
  }
  return sanitized;
}

export async function executeWrite<K extends keyof NFCData>(
  table: K,
  action: "insert" | "update" | "upsert" | "delete",
  payload: any
): Promise<{ success: boolean; data: any; queued: boolean; error?: string }> {
  if ((action === "insert" || action === "upsert") && !payload.id && table !== 'settings') {
    payload.id = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  }

  const itemId = String(payload.id || payload.key || ""); 

  // ALWAYS update the local, high-fidelity offline cache first!
  await syncLocalCacheItem(table, action, payload);

  let successToCloud = false;
  let lastError: any = null;

  if (isFirebaseInitialized && isOnline()) {
    try {
      if (action === "insert" || action === "upsert" || action === "update") {
         const cleanPayload = sanitizePayload(table, payload);
         
         // Fix: Provide a timeout so app does not freeze if offline internal queue blocks
         const writePromise = setDoc(doc(db, table, itemId), cleanPayload, { merge: true });
         const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 2500));
         await Promise.race([writePromise, timeoutPromise]);
         
      } else if (action === "delete") {
         const deletePromise = deleteDoc(doc(db, table, itemId));
         const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 2500));
         await Promise.race([deletePromise, timeoutPromise]);
      }
      
      successToCloud = true;
    } catch (e) {
      console.warn(`Firebase write fail on '${table}'. Storing inside queue for background sync.`, e);
      lastError = e;
    }
  }

  if (successToCloud) {
    return { success: true, data: payload, queued: false };
  }

  // Store in queue so it retries until committed
  const queue = getQueue();
  queue.push({
    id: itemId,
    table,
    action,
    payload,
    timestamp: Date.now(),
  });
  saveQueue(queue);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("queue_updated"));
  }

  return { success: true, data: payload, queued: true, error: lastError?.message || lastError?.details || "Offline or configuration error" };
}

export async function processQueue(): Promise<{ success: boolean; processed: number; remaining: number }> {
  if (!isFirebaseInitialized || !isOnline()) {
    return { success: false, processed: 0, remaining: getQueue().length };
  }

  const queue = getQueue();
  if (queue.length === 0) return { success: true, processed: 0, remaining: 0 };

  const idTempMap: Record<string, any> = {};
  const remaining: QueueItem[] = [];
  let processedCount = 0;

  for (let item of queue) {
    try {
      const resolvedPayload = resolveTempIds(item.payload, idTempMap);
      const cleanPayload = sanitizePayload(item.table, resolvedPayload);
      const itemId = String(idTempMap[item.id] || item.id);

      if (item.action === "insert" || item.action === "upsert" || item.action === "update") {
         const writePromise = setDoc(doc(db, item.table, itemId), cleanPayload, { merge: true });
         const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 2500));
         await Promise.race([writePromise, timeoutPromise]);
      } else if (item.action === "delete") {
         const deletePromise = deleteDoc(doc(db, item.table, itemId));
         const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 2500));
         await Promise.race([deletePromise, timeoutPromise]);
      }

      processedCount++;
    } catch (err) {
      console.error(`Failed to process queued record:`, item, err);
      remaining.push(item);
    }
  }

  saveQueue(remaining);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("queue_updated"));
  }

  await loadAll();

  return {
    success: remaining.length === 0,
    processed: processedCount,
    remaining: remaining.length,
  };
}

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

async function syncLocalCacheItem<K extends keyof NFCData>(
  table: K,
  action: "insert" | "update" | "upsert" | "delete",
  payload: any
) {
  const cache = getLocalCache();
  const tableList = (cache[table] || []) as any[];
  const itemId = String(payload.id || payload.key || "");

  switch (action) {
    case "insert":
      if (!tableList.some((x) => String(x.id || (x as any).key) === String(itemId))) {
        tableList.push(payload);
      }
      break;
    case "update":
    case "upsert": {
      const idx = tableList.findIndex((x) => String(x.id || (x as any).key) === String(itemId));
      if (idx !== -1) {
        tableList[idx] = { ...tableList[idx], ...payload };
      } else {
        tableList.push(payload);
      }
      break;
    }
    case "delete":
      cache[table] = tableList.filter((x) => String(x.id || (x as any).key) !== String(itemId)) as any;
      break;
  }

  saveLocalCache(cache);
}

export function clearAllLocalState() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(QUEUE_KEY);
  }
}

export async function wipeAllData(): Promise<void> {
  if (!isFirebaseInitialized || !isOnline()) {
    throw new Error("System must be online to perform a full cloud wipe.");
  }
  
  const keys: (keyof NFCData)[] = ["users", "buyers", "sources", "transactions", "daily_collections", "source_payments", "settings"];
  for (const key of keys) {
     const snap = await getDocs(collection(db, key));
     const batch = writeBatch(db);
     snap.forEach((docSnap) => batch.delete(docSnap.ref));
     if (!snap.empty) {
        await batch.commit().catch(()=> {});
     }
  }
  
  clearAllLocalState();
  
  const batch = writeBatch(db);
  for(const item of INITIAL_SEED_DATA.users) { batch.set(doc(db, 'users', String(item.id)), item); }
  for(const item of INITIAL_SEED_DATA.settings) { batch.set(doc(db, 'settings', String(item.key)), item); }
  await batch.commit();
  
  window.location.reload();
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    loadAll()
      .then(() => {
        console.log("Synchronized fresh Firebase snapshot.");
      })
      .catch((e) => console.error("Snapshot sync failed", e))
      .finally(() => {
        processQueue()
          .then((res) => {
            if (res.processed > 0) {
              console.log(`Auto queue resolved ${res.processed} records.`);
            }
          })
          .catch((err) => console.error("Auto queue sync error", err));
      });
  });
}

export async function authenticateUserWithPIN(
  userId: string | number,
  pin: string
): Promise<{ success: boolean; user?: User }> {
  try {
     const cache = getLocalCache();
     let matchedUser = cache.users.find((u) => String(u.id) === String(userId) && String(u.pin) === String(pin));
     if (matchedUser) return { success: true, user: matchedUser };
  } catch(e) {}
  return { success: false };
}

export function setupRealtimeSubscriptions(onUpdate?: () => void): () => void {
  if (!isFirebaseInitialized) return () => {};

  const tables = ["users", "buyers", "sources", "transactions", "daily_collections", "source_payments", "settings"];
  const unsubscribers: any[] = [];

  tables.forEach((table) => {
    const unsub = onSnapshot(collection(db, table), (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        let action: any = "upsert";
        if (change.type === 'removed') action = "delete";
        
        const record = change.doc.data();
        // Fallback IDs if omitted in data payload
        if(!record.id && table !== 'settings') record.id = change.doc.id;
        if(!record.key && table === 'settings') record.key = change.doc.id;
        
        syncLocalCacheItem(table as keyof NFCData, action, record).then(() => {
           if (typeof window !== "undefined") {
             window.dispatchEvent(new Event("queue_updated"));
           }
           if (onUpdate) onUpdate();
        });
      });
    }, (error) => {
      console.warn(`Snapshot listener error on table ${table}:`, error);
    });
    
    unsubscribers.push(unsub);
  });

  return () => {
    unsubscribers.forEach(unsub => unsub());
  };
}
