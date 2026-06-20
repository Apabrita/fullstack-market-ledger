import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getFirestore, 
  enableIndexedDbPersistence, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDocs, 
  onSnapshot,
  query,
  orderBy,
  limit,
  writeBatch
} from "firebase/firestore";
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
export interface User { id: string | number; name: string; pin: string; role: "admin" | "auctioneer" | "collector"; }
export interface Buyer { id: string | number; nickname: string; lifetime_debt: number; credit_limit: number; }
export interface Source { id: string | number; name: string; date: string; is_completed: boolean; is_archived: boolean; rate_per_kg?: number; }
export interface Transaction { id: string | number; source_id: string | number; buyer_id: string | number; weight: number; price_per_kg: number; total_price: number; date: string; fish_type: string; added_by: string; timestamp?: string | number; device_id?: string; }
export interface DailyCollection { id: string | number; buyer_id: string | number; date: string; total_owed_today: number; amount_paid: number; is_rolled_over: boolean; is_approved: boolean; created_at?: string; }
export interface SourcePayment { id: string | number; source_id: string | number; date: string; total_kg: number; sale_total: number; amount_paid_to_source: number; commission: number; is_settled: boolean; items_json?: string; rate_per_kg?: number; }
export interface Setting { key: string; value: string; }
export interface NFCData { users: User[]; buyers: Buyer[]; sources: Source[]; transactions: Transaction[]; daily_collections: DailyCollection[]; source_payments: SourcePayment[]; settings: Setting[]; }
export interface QueueItem { id: string | number; table: keyof NFCData; action: "insert" | "update" | "delete" | "upsert"; payload: any; timestamp: number; }

const crateCodeMap: Record<string, string> = {
  "R": "Rui", "K": "Katla", "T": "Telapia", 
  "I": "Ilish", "Aar": "Aar", "CNGR": "Chingri",
  "BT": "Bata", "TNGR": "Tangra", "PRS": "Parse",
  "PBD": "Pabda", "DHL": "Dhela", "PMF": "Pomfret", "BHK": "Bhetki",
  "E": "All Eggs", "EM": "Mixed Eggs"
};

export function expandFishType(code: string): string {
  if (!code) return "Unspecified";
  
  // Try to extract alpha characters only and see if we have them in map
  // since users might type "1234RE"
  const alphas = code.match(/[a-zA-Z]+/g);
  if (!alphas) return code;
  
  let translated = code;
  for (const part of alphas) {
    const p = part.toUpperCase();
    if (crateCodeMap[p]) {
      translated = translated.replace(part, `[${crateCodeMap[p]}]`);
    } else {
      // Handle combined like RE (Rui + Eggs)
      let compound = "";
      let remaining = p;
      for (const key of Object.keys(crateCodeMap).sort((a,b) => b.length - a.length)) {
        if (remaining.includes(key)) {
          compound += `${crateCodeMap[key]} `;
          remaining = remaining.replace(key, "");
        }
      }
      if (compound) {
        translated = translated.replace(part, `[${compound.trim()}]`);
      }
    }
  }
  return translated;
}

// ==========================================
// 3. Firebase Architecture Sync Setup
// ==========================================
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = (firebaseConfig as any).firestoreDatabaseId 
  ? getFirestore(app, (firebaseConfig as any).firestoreDatabaseId) 
  : getFirestore(app);

if (typeof window !== "undefined") {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code == 'failed-precondition') {
      console.warn("Multiple tabs open, persistence can only be enabled in one tab at a time.");
    } else if (err.code == 'unimplemented') {
      console.warn("The current browser does not support all of the features required to enable persistence");
    }
  });
}

export function isSyncConfigured(): boolean {
  return true; // Firebase config is hardcoded and always configured
}

export function getCredentials(): { url: string; anonKey: string } {
  return { url: "Firebase Cloud Sync", anonKey: "Hidden" };
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
  buyers: [], sources: [], transactions: [], daily_collections: [], source_payments: [],
  settings: [{ key: "halkhata_pin", value: "9988" }],
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
  try { return JSON.parse(stored); } catch (e) { return INITIAL_SEED_DATA; }
}

export function saveLocalCache(data: NFCData) {
  if (typeof window !== "undefined") {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  }
}

export function getQueue(): QueueItem[] { return []; } 
export function saveQueue(queue: QueueItem[]) {}

