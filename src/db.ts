/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, updateDoc } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

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
// 3. Live Google Firebase Storage Setup
// ==========================================
let db: any = null;
let firebaseInitialized = false;

try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
  firebaseInitialized = true;
  console.log("Firebase Firestore Client synchronized perfectly!");
} catch (err) {
  console.warn("Firebase config initialization failed/skipped. Local Cache acts as primary storage.", err);
}

export function isSyncConfigured(): boolean {
  return firebaseInitialized;
}

// Check network online status
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

// Helpers to get local cache
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

  if (firebaseInitialized && isOnline()) {
    try {
      const keys: (keyof NFCData)[] = ["users", "buyers", "sources", "transactions", "daily_collections", "source_payments", "settings"];
      const dbData = {} as NFCData;

      const fetchCloud = Promise.all(
        keys.map(async (key) => {
          const colRef = collection(db, key);
          const snapshot = await getDocs(colRef);
          const list: any[] = [];
          snapshot.forEach((docSnap) => {
            const docId = docSnap.id;
            const docData = docSnap.data();
            list.push({ id: docId, key: docId, ...docData });
          });
          dbData[key] = list as any;
        })
      );

      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Cloud fetch timeout")), 1000));
      await Promise.race([fetchCloud, timeout]);

      // Verify if database was empty setup to write seed
      let totalDocCount = 0;
      keys.forEach((k) => {
        if (dbData[k] && dbData[k].length > 0) {
          totalDocCount += dbData[k].length;
        }
      });

      if (totalDocCount === 0) {
        console.log("Firestore database is blank. Initiating market seed process...");
        await Promise.all(
          keys.map(async (key) => {
            const list = INITIAL_SEED_DATA[key];
            await Promise.all(
              list.map(async (item: any) => {
                const itemId = item.id || item.key;
                const docRef = doc(db, key, String(itemId));
                await setDoc(docRef, item);
              })
            );
          })
        );
        
        // Re-read back
        await Promise.all(
          keys.map(async (key) => {
            const colRef = collection(db, key);
            const snapshot = await getDocs(colRef);
            const list: any[] = [];
            snapshot.forEach((docSnap) => {
              const docId = docSnap.id;
              list.push({ id: docId, key: docId, ...docSnap.data() });
            });
            dbData[key] = list as any;
          })
        );
      }

      if (!dbData.users || dbData.users.length === 0) {
        console.log("Firestore users list is empty. Provisioning default station operator accounts...");
        const defaultUsers = INITIAL_SEED_DATA.users;
        await Promise.all(
          defaultUsers.map(async (u) => {
            const docRef = doc(db, "users", String(u.id));
            await setDoc(docRef, u);
          })
        );
        dbData.users = defaultUsers;
      }

      fetched = dbData;
      saveLocalCache(fetched);
    } catch (e) {
      console.warn("Google Firestore fetch failed. Reverting to persistent offline cache.", e);
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
      
      if (!merged[tableKey]) {
        merged[tableKey] = [];
      }

      const tableList = merged[tableKey] as any[];

      switch (item.action) {
        case "insert":
          if (!tableList.some((x) => (x.id === item.id || x.key === item.id))) {
            tableList.push(item.payload);
          }
          break;

        case "update":
        case "upsert": {
          const idx = tableList.findIndex((x) => (x.id === item.id || x.key === item.id));
          if (idx !== -1) {
            tableList[idx] = { ...tableList[idx], ...item.payload };
          } else {
            tableList.push(item.payload);
          }
          break;
        }

        case "delete":
          merged[tableKey] = tableList.filter((x) => (x.id !== item.id && x.key !== item.id)) as any;
          break;
      }
    });

    return merged;
  }

  return fetched;
}

export async function executeWrite<K extends keyof NFCData>(
  table: K,
  action: "insert" | "update" | "upsert" | "delete",
  payload: any
): Promise<{ success: boolean; data: any; queued: boolean }> {
  if ((action === "insert" || action === "upsert") && !payload.id) {
    payload.id = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  }

  const itemId = payload.id || payload.key || ""; 

  if (firebaseInitialized && isOnline()) {
    try {
      const docRef = doc(db, table, String(itemId));
      if (action === "insert" || action === "upsert") {
        await setDoc(docRef, payload);
      } else if (action === "update") {
        await updateDoc(docRef, payload);
      } else if (action === "delete") {
        await deleteDoc(docRef);
      }

      await syncLocalCacheItem(table, action, payload);
      return { success: true, data: payload, queued: false };
    } catch (e) {
      console.warn(`Firestore write fail on '${table}'. Storing inside queue.`, e);
    }
  }

  // Queue transactions locally when offline
  const queue = getQueue();
  const queueItem: QueueItem = {
    id: itemId,
    table,
    action,
    payload,
    timestamp: Date.now(),
  };

  queue.push(queueItem);
  saveQueue(queue);

  await syncLocalCacheItem(table, action, payload);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("queue_updated"));
  }

  return { success: true, data: payload, queued: true };
}

