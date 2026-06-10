/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { useData } from "./DataContext";
import { Anchor, User, Scale, TrendingUp, AlertCircle, Sparkles, Check, Edit2, Play, Lock, Trash2, ArrowRight, X, ChevronRight, UserPlus, CreditCard } from "lucide-react";
import { User as DbUser, loadAll } from "../db";
import { motion, AnimatePresence } from "motion/react";

interface TransactionPanelProps {
  activeUser: DbUser | null;
  isAuthenticated: boolean;
  deviceMode?: "laptop" | "android";
}

// ─────────────────────────────────────────────────────────────────────────────
// SMART LOGIC HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const getSmartFishSuggestions = (transactions: any[], sourceId: string | number | null, buyerId: string | number | null) => {
  const counts: { [key: string]: number } = {};
  transactions.forEach((t) => {
    if (t.fish_type) {
      const matchSource = sourceId && t.source_id === sourceId;
      const matchBuyer = buyerId && t.buyer_id === buyerId;
      const weightBonus = (matchSource ? 5 : 0) + (matchBuyer ? 5 : 0) + 1;
      counts[t.fish_type] = (counts[t.fish_type] || 0) + weightBonus;
    }
  });

  return Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 8);
};

const getSmartBuyerSuggestions = (transactions: any[], buyers: any[], sourceId: string | number | null, fishType: string) => {
  const counts: { [key: string]: number } = {};
  transactions.forEach((t) => {
    if (t.buyer_id) {
      const matchSource = sourceId && t.source_id === sourceId;
      const matchFish = fishType && t.fish_type?.toLowerCase() === fishType.toLowerCase();
      const weightBonus = (matchSource ? 5 : 0) + (matchFish ? 5 : 0) + 1;
      counts[t.buyer_id] = (counts[t.buyer_id] || 0) + weightBonus;
    }
  });

  return buyers
    .map((b) => ({ ...b, score: counts[b.id] || 0 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
};

const fmt = (v: number) => "₹" + Math.round(v).toLocaleString();
const fmtKg = (v: number) => v.toFixed(2) + " kg";

// ─────────────────────────────────────────────────────────────────────────────
// THE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export const TransactionPanel: React.FC<TransactionPanelProps> = ({ activeUser, isAuthenticated, deviceMode }) => {
  const { data, write, appDate } = useData();

  const store = {
    transactions: (data?.transactions || []).filter((t: any) => t.date === appDate),
    sources: data?.sources || [],
    buyers: data?.buyers || [],
    source_payments: data?.source_payments || [],
  };

  const isAdmin = activeUser?.role === "admin";
  const canWrite = isAuthenticated && (activeUser?.role === "admin" || activeUser?.role === "auctioneer");

  // State managers
  const [activeSourceId, setActiveSourceId] = useState<string | number | null>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("nfc_active_source_id");
      return saved ? saved : null;
    }
    return null;
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (activeSourceId) {
        localStorage.setItem("nfc_active_source_id", String(activeSourceId));
      } else {
        localStorage.removeItem("nfc_active_source_id");
      }
    }
  }, [activeSourceId]);

  const store_settings = data?.settings || [];
  const sessionEndedSetting = store_settings.find((s: any) => s.key === `auction_session_ended_${appDate}`);
  const [isAuctionSessionEnded, setIsAuctionSessionEnded] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(`nfc_auction_session_ended_${appDate}`) === "true";
    }
    return false;
  });

  useEffect(() => {
    if (sessionEndedSetting) {
      setIsAuctionSessionEnded(sessionEndedSetting.value === "true");
    }
  }, [sessionEndedSetting]);

  const [buyer, setBuyer] = useState<any>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("nfc_draft_buyer");
      try {
        return saved ? JSON.parse(saved) : null;
      } catch {
        return null;
      }
    }
    return null;
  });

  const [fishType, setFishType] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("nfc_draft_fish_type") || "";
    }
    return "";
  });

  const [isFishInputFocused, setIsFishInputFocused] = useState(false);
  const [weight, setWeight] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("nfc_draft_weight") || "";
    }
    return "";
  });

  const [price, setPrice] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("nfc_draft_price") || "";
    }
    return "";
  });

  const [field, setField] = useState<"weight" | "price">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("nfc_draft_field");
      return (saved === "weight" || saved === "price") ? saved : "weight";
    }
    return "weight";
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (buyer) {
        localStorage.setItem("nfc_draft_buyer", JSON.stringify(buyer));
      } else {
        localStorage.removeItem("nfc_draft_buyer");
      }
    }
  }, [buyer]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("nfc_draft_fish_type", fishType);
    }
  }, [fishType]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("nfc_draft_weight", weight);
    }
  }, [weight]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("nfc_draft_price", price);
    }
  }, [price]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("nfc_draft_field", field);
    }
  }, [field]);

  const [showPicker, setShowPicker] = useState(false);
  const [showSrcInput, setShowSrcInput] = useState(false);
  const [srcName, setSrcName] = useState("");
  const [srcRate, setSrcRate] = useState("");
  const [editTxn, setEditTxn] = useState<any>(null);
  const [flash, setFlash] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [isNumpadDown, setIsNumpadDown] = useState(false);
  const [showEndAuctionConfirm, setShowEndAuctionConfirm] = useState(false);

  // Source editing state variables
  const [isEditingSource, setIsEditingSource] = useState(false);
  const [editSourceName, setEditSourceName] = useState("");
  const [editSourceRate, setEditSourceRate] = useState("");



  // Derive dynamic entities
  const fishSuggestions = getSmartFishSuggestions(store.transactions, activeSourceId, buyer?.id);
  const buyerSuggestions = getSmartBuyerSuggestions(store.transactions, store.buyers, activeSourceId, fishType);
  const todaySources = store.sources.filter((s) => s.date === appDate && !s.is_archived);
  const activeSrc = store.sources.find((s) => s.id === activeSourceId);
  const activeTxns = store.transactions.filter((t) => t.source_id === activeSourceId);
  const totalKg = activeTxns.reduce((sum, t) => sum + (t.weight || 0), 0);
  const totalAmt = activeTxns.reduce((sum, t) => sum + (t.total_price || 0), 0);

  // Set default active source if none is selected
  useEffect(() => {
    if (!activeSourceId && todaySources.length > 0) {
      // Find first uncompleted source
      const firstActive = todaySources.find((s) => !s.is_completed);
      if (firstActive) {
        setActiveSourceId(firstActive.id);
      } else {
        setActiveSourceId(todaySources[0].id);
      }
    }
  }, [todaySources, activeSourceId]);

  const doFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(""), 1700);
  };

  const addBuyer = async (name: string) => {
    const newId = `buyer_rec_${Date.now()}`;
    const newB = { id: newId, nickname: name, lifetime_debt: 0, credit_limit: 100000 };
    await write("buyers", "insert", newB);
    doFlash("✔ Buyer Registered!");
    return newB;
  };

  const createSource = async () => {
    if (!srcName.trim()) return;
    setLoading(true);
    const newId = `src_rec_${Date.now()}`;
    const src = {
      id: newId,
      name: srcName.trim(),
      rate_per_kg: parseFloat(srcRate) || 0,
      date: appDate,
      is_completed: false,
      is_archived: false,
    };
    await write("sources", "insert", src);
    setActiveSourceId(newId);
    setSrcName("");
    setSrcRate("");
    setShowSrcInput(false);
    setLoading(false);
    doFlash("✔ New Source added!");
  };

  const saveSourceEdit = async () => {
    if (!activeSrc) return;
    const rate = parseFloat(editSourceRate) || 0;
    await write("sources", "update", {
      ...activeSrc,
      name: editSourceName.trim() || activeSrc.name,
      rate_per_kg: rate,
    });
    
    // Also update any matching source payments
    const existingPayment = store.source_payments.find((p) => p.source_id === activeSrc.id);
    if (existingPayment) {
      await write("source_payments", "update", {
        ...existingPayment,
        rate_per_kg: rate,
      });
    }

    setIsEditingSource(false);
    doFlash("✔ Source Metadata Updated!");
  };

  const lockSource = async () => {
    if (!activeSrc) return;
    await write("sources", "update", { ...activeSrc, is_completed: true });
    
    // Auto-create or Update source payment slip structure inside ledger
    const existing = store.source_payments.find((p) => p.source_id === activeSrc.id);
    if (!existing) {
      await write("source_payments", "insert", {
        id: `sp_${Date.now()}`,
        source_id: activeSrc.id,
        date: appDate,
        total_kg: totalKg,
        rate_per_kg: activeSrc.rate_per_kg || 0,
        sale_total: totalAmt,
        amount_paid_to_source: 0,
        commission: 0,
        is_settled: false,
      });
    } else {
      await write("source_payments", "update", {
        ...existing,
        total_kg: totalKg,
        sale_total: totalAmt,
      });
    }
    setActiveSourceId(null);
    doFlash("🔒 Source Marked Sold!");
  };

  const clearAll = async () => {
    for (const s of todaySources) {
      await write("sources", "update", { ...s, is_archived: true, is_completed: true });
    }
    setActiveSourceId(null);
    setConfirmClear(false);
    doFlash("✔ All archived!");
  };

  const rebuildCollection = async (buyerId: string, date: string) => {
    // To ensure precision immediately after a write, we pull the freshest data (queue merged)
    const latestData = await loadAll();
    const txns = latestData.transactions.filter((t) => t.buyer_id === buyerId && t.date === date);
    const total = txns.reduce((sum, t) => sum + (t.total_price || 0), 0);
    
    // We can still use data?.daily_collections here to find the entity ID structure
    const dailyCollections = latestData.daily_collections || [];
    const existing = dailyCollections.find((c) => c.buyer_id === buyerId && c.date === date);

    if (total > 0) {
      if (existing) {
        await write("daily_collections", "update", {
          ...existing,
          total_owed_today: total,
        });
      } else {
        await write("daily_collections", "insert", {
          id: `dc_${Date.now()}`,
          buyer_id: buyerId,
          date,
          total_owed_today: total,
          amount_paid: 0,
          is_rolled_over: false,
          is_approved: false,
        });
      }
    } else if (existing) {
      await write("daily_collections", "update", {
        ...existing,
        total_owed_today: 0,
      });
    }
  };

  const saveTxn = async () => {
    if (!canWrite) {
      alert("Unauthorized! Tap user selector in the left column to log in as admin or auctioneer.");
      return;
    }
    if (!buyer || !weight || !price || !activeSourceId) return;
    
    // Capture values and clear instantly to prevent double-tap
    const w = parseFloat(weight);
    const p = parseFloat(price);
    const currentBuyer = buyer;
    const currentFishType = fishType;
    const currentActiveSourceId = activeSourceId;
    
    setWeight("");
    setPrice("");
    setFishType("");
    setField("weight");
    setBuyer(null);

    if (isNaN(w) || isNaN(p) || w <= 0 || p <= 0) return;
    
    setLoading(true);

    try {
      const totalNum = w * p;
      const tempTxId = `tx_${Date.now()}`;

      // Insert transaction
      await write("transactions", "insert", {
        id: tempTxId,
        source_id: currentActiveSourceId,
        buyer_id: currentBuyer.id,
        weight: w,
        price_per_kg: p,
        total_price: totalNum,
        date: appDate,
        fish_type: currentFishType.trim() || "Unsorted Lot",
        timestamp: new Date().toISOString(),
        added_by: activeUser?.name || "System Staff",
      });

      // Cascade update buyer lifetime debt
      const updatedBuyer = {
        ...currentBuyer,
        lifetime_debt: (currentBuyer.lifetime_debt || 0) + totalNum,
      };
      await write("buyers", "update", updatedBuyer);

      // Rebuild buyer collections statement
      await rebuildCollection(currentBuyer.id, appDate);

      doFlash("✔ Auction commit recorded successful!");
    } catch (err: any) {
      console.error("Save Txn Error:", err);
      alert("An error occurred saving the record: " + err.message);
      // Optional: restore state on error if needed
    } finally {
      setLoading(false);
    }
  };

  const handleEditSave = async (changes: any) => {
    const old = editTxn;
    if (!old) return;
    
    const updatedTxn = { ...old, ...changes };
    await write("transactions", "update", updatedTxn);

    if (old.buyer_id) await rebuildCollection(old.buyer_id, old.date);
    if (changes.buyer_id && changes.buyer_id !== old.buyer_id) {
      await rebuildCollection(changes.buyer_id, old.date);
    }

    setEditTxn(null);
    doFlash("✔ Entry Updated!");
  };

  const handleEditDelete = async () => {
    const t = editTxn;
    if (!t) return;

    if (!window.confirm("Are you sure you want to delete this transaction? This action cannot be undone.")) return;

    await write("transactions", "delete", { id: t.id });
    if (t.buyer_id) await rebuildCollection(t.buyer_id, t.date);

    setEditTxn(null);
    doFlash("✔ Entry Deleted!");
  };

  const numVal = field === "weight" ? weight : price;
  const setNumVal = (v: string) => {
    if (field === "weight") {
      setWeight(v);
    } else {
      setPrice(v);
    }
  };

  // Tactile Virtual Keypad cell handlers
  const handleKeyTap = (key: string) => {
    let current = numVal;
    if (key === "back") {
      setNumVal(current.slice(0, -1));
    } else if (key === "C") {
      setNumVal("");
    } else if (key === "NEXT") {
      if (field === "weight") {
        setField("price");
      } else {
        saveTxn();
      }
    } else if (key === ".") {
      if (!current.includes(".")) {
        setNumVal(current === "" ? "0." : current + ".");
      }
    } else if (key === "00") {
      if (current !== "" && current !== "0") {
        setNumVal(current + "00");
      }
    } else {
      // Avoid starting with multiple zeroes
      if (current === "0") {
        setNumVal(key);
      } else {
        setNumVal(current + key);
      }
    }
  };

  if (showPicker) {
    return (
      <BuyerPicker
        buyers={store.buyers}
        onSelect={(b) => {
          setBuyer(b);
          setWeight("");
          setPrice("");
          setShowPicker(false);
        }}
        onClose={() => setShowPicker(false)}
        onAddAndSelect={async (name) => {
          const nb = await addBuyer(name);
          setBuyer(nb);
          setWeight("");
          setPrice("");
          setShowPicker(false);
        }}
      />
    );
  }

  return (
    <div className={`flex flex-col ${
      deviceMode === "android" ? "h-full" : "h-[740px] md:h-[800px]"
    } bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl relative font-sans text-zinc-100`}>
      <style>{`
        .pop-flash {
          animation: popMsg 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes popMsg {
          0% { transform: scale(0.85); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
      
      {/* Edit and override Modal */}
      {editTxn && (
        <EditTxnModal
          txn={editTxn}
          buyers={store.buyers}
          onSave={handleEditSave}
          onDelete={handleEditDelete}
          onClose={() => setEditTxn(null)}
          onAddBuyer={addBuyer}
        />
      )}

      {/* 1. Source Unloading Session bar */}
      <div className="bg-gradient-to-b from-zinc-900 to-zinc-950 border-b border-zinc-800 p-3 shrink-0 space-y-2">
        {/* Consolidated row for dynamic action chips and end session toggle */}
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="flex flex-wrap gap-1.5 items-center">
            {todaySources.map((src) => {
              const isActive = src.id === activeSourceId && !src.is_completed;
              const isCompleted = src.is_completed;
              return (
                <button
                  key={src.id}
                  onClick={() => {
                    setActiveSourceId(src.id);
                    setConfirmClear(false);
                  }}
                  className={`px-3 py-1.5 text-[11px] font-bold rounded-full border transition flex items-center gap-1.5 cursor-pointer selection:hidden select-none ${
                    isActive
                      ? "bg-sky-600 text-white border-sky-400 font-extrabold shadow-md transform scale-102"
                      : isCompleted
                      ? "bg-zinc-900/60 text-zinc-500 border-zinc-800/80 line-through decoration-slate-600"
                      : "bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800"
                  }`}
                >
                  {isCompleted ? <Lock className="w-2.5 h-2.5 text-amber-500 shrink-0" /> : <Anchor className="w-2.5 h-2.5 text-sky-400 shrink-0" />}
                  <span>{src.name}</span>
                  {src.rate_per_kg > 0 && <span className="opacity-60 text-[9px] font-mono">₹{src.rate_per_kg}</span>}
                </button>
              );
            })}

            {!showSrcInput && (
              <button
                onClick={() => {
                  setSrcName("");
                  setSrcRate("");
                  setShowSrcInput(true);
                }}
                className="px-3 py-1.5 text-[11px] font-bold border border-dashed border-amber-600 rounded-full text-amber-500 hover:text-amber-400 hover:bg-amber-500/5 transition cursor-pointer select-none"
              >
                + New Source
              </button>
            )}
          </div>

          {!isAuctionSessionEnded && (
            <button
              onClick={() => setShowEndAuctionConfirm(true)}
              className="px-2.5 py-1.5 bg-rose-600/90 hover:bg-rose-700 text-white font-extrabold rounded-full text-[9px] tracking-wide uppercase transition duration-150 cursor-pointer shadow-sm border border-rose-500/10 flex items-center justify-center gap-1 shrink-0"
              title="End the auction session for today"
            >
              ✕ Close Today's Auction
            </button>
          )}
        </div>

        {/* Create Source input elements overlay */}
        {showSrcInput && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createSource();
            }}
            className="p-3.5 bg-zinc-950 border border-zinc-800 rounded-2xl flex flex-col sm:flex-row gap-2.5 items-center animate-slideDown shadow-lg"
          >
            <input
              type="text"
              value={srcName}
              onChange={(e) => setSrcName(e.target.value)}
              placeholder="Source Source Name (e.g. Robin Kaka)"
              className="w-full sm:flex-grow text-xs text-zinc-200 bg-zinc-900 p-2.5 rounded-2xl border border-zinc-800 focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans"
              autoFocus
            />
            <input
              type="text"
              value={srcRate}
              onChange={(e) => setSrcRate(e.target.value.replace(/[^\d.]/g, ""))}
              placeholder="Rate/kg (e.g. 250)"
              className="w-full sm:w-28 text-xs text-zinc-200 bg-zinc-900 p-2.5 rounded-2xl border border-zinc-800 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
            />
            <div className="flex gap-1.5 w-full sm:w-auto">
              <button
                type="submit"
                className="flex-grow sm:flex-none px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold rounded-2xl text-xs tracking-wider cursor-pointer font-sans"
              >
                ADD
              </button>
              <button
                type="button"
                onClick={() => {
                  setSrcName("");
                  setSrcRate("");
                  setShowSrcInput(false);
                }}
                className="px-3 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-405 text-zinc-400 rounded-2xl cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {/* Source Action controllers (Lock, edit metadata, and settlement triggers) */}
        {todaySources.length > 0 && activeSrc && (
          <div className="flex flex-wrap gap-1.5 items-center justify-between text-[10px] text-zinc-400 border-t border-zinc-900/60 pt-2.5 mt-1 select-none">
            {isEditingSource && canWrite ? (
              <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-800 p-1 rounded-2xl w-full sm:w-auto">
                <input
                  type="text"
                  value={editSourceName}
                  onChange={(e) => setEditSourceName(e.target.value)}
                  className="bg-zinc-900 text-zinc-100 text-[10px] px-2 py-1 rounded border border-zinc-800 font-sans w-28 focus:outline-none focus:border-amber-500"
                  placeholder="Source Name"
                />
                <input
                  type="text"
                  value={editSourceRate}
                  onChange={(e) => setEditSourceRate(e.target.value.replace(/[^\d.]/g, ""))}
                  className="bg-zinc-900 text-zinc-100 text-[10px] px-2 py-1 rounded border border-zinc-800 font-mono w-16 focus:outline-none focus:border-amber-500"
                  placeholder="Rate/kg"
                />
                <button
                  type="button"
                  onClick={saveSourceEdit}
                  className="px-2 py-1 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingSource(false)}
                  className="px-2 py-1 bg-zinc-800 text-zinc-400 rounded"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[9px] uppercase">Unloading: <strong className="text-teal-400">{activeSrc.name}</strong></span>
                {canWrite && (
                  <button
                    onClick={() => {
                      setEditSourceName(activeSrc.name);
                      setEditSourceRate(String(activeSrc.rate_per_kg || ""));
                      setIsEditingSource(true);
                    }}
                    className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition flex items-center justify-center"
                    title="Edit name or base rate"
                  >
                    ✏️
                  </button>
                )}
              </div>
            )}
            
            <div className="flex gap-1.5 ml-auto sm:ml-0">
              {activeSrc && !activeSrc.is_completed && (
                <button
                  onClick={lockSource}
                  className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:text-emerald-300 font-black rounded text-[9.5px] uppercase tracking-wider cursor-pointer transition flex items-center gap-1"
                >
                  <Lock className="w-3 h-3" /> Sold
                </button>
              )}

              {activeSrc && activeSrc.is_completed && canWrite && (
                <button
                  onClick={async () => {
                    await write("sources", "update", { ...activeSrc, is_completed: false });
                    doFlash("🔓 Source Reopened!");
                  }}
                  className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 hover:text-amber-300 font-black rounded text-[9.5px] uppercase tracking-wider cursor-pointer transition flex items-center gap-1"
                  title="Reopen source to add or modify auctions"
                >
                  🔓 Undo
                </button>
              )}
              
              {!confirmClear ? (
                <button
                  onClick={() => setConfirmClear(true)}
                  className="px-2 py-1 hover:bg-zinc-900 text-zinc-500 hover:text-zinc-300 rounded text-[9.5px] border border-zinc-800/60 font-sans cursor-pointer transition uppercase"
                  title="Archive all sources for today"
                >
                  Archive All
                </button>
              ) : (
                <div className="flex gap-1 items-center">
                  <span className="text-[9px] text-amber-500 animate-pulse font-bold uppercase">Confirm?</span>
                  <button
                    onClick={clearAll}
                    className="px-2 py-1 bg-rose-500/20 hover:bg-rose-500 border border-rose-900 text-rose-400 hover:text-white rounded text-[9px] font-extrabold cursor-pointer transition"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setConfirmClear(false)}
                    className="px-2 py-1 hover:bg-zinc-900 text-zinc-400 rounded text-[9px] font-bold cursor-pointer border border-zinc-800"
                  >
                    No
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Confirmation End Session Modal Popup Dialog */}
      {showEndAuctionConfirm && (
        <div className="inset-0 absolute bg-zinc-950/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl text-center space-y-5">
            <div className="w-14 h-14 bg-rose-500/10 border border-rose-500/35 rounded-full flex items-center justify-center mx-auto text-rose-500">
              <AlertCircle className="w-7 h-7" />
            </div>
            <div className="space-y-1.5 text-center">
              <h4 className="font-extrabold text-md uppercase text-zinc-100 tracking-tight">End today's auction?</h4>
              <p className="text-zinc-400 text-[11px] leading-relaxed">
                Are you sure you want to end the auction for today? This action is reversible, but it will clear the active auction screen and entries panel until reopened.
              </p>
            </div>
            <div className="flex gap-2 justify-center pt-2">
              <button
                onClick={async () => {
                  setIsAuctionSessionEnded(true);
                  if (typeof window !== "undefined") {
                    localStorage.setItem(`nfc_auction_session_ended_${appDate}`, "true");
                    // Clear current draft selections
                    localStorage.removeItem("nfc_draft_buyer");
                    localStorage.removeItem("nfc_draft_fish_type");
                    localStorage.removeItem("nfc_draft_weight");
                    localStorage.removeItem("nfc_draft_price");
                    localStorage.removeItem("nfc_draft_field");
                    localStorage.removeItem("nfc_active_source_id");
                  }
                  setBuyer(null);
                  setWeight("");
                  setPrice("");
                  setFishType("");
                  setField("weight");
                  setActiveSourceId(null);
                  
                  // Upsert setting in DB
                  await write("settings", "upsert", { key: `auction_session_ended_${appDate}`, value: "true" });
                  
                  setShowEndAuctionConfirm(false);
                  doFlash("🔒 Auction Session Ended Successfully!");
                }}
                className="flex-grow sm:flex-none px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-black rounded-2xl transition shadow cursor-pointer uppercase tracking-tight"
              >
                Yes, End Session
              </button>
              <button
                onClick={() => setShowEndAuctionConfirm(false)}
                className="flex-grow sm:flex-none px-5 py-2.5 bg-zinc-850 hover:bg-zinc-800 border border-zinc-805 border-zinc-800 text-zinc-300 text-[11px] font-bold rounded-2xl transition cursor-pointer uppercase tracking-tight"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Scrollable Transaction Audit Log */}
      {isAuctionSessionEnded ? (
        <div className="flex-grow flex flex-col items-center justify-center p-6 text-center space-y-5 select-none bg-gradient-to-b from-zinc-950 to-zinc-900 overflow-y-auto">
          <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 rounded-full flex items-center justify-center text-rose-500 animate-pulse shadow-sm animate-scaleUp">
            <Lock className="w-8 h-8" />
          </div>
          
          <div className="space-y-1.5 max-w-sm">
            <h4 className="text-sm font-black tracking-tight uppercase text-zinc-100">
              Auction Session Closed
            </h4>
            <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
              All transactions have been finalized and the digital auction slate has been closed for <span className="font-mono text-amber-500 font-bold">{appDate}</span>.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5 w-full max-w-sm bg-zinc-900/60 border border-zinc-800 p-4 rounded-2xl text-left shadow-md">
            <div className="border-r border-zinc-800/80 pr-2">
              <span className="text-[9px] text-zinc-500 uppercase font-black tracking-wider block">Daily Total Volume</span>
              <span className="text-xs font-black text-amber-500 font-mono mt-0.5 block">{fmtKg(store.transactions.reduce((sum, t) => sum + (t.weight || 0), 0))}</span>
            </div>
            <div className="pl-3">
              <span className="text-[9px] text-zinc-500 uppercase font-black tracking-wider block">Completed Turnover</span>
              <span className="text-xs font-black text-emerald-400 font-mono mt-0.5 block">{fmt(store.transactions.reduce((sum, t) => sum + (t.total_price || 0), 0))}</span>
            </div>
          </div>

          <div className="space-y-3 w-full max-w-xs pt-1 animate-fadeIn">
            <button
              onClick={async () => {
                setIsAuctionSessionEnded(false);
                if (typeof window !== "undefined") {
                  localStorage.setItem(`nfc_auction_session_ended_${appDate}`, "false");
                }
                await write("settings", "upsert", { key: `auction_session_ended_${appDate}`, value: "false" });
                doFlash("🔓 Auction Session Reopened!");
              }}
              className="w-full bg-slate-100 hover:bg-white text-zinc-950 font-black rounded-xl py-2.5 text-xs tracking-wider cursor-pointer uppercase transition duration-150 shadow shadow-white/5 border border-white/20 block"
            >
              🔓 Reopen Auction Session
            </button>
            <p className="text-[9.5px] text-zinc-500 font-sans leading-normal">
              Reopening will restore custom numeric keypads, source slots, and enable active buyer record logging.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-grow overflow-y-auto p-4 space-y-4">
            {/* Dynamic Aggregated Metrics cards row */}
            <div className="grid grid-cols-3 gap-2 shrink-0">
              {[
                ["TOTAL KG", fmtKg(totalKg), "text-amber-500", "border-amber-500/20"],
                ["REVENUE", fmt(totalAmt), "text-emerald-400", "border-emerald-500/20"],
                ["MEAN BID", totalKg > 0 ? fmt(totalAmt / totalKg) + "/kg" : "—", "text-sky-400", "border-sky-500/20"],
              ].map(([label, value, textColor, borderColor]) => (
                <div
                  key={label}
                  className={`bg-gradient-to-br from-zinc-900 to-zinc-950 border ${borderColor} rounded-2xl py-2.5 px-1 text-center select-none shadow-sm`}
                >
                  <div className="text-[8px] text-zinc-500 font-extrabold uppercase font-sans tracking-widest">{label}</div>
                  <div className={`text-sm md:text-base font-black font-mono mt-1 ${textColor}`}>{value}</div>
                </div>
              ))}
            </div>

            {/* Empty placeholder if no recorded logs */}
            {activeTxns.length === 0 && (
              <div className="text-center py-20 text-zinc-500 text-xs font-sans space-y-2 select-none">
                <div className="text-2xl animate-bounce">🎣</div>
                <div className="font-bold">No transactions found for this source.</div>
                <p className="text-[10.5px] text-zinc-600 max-w-sm mx-auto">
                  Select or register a source chip above, pick your buyer nickname at the bottom, and enter weights on the custom keypad.
                </p>
              </div>
            )}

            {/* Table representation but mobile-first scrolling Cards */}
            <div className="space-y-2 animate-fadeIn">
              {[...activeTxns].reverse().map((t) => {
                const b = store.buyers.find((x) => x.id === t.buyer_id);
                const canEdit = canWrite;
                return (
                  <div
                    key={t.id}
                    className="flex justify-between items-center bg-zinc-900/40 border border-zinc-800 rounded-2xl p-3 shadow-inner hover:bg-zinc-900 transition duration-150"
                  >
                    <div className="flex-grow">
                      <div className="text-xs md:text-sm font-extrabold text-zinc-200 uppercase tracking-tight flex items-center flex-wrap gap-1.5 font-sans">
                        <span>{b?.nickname || "Direct Spot Cash"}</span>
                        {t.fish_type && (
                          <span className="text-[9.5px] uppercase font-bold text-sky-500 text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded-full border border-sky-400/10">
                            {t.fish_type}
                          </span>
                        )}
                        {t.added_by && (
                          <span className="text-[9px] font-medium font-mono text-zinc-500 lowercase">
                            ({t.added_by})
                          </span>
                        )}
                      </div>
                      <div className="text-[10.5px] text-zinc-400 font-mono mt-1">
                        {t.weight.toFixed(2)} kg × ₹{t.price_per_kg}/kg
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-xs md:text-sm font-black font-mono text-emerald-400 text-right">
                        {fmt(t.total_price)}
                      </div>
                      {canEdit && (
                        <button
                          onClick={() => setEditTxn(t)}
                          className="p-1.5 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white rounded-2xl cursor-pointer transition text-[11px]"
                          title="Adjust Record"
                        >
                          ✏️
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Static Tactile POS Entry Drawer */}
          <div className="shrink-0 border-t-2 border-zinc-800 bg-zinc-900 p-3 select-none flex flex-col gap-2.5 z-10 shadow-[0_-5px_20px_rgba(0,0,0,0.3)]">
            {/* Compact Wholesale Buyer Box and Mini Keypad Toggle side-by-side */}
            <div className="flex gap-1.5 items-center justify-between">
              <button
                onClick={() => setShowPicker(true)}
                className={`w-[84%] py-1.5 px-2.5 rounded-2xl text-center cursor-pointer flex items-center justify-center gap-1 border font-extrabold text-[10px] uppercase tracking-wider select-none selection:hidden transition-all duration-150 focus:outline-none ${
                  buyer
                    ? "bg-amber-600 text-white border-amber-500 shadow-md"
                    : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:bg-zinc-900"
                }`}
              >
                <User className="w-2.5 h-2.5 shrink-0" />
                <span className="truncate">{buyer ? `🧑 ${buyer.nickname}` : "👤 Pick Buyer"}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsNumpadDown(!isNumpadDown)}
                className={`w-[14%] flex-shrink-0 py-1.5 px-1 border rounded-2xl font-black text-[10px] uppercase cursor-pointer flex items-center justify-center select-none transition-all ${
                  isNumpadDown
                    ? "bg-zinc-950 text-zinc-500 border-zinc-800 hover:bg-zinc-900"
                    : "bg-indigo-600 text-white border-indigo-500 hover:bg-indigo-700"
                }`}
                title={isNumpadDown ? "Show Custom Keypad" : "Hide Custom Keypad"}
              >
                <span>{isNumpadDown ? "⌨️" : "✕ ⌨️"}</span>
              </button>
            </div>



              {/* Crate Name / No. entry & chip helper row */}
            <div className="flex flex-col gap-1.5 relative">
              <div className="flex gap-2 relative">
                <input
                  type="text"
                  value={fishType}
                  onChange={(e) => setFishType(e.target.value)}
                  onFocus={() => setIsFishInputFocused(true)}
                  onBlur={() => setTimeout(() => setIsFishInputFocused(false), 200)}
                  placeholder="📦 Enter Crate Name / No...."
                  className={`w-full text-xs font-semibold bg-zinc-950 p-2 text-zinc-200 placeholder-slate-600 rounded-2xl border outline-none focus:ring-1 focus:ring-sky-500 transition-all font-sans ${
                    fishType ? "border-sky-500/60" : "border-zinc-800"
                  }`}
                />
                {fishType && (
                  <button
                    onClick={() => setFishType("")}
                    className="absolute right-2 top-2 text-rose-500 p-0.5 hover:bg-rose-500/10 rounded cursor-pointer z-10"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Crate contextual pill tags suggestions */}
              {isFishInputFocused && fishSuggestions.length > 0 && !fishSuggestions.some(s => s.toLowerCase() === fishType.toLowerCase()) && (
                <div className="flex flex-wrap gap-1.5 overflow-x-auto scrollbar-none py-0.5 select-none absolute top-full left-0 right-0 z-20 bg-zinc-900 border border-zinc-800 p-2 rounded-2xl shadow-2xl shadow-black/10 mt-1">
                  {fishSuggestions
                    .filter((s) => !fishType || s.toLowerCase().startsWith(fishType.toLowerCase()))
                    .map((s) => (
                      <button
                        key={s}
                        onMouseDown={(e) => {
                          e.preventDefault(); // Prevent blur when clicking
                        }}
                        onClick={() => {
                          setFishType(s);
                          setIsFishInputFocused(false);
                        }}
                        className="px-3 py-1.5 text-[10.5px] font-extrabold rounded-full border transition flex items-center justify-center cursor-pointer select-none bg-zinc-950 border-zinc-800/70 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                      >
                        {s}
                      </button>
                    ))}
                </div>
              )}
            </div>

            {/* Side-by-side WEIGHT (kg) and PRICE/kg box containers */}
            <div className="grid grid-cols-2 gap-2 text-left shrink-0">
              {[
                ["WEIGHT (kg)", weight, "weight"],
                ["PRICE/kg (₹)", price, "price"],
              ].map(([label, val, f]) => {
                const isActive = field === f;
                return (
                  <div
                    key={f}
                    onClick={() => setField(f as any)}
                    className={`p-2 rounded-2xl transition duration-155 cursor-pointer flex flex-col justify-between select-none ${
                      isActive
                        ? "bg-zinc-955 border-2 border-amber-500 bg-zinc-950 shadow-inner scale-[1.01]"
                        : "bg-zinc-950 border-2 border-zinc-800/80 hover:border-zinc-800"
                    }`}
                  >
                    <div className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider font-sans select-none">{label}</div>
                    <div className="text-lg md:text-xl font-bold font-mono text-zinc-100 flex items-baseline justify-between pt-1">
                      <span>{val || <span className="text-zinc-700">0</span>}</span>
                      {isActive && <span className="w-1.5 h-4 bg-amber-500 animate-pulse inline-block" />}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Calculated Total summary overlay */}
            {parseFloat(weight) > 0 && parseFloat(price) > 0 && (
              <div className="bg-emerald-950/20 border border-emerald-900/40 text-emerald-400 p-2 rounded-2xl flex justify-between items-center font-mono selection:hidden select-none px-4 shadow-sm">
                <span className="text-[11px] font-sans font-bold text-emerald-500">Commit Sum:</span>
                <span className="text-base font-black">{fmt(parseFloat(weight) * parseFloat(price))}</span>
              </div>
            )}

            {/* Saving / update system notifications overlays */}
            {flash && (
              <div className="pop-flash text-center text-emerald-400 font-extrabold text-[11px] tracking-wider font-sans uppercase animate-pulse select-none">
                {flash}
              </div>
            )}

            {/* Highly tactile specialized mobile numpad layout */}
            {!isNumpadDown && (
              <div className="grid grid-cols-4 gap-1.5 shrink-0 select-none animate-fadeIn">
                {/* Row 1 */}
                <button
                  onClick={() => handleKeyTap("7")}
                  className="py-2.5 text-sm md:text-base font-black font-mono bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-2xl cursor-pointer"
                >
                  7
                </button>
                <button
                  onClick={() => handleKeyTap("8")}
                  className="py-2.5 text-sm md:text-base font-black font-mono bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-2xl cursor-pointer"
                >
                  8
                </button>
                <button
                  onClick={() => handleKeyTap("9")}
                  className="py-2.5 text-sm md:text-base font-black font-mono bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-2xl cursor-pointer"
                >
                  9
                </button>
                <button
                  onClick={() => handleKeyTap("back")}
                  className="py-2.5 text-sm font-extrabold bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-rose-500 rounded-2xl cursor-pointer flex items-center justify-center font-mono"
                >
                  ⌫
                </button>

                {/* Row 2 */}
                <button
                  onClick={() => handleKeyTap("4")}
                  className="py-2.5 text-sm md:text-base font-black font-mono bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-2xl cursor-pointer"
                >
                  4
                </button>
                <button
                  onClick={() => handleKeyTap("5")}
                  className="py-2.5 text-sm md:text-base font-black font-mono bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-2xl cursor-pointer"
                >
                  5
                </button>
                <button
                  onClick={() => handleKeyTap("6")}
                  className="py-2.5 text-sm md:text-base font-black font-mono bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-2xl cursor-pointer"
                >
                  6
                </button>
                <button
                  onClick={() => handleKeyTap("C")}
                  className="py-2.5 text-xs font-black bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-rose-500 rounded-2xl cursor-pointer flex items-center justify-center"
                >
                  C
                </button>

                {/* Row 3 and 4 with spanning NEXT button */}
                <div className="col-span-3 grid grid-cols-3 gap-1.5">
                  {/* Row 3 keys */}
                  <button
                    onClick={() => handleKeyTap("1")}
                    className="py-2.5 text-sm md:text-base font-black font-mono bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-2xl cursor-pointer"
                  >
                    1
                  </button>
                  <button
                    onClick={() => handleKeyTap("2")}
                    className="py-2.5 text-sm md:text-base font-black font-mono bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-2xl cursor-pointer"
                  >
                    2
                  </button>
                  <button
                    onClick={() => handleKeyTap("3")}
                    className="py-2.5 text-sm md:text-base font-black font-mono bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-2xl cursor-pointer"
                  >
                    3
                  </button>

                  {/* Row 4 keys */}
                  <button
                    onClick={() => handleKeyTap("0")}
                    className="py-2.5 text-sm md:text-base font-black font-mono bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-2xl cursor-pointer"
                  >
                    0
                  </button>
                  <button
                    onClick={() => handleKeyTap(".")}
                    className="py-2.5 text-sm md:text-base font-black font-mono bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-2xl cursor-pointer"
                  >
                    .
                  </button>
                  <button
                    onClick={() => handleKeyTap("00")}
                    className="py-2.5 text-sm md:text-base font-black font-mono bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-2xl cursor-pointer"
                  >
                    00
                  </button>
                </div>

                {/* Spanned NEXT element */}
                <button
                  onClick={() => handleKeyTap("NEXT")}
                  className={`py-6 text-xs md:text-sm font-black text-white hover:opacity-90 rounded-2xl cursor-pointer transition-all uppercase flex flex-col justify-center items-center shadow-lg gap-1 select-none ${
                    field === "weight" ? "bg-amber-600 shadow-amber-900/30" : "bg-emerald-600 shadow-emerald-900/30"
                  }`}
                >
                  <span>{field === "weight" ? "NEXT" : "SAVE"}</span>
                  <span className="text-[9px] font-bold">{field === "weight" ? "➔" : "✔"}</span>
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// BUYER PICKER DRAWER COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
interface BuyerPickerProps {
  buyers: any[];
  onSelect: (b: any) => void;
  onClose: () => void;
  onAddAndSelect: (name: string) => Promise<void>;
}

const BuyerPicker: React.FC<BuyerPickerProps> = ({ buyers, onSelect, onClose, onAddAndSelect }) => {
  const { write } = useData();
  const [search, setSearch] = useState("");
  const [newBuyerName, setNewBuyerName] = useState("");
  const [adding, setAdding] = useState(false);

  // Rename states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  // Filter buyers
  const filtered = buyers
    .filter((b) => b.nickname.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.nickname.localeCompare(b.nickname));

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBuyerName.trim()) return;
    setAdding(true);
    await onAddAndSelect(newBuyerName.trim());
    setNewBuyerName("");
    setAdding(false);
  };

  const handleSaveRename = async (b: any, nameVal: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!nameVal.trim()) return;
    await write("buyers", "update", {
      ...b,
      nickname: nameVal.trim()
    });
    setEditingId(null);
  };

  return (
    <div className="inset-0 absolute bg-zinc-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-scaleUp">
        
        {/* Header picker segment */}
        <div className="px-5 py-4 bg-gradient-to-b from-zinc-950 to-zinc-900 border-b border-zinc-800 flex justify-between items-center select-none">
          <h3 className="font-extrabold text-sm uppercase tracking-wider text-zinc-200 text-zinc-200">Wholesale Buyers Directory</h3>
          <button
            onClick={onClose}
            className="p-1 px-2 text-[10.5px] font-mono font-bold bg-zinc-950 border border-zinc-805 hover:bg-zinc-800 rounded-2xl text-zinc-400 hover:text-white cursor-pointer select-none"
          >
            ✕ CLOSE
          </button>
        </div>

        {/* Directory search filter box */}
        <div className="px-5 py-3 border-b border-zinc-900 select-none">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Narrow down by buyer name..."
            className="w-full text-xs font-semibold bg-zinc-950 text-zinc-300 p-2.5 rounded-2xl border border-zinc-800 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Scrollable list content */}
        <div className="flex-grow overflow-y-auto p-4 divide-y divide-zinc-800/60">
          {filtered.map((b) => {
            const hasOverLimit = (b.lifetime_debt || 0) >= (b.credit_limit || 100000);
            const isEditingThis = editingId === b.id;
            return (
              <div
                key={b.id}
                onClick={() => {
                  if (!isEditingThis) onSelect(b);
                }}
                className="py-3 px-2 flex justify-between items-center cursor-pointer hover:bg-zinc-800 rounded-2xl transition duration-150 group"
              >
                <div className="flex-grow mr-2">
                  {isEditingThis ? (
                    <div className="flex gap-1.5 items-center mt-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="bg-zinc-950 text-zinc-200 text-xs p-1.5 rounded border border-zinc-800 font-sans w-full"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={(e) => handleSaveRename(b, editingName, e)}
                        className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[9.5px] font-bold rounded"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(null);
                        }}
                        className="px-2 py-1 bg-zinc-800 text-zinc-400 text-[9.5px] rounded"
                      >
                        X
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="text-xs font-extrabold text-zinc-200 text-zinc-200 group-hover:text-amber-500 transition-colors uppercase flex items-center gap-1.5">
                        <span>{b.nickname}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(b.id);
                            setEditingName(b.nickname);
                          }}
                          className="p-1 text-zinc-500 hover:text-zinc-300 text-[9.5px] font-normal lowercase font-sans cursor-pointer"
                          title="Rename this buyer"
                        >
                          ✏️ rename
                        </button>
                      </div>
                      <div className="text-[10px] text-zinc-500 font-mono mt-1 flex items-center gap-2">
                        <span>Owed: <strong>₹{Math.round(b.lifetime_debt || 0).toLocaleString()}</strong></span>
                        <span className="opacity-45">|</span>
                        <span>Limit: ₹{Math.round(b.credit_limit || 100000).toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 select-none shrink-0" onClick={(e) => e.stopPropagation()}>
                  {hasOverLimit && (
                    <span className="text-[8px] bg-red-500/10 border border-red-500/30 text-rose-400 px-1.5 py-0.5 rounded font-mono font-bold tracking-tight uppercase">
                      Debt Limit Reached
                    </span>
                  )}
                  <div
                    onClick={() => {
                      if (!isEditingThis) onSelect(b);
                    }}
                    className="p-1.5 bg-zinc-950 border border-zinc-800 rounded-2xl text-zinc-400 group-hover:text-amber-500 group-hover:border-amber-500/30 transition shadow-inner"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="py-12 text-center text-zinc-500 text-xs font-semibold select-none space-y-4">
              <div>No registered buyer matches "{search}".</div>
              {search.trim().length > 0 && (
                <button
                  type="button"
                  onClick={async () => {
                    const cleanName = search.trim();
                    setAdding(true);
                    await onAddAndSelect(cleanName);
                    setSearch("");
                    setAdding(false);
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-zinc-955 text-xs font-black rounded-2xl transition duration-150 inline-flex items-center gap-1.5 shadow cursor-pointer select-none"
                >
                  ➕ Create & Select "{search.trim()}"
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// EDIT TRANSACTION modal OVERLAY DIALOG
// ─────────────────────────────────────────────────────────────────────────────
interface EditTxnModalProps {
  txn: any;
  buyers: any[];
  onSave: (changes: any) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
  onAddBuyer: (name: string) => Promise<any>;
}

const EditTxnModal: React.FC<EditTxnModalProps> = ({ txn, buyers, onSave, onDelete, onClose, onAddBuyer }) => {
  const [buyerId, setBuyerId] = useState(txn.buyer_id || "");
  const [fishType, setFishType] = useState(txn.fish_type || "");
  const [weight, setWeight] = useState(String(txn.weight || ""));
  const [pricePerKg, setPricePerKg] = useState(String(txn.price_per_kg || ""));
  const [confirmDel, setConfirmDel] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const wNum = parseFloat(weight);
    const pNum = parseFloat(pricePerKg);
    if (!buyerId || isNaN(wNum) || isNaN(pNum) || wNum <= 0 || pNum <= 0) {
      alert("Invalid numeric entries found. Please correct values.");
      return;
    }

    await onSave({
      buyer_id: buyerId,
      fish_type: fishType.trim(),
      weight: wNum,
      price_per_kg: pNum,
      total_price: wNum * pNum,
    });
  };

  return (
    <div className="inset-0 absolute bg-zinc-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col animate-scaleUp text-left"
      >
        <div className="px-5 py-4 bg-gradient-to-b from-zinc-950 to-zinc-900 border-b border-zinc-810 border-b border-zinc-800 flex justify-between items-center select-none">
          <div>
            <h3 className="font-extrabold text-sm uppercase text-zinc-200">Adjust Recorded Sale</h3>
            <p className="text-[10px] text-zinc-500">Edit or delete recorded auction entries</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] font-mono font-bold bg-zinc-950 border border-zinc-805 px-2 py-1 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-2xl cursor-pointer"
          >
            ✕ CANCEL
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Buyer selection */}
          <div className="space-y-1.5">
            <label className="text-[10.5px] font-extrabold text-zinc-500 uppercase font-sans tracking-wider block">Buyer Nickname</label>
            <select
              value={buyerId}
              onChange={(e) => setBuyerId(e.target.value)}
              required
              className="w-full text-xs text-zinc-200 text-zinc-200 bg-zinc-950 border border-zinc-800 rounded-2xl p-3 outline-none focus:ring-1 focus:ring-amber-500"
            >
              {buyers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nickname}
                </option>
              ))}
            </select>
          </div>

          {/* Crate selection */}
          <div className="space-y-1.5">
            <label className="text-[10.5px] font-extrabold text-zinc-500 uppercase font-sans tracking-wider block">Crate Name / No.</label>
            <input
              type="text"
              value={fishType}
              onChange={(e) => setFishType(e.target.value)}
              className="w-full text-xs text-zinc-200 bg-zinc-950 border border-zinc-800 rounded-2xl p-3 outline-none focus:ring-1 focus:ring-amber-500"
              placeholder="Enter Crate Name or Number"
            />
          </div>

          {/* Weight and bid rate inputs */}
          <div className="grid grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="text-[10.5px] font-extrabold text-zinc-500 uppercase font-sans tracking-wider block">Weight (kg)</label>
              <input
                type="text"
                value={weight}
                onChange={(e) => setWeight(e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="0.0"
                required
                className="w-full text-xs text-zinc-200 bg-zinc-950 border border-zinc-800 rounded-2xl p-3 outline-none focus:ring-1 focus:ring-amber-500 font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10.5px] font-extrabold text-zinc-500 uppercase font-sans tracking-wider block">Rate per kg (₹)</label>
              <input
                type="text"
                value={pricePerKg}
                onChange={(e) => setPricePerKg(e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="0"
                required
                className="w-full text-xs text-zinc-200 bg-zinc-950 border border-zinc-800 rounded-2xl p-3 outline-none focus:ring-1 focus:ring-amber-500 font-mono"
              />
            </div>
          </div>

          {/* Calculated summary values */}
          <div className="bg-zinc-950/60 border border-zinc-800 p-3 rounded-2xl flex justify-between items-center text-xs font-mono select-none">
            <span className="text-zinc-500">Recalculated Aggregate:</span>
            <span className="font-extrabold text-emerald-500 text-emerald-400">
              {fmt((parseFloat(weight) || 0) * (parseFloat(pricePerKg) || 0))}
            </span>
          </div>
        </div>

        {/* Dialog footer controller actions */}
        <div className="px-5 py-4 bg-zinc-950 border-t border-zinc-800 flex flex-col sm:flex-row gap-2 select-none justify-between items-center">
          {/* Delete triggers */}
          {!confirmDel ? (
            <button
              type="button"
              onClick={() => setConfirmDel(true)}
              className="w-full sm:w-auto px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500 hover:text-white border border-rose-900/30 text-rose-400 rounded-2xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1 shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Record</span>
            </button>
          ) : (
            <div className="flex gap-1.5 items-center w-full sm:w-auto">
              <span className="text-[9.5px] text-rose-400 animate-pulse font-bold tracking-tight uppercase">Confirm deletion?</span>
              <button
                type="button"
                onClick={onDelete}
                className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-[10.5px] font-extrabold cursor-pointer transition"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmDel(false)}
                className="px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-2xl text-[10.5px] font-bold cursor-pointer transition"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Commit update button */}
          <button
            type="submit"
            className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl text-xs tracking-wider cursor-pointer font-sans"
          >
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
};