async function migrateLegacyOfflineQueue() {
  if (typeof window === "undefined") return;
  const stored = localStorage.getItem(QUEUE_KEY);
  if (!stored) return;
  
  try {
    const queue = JSON.parse(stored) as QueueItem[];
    if (queue && queue.length > 0) {
      console.log(`Migrating ${queue.length} legacy offline queue items to Firebase...`);
      for (const item of queue) {
        const itemId = String(item.id || item.payload?.id || item.payload?.key || "");
        if (!itemId) continue;
        
        try {
          if (item.action === "insert" || item.action === "upsert" || item.action === "update") {
             const cleanPayload = sanitizePayload(item.table, item.payload);
             await setDoc(doc(db, item.table, itemId), cleanPayload, { merge: true });
          } else if (item.action === "delete") {
             await deleteDoc(doc(db, item.table, itemId));
          }
        } catch(e) {
          console.warn(`Legacy queue migration error for item ${item.id}`, e);
        }
      }
      // Clear legacy queue once migrated
      localStorage.removeItem(QUEUE_KEY);
      console.log("Legacy queue migrated successfully and cleared.");
    }
  } catch (e) {
    console.warn("Failed to parse legacy offline queue", e);
  }
}

export async function authenticateUserWithPIN(userId: string | number, pin: string): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    // Read directly from cached data to prevent a 5-second blocking network call during login
    const data = getLocalOptimisticData();
    const user = data.users.find(u => String(u.id) === String(userId) && String(u.pin) === String(pin));
    if (user) return { success: true, user };
    return { success: false, error: "Invalid PIN. Access denied." };
  } catch (e) {
    return { success: false, error: "Authentication check failed." };
  }
}

// ==========================================
// 5. Offline Queue Engine Logic (Now natively Firebase)
// ==========================================

export async function migrateLegacyCacheToFirebase() {
  if (typeof window === "undefined") return;
  const stored = localStorage.getItem(CACHE_KEY);
  const migrated = localStorage.getItem("nfc_cache_migrated_to_firebase_v2");
  if (!stored || migrated === "true") return;

  try {
    const cache = JSON.parse(stored) as NFCData;
    console.log("Migrating full legacy cache (APK offline data) to Firebase...");
    let anyMigrated = false;
    for (const tableString of Object.keys(VALID_TABLE_COLUMNS)) {
       const table = tableString as keyof NFCData;
       if (table === 'users' || table === 'settings') continue; // Skip settings/users for now
       const items = cache[table] || [];
       for (const item of items) {
          const itemId = String(item.id || (item as any).key || "");
          if (!itemId) continue;
          try {
             const cleanPayload = sanitizePayload(table, item);
             await setDoc(doc(db, table, itemId), cleanPayload, { merge: true });
             anyMigrated = true;
          } catch(e) { console.warn(e); }
       }
    }
    localStorage.setItem("nfc_cache_migrated_to_firebase_v2", "true");
    console.log("Legacy cache migration completed.");
  } catch (e) {
    console.warn("Failed to migrate legacy cache", e);
  }
}

// Auto-run migration early on client boot
if (typeof window !== "undefined") {
  setTimeout(() => {
    migrateLegacyOfflineQueue().catch(console.warn);
    migrateLegacyCacheToFirebase().catch(console.warn);
  }, 1000);
}

export async function loadAll(): Promise<NFCData> {
  // Push any data from the old local-first implementation to Firebase
  migrateLegacyOfflineQueue().catch(console.warn);
  migrateLegacyCacheToFirebase().catch(console.warn);

  let fetched: NFCData = getLocalCache();

  try {
    const keys: (keyof NFCData)[] = ["users", "buyers", "sources", "transactions", "daily_collections", "source_payments", "settings"];
    const dbData = {} as NFCData;

    const fetchPromises = keys.map(async (key) => {
      let q = collection(db, key) as any;

      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(d => {
        let rec = d.data() as any;
        if (key === 'settings' && !rec.key) rec.key = d.id;
        else if (!rec.id) rec.id = d.id;
        return rec;
      });
      dbData[key] = data as any;
    });

    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Cloud fetch timeout")), 15000));
    await Promise.race([Promise.all(fetchPromises), timeout]);

    fetched = dbData;
    saveLocalCache(fetched);
  } catch (e) {
    console.warn("Firebase fetch timeout or network error... utilizing local unified cache.", e);
    fetched = getLocalCache();
  }

  if (!fetched.users || fetched.users.length === 0) {
    fetched.users = INITIAL_SEED_DATA.users;
    saveLocalCache(fetched);
  }

  return fetched;
}

export function getLocalOptimisticData(): NFCData {
  return getLocalCache();
}