export async function processQueue(): Promise<{ success: boolean; processed: number; remaining: number }> {
  if (!firebaseInitialized || !isOnline()) {
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
      const itemId = idTempMap[item.id] || item.id;
      const docRef = doc(db, item.table, String(itemId));

      if (item.action === "insert" || item.action === "upsert") {
        await setDoc(docRef, resolvedPayload);
      } else if (item.action === "update") {
        await updateDoc(docRef, resolvedPayload);
      } else if (item.action === "delete") {
        await deleteDoc(docRef);
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

  await forceSyncFromServer();

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
  const itemId = payload.id || payload.key || "";

  switch (action) {
    case "insert":
      if (!tableList.some((x) => (x.id === itemId || x.key === itemId))) {
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
      cache[table] = tableList.filter((x) => (x.id !== itemId && x.key !== itemId)) as any;
      break;
  }

  saveLocalCache(cache);
}

export async function forceSyncFromServer(): Promise<boolean> {
  if (!firebaseInitialized || !isOnline()) return false;
  try {
    const keys: (keyof NFCData)[] = ["users", "buyers", "sources", "transactions", "daily_collections", "source_payments", "settings"];
    const dbData = {} as NFCData;

    await Promise.all(
      keys.map(async (key) => {
        const colRef = collection(db, key);
        const snapshot = await getDocs(colRef);
        const list: any[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() });
        });
        dbData[key] = list as any;
      })
    );

    saveLocalCache(dbData);
    return true;
  } catch (err) {
    console.error("Force sync failed: ", err);
    return false;
  }
}

export function clearAllLocalState() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(QUEUE_KEY);
  }
}

export async function wipeAllData(): Promise<void> {
  if (!firebaseInitialized || !isOnline()) {
    throw new Error("System must be online to perform a full cloud wipe.");
  }
  
  const keys: (keyof NFCData)[] = ["users", "buyers", "sources", "transactions", "daily_collections", "source_payments", "settings"];
  for (const key of keys) {
    const colRef = collection(db, key);
    const snapshot = await getDocs(colRef);
    for (const docSnap of snapshot.docs) {
      await deleteDoc(doc(db, key, docSnap.id));
    }
  }
  
  clearAllLocalState();

  // Restore the core admin user so you don't get locked out
  await setDoc(doc(db, "users", "u-1"), { id: "u-1", name: "Admin Setup", pin: "2255", role: "admin" });
  await setDoc(doc(db, "users", "u-2"), { id: "u-2", name: "Auctioneer Setup", pin: "1122", role: "auctioneer" });
  await setDoc(doc(db, "users", "u-3"), { id: "u-3", name: "Collector Setup", pin: "3344", role: "collector" });
  await setDoc(doc(db, "settings", "halkhata_pin"), { key: "halkhata_pin", value: "9988" });
  
  window.location.reload();
}

// Window online hook
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    forceSyncFromServer()
      .then(() => {
        console.log("Synchronized fresh Firestore snapshot.");
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

// ==========================================
// 6. User Verification & Subscriptions
// ==========================================

export async function authenticateUserWithPIN(
  userId: string | number,
  pin: string
): Promise<{ success: boolean; user?: User }> {
  if (firebaseInitialized && isOnline()) {
    try {
      const cache = getLocalCache();
      const matchedUser = cache.users.find((u) => String(u.id) === String(userId) && u.pin === pin);
      if (matchedUser) {
        return { success: true, user: matchedUser };
      }
    } catch (e) {
      console.warn("Firestore user PIN mismatch, reverting to local offline state", e);
    }
  }

  const cache = getLocalCache();
  const matchedUser = cache.users.find((u) => String(u.id) === String(userId) && u.pin === pin);
  if (matchedUser) {
    return { success: true, user: matchedUser };
  }
  return { success: false };
}

import { onSnapshot } from "firebase/firestore";

export function setupRealtimeSubscriptions(onUpdate?: () => void): () => void {
  if (!firebaseInitialized) {
    console.log("Skipping realtime Firestore listener (Demo/local Mode)");
    return () => {};
  }

  const tables: (keyof NFCData)[] = ["users", "buyers", "sources", "transactions", "daily_collections", "source_payments", "settings"];
  const unsubs: (() => void)[] = [];

  console.log("Setting up Cloud Firestore Realtime listeners:", tables);

  tables.forEach((key) => {
    try {
      const unsub = onSnapshot(collection(db, key), (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          let action: "insert" | "update" | "delete" | "upsert" = "upsert";
          if (change.type === "added") action = "insert";
          else if (change.type === "modified") action = "update";
          else if (change.type === "removed") action = "delete";

          const dataWithId = { id: change.doc.id, ...change.doc.data() };
          await syncLocalCacheItem(key, action, dataWithId);
        });

        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("queue_updated"));
        }
        if (onUpdate) {
          onUpdate();
        }
      }, (err) => {
        console.warn(`Firestore Real-time subscription error for table ${key}:`, err);
      });
      unsubs.push(unsub);
    } catch (err) {
      console.error(`Failed to subscribe to Firestore collection ${key}:`, err);
    }
  });

  return () => {
    console.log("Cleaning up active Firebase Real-time listeners.");
    unsubs.forEach((unsub) => unsub());
  };
}
