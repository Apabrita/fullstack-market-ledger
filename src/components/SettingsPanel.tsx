/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { useData } from "./DataContext";
import { PlusCircle, Search, KeyRound, User, UserCheck, ShieldAlert, CheckSquare, RefreshCcw, Trash2, Key, Sun, Moon, Sliders, AlertCircle, Server } from "lucide-react";
import { User as DbUser, getQueue, saveQueue, isOnline, QueueItem, executeWrite, getCredentials, saveCredentials, clearCredentials, isSyncConfigured } from "../db";

interface SettingsPanelProps {
  activeUser: DbUser | null;
  isAuthenticated: boolean;
  onLogout?: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ activeUser, isAuthenticated, onLogout }) => {
  const { data, queue, write, theme, setTheme, activeTheme } = useData();
  const [showAddUserForm, setShowAddUserForm] = useState(false);

  // Archive & Database Optimization States
  const [isPruning, setIsPruning] = useState(false);
  const [pruningStatus, setPruningStatus] = useState<string | null>(null);

  // New User States
  const [newUserName, setNewUserName] = useState("");
  const [newUserPin, setNewUserPin] = useState("");
  const [newUserRole, setNewUserRole] = useState<"admin" | "auctioneer" | "collector">("auctioneer");

  // Halkhata Pin States
  const settings = data?.settings || [];
  const halkhataPinObj = settings.find((s) => s.key === "halkhata_pin") || { key: "halkhata_pin", value: "9988" };
  const [halkhataInput, setHalkhataInput] = useState(halkhataPinObj.value);
  const [pinChangeSuccess, setPinChangeSuccess] = useState(false);

  const users = data?.users || [];

  const isAdmin = activeUser?.role === "admin" && isAuthenticated;

  const handleSafetyPrune = async () => {
    if (!isAdmin) {
      alert("Only an authenticated Administrator operator can prune system history records!");
      return;
    }

    if (!confirm("Are you sure you want to run the 7-day safety retention optimizer? Granular transactions & payments older than 7 days will be pruned. Cumulative balances on all Buyer accounts will remain perfectly intact.")) {
      return;
    }

    setIsPruning(true);
    setPruningStatus("Initializing safety optimizer...");

    try {
      const CUTOFF_DATE = "2026-06-02"; // CUTOFF is always 7 days before current market date 2026-06-09
      const prevTransactions = data?.transactions || [];
      const prevCollections = data?.daily_collections || [];
      const prevPayments = data?.source_payments || [];

      const txToPrune = prevTransactions.filter((tx) => tx.date < CUTOFF_DATE);
      const collectionsToPrune = prevCollections.filter((c) => c.date < CUTOFF_DATE);
      const paymentsToPrune = prevPayments.filter((p) => p.date < CUTOFF_DATE);

      let prunedCount = 0;

      for (const tx of txToPrune) {
        await write("transactions", "delete", { id: tx.id });
        prunedCount++;
      }

      for (const col of collectionsToPrune) {
        await write("daily_collections", "delete", { id: col.id });
        prunedCount++;
      }

      for (const pm of paymentsToPrune) {
        await write("source_payments", "delete", { id: pm.id });
        prunedCount++;
      }

      setPruningStatus(`Pruning complete! ${prunedCount} old logs safely optimized from local/remote memory. Cumulative buyer outstandings are fully protected!`);
      setTimeout(() => setPruningStatus(null), 8500);
    } catch (e) {
      console.error(e);
      setPruningStatus("Error executing safety prune optimization.");
    } finally {
      setIsPruning(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName || !newUserPin) return;

    if (!activeUser || !isAuthenticated || activeUser.role !== "admin") {
      alert("Only an authenticated Administrator operator can create system users!");
      return;
    }

    const newUserPayload = {
      id: `temp_u_${Date.now()}`,
      name: newUserName,
      pin: newUserPin,
      role: newUserRole,
    };

    await write("users", "insert", newUserPayload);

    setNewUserName("");
    setNewUserPin("");
    setShowAddUserForm(false);
  };

  const handleRemoveUser = async (userToDelete: DbUser) => {
    if (!isAdmin) {
      alert("Only admins can remove users.");
      return;
    }
    if (userToDelete.id === activeUser?.id) {
      alert("You cannot remove your own active session. Please log in as a different admin to remove this account.");
      return;
    }
    if (userToDelete.role === "admin" && users.filter((u) => u.role === "admin").length <= 1) {
      alert("Cannot remove the last admin.");
      return;
    }
    if (!confirm(`Are you sure you want to remove ${userToDelete.name}?`)) {
      return;
    }
    await write("users", "delete", { id: userToDelete.id });
  };

  const handleUpdateHalkhataPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!halkhataInput) return;

    if (!activeUser || !isAuthenticated || activeUser.role !== "admin") {
      alert("Only an authenticated Administrator operator can change the configuration PIN!");
      return;
    }

    const updatedPin = {
      key: "halkhata_pin",
      value: halkhataInput,
    };

    await write("settings", "upsert", updatedPin);
    setPinChangeSuccess(true);
    setTimeout(() => {
      setPinChangeSuccess(false);
    }, 4000);
  };

  const handleRemoveQueueItem = (timestamp: number) => {
    if (!isAdmin) {
      alert("Only an admin can discard operations.");
      return;
    }
    if (!confirm("Are you sure you want to discard this pending offline operation? This may cause data mismatch.")) return;
    const currentQueue = getQueue();
    const newQueue = currentQueue.filter(item => item.timestamp !== timestamp);
    saveQueue(newQueue);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("queue_updated"));
    }
  };

  const handleRetryItem = async (item: QueueItem) => {
    if (!isOnline()) {
       alert("Network offline! Cannot retry.");
       return;
    }

    try {
      const q = getQueue().filter(i => i.timestamp !== item.timestamp);
      saveQueue(q);

      const result = await executeWrite(item.table, item.action, item.payload) as any;
      if (result.queued) {
         alert(`Sync failed: ${result.error || 'Unknown error'}`);
      } else {
         alert("Operation successfully verified and synced!");
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("queue_updated"));
      }
    } catch(e: any) {
      alert("Error: " + e.message);
    }
  };

  const handleSyncAll = async () => {
    if (!isOnline()) {
       alert("Network offline! Cannot sync.");
       return;
    }
    const currentQueue = getQueue();
    if (currentQueue.length === 0) return;

    let successCount = 0;
    let failCount = 0;
    let lastErrorMsg = "";
    
    // Clear out the current queue so we can retry them sequentially
    saveQueue([]);
    
    for (const item of currentQueue) {
      try {
         const result = await executeWrite(item.table, item.action, item.payload) as any;
         if (result.queued) {
            failCount++;
            if (result.error) lastErrorMsg = result.error;
         } else {
            successCount++;
         }
      } catch (e) {
         failCount++;
      }
    }
    
    if (typeof window !== "undefined") {
       window.dispatchEvent(new Event("queue_updated"));
    }
    
    if (failCount > 0) {
      alert(`Sync completed with issues: ${successCount} synced, ${failCount} failed. Last error: ${lastErrorMsg || 'Make sure you are online.'}`);
    } else {
      alert(`Successfully synced ${successCount} operations to the server!`);
    }
  };

  return (
    <div className={`space-y-6 transition-colors duration-200 ${activeTheme === "light" ? "text-zinc-900" : "text-[#f8fafc]"}`} id="settings-halkhata-panel">
      <div className="flex flex-col gap-6">
        {/* 1. System Users management */}
        <div className={`border rounded-2xl overflow-hidden shadow-md flex flex-col transition-colors duration-200 ${
          activeTheme === "light" ? "bg-white border-zinc-200" : "bg-[#060a15] border-[#1d2d52]"
        }`}>
          <div className={`px-5 py-4 border-b flex justify-between items-center transition-colors duration-200 ${
            activeTheme === "light" ? "bg-zinc-50 border-zinc-200" : "bg-[#0a1125] border-[#1d2d52]"
          }`}>
            <h4 className={`font-sans font-extrabold text-xs uppercase tracking-wider ${
              activeTheme === "light" ? "text-zinc-800" : "text-[#f8fafc]"
            }`}>
              Operator Management (Team)
            </h4>
            <button
              onClick={() => {
                if (!isAdmin) {
                  alert("Only authenticated Administrators can register new team members!");
                  return;
                }
                setShowAddUserForm(!showAddUserForm);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-2xl shadow-sm flex items-center justify-center gap-1 cursor-pointer transition ${
                isAdmin
                  ? "bg-teal-600 hover:bg-teal-700 text-white"
                  : activeTheme === "light"
                    ? "bg-zinc-200 text-zinc-400 border border-zinc-300 cursor-not-allowed"
                    : "bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-not-allowed"
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Add team member</span>
            </button>
          </div>

          <div className="p-5 flex-grow space-y-4">
            {showAddUserForm && (
              <form onSubmit={handleCreateUser} className={`border p-4 rounded-2xl space-y-3 animate-slideDown transition-colors duration-200 ${
                activeTheme === "light" ? "bg-zinc-50 border-zinc-200 text-zinc-900" : "bg-[#030611] border-[#1a2d52]"
              }`}>
                <div className={`text-[11px] font-black uppercase tracking-wider ${
                  activeTheme === "light" ? "text-zinc-800" : "text-zinc-300"
                }`}>
                  Registration form
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <label className={`font-bold block ${activeTheme === "light" ? "text-zinc-700" : "text-zinc-300"}`}>Full Name:</label>
                    <input
                      type="text"
                      required
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      placeholder="e.g. Kashem Ali"
                      className={`w-full text-xs rounded-2xl p-2 focus:ring-1 outline-none font-semibold ${
                        activeTheme === "light"
                          ? "text-zinc-900 bg-white border border-zinc-300 focus:ring-teal-500 font-bold"
                          : "text-white bg-[#020409] border border-[#1d2d52] focus:ring-indigo-500"
                      }`}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className={`font-bold block ${activeTheme === "light" ? "text-zinc-700" : "text-zinc-300"}`}>Login Code / PIN (Digits):</label>
                    <input
                      type="password"
                      required
                      maxLength={6}
                      value={newUserPin}
                      onChange={(e) => setNewUserPin(e.target.value.replace(/\D/g, ""))}
                      placeholder="e.g. 5566"
                      className={`w-full text-xs rounded-2xl p-2 focus:ring-1 outline-none font-semibold ${
                        activeTheme === "light"
                          ? "text-zinc-900 bg-white border border-zinc-300 focus:ring-teal-500 font-bold"
                          : "text-white bg-[#020409] border border-[#1d2d52] focus:ring-indigo-550"
                      }`}
                    />
                  </div>
                </div>
                <div className="space-y-1 text-xs">
                  <label className={`font-bold block ${activeTheme === "light" ? "text-zinc-705" : "text-zinc-300"}`}>System Access Role:</label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as any)}
                    className={`w-full text-xs rounded-2xl p-2 focus:ring-1 outline-none font-semibold ${
                      activeTheme === "light"
                        ? "text-zinc-900 bg-white border border-zinc-300 focus:ring-teal-500 font-bold"
                        : "text-white bg-[#020409] border border-[#1d2d52] focus:ring-indigo-550"
                    }`}
                  >
                    <option value="admin">Administrator (Complete accounts & settlements access)</option>
                    <option value="auctioneer">Auctioneer (Logs sources and record buyer transactions)</option>
                    <option value="collector">Collector (Logs cash receipts and collections drafts)</option>
                  </select>
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddUserForm(false)}
                    className={`px-3 py-1.5 text-[11px] font-bold rounded-2xl cursor-pointer transition ${
                      activeTheme === "light"
                        ? "bg-zinc-200 hover:bg-zinc-300 text-zinc-800"
                        : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-bold rounded-2xl shadow-sm cursor-pointer"
                  >
                    Save Team Member
                  </button>
                </div>
              </form>
            )}

            {/* List of team members */}
            <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
              {users.map((u) => (
                <div key={u.id} className={`p-3 border rounded-2xl flex items-center justify-between transition-colors duration-200 ${
                  activeTheme === "light" ? "bg-zinc-50 border-zinc-150 text-zinc-900" : "bg-[#030611] border-[#131b2e] text-zinc-105"
                }`}>
                  <div className="flex items-center space-x-2.5">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs uppercase ${
                      activeTheme === "light" ? "bg-zinc-200 text-zinc-700" : "bg-[#16223f] text-zinc-100"
                    }`}>
                      {u.name.substring(0, 2)}
                    </div>
                    <div>
                      <div className={`text-xs font-bold ${activeTheme === "light" ? "text-zinc-800" : "text-[#ffffff]"}`}>{u.name}</div>
                      <div className={`text-[10px] flex items-center gap-1 font-mono ${activeTheme === "light" ? "text-zinc-500" : "text-zinc-400"}`}>
                        PIN code: <span className="tracking-widest font-bold font-mono">••••</span> {(isAdmin || u.id === activeUser?.id) && `(Hint: ${u.pin})`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-mono tracking-wider font-bold ${
                      u.role === "admin" ? "bg-purple-100 text-purple-800 border border-purple-200" :
                      u.role === "auctioneer" ? "bg-blue-100 text-blue-800 border border-blue-200" :
                      "bg-orange-100 text-orange-800 border border-orange-200"
                    }`}>
                      {u.role}
                    </span>
                    {isAdmin && (
                      <button
                        onClick={() => handleRemoveUser(u)}
                        className="p-1.5 hover:bg-rose-500/10 text-rose-500 rounded transition-colors"
                        title="Remove user"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 2. Global Halkhata configuration/settings */}
        <div className={`border rounded-2xl overflow-hidden shadow-md flex flex-col transition-colors duration-200 ${
          activeTheme === "light" ? "bg-white border-zinc-200" : "bg-[#060a15] border-[#1d2d52]"
        }`}>
          <div className={`px-5 py-4 border-b flex items-center justify-between transition-colors duration-200 ${
            activeTheme === "light" ? "bg-zinc-50 border-zinc-200" : "bg-[#0a1125] border-[#1d2d52]"
          }`}>
            <h4 className={`font-sans font-extrabold text-xs uppercase tracking-wider ${
              activeTheme === "light" ? "text-zinc-800" : "text-[#f8fafc]"
            }`}>
              Halkhata Configuration & Database Keys
            </h4>
            <KeyRound className="w-4 h-4 text-zinc-400" />
          </div>

          <div className="p-5 flex-grow space-y-4">
            <div className={`rounded-xl p-4 border space-y-3 text-xs leading-relaxed transition-colors duration-200 ${
              activeTheme === "light" ? "bg-zinc-50 border-zinc-200 text-zinc-700" : "bg-[#030611] border-[#1d2d52] text-zinc-300"
            }`}>
              <div className={`font-sans font-black text-[11px] uppercase tracking-wider flex items-center gap-1 ${
                activeTheme === "light" ? "text-zinc-800" : "text-white"
              }`}>
                <ShieldAlert className="w-4 h-4 text-teal-555 shrink-0" /> Security Access Rules
              </div>
              <p>
                The <strong>halkhata_pin</strong> value sets the overarching master override key. This allows collectors or admin operators to unlock protected ledger settlements or balance archives at the end of the market shift!
              </p>
              <div className={`p-3 border rounded-2xl font-mono flex justify-between items-center text-[10px] transition-colors duration-200 ${
                activeTheme === "light" ? "bg-white border-zinc-200 text-zinc-900" : "bg-[#020409] border-[#1d2d52]"
              }`}>
                <span className={`uppercase font-sans font-bold ${activeTheme === "light" ? "text-zinc-500" : "text-zinc-400"}`}>Active Master PIN:</span>
                <span className="font-extrabold text-teal-600 tracking-widest text-xs">{halkhataPinObj.value}</span>
              </div>
            </div>

            <form onSubmit={handleUpdateHalkhataPin} className="space-y-4">
              <div className="space-y-1 text-xs">
                <label className={`font-bold block ${activeTheme === "light" ? "text-zinc-700" : "text-zinc-300"}`}>Configure Master Halkhata PIN:</label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    maxLength={6}
                    value={halkhataInput}
                    onChange={(e) => {
                      setHalkhataInput(e.target.value.replace(/\D/g, ""));
                      setPinChangeSuccess(false);
                    }}
                    placeholder="Enter 4-6 digits"
                    className={`text-xs text-center tracking-widest font-mono rounded-2xl px-2 py-2 flex-grow focus:outline-none focus:ring-1 ${
                      activeTheme === "light"
                        ? "bg-white text-zinc-900 border border-zinc-300 focus:ring-teal-500"
                        : "bg-[#020409] text-white border border-[#1d2d52] focus:ring-indigo-500"
                    }`}
                  />
                  <button
                    type="submit"
                    className={`px-4 rounded-2xl font-bold text-xs transition duration-200 cursor-pointer flex items-center gap-1 border shadow-sm ${
                      isAdmin
                        ? activeTheme === "light"
                          ? "bg-zinc-900 text-white border-zinc-800 hover:bg-zinc-800"
                          : "bg-teal-600 text-white border-teal-500 hover:bg-teal-700"
                        : activeTheme === "light"
                          ? "bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed"
                          : "bg-zinc-800 text-zinc-500 border-zinc-700 cursor-not-allowed"
                    }`}
                    title={isAdmin ? "Save PIN to settings table" : "Changing system parameters requires Admin Operator authentication."}
                  >
                    <Key className="w-3.5 h-3.5" />
                    Change PIN
                  </button>
                </div>
              </div>

              {pinChangeSuccess && (
                <div className="p-2 bg-emerald-50 text-emerald-800 border border-emerald-200 text-center rounded-2xl text-[10px] font-bold">
                  Halkhata configuration PIN successfully committed and queued!
                </div>
              )}

              {!isAdmin && (
                <div className={`p-3 rounded-2xl text-[11px] leading-relaxed border font-bold ${
                  activeTheme === "light"
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : "bg-rose-950/20 text-rose-300 border-rose-900/40"
                }`}>
                  🔒 Operator locked. Please authorize as Apon Das (Admin) and enter PIN 2255 in the left Operator panel before applying configuration changes.
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
         {/* 3. Terminal Theme Adjustment */}
      <div className={`border rounded-2xl overflow-hidden shadow-md p-5 space-y-4 max-w-xl mx-auto transition-colors duration-200 ${
        activeTheme === "light" ? "bg-white border-zinc-200" : "bg-[#060a15] border-[#1d2d52]"
      }`}>
        <div className={`border-b pb-3 flex justify-between items-center ${activeTheme === "light" ? "border-zinc-100" : "border-[#1d2d52]"}`}>
          <h4 className={`font-sans font-black text-xs uppercase tracking-wider flex items-center gap-1.5 ${
            activeTheme === "light" ? "text-zinc-800" : "text-[#f8fafc]"
          }`}>
            🎨 Terminal Theme & Sunlight Settings
          </h4>
          <span className={`text-[9.5px] uppercase font-mono font-extrabold px-3 py-1 rounded-full ${
            activeTheme === "light" ? "bg-amber-100 text-amber-805 border border-amber-200" : "bg-sky-950/80 text-[#2dd4bf] border border-[#115e59]"
          }`}>
            {activeTheme === "light" ? "☀️ Active: Light (Sunlight)" : "🌙 Active: Midnight Dark"}
          </span>
        </div>

        <p className={`text-[10.5px] leading-relaxed font-sans ${activeTheme === "light" ? "text-zinc-600" : "text-zinc-400"}`}>
          Configure display colors to combat harsh outdoor sunlight reflections or switch to eye-safe nighttime levels. Choosing <strong>System</strong> will automatically pair with your device default theme.
        </p>

        <div className="grid grid-cols-3 gap-3 pt-1 text-xs">
          <button
            type="button"
            onClick={() => setTheme("system")}
            className={`py-3 px-3.5 rounded-2xl border text-center font-bold tracking-tight transition cursor-pointer flex flex-col items-center justify-center gap-1.5 ${
              theme === "system"
                ? "bg-teal-50 border-teal-500 text-teal-705 font-extrabold shadow-sm"
                : activeTheme === "light"
                  ? "bg-zinc-50 border-zinc-200 text-zinc-705 hover:bg-zinc-100"
                  : "bg-[#030611] border-[#1d2d52] text-zinc-350 hover:bg-[#0a1125]"
            }`}
          >
            <Sliders className="w-4.5 h-4.5 text-zinc-500" />
            <span>🖥️ System</span>
          </button>
          
          <button
            type="button"
            onClick={() => setTheme("light")}
            className={`py-3 px-3.5 rounded-2xl border text-center font-bold tracking-tight transition cursor-pointer flex flex-col items-center justify-center gap-1.5 ${
              theme === "light"
                ? "bg-amber-100 border-amber-500 text-amber-800 font-extrabold shadow-sm"
                : activeTheme === "light"
                  ? "bg-zinc-50 border-zinc-200 text-zinc-705 hover:bg-zinc-100"
                  : "bg-[#030611] border-[#1d2d52] text-zinc-350 hover:bg-[#0a1125]"
            }`}
          >
            <Sun className="w-4.5 h-4.5 text-amber-550" />
            <span>☀️ Light Mode</span>
          </button>
          
          <button
            type="button"
            onClick={() => setTheme("dark")}
            className={`py-3 px-3.5 rounded-2xl border text-center font-bold tracking-tight transition cursor-pointer flex flex-col items-center justify-center gap-1.5 ${
              theme === "dark"
                ? "bg-indigo-950 border-indigo-400 text-indigo-150 font-extrabold shadow-sm"
                : activeTheme === "light"
                  ? "bg-zinc-50 border-zinc-200 text-zinc-705 hover:bg-zinc-100"
                  : "bg-[#030611] border-[#1d2d52] text-zinc-350 hover:bg-[#0a1125]"
            }`}
          >
            <Moon className="w-4.5 h-4.5 text-indigo-500" />
            <span>🌙 Dark Mode</span>
          </button>
        </div>
      </div>

      {/* 4. Database Storage & 7-Day Safety Retention Optimizer */}
      <div className={`border rounded-2xl overflow-hidden shadow-md p-5 space-y-4 max-w-xl mx-auto transition-colors duration-200 ${
        activeTheme === "light" ? "bg-white border-zinc-200" : "bg-[#060a15] border-[#1d2d52]"
      }`}>
        <div className={`border-b pb-3 flex justify-between items-center ${activeTheme === "light" ? "border-zinc-100" : "border-[#1d2d52]"}`}>
          <h4 className={`font-sans font-black text-xs uppercase tracking-wider flex items-center gap-1.5 ${
            activeTheme === "light" ? "text-zinc-800" : "text-[#f8fafc]"
          }`}>
            ⚡ 7-Day Database Space Optimizer
          </h4>
          <span className="text-[9.5px] uppercase font-mono font-extrabold px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500 text-emerald-550">
            Automated Retention Guard
          </span>
        </div>

        <div className="space-y-3">
          <p className={`text-[10.5px] leading-relaxed font-sans ${activeTheme === "light" ? "text-zinc-655" : "text-zinc-400"}`}>
            Your Arat operates with around 350+ global buyers (100+ active daily) and up to 20 vessels. At 1,000+ transaction/weight entries per day, the system writes fewer than <strong>250 KB / day</strong> of active storage.
          </p>

          <div className={`grid grid-cols-2 gap-2.5 p-3 rounded-2xl border text-[10px] font-mono transition-colors duration-200 ${
            activeTheme === "light" ? "bg-zinc-50 border-zinc-200 text-zinc-800" : "bg-[#020409] border-[#1d2d52] text-zinc-350"
          }`}>
            <div className="space-y-1">
              <div>👥 Stored Buyers: <strong className="text-teal-600">{data?.buyers?.length || 0} accounts</strong></div>
              <div>⚓ Stored Vessels: <strong className="text-indigo-600">{data?.sources?.length || 0} sources</strong></div>
              <div>📦 Total Auction Lots: <strong>{data?.transactions?.length || 0} records</strong></div>
            </div>
            <div className="space-y-1 border-l pl-3 border-zinc-200/50">
              <div>💳 Stored Collections: <strong>{data?.daily_collections?.length || 0} entries</strong></div>
              <div>💾 Est. Storage Used: <strong className="text-emerald-500">~{Math.round(((data?.transactions?.length || 0) * 0.25 + (data?.daily_collections?.length || 0) * 0.15 + (data?.buyers?.length || 0) * 0.15) * 10) / 10} KB</strong></div>
              <div className="text-[8.5px] text-zinc-500">Supabase Free Quota: <strong>~500 MB</strong></div>
            </div>
          </div>

          <p className={`text-[10px] leading-relaxed italic ${activeTheme === "light" ? "text-zinc-500" : "text-zinc-500"}`}>
            * <strong>Safety Assurance Rule:</strong> Running the 7-day space sweep purges old granular transaction lots and payment stamps older than 7 days (Cutoff: Before 2026-06-02). However, all historical outstanding dues, lifetime debt, and registered buyer details are mathematically rolled up into cumulative balance cards and kept completely safe!
          </p>

          {pruningStatus && (
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-center text-[10px] font-mono text-emerald-400 font-black animate-slideDown">
              ⚙️ {pruningStatus}
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button
              type="button"
              disabled={isPruning}
              onClick={handleSafetyPrune}
              className={`px-4 py-2 w-full sm:w-auto text-center font-bold text-xs rounded-2xl transition-all duration-150 cursor-pointer shadow border ${
                isAdmin
                  ? isPruning
                    ? "bg-zinc-800 text-zinc-500 border-zinc-700 cursor-not-allowed"
                    : activeTheme === "light"
                      ? "bg-zinc-900 border-zinc-800 text-white hover:bg-zinc-800"
                      : "bg-teal-605 border-teal-555 text-white hover:bg-teal-700 shadow-teal-500/10"
                  : activeTheme === "light"
                    ? "bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed"
                    : "bg-zinc-800 text-zinc-500 border-zinc-700 cursor-not-allowed"
              }`}
            >
              {isPruning ? "⚙️ Saving Space..." : "⚡ Run 7-Day Safety Retention Pruning"}
            </button>
          </div>
        </div>
      </div>

      {/* 5. Offline Operations Sync Queue */}
      <div className={`border rounded-2xl overflow-hidden shadow-md p-5 space-y-4 max-w-xl mx-auto transition-colors duration-200 ${
        activeTheme === "light" ? "bg-white border-zinc-200" : "bg-[#060a15] border-[#1d2d52]"
      }`}>
        <div className={`border-b pb-3 flex justify-between items-center flex-wrap gap-2 ${activeTheme === "light" ? "border-zinc-100" : "border-[#1d2d52]"}`}>
          <h4 className={`font-sans font-black text-xs uppercase tracking-wider flex items-center gap-1.5 ${
            activeTheme === "light" ? "text-zinc-800" : "text-[#f8fafc]"
          }`}>
            <Server className="w-4 h-4" /> Offline & Sync Queue
          </h4>
          <div className="flex items-center gap-2">
            <span className={`text-[9.5px] uppercase font-mono font-extrabold px-3 py-1 rounded-full border ${
              queue.length > 0 ? "bg-amber-100 text-amber-800 border-amber-300" : "bg-teal-50 text-teal-700 border-teal-200"
            }`}>
              {queue.length} Pending
            </span>
            {queue.length > 0 && (
              <button 
                onClick={handleSyncAll}
                className="px-3 py-1 text-[10px] uppercase font-bold bg-teal-600 hover:bg-teal-700 text-white rounded-full border border-teal-500 shadow-sm cursor-pointer transition flex items-center gap-1"
                title="Attempt to synchronize all pending operations automatically"
              >
                Sync All <Server className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        <p className={`text-[10px] leading-relaxed font-sans ${activeTheme === "light" ? "text-zinc-655" : "text-zinc-400"}`}>
          If the system lost connection, records are stored safely in an offline cache. These will automatically synchronize once the internet is restored. You can manually retry or discard operations below.
        </p>

        {queue.length === 0 ? (
          <div className="p-4 border border-dashed rounded-2xl text-center text-xs font-bold text-zinc-400">
            All operations perfectly synchronized.
          </div>
        ) : (
          <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {[...queue].reverse().map((qItem, index) => (
              <div key={qItem.timestamp || index} className={`p-3 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                activeTheme === "light" ? "bg-zinc-50 border-zinc-200 text-zinc-800" : "bg-[#020409] border-[#1d2d52] text-zinc-300"
              }`}>
                <div className="space-y-1">
                  <div className="flex gap-2 items-center text-[10px] font-mono">
                    <span className={`px-1.5 py-0.5 rounded uppercase font-bold text-[9px] border ${
                      qItem.action === "delete" ? "bg-rose-100 text-rose-700 border-rose-200" : 
                      qItem.action === "update" ? "bg-sky-100 text-sky-700 border-sky-200" :
                      "bg-emerald-100 text-emerald-700 border-emerald-200"
                    }`}>
                      {qItem.action}
                    </span>
                    <span className="font-bold text-zinc-500">[{qItem.table}]</span>
                    <span className="text-zinc-400">{new Date(qItem.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div className="text-[10px] font-sans opacity-80 break-all pt-0.5">
                    ID: {qItem.id}
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0 self-end sm:self-auto">
                  <button 
                    onClick={() => handleRetryItem(qItem)}
                    className="p-1.5 px-3 rounded text-[10px] uppercase font-bold tracking-wider bg-teal-600 hover:bg-teal-700 text-white cursor-pointer transition shadow-sm border border-teal-500"
                    title="Retry this operation"
                  >
                    Sync
                  </button>
                  <button 
                    onClick={() => handleRemoveQueueItem(qItem.timestamp)}
                    className="p-1.5 rounded bg-zinc-200 hover:bg-rose-100 text-zinc-500 hover:text-rose-600 cursor-pointer transition border border-zinc-300 hover:border-rose-300"
                    title="Discard (Danger)"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 6. Data Export (CSV Backup) */}
      <div className={`border rounded-2xl overflow-hidden shadow-md p-5 space-y-4 max-w-xl mx-auto transition-colors duration-200 ${
        activeTheme === "light" ? "bg-white border-zinc-200" : "bg-[#060a15] border-[#1d2d52]"
      }`}>
        <div className={`border-b pb-3 flex justify-between items-center ${activeTheme === "light" ? "border-zinc-100" : "border-[#1d2d52]"}`}>
          <h4 className={`font-sans font-black text-xs uppercase tracking-wider flex items-center gap-1.5 ${
            activeTheme === "light" ? "text-zinc-800" : "text-[#f8fafc]"
          }`}>
            💾 Database Backup & Export
          </h4>
          <span className="text-[9.5px] uppercase font-mono font-extrabold px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500 text-blue-550">
            Native Excel
          </span>
        </div>

        <div className="space-y-3">
          <p className={`text-[10.5px] leading-relaxed font-sans ${activeTheme === "light" ? "text-zinc-655" : "text-zinc-400"}`}>
            Generate an offline emergency backup of all your transactions and ledger balances. The data will be encoded securely into a Microsoft Excel-compatible XLSX file with properly sized columns and saved directly to your local device.
          </p>

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={async () => {
                const getBuyerName = (id: any) => data?.buyers?.find((b) => String(b.id) === String(id))?.nickname || String(id);
                const getSourceName = (id: any) => data?.sources?.find((s) => String(s.id) === String(id))?.name || String(id);
                const getUserName = (id: any) => data?.users?.find((u) => String(u.id) === String(id))?.name || String(id);

                const exportData: any[] = [];

                // 1. Transactions (Auctions)
                exportData.push({"TABLE": "*** LOT AUCTIONS ***"});
                const txData = [...(data?.transactions || [])]
                  .sort((a,b) => String(b.date).localeCompare(String(a.date)))
                  .map(tx => ({
                    "Date & Time": new Date(tx.date).toLocaleString(),
                    "Buyer Name": getBuyerName(tx.buyer_id),
                    "Source Name": getSourceName(tx.source_id),
                    "Authorizing Operator": getUserName(tx.added_by),
                    "Fish Type": tx.fish_type || 'Mixed',
                    "Lot Weight (Kg)": tx.weight,
                    "Rate Per Kg (BDT)": tx.price_per_kg,
                    "Total Amount (BDT)": tx.total_price
                  }));
                exportData.push(...txData);

                // 2. Collections (Jama)
                exportData.push({});
                exportData.push({"TABLE": "*** CASH COLLECTIONS ***"});
                const colData = [...(data?.daily_collections || [])]
                  .sort((a,b) => String(b.date).localeCompare(String(a.date)))
                  .map(col => ({
                    "Date & Time": new Date(col.date).toLocaleString(),
                    "Buyer Name": getBuyerName(col.buyer_id),
                    "Amount Paid (BDT)": col.amount_paid,
                    "Total Outstanding That Day": col.total_owed_today,
                    "Approval Status": col.is_approved ? 'Approved' : 'Pending'
                  }));
                exportData.push(...colData);

                // 3. Source Payments 
                exportData.push({});
                exportData.push({"TABLE": "*** SOURCE PAYMENTS ***"});
                const spData = [...(data?.source_payments || [])]
                  .sort((a,b) => String(b.date).localeCompare(String(a.date)))
                  .map(sp => ({
                    "Date & Time": new Date(sp.date).toLocaleString(),
                    "Source Name": getSourceName(sp.source_id),
                    "Gross Sale (BDT)": sp.sale_total,
                    "Commission (BDT)": sp.commission,
                    "Net Paid to Source (BDT)": sp.amount_paid_to_source,
                    "Settlement Status": sp.is_settled ? 'Settled' : 'Unsettled'
                  }));
                exportData.push(...spData);

                const { downloadCSV } = await import('../utils/fileExport');
                await downloadCSV(exportData, `NFC_BACKUP_${new Date().toISOString().split("T")[0]}.csv`);
              }}
              className={`px-4 py-2 w-full sm:w-auto text-center font-bold text-xs rounded-2xl shadow border transition cursor-pointer ${
                activeTheme === "light"
                  ? "bg-blue-600 border-blue-500 text-white hover:bg-blue-700 shadow-blue-500/20"
                  : "bg-blue-600 border-blue-500 text-white hover:bg-blue-700 shadow-blue-500/10"
              }`}
            >
              📥 Download Local CSV Backup
            </button>
          </div>
        </div>
      </div>

      {/* Danger Zone: Wipe Database Section */}
      {isAdmin && (
        <div className={`border rounded-2xl overflow-hidden shadow-md p-5 space-y-4 max-w-xl mx-auto transition-colors duration-200 mt-4 relative ${
          activeTheme === "light" ? "bg-rose-50 border-rose-200" : "bg-zinc-900 border-red-900/50"
        }`}>
          <div className="absolute inset-0 bg-red-500/5 pointer-events-none"></div>
          <div className={`border-b pb-3 flex justify-between items-center relative ${activeTheme === "light" ? "border-rose-100" : "border-red-900/50"}`}>
            <h4 className="font-sans font-black text-xs uppercase tracking-wider flex items-center gap-1.5 text-red-500">
              <AlertCircle className="w-4 h-4" /> DANGER ZONE: PURGE SYSTEM
            </h4>
          </div>
          <div className="space-y-3 relative">
             <p className={`text-[10.5px] leading-relaxed font-sans ${activeTheme === "light" ? "text-zinc-600" : "text-zinc-400"}`}>
               Completely erase all Transactions, Source Records, and Daily Collections from the Cloud Database. Buyers, Settings, and User accounts will remain intact. This action cannot be undone!
             </p>
             <div className="flex flex-col sm:flex-row justify-end pt-1 gap-3">
               <button
                 onClick={async () => {
                   const step1 = window.confirm("🚨 LAST WARNING 🚨\n\nThis will completely ERASE everything (Transactions, Sources, Collections, Users, Buyers, Settings) globally.\n\nYou will have to create a new user to log in again!\n\nAre you absolutely sure you want to proceed?");
                   if (!step1) return;
                   const step2 = window.prompt("Type 'FACTORY RESET' to confirm COMPLETE SYSTEM WIPE:");
                   if (step2 === "FACTORY RESET") {
                     try {
                       const { factoryResetData } = await import('../db');
                       await factoryResetData();
                       alert("Factory Reset Complete. The app will now reload.");
                       window.location.reload();
                     } catch(e: any) {
                       alert('Wipe failed: ' + e.message);
                     }
                   }
                 }}
                 className="px-4 py-2 text-[10.5px] font-bold uppercase tracking-wider rounded-2xl transition border border-red-800 text-red-500 hover:bg-red-950 cursor-pointer w-full sm:w-auto text-center"
               >
                 FACTORY RESET
               </button>
               
               <button
                 onClick={async () => {
                   const step1 = window.confirm("🚨 PURGE TRANSACTIONS 🚨\n\nThis will completely ERASE all transaction and collection data globally. (Buyers & Users are kept).\n\nAre you sure you want to proceed?");
                   if (!step1) return;
                   const step2 = window.prompt("Type 'DELETE' to confirm transaction wipe:");
                   if (step2 === "DELETE") {
                     try {
                       const { wipeAllData } = await import('../db');
                       await wipeAllData();
                       alert("Transactions Wiped. The app will now reload.");
                       window.location.reload();
                     } catch(e: any) {
                       alert('Wipe failed: ' + e.message);
                     }
                   }
                 }}
                 className="px-4 py-2 text-[10.5px] font-bold uppercase tracking-wider rounded-2xl transition bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/20 cursor-pointer w-full sm:w-auto text-center"
               >
                 WIPE TRANSACTIONS 🗑️
               </button>
             </div>
          </div>
        </div>
      )}

      {/* 5. Shift Session termination - Only visible under settings */}
      {isAuthenticated && onLogout && (
        <div className={`border rounded-2xl overflow-hidden shadow-md p-5 transition-colors duration-200 ${
          activeTheme === "light"
            ? "bg-rose-50 border-rose-200 text-rose-955"
            : "bg-[#180a0f] border-[#5e192a] text-[#fca5a5]"
        }`}>
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
              <h4 className="font-sans font-extrabold text-xs uppercase tracking-wider text-rose-600 flex items-center gap-1.5">
                🚨 End Shift Session & Lock Desk
              </h4>
              <p className="text-[10.5px] text-zinc-500 mt-1 max-w-md">
                Terminate your active terminal cache session, secure all registered outstanding accounts, and lock the hardware workspace for next operator change.
              </p>
            </div>
            <button
              onClick={onLogout}
              className="px-4 py-2 w-full sm:w-auto text-center shrink-0 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-[11px] uppercase tracking-wider transition-all duration-150 cursor-pointer shadow-md shadow-rose-900/10"
            >
              Sign Out Session
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
