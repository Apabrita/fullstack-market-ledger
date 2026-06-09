/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { useData } from "./DataContext";
import { Wifi, WifiOff, RefreshCw, AlertTriangle, Database, Trash2, CheckCircle } from "lucide-react";

export const NetworkSimulator: React.FC = () => {
  const {
    queue,
    online,
    simulatedOffline,
    syncConfigured,
    toggleNetworkSimulation,
    triggerSync,
    resetToDefault,
  } = useData();

  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    success: boolean;
    processed: number;
    remaining: number;
  } | null>(null);

  const handleSyncClick = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await triggerSync();
      setSyncResult(res);
      setTimeout(() => {
        setSyncResult(null);
      }, 5000);
    } catch (e) {
      console.error(e);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-5 text-slate-100" id="network-simulator-panel">
      {/* 1. Header with Network Status */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2">
          {online ? (
            <div className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </div>
          ) : (
            <div className="h-3 w-3 rounded-full bg-rose-500 animate-pulse"></div>
          )}
          <h3 className="font-sans font-semibold text-sm tracking-wide uppercase text-slate-300">
            Sync Engine Status
          </h3>
        </div>
        <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
          NFC-v1.0
        </span>
      </div>

      {/* 2. Connection Overview */}
      <div className="space-y-2 text-xs">
        <div className="flex justify-between items-center bg-slate-950/50 p-2.5 rounded-lg border border-slate-850">
          <span className="text-slate-400">Connection Engine:</span>
          {online ? (
            <span className="text-emerald-400 font-bold flex items-center gap-1 uppercase tracking-wider text-[10px]">
              ● Connected
            </span>
          ) : (
            <span className="text-amber-500 font-bold flex items-center gap-1 uppercase tracking-wider text-[10px]">
              ▲ Offline Mode
            </span>
          )}
        </div>

        <div className="flex justify-between items-center bg-slate-950/50 p-2.5 rounded-lg border border-slate-850">
          <span className="text-slate-400">Sync Behavior:</span>
          <span className="text-teal-450 text-teal-400 font-bold text-[10px] uppercase">Fully Automated</span>
        </div>

        <div className="flex justify-between items-center bg-slate-950/50 p-2.5 rounded-lg border border-slate-850">
          <span className="text-slate-400">Server Remote:</span>
          {syncConfigured ? (
            <span className="text-teal-400 flex items-center gap-1 font-mono">
              <Database className="w-3.5 h-3.5" /> Supabase
            </span>
          ) : (
            <span className="text-yellow-500 flex items-center gap-1 font-mono hover:underline cursor-help" title="No env variables. Running client-side sandboxed.">
              <AlertTriangle className="w-3.5 h-3.5" /> Local-Demo
            </span>
          )}
        </div>
      </div>

      <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-850 text-[11px] leading-relaxed text-slate-450 text-slate-400">
        ✨ <strong>How it works</strong>: When you book transactions, collect money, or adjust records, the app saves everything locally and automatically checks if internet is active. Once connected, it automatically syncs the queue to the cloud server datasets. If you have no connection, it holds your records seamlessly!
      </div>

      {/* Sync result notification */}
      {syncResult && (
        <div className={`p-3 rounded-lg text-xs flex gap-2 border ${
          syncResult.success 
            ? "bg-emerald-950/30 text-emerald-400 border-emerald-900/30" 
            : "bg-rose-950/30 text-rose-400 border-rose-900/30"
        }`}>
          {syncResult.success ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          <div>
            <div className="font-semibold">{syncResult.success ? "Sync Finished!" : "Sync Encountered Issues"}</div>
            <div>Processed: {syncResult.processed} item(s). Remaining: {syncResult.remaining} left in queue.</div>
          </div>
        </div>
      )}

      {/* 4. Queue visual list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-sans font-bold text-xs text-slate-400 tracking-wider uppercase">
            Pending Queue ({queue.length})
          </span>
          {queue.length > 0 && !online && (
            <span className="text-[10px] text-amber-500 italic bg-amber-955/20 px-1.5 py-0.5 rounded border border-amber-900/30">
              Buffered offline
            </span>
          )}
        </div>

        {queue.length === 0 ? (
          <div className="text-center py-6 px-4 bg-slate-950/30 rounded-lg text-slate-500 text-xs border border-dashed border-slate-850">
            <CheckCircle className="w-6 h-6 mx-auto mb-2 text-slate-700" />
            No pending writes in query queue. All entries are in sync.
          </div>
        ) : (
          <div className="max-h-48 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800 pr-1">
            {queue.map((item, index) => (
              <div
                key={`${item.id}-${index}`}
                className="bg-slate-950 p-2.5 rounded-lg border border-slate-850 text-[11px] space-y-1"
              >
                <div className="flex justify-between items-center text-slate-400">
                  <span className="font-mono text-slate-500 uppercase">
                    #{index + 1} • {item.table}
                  </span>
                  <span className={`px-1 rounded uppercase font-mono text-[9px] ${
                    item.action === "insert" ? "bg-emerald-950 text-emerald-400" :
                    item.action === "update" ? "bg-blue-900/50 text-blue-300" :
                    item.action === "delete" ? "bg-rose-950 text-rose-400" : "bg-purple-900/50 text-purple-300"
                  }`}>
                    {item.action}
                  </span>
                </div>
                <div className="font-semibold text-slate-200">
                  {item.table === "transactions" ? (
                    <span>Fish Sale: {item.payload.fish_type} ({item.payload.weight}kg)</span>
                  ) : item.table === "buyers" ? (
                    <span>Buyer: {item.payload.nickname}</span>
                  ) : item.table === "sources" ? (
                    <span>Source: {item.payload.name}</span>
                  ) : item.table === "daily_collections" ? (
                    <span>Collection: ₹{item.payload.amount_paid}</span>
                  ) : (
                    <span>Payload: {JSON.stringify(item.payload).substring(0, 45)}...</span>
                  )}
                </div>
                <div className="text-[10px] text-slate-500 font-mono flex justify-between">
                  <span>ID: {String(item.id).substring(0, 12)}</span>
                  <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. Hard Reset Button */}
      <div className="pt-2 border-t border-slate-850 flex items-center justify-between text-[11px]">
        <span className="text-slate-500">Need a fresh start?</span>
        <button
          onClick={() => {
            if (confirm("Are you sure you want to purge all offline state? This clears local databases and sync queues directly!")) {
              resetToDefault();
            }
          }}
          className="text-slate-500 hover:text-rose-400 flex items-center gap-1 transition duration-150 cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Purge Offline Cache
        </button>
      </div>

      {!syncConfigured && (
        <div className="p-3 bg-teal-950/20 text-slate-400 border border-teal-900/30 rounded-lg text-[11px] leading-relaxed">
          💡 <strong>Demo Mode Enabled</strong>: All reads & writes accumulate instantly in client's local storage and support optimistic layouts! To wire real Supabase persistence: configure your <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> credentials in your project secrets.
        </div>
      )}
    </div>
  );
};