const VALID_TABLE_COLUMNS: Record<keyof NFCData, string[]> = {
  users: ["id", "name", "pin", "role"],
  buyers: ["id", "nickname", "lifetime_debt", "credit_limit"],
  sources: ["id", "name", "date", "is_completed", "is_archived", "rate_per_kg"],
  transactions: ["id", "source_id", "buyer_id", "weight", "price_per_kg", "total_price", "date", "fish_type", "added_by", "timestamp", "device_id"],
  daily_collections: ["id", "buyer_id", "date", "total_owed_today", "amount_paid", "is_rolled_over", "is_approved", "created_at"],
  source_payments: ["id", "source_id", "date", "total_kg", "sale_total", "amount_paid_to_source", "commission", "is_settled", "items_json", "rate_per_kg"],
  settings: ["key", "value"],
};

function sanitizePayload(table: keyof NFCData, payload: any): any {
  if (!payload || typeof payload !== "object") return payload;
  const validKeys = VALID_TABLE_COLUMNS[table];
  if (!validKeys) return payload;
  const sanitized: any = {};
  for (const key of validKeys) {
    if (payload[key] !== undefined) sanitized[key] = payload[key];
  }
  return sanitized;
}

export async function executeWrite<K extends keyof NFCData>(
  table: K,
  action: "insert" | "update" | "upsert" | "delete",
  payload: any
): Promise<{ success: boolean; data: any; queued: boolean; error?: string }> {
  if ((action === "insert" || action === "upsert") && !payload.id && table !== 'settings') {
    payload.id = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  }

  const itemId = String(payload.id || payload.key || ""); 
  await syncLocalCacheItem(table, action, payload);

  try {
    if (action === "insert" || action === "upsert" || action === "update") {
       const cleanPayload = sanitizePayload(table, payload);
       // Firebase setDoc queues offline natively
       setDoc(doc(db, table, itemId), cleanPayload, { merge: true }).catch((e) => console.warn(`Silent online sync catch:`, e));
    } else if (action === "delete") {
       deleteDoc(doc(db, table, itemId)).catch((e) => console.warn(`Silent online sync delete catch:`, e));
    }
  } catch (e) {
    console.warn(`Firebase logic sync layer exception.`, e);
  }

  return { success: true, data: payload, queued: !isOnline() };
}

export async function processQueue(): Promise<{ success: boolean; processed: number; remaining: number }> {
    return { success: true, processed: 0, remaining: 0 };
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
      if (!tableList.some((x) => String(x.id || (x as any).key) === String(itemId))) tableList.push(payload);
      break;
    case "update":
    case "upsert": {
      const idx = tableList.findIndex((x) => String(x.id || (x as any).key) === String(itemId));
      if (idx !== -1) tableList[idx] = { ...tableList[idx], ...payload };
      else tableList.push(payload);
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
  const keys: (keyof NFCData)[] = ["sources", "transactions", "daily_collections", "source_payments"];
  for (const key of keys) {
     const snap = await getDocs(collection(db, key));
     const batch = writeBatch(db);
     snap.docs.forEach((d: any) => batch.delete(d.ref));
     if(snap.docs.length > 0) await batch.commit();
  }
  
  const cache = getLocalCache();
  cache.sources = [];
  cache.transactions = [];
  cache.daily_collections = [];
  cache.source_payments = [];
  saveLocalCache(cache);
  
  window.location.reload();
}

export function setupRealtimeSubscriptions(onUpdate?: () => void): () => void {
  const tables = ["users", "buyers", "sources", "transactions", "daily_collections", "source_payments", "settings"];
  const unsubscribes: any[] = [];

  tables.forEach((table) => {
    let q = collection(db, table) as any;

    const unsubscribe = onSnapshot(
      q,
      (snapshot: any) => {
        snapshot.docChanges().forEach((change: any) => {
          let action: "upsert" | "delete" | "insert" | "update" = "upsert";
          if (change.type === "removed") action = "delete";
          const record = change.doc.data();
          if (table === 'settings' && !record.key) record.key = change.doc.id;
          else if (!record.id) record.id = change.doc.id;
          
          syncLocalCacheItem(table as keyof NFCData, action, record).then(() => {
            if (typeof window !== "undefined") {
              window.dispatchEvent(new Event("queue_updated"));
            }
          });
        });
        if (onUpdate) onUpdate();
      },
      (error: any) => {
         console.warn(`Firebase realtime subscription error on ${table}:`, error);
      }
    );
    unsubscribes.push(unsubscribe);
  });

  return () => {
    unsubscribes.forEach((u) => u());
  };
}


export async function factoryResetData(): Promise<void> {
  const keys: (keyof NFCData)[] = ['sources', 'transactions', 'daily_collections', 'source_payments', 'buyers', 'users', 'settings'];
  for (const key of keys) {
     const snap = await getDocs(collection(db, key));
     for (const docSnap of snap.docs) {
         await deleteDoc(docSnap.ref);
     }
  }
  clearAllLocalState();
}