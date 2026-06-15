/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useData } from "./DataContext";
import { User as DbUser } from "../db";
import {
  PlusCircle,
  Landmark,
  CheckCircle,
  Clock,
  User,
  ShieldCheck,
  Percent,
  RefreshCw,
  TrendingDown,
  Calculator,
  Search,
  CheckSquare,
  AlertCircle
} from "lucide-react";

import { triggerHaptic } from "../utils/haptics";

interface CollectPanelProps {
  activeUser: DbUser | null;
  isAuthenticated: boolean;
}

export const CollectPanel: React.FC<CollectPanelProps> = ({
  activeUser,
  isAuthenticated,
}) => {
  const { data, write, appDate } = useData();

  const [showForm, setShowForm] = useState(true); // default to open for direct floor use
  const [showNumpad, setShowNumpad] = useState(false);
  const [showCashCalc, setShowCashCalc] = useState(false);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  // Ledger search for existing list
  const [ledgerSearch, setLedgerSearch] = useState("");

  // Form states
  const [buyerId, setBuyerId] = useState("");
  const [amountPaidInput, setAmountPaidInput] = useState("");
  const [collectionDate, setCollectionDate] = useState(appDate);

  // Sync collectionDate with appDate when appDate changes
  React.useEffect(() => {
    setCollectionDate(appDate);
  }, [appDate]);
  const [editingCollectionId, setEditingCollectionId] = useState<string | number | null>(null);
  const [isSuccessAnimated, setIsSuccessAnimated] = useState(false);

  // Fast scroll to letter
  const scrollToLetter = (letter: string) => {
    const el = document.getElementById(`buyer-letter-${letter}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  
  // Cash Denomination Calculator states
  const [notes500, setNotes500] = useState("");
  const [notes200, setNotes200] = useState("");
  const [notes100, setNotes100] = useState("");
  const [notes50, setNotes50] = useState("");
  const [notes20, setNotes20] = useState("");
  const [notes10, setNotes10] = useState("");

  const buyers = data?.buyers || [];
  const collections = data?.daily_collections || [];
  
  // Determine who bought today
  const transactions = data?.transactions || [];
  const todayBuyerIds = new Set(transactions.filter(t => t.date === appDate).map(t => String(t.buyer_id)));

  // Calculate cash calc total
  const calculatedCashTotal =
    (Number(notes500) || 0) * 500 +
    (Number(notes200) || 0) * 200 +
    (Number(notes100) || 0) * 100 +
    (Number(notes50) || 0) * 50 +
    (Number(notes20) || 0) * 20 +
    (Number(notes10) || 0) * 10;

  const handleApplyCashTotal = () => {
    setAmountPaidInput(calculatedCashTotal.toString());
    setShowCashCalc(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buyerId || !amountPaidInput) {
      alert("Please fill in the collection amount and select a buyer.");
      return;
    }

    const payAmount = parseFloat(amountPaidInput);
    if (isNaN(payAmount) || payAmount <= 0) {
      alert("Please enter a valid monetary amount.");
      return;
    }

    const selectedBuyer = buyers.find((b) => b.id === buyerId);
    if (!selectedBuyer) return;

    if (editingCollectionId) {
      // Modifying an existing collection ledger row
      const oldCol = collections.find((c) => c.id === editingCollectionId);
      if (oldCol) {
        const updatedCollection = {
          ...oldCol,
          amount_paid: payAmount,
          date: collectionDate,
          created_at: oldCol.created_at || new Date().toLocaleString(),
        };
        await write("daily_collections", "update", updatedCollection);
      }
      setEditingCollectionId(null);
    } else {
      // Find if an unapproved collection for this buyer already exists today on this date
      const existingDraft = collections.find(
        (c) => String(c.buyer_id) === String(buyerId) && c.date === collectionDate && !c.is_approved
      );
      if (existingDraft) {
        const updated = {
          ...existingDraft,
          amount_paid: payAmount,
          created_at: existingDraft.created_at || new Date().toLocaleString(),
        };
        await write("daily_collections", "update", updated);
      } else {
        const newCollection = {
          id: `temp_col_${Date.now()}`,
          buyer_id: buyerId,
          date: collectionDate,
          total_owed_today: selectedBuyer.lifetime_debt,
          amount_paid: payAmount,
          is_rolled_over: false,
          is_approved: false, // requires admin approval to reduce debtor account
          created_at: new Date().toLocaleString(),
        };
        await write("daily_collections", "insert", newCollection);
      }
    }
    
    triggerHaptic('success');
    setIsSuccessAnimated(true);
    setTimeout(() => setIsSuccessAnimated(false), 500);

    // Reset Form
    setBuyerId("");
    setAmountPaidInput("");
    setSearchQuery("");
    setShowForm(true);
    setShowNumpad(false);
  };

  const handleApprove = async (colId: string | number) => {
    if (!activeUser || !isAuthenticated || activeUser.role !== "admin") {
      alert("Only an authenticated Administrator operator can approve daily collection sheets!");
      return;
    }

    const col = collections.find((c) => String(c.id) === String(colId));
    if (!col) return;

    // Reduce buyer lifetime debt
    const buyer = buyers.find((b) => String(b.id) === String(col.buyer_id));
    if (buyer) {
      const updatedBuyer = {
        ...buyer,
        lifetime_debt: Math.max(0, (buyer.lifetime_debt || 0) - (col.amount_paid || 0)),
      };
      await write("buyers", "update", updatedBuyer);
    }

    // Update approval status
    const updatedCollection = {
      ...col,
      is_approved: true,
    };
    await write("daily_collections", "update", updatedCollection);
  };

  const handleRollover = async (colId: string | number) => {
    const col = collections.find((c) => c.id === colId);
    if (!col) return;

    const updated = {
      ...col,
      is_rolled_over: !col.is_rolled_over,
    };
    await write("daily_collections", "update", updated);
  };

  const handleDeleteDraft = async (colId: string | number) => {
    if (!activeUser || !isAuthenticated || activeUser.role !== "admin") {
      alert("Only authenticated Administrators can prune drafts.");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this collection draft?")) return;
    await write("daily_collections", "delete", { id: colId });
  };

  const isAuthorizedToLog = isAuthenticated && (activeUser?.role === "admin" || activeUser?.role === "collector");
  const isAdmin = isAuthenticated && activeUser?.role === "admin";

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="space-y-6"
    >
      {/* Overview summaries - Compact Single Box */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-3 shadow-md">
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-zinc-800/60">
          
          {/* Approved Collections Column */}
          <div className="flex items-center space-x-3 pb-3 md:pb-0 md:pr-4">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl shrink-0">
              <CheckSquare className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="text-[9px] text-[#22c55e] font-sans font-black uppercase tracking-wider">
                Approved Collections
              </div>
              <div className="text-sm font-black font-mono text-emerald-400 mt-0.5 leading-none">
                ₹ {collections.filter(c => c.is_approved).reduce((sum, c) => sum + (c.amount_paid || 0), 0).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Unapproved / Drafts Column */}
          <div className="flex items-center justify-between py-3 md:py-0 md:px-5">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-xl shrink-0">
                <Clock className="w-4.5 h-4.5 animate-pulse" />
              </div>
              <div>
                <div className="text-[9px] text-amber-550 text-amber-500 font-sans font-black uppercase tracking-wider flex items-center gap-1.5">
                  Unapproved Drafts
                </div>
                <div className="text-sm font-black font-mono text-amber-500 mt-0.5 leading-none">
                  ₹ {collections.filter(c => !c.is_approved).reduce((sum, c) => sum + (c.amount_paid || 0), 0).toLocaleString()}
                </div>
              </div>
            </div>
            <span className="text-[8.5px] font-bold font-mono bg-amber-950/40 text-amber-450 text-amber-400 border border-amber-900/40 px-2 py-0.5 rounded-full uppercase leading-none">
              {collections.filter(c => !c.is_approved).length} Drafts
            </span>
          </div>

          {/* Outstanding Balance Column */}
          <div className="flex items-center space-x-3 pt-3 md:pt-0 md:pl-5">
            <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl shrink-0">
              <Landmark className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="text-[9px] text-[#6366f1] font-sans font-black uppercase tracking-wider">
                Outstanding Balance
              </div>
              <div className="text-sm font-black font-mono text-indigo-400 mt-0.5 leading-none">
                ₹ {buyers.reduce((sum, b) => sum + (b.lifetime_debt || 0), 0).toLocaleString()}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Main Operations Block: Logging Box & Pending Receipts Grid */}
      <div className="flex flex-col gap-6 w-full">
        
        {/* Collection Form Panel - Full width */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 shadow-2xl shadow-black/10 space-y-4 w-full">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <h3 className="text-xs font-sans font-extrabold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
              <Landmark className="w-4 h-4 text-teal-400" /> Book Client Cash Collections
            </h3>
            {isAuthorizedToLog && (
              <button
                type="button"
                onClick={() => {
                  setBuyerId("");
                  setAmountPaidInput("");
                  setEditingCollectionId(null);
                  setSearchQuery("");
                }}
                className="text-[10px] uppercase font-mono tracking-wider font-bold text-teal-400 hover:underline cursor-pointer"
              >
                Reset Clear
              </button>
            )}
          </div>

          {!isAuthorizedToLog ? (
            <div className="p-4 bg-zinc-900/20 border border-zinc-800 rounded-2xl text-center text-xs text-zinc-555 text-zinc-400 font-medium">
              🔒 Locked Operator Account. Please authorize your collector or administrator PIN first.
            </div>
          ) : (
            <div className="space-y-4 font-sans">
              
              {/* Note about active role */}
              <div className="text-[9.5px] uppercase font-mono text-zinc-500 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-500" /> Stamped Operator: {activeUser?.name} ({activeUser?.role})
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                
                {/* Search / Selection input block */}
                {!buyerId ? (
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between items-center">
                      <label className="text-zinc-400 block font-bold">Search Debtor Account:</label>
                      <span className="text-[9.5px] text-zinc-500 uppercase font-mono">Alphabetic Order</span>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Type client's name or nickname..."
                        className="w-full text-xs text-zinc-200 bg-zinc-900 border border-zinc-800 rounded-2xl p-3 pl-9 focus:outline-none focus:ring-1 focus:ring-teal-500"
                      />
                      <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-3.5" />
                    </div>

                    {/* Filtered buyers list with touch selectors */}
                    <div className="relative">
                      <div className="space-y-1.5 max-h-[300px] overflow-y-auto border border-zinc-800 rounded-2xl p-2 bg-zinc-950/40 pr-6 custom-scrollbar" id="buyers-scroll-container">
                        {buyers
                          .filter((b) => searchQuery === "" || b.nickname.toLowerCase().includes(searchQuery.toLowerCase()))
                          .sort((a, b) => {
                             const aToday = todayBuyerIds.has(String(a.id));
                             const bToday = todayBuyerIds.has(String(b.id));
                             if (aToday && !bToday) return -1;
                             if (!aToday && bToday) return 1;
                             return a.nickname.localeCompare(b.nickname);
                          })
                          .map((b, index, arr) => {
                             const isFirstOfInitial = index === 0 || b.nickname[0].toUpperCase() !== arr[index - 1].nickname[0].toUpperCase();
                             const isToday = todayBuyerIds.has(String(b.id));

                             return (
                               <React.Fragment key={b.id}>
                                 {isFirstOfInitial && !isToday && (
                                   <div id={`buyer-letter-${b.nickname[0].toUpperCase()}`} className="px-2 py-1 text-zinc-500 font-bold text-[10px] mt-2">
                                     {b.nickname[0].toUpperCase()}
                                   </div>
                                 )}
                                 <button
                                   type="button"
                                   onClick={() => {
                                     setBuyerId(String(b.id));
                                     setSearchQuery("");
                                   }}
                                   className={`w-full text-left p-2.5 rounded-2xl transition flex justify-between items-center border ${
                                      isToday ? "bg-teal-900/20 border-teal-800/30 hover:bg-teal-900/30" : "bg-transparent border-transparent hover:bg-zinc-900 hover:border-zinc-800"
                                   }`}
                                 >
                                   <div className="flex flex-col">
                                     <span className="text-xs font-bold text-zinc-200 truncate pr-2 flex items-center gap-2">
                                       {b.nickname}
                                       {isToday && <span className="bg-teal-500 text-teal-950 text-[8px] px-1.5 font-bold rounded-sm uppercase tracking-wider">Today</span>}
                                     </span>
                                   </div>
                                   <span className="text-[10px] font-mono text-teal-500 text-zinc-400 shrink-0 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                                     Owed: ₹{b.lifetime_debt.toLocaleString()}
                                   </span>
                                 </button>
                               </React.Fragment>
                             );
                          })}
                        {buyers.filter((b) => searchQuery === "" || b.nickname.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                          <div className="text-center py-6 text-[11px] text-zinc-500 font-medium">
                            No matching active debtors found.
                          </div>
                        )}
                      </div>
                      
                      {/* A-Z fast scroller */}
                      <div className="absolute right-1 top-0 bottom-0 flex flex-col justify-center text-[7px] font-bold text-zinc-500 gap-0.5">
                        {Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ").map(letter => (
                          <div 
                            key={letter} 
                            onClick={() => scrollToLetter(letter)}
                            className="cursor-pointer hover:text-teal-400 text-center px-1 py-0.5"
                          >
                            {letter}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  (() => {
                    const selectedBuyer = buyers.find((b) => String(b.id) === String(buyerId));
                    if (!selectedBuyer) return null;
                    return (
                      <div className="p-3.5 bg-zinc-900/60 border border-zinc-800 rounded-2xl space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold">Selected Buyer Account</span>
                            <div className="text-xs font-black text-zinc-100">{selectedBuyer.nickname}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setBuyerId("");
                              setAmountPaidInput("");
                              setEditingCollectionId(null);
                              setShowNumpad(false);
                            }}
                            className="px-2 py-1 text-[9.5px] uppercase font-mono font-bold bg-zinc-950 border border-zinc-800 hover:bg-zinc-800 text-rose-400 rounded cursor-pointer transition"
                          >
                            Change
                          </button>
                        </div>
                        <div className="flex justify-between items-center text-xs border-t border-zinc-800/40 pt-2">
                          <span className="text-zinc-400">Total Outstanding Debt:</span>
                          <span className="font-mono font-black text-rose-400">₹{(selectedBuyer.lifetime_debt || 0).toLocaleString()}</span>
                        </div>

                        <div className="flex justify-between items-center text-xs border-t border-zinc-800/40 pt-2 pb-1">
                          <span className="text-zinc-400 font-sans">Payment Allocation:</span>
                          <span className={`font-sans font-extrabold text-[9.5px] px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                            parseFloat(amountPaidInput) === selectedBuyer.lifetime_debt
                              ? "bg-sky-950/80 text-sky-400 border border-sky-900/40"
                              : parseFloat(amountPaidInput) > 0
                              ? "bg-teal-950/80 text-teal-400 border border-teal-900/45 animate-pulse"
                              : "bg-zinc-900 text-zinc-500 border border-zinc-800"
                          }`}>
                            {parseFloat(amountPaidInput) === selectedBuyer.lifetime_debt
                              ? "⚡ Full Payment"
                              : parseFloat(amountPaidInput) > 0
                              ? "💸 Partial Payment"
                              : "⏳ Awaiting Entry"}
                          </span>
                        </div>

                        {/* Full & Partial Payment buttons layout */}
                        <div className="grid grid-cols-1 gap-2 pt-1">
                          
                          {/* Active Editing / Entry indicator */}
                          {editingCollectionId && (
                            <div className="bg-sky-950/40 border border-sky-900/35 p-2 rounded-2xl text-[10px] text-sky-305 text-center font-bold">
                              ✏️ Modifying Draft ID #{String(editingCollectionId).substring(0, 8)}
                            </div>
                          )}

                          {/* Partial Payment button (Larger button as requested) */}
                          <button
                            type="button"
                            onClick={() => {
                              setShowNumpad(true);
                              setShowCashCalc(false);
                            }}
                            className={`w-full py-3 px-4 font-sans font-bold text-xs rounded-2xl flex items-center justify-center gap-2 border transition cursor-pointer ${
                              showNumpad
                                ? "bg-teal-600 border-teal-500 text-white shadow-md bg-teal-600"
                                : "bg-zinc-900 border-zinc-800 text-zinc-200 hover:bg-zinc-800"
                            }`}
                          >
                            <Calculator className="w-4 h-4 text-teal-400" />
                            <span>Partial Payment (Touch Keypad)</span>
                          </button>

                          {/* Full Payment button (Smaller button, placed under partial payment) */}
                          {selectedBuyer.lifetime_debt > 0 && (
                            <div className="flex justify-center pt-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setAmountPaidInput(selectedBuyer.lifetime_debt.toString());
                                  setShowNumpad(false);
                                }}
                                className="py-1 px-2.5 text-[10px] font-sans font-extrabold uppercase bg-sky-950/30 border border-sky-900/35 text-sky-455 text-sky-400 hover:bg-sky-950/60 rounded-2xl cursor-pointer transition flex items-center gap-1 shrink-0"
                              >
                                <span>Full Payment: ₹{selectedBuyer.lifetime_debt.toLocaleString()}</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()
                )}

                {/* Amount Paid text box display + Device recorded date box */}
                <div className="grid grid-cols-2 gap-3 items-end">
                  
                  {/* Device captured date - strictly automatic */}
                  <div className="space-y-1.5 text-xs">
                    <label className="text-zinc-400 block font-bold">Device Date Stamps:</label>
                    <div className="w-full text-xs text-emerald-500 text-emerald-400 bg-zinc-900 border border-emerald-900/10 rounded-2xl p-3 font-mono font-bold select-none text-center">
                      ⚡ {collectionDate}
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs relative">
                    <label className="text-zinc-400 block font-bold">Amount Paid (₹):</label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                           if (buyerId) {
                             setShowNumpad(!showNumpad);
                             setShowCashCalc(false);
                           }
                        }}
                        className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white transition cursor-pointer"
                        title="Toggle Keypad"
                      >
                        ⌨️
                      </button>
                      <input
                        type="text"
                        value={amountPaidInput}
                        onChange={(e) => {
                          const parsed = e.target.value.replace(/\D/g, "");
                          setAmountPaidInput(parsed);
                          if (parsed && !showNumpad) {
                            setShowNumpad(true);
                          }
                        }}
                        onFocus={() => {
                          if (buyerId) {
                            setShowNumpad(true);
                            setShowCashCalc(false);
                          } else {
                            alert("Please select or search a buyer first.");
                          }
                        }}
                        placeholder="INR Amount"
                        className="w-full text-xs text-zinc-200 bg-zinc-900 border border-zinc-800 rounded-2xl py-3 pr-3 pl-10 focus:outline-none focus:ring-1 focus:ring-teal-500 font-mono text-right font-bold"
                        required
                        disabled={!buyerId}
                      />
                    </div>
                  </div>
                </div>

                {/* Auxiliary Helpers Toggle row */}
                {buyerId && (
                  <div className="flex gap-2 justify-end text-[10px]">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCashCalc(!showCashCalc);
                        setShowNumpad(false);
                      }}
                      className="px-2.5 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-indigo-400 border border-indigo-900/40 font-mono font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Calculator className="w-3.5 h-3.5" /> India Note Counter
                    </button>

                    {showNumpad && (
                      <button
                        type="button"
                        onClick={() => setShowNumpad(false)}
                        className="px-2.5 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-zinc-800 font-mono cursor-pointer"
                      >
                        Hide Pad
                      </button>
                    )}
                  </div>
                )}

                {/* India Note Counter block */}
                {showCashCalc && buyerId && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="p-3.5 bg-indigo-950/20 border border-indigo-900/30 rounded-2xl space-y-3 font-mono text-[11px]"
                  >
                    <div className="flex justify-between items-center text-xs font-sans font-bold text-zinc-200">
                      <span>Physical Cash Drawer Note Counter</span>
                      <span className="text-indigo-400">INR denominations</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="w-10 text-zinc-500 text-[10px]">₹500:</span>
                        <input
                          type="text"
                          value={notes500}
                          onChange={(e) => setNotes500(e.target.value.replace(/\D/g, ""))}
                          className="w-full text-xs text-zinc-200 bg-zinc-900 border border-zinc-800 rounded p-1 text-center font-mono"
                          placeholder="qty"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-10 text-zinc-500 text-[10px]">₹200:</span>
                        <input
                          type="text"
                          value={notes200}
                          onChange={(e) => setNotes200(e.target.value.replace(/\D/g, ""))}
                          className="w-full text-xs text-zinc-200 bg-zinc-900 border border-zinc-855 rounded p-1 text-center font-mono"
                          placeholder="qty"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-10 text-zinc-500 text-[10px]">₹100:</span>
                        <input
                          type="text"
                          value={notes100}
                          onChange={(e) => setNotes100(e.target.value.replace(/\D/g, ""))}
                          className="w-full text-xs text-zinc-200 bg-zinc-900 border border-zinc-800 rounded p-1 text-center font-mono"
                          placeholder="qty"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-10 text-zinc-500 text-[10px]">₹50:</span>
                        <input
                          type="text"
                          value={notes50}
                          onChange={(e) => setNotes50(e.target.value.replace(/\D/g, ""))}
                          className="w-full text-xs text-zinc-200 bg-zinc-900 border border-zinc-805 rounded p-1 text-center font-mono"
                          placeholder="qty"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-10 text-zinc-500 text-[10px]">₹20:</span>
                        <input
                          type="text"
                          value={notes20}
                          onChange={(e) => setNotes20(e.target.value.replace(/\D/g, ""))}
                          className="w-full text-xs text-zinc-200 bg-zinc-900 border border-zinc-800 rounded p-1 text-center font-mono"
                          placeholder="qty"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-10 text-zinc-500 text-[10px]">₹10:</span>
                        <input
                          type="text"
                          value={notes10}
                          onChange={(e) => setNotes10(e.target.value.replace(/\D/g, ""))}
                          className="w-full text-xs text-zinc-200 bg-zinc-900 border border-zinc-800 rounded p-1 text-center font-mono"
                          placeholder="qty"
                        />
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-indigo-950 text-xs">
                      <span className="font-sans font-bold text-zinc-400">Drawer Sum:</span>
                      <span className="font-extrabold text-teal-400 font-mono">₹{calculatedCashTotal.toLocaleString()}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setNotes500("");
                          setNotes200("");
                          setNotes100("");
                          setNotes50("");
                          setNotes20("");
                          setNotes10("");
                        }}
                        className="py-1 bg-zinc-900 hover:bg-zinc-800 rounded text-zinc-400 font-sans cursor-pointer text-[10px]"
                      >
                        Reset Counts
                      </button>
                      <button
                        type="button"
                        onClick={handleApplyCashTotal}
                        disabled={calculatedCashTotal <= 0}
                        className="py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-sans font-bold cursor-pointer text-[10px]"
                      >
                        Apply Counter Sum
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Fixed Numpad for amount paid input if toggled */}
                {showNumpad && buyerId && (
                  <motion.div 
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="fixed bottom-0 left-0 right-0 z-50 p-3 bg-zinc-900 border-t-2 border-zinc-800 shadow-[0_-10px_40px_rgba(0,0,0,0.8)] pb-8"
                  >
                    <div className="w-full max-w-sm mx-auto space-y-2">
                       <div className="flex justify-between items-center mb-1 bg-zinc-950 p-2 rounded-xl text-xs">
                          <span className="font-mono text-zinc-500 font-bold uppercase tracking-widest pl-2">Amount</span>
                          <div className="font-mono font-black text-teal-400 text-lg mr-2">{amountPaidInput || "0.00"}</div>
                       </div>
                       
                       {/* Highly tactile specialized mobile numpad layout */}
                       <div className="grid grid-cols-4 gap-1.5 shrink-0 select-none animate-fadeIn">
                         {/* Row 1 */}
                         <button onClick={() => setAmountPaidInput(prev => prev + "7")} type="button" className="py-2.5 text-sm md:text-base font-black font-mono bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-2xl cursor-pointer">7</button>
                         <button onClick={() => setAmountPaidInput(prev => prev + "8")} type="button" className="py-2.5 text-sm md:text-base font-black font-mono bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-2xl cursor-pointer">8</button>
                         <button onClick={() => setAmountPaidInput(prev => prev + "9")} type="button" className="py-2.5 text-sm md:text-base font-black font-mono bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-2xl cursor-pointer">9</button>
                         <button onClick={() => setAmountPaidInput(prev => prev.slice(0, -1))} type="button" className="py-2.5 text-sm font-extrabold bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-rose-500 rounded-2xl cursor-pointer flex items-center justify-center font-mono">⌫</button>
                         
                         {/* Row 2 */}
                         <button onClick={() => setAmountPaidInput(prev => prev + "4")} type="button" className="py-2.5 text-sm md:text-base font-black font-mono bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-2xl cursor-pointer">4</button>
                         <button onClick={() => setAmountPaidInput(prev => prev + "5")} type="button" className="py-2.5 text-sm md:text-base font-black font-mono bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-2xl cursor-pointer">5</button>
                         <button onClick={() => setAmountPaidInput(prev => prev + "6")} type="button" className="py-2.5 text-sm md:text-base font-black font-mono bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-2xl cursor-pointer">6</button>
                         <button onClick={() => setAmountPaidInput("")} type="button" className="py-2.5 text-xs font-black bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-rose-500 rounded-2xl cursor-pointer flex items-center justify-center">C</button>
                         
                         {/* Row 3 and 4 with spanning NEXT button */}
                         <div className="col-span-3 grid grid-cols-3 gap-1.5">
                           <button onClick={() => setAmountPaidInput(prev => prev + "1")} type="button" className="py-2.5 text-sm md:text-base font-black font-mono bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-2xl cursor-pointer">1</button>
                           <button onClick={() => setAmountPaidInput(prev => prev + "2")} type="button" className="py-2.5 text-sm md:text-base font-black font-mono bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-2xl cursor-pointer">2</button>
                           <button onClick={() => setAmountPaidInput(prev => prev + "3")} type="button" className="py-2.5 text-sm md:text-base font-black font-mono bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-2xl cursor-pointer">3</button>
                           
                           <button onClick={() => setAmountPaidInput(prev => prev + "0")} type="button" className="py-2.5 text-sm md:text-base font-black font-mono bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-2xl cursor-pointer">0</button>
                           <button onClick={() => { if(!amountPaidInput.includes(".")) setAmountPaidInput(prev => prev + "."); }} type="button" className="py-2.5 text-sm md:text-base font-black font-mono bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-2xl cursor-pointer">.</button>
                           <button onClick={() => setAmountPaidInput(prev => prev + "00")} type="button" className="py-2.5 text-sm md:text-base font-black font-mono bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-2xl cursor-pointer">00</button>
                         </div>
                         
                         {/* Spanned NEXT element */}
                         <button onClick={() => setShowNumpad(false)} type="button" className="py-6 text-xs md:text-sm font-black text-white hover:opacity-90 rounded-2xl cursor-pointer transition-all uppercase flex flex-col justify-center items-center shadow-lg gap-1 select-none bg-emerald-600 shadow-emerald-900/30">
                           <span>APPLY</span>
                           <span className="text-[9px] font-bold">✔</span>
                         </button>
                       </div>
                    </div>
                  </motion.div>
                )}

                {buyerId && (
                  <motion.button
                    type="submit"
                    whileTap={{ scale: 0.96 }}
                    animate={
                      isSuccessAnimated 
                        ? { scale: [1, 1.05, 1], rotate: [0, -2, 2, 0] }
                        : {}
                    }
                    transition={{ duration: 0.3 }}
                    className={`w-full py-3.5 rounded-2xl text-white font-sans font-bold text-xs shadow-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 relative overflow-hidden ${
                      isSuccessAnimated ? 'bg-teal-500 shadow-teal-900/40' : 'bg-teal-600 hover:bg-teal-700 shadow-teal-900/20'
                    }`}
                  >
                    <AnimatePresence>
                    {isSuccessAnimated && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 2 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.4 }}
                        className="absolute inset-0 bg-white/25 rounded-2xl pointer-events-none"
                      />
                    )}
                    </AnimatePresence>
                    <PlusCircle className="w-4 h-4 relative z-10" />
                    <span className="relative z-10">{isSuccessAnimated ? "Saved Successfully!" : editingCollectionId ? "Modify Collection Draft" : "Book Collection Draft"}</span>
                  </motion.button>
                )}
              </form>
            </div>
          )}
        </div>

        {/* Collections Ledger Audit List - Full width */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 shadow-2xl shadow-black/10 space-y-4 w-full">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-zinc-800 gap-2.5">
            <div className="space-y-0.5">
              <h3 className="text-xs font-sans font-extrabold uppercase tracking-wider text-zinc-300">
                Collections Audit & Approvals
              </h3>
              <p className="text-[10px] text-zinc-500">
                Outstanding cash receipts queued in system ledger
              </p>
            </div>
            
            {/* Search option on the collection history ledger list too */}
            <div className="relative">
              <input
                type="text"
                value={ledgerSearch}
                onChange={(e) => setLedgerSearch(e.target.value)}
                placeholder="Search ledger..."
                className="text-[10px] text-zinc-200 bg-zinc-900 border border-zinc-800 rounded-2xl p-1.5 pl-7 focus:outline-none focus:ring-1 focus:ring-teal-500 w-full sm:w-40 font-sans"
              />
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2 top-2" />
            </div>
          </div>

          {collections.length === 0 ? (
            <div className="text-center py-20 bg-zinc-900/20 rounded-2xl border border-dashed border-zinc-800 text-zinc-500 text-xs text-zinc-400">
              No collection logs registered in the physical database yet.
            </div>
          ) : (
            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
              <AnimatePresence initial={false}>
                {collections
                  .filter((col) => {
                    if (!ledgerSearch) return true;
                    const buyer = buyers.find((b) => String(b.id) === String(col.buyer_id));
                    return buyer?.nickname.toLowerCase().includes(ledgerSearch.toLowerCase());
                  })
                  .map((col) => {
                    const buyer = buyers.find((b) => String(b.id) === String(col.buyer_id));
                    return (
                      <motion.div
                        key={col.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        className="bg-zinc-950/40 border border-zinc-800 p-3 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 font-sans"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-zinc-200">
                              {buyer ? buyer.nickname : "Unknown Buyer ID"}
                            </span>
                            {col.is_approved ? (
                              <span className="text-[9px] bg-emerald-950/50 text-emerald-400 border border-emerald-900/40 px-1.5 py-0.5 rounded-full uppercase font-mono font-bold">
                                Approved
                              </span>
                            ) : (
                              <span className="text-[9px] bg-amber-950/50 text-amber-500 border border-amber-900/30 px-1.5 py-0.5 rounded-full uppercase font-mono font-semibold animate-pulse">
                                Pending Approval
                              </span>
                            )}
                          </div>

                          <div className="text-[10px] text-zinc-500 font-mono flex flex-wrap gap-x-2">
                            <span>Date: {col.date}</span>
                            {col.created_at && (
                              <>
                                <span>•</span>
                                <span className="text-teal-500">Time: {col.created_at}</span>
                              </>
                            )}
                            <span>•</span>
                            <span>Draft ID: #{String(col.id).substring(0, 8)}</span>
                          </div>

                          <div className="text-[11px] font-bold text-zinc-400">
                            Amount Paid: <span className="text-teal-400 font-mono font-black">₹{(col.amount_paid || 0).toLocaleString()}</span>
                          </div>
                        </div>

                        {/* Approvals and Rollovers triggers */}
                        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                          {/* Approve receipt (only Admin role can confirm) */}
                          {!col.is_approved ? (
                            <>
                              {/* Edit draft (Collector/operator can edit) */}
                              <button
                                onClick={() => {
                                  setBuyerId(String(col.buyer_id));
                                  setAmountPaidInput(String(col.amount_paid));
                                  setCollectionDate(col.date);
                                  setEditingCollectionId(col.id);
                                  setShowForm(true);
                                  setShowNumpad(true);
                                }}
                                className="px-2.5 py-1.5 rounded-2xl text-[10px] font-bold bg-indigo-950/40 border border-indigo-900/40 text-indigo-400 hover:bg-indigo-950/80 transition cursor-pointer"
                                title="Edit booked cash amount"
                              >
                                Edit
                              </button>

                              <button
                                onClick={() => handleApprove(col.id)}
                                className={`px-2.5 py-1.5 rounded-2xl text-[10px] font-bold flex items-center gap-1 cursor-pointer transition ${
                                  isAdmin
                                    ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                                    : "bg-zinc-900 border border-zinc-800 text-zinc-500 cursor-not-allowed"
                                }`}
                                title={isAdmin ? "Approve cash & deduct debtor balance" : "Admin credentials required to clear receipt"}
                              >
                                <CheckCircle className="w-3.5 h-3.5" /> Approve
                              </button>
                              {isAdmin && (
                                <button
                                  onClick={() => handleDeleteDraft(col.id)}
                                  className="px-2 py-1.5 rounded-2xl text-[10px] bg-zinc-900 hover:bg-rose-950/30 text-zinc-500 hover:text-rose-400 border border-zinc-800 hover:border-rose-900/40 transition cursor-pointer"
                                >
                                  Prune
                                </button>
                              )}
                            </>
                          ) : (
                            <div className="text-[10px] text-emerald-400/80 font-mono flex items-center gap-0.5 bg-emerald-950/10 px-2 py-1 border border-emerald-900/30 rounded-2xl">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Settled Cloud Log
                            </div>
                          )}

                          {/* Rollover trigger */}
                          <button
                            onClick={() => handleRollover(col.id)}
                            className={`px-2 py-1.5 rounded-2xl text-[10px] font-bold border transition ${
                              col.is_rolled_over
                                ? "bg-indigo-950/30 text-indigo-400 border-indigo-900/50 hover:bg-indigo-950/50"
                                : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-white"
                            } cursor-pointer`}
                          >
                            {col.is_rolled_over ? "Rolled Over" : "Rollover"}
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
              </AnimatePresence>
            </div>
          )}
        </div>

      </div>
    </motion.div>
  );
};
