/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useData } from "./DataContext";
import { User as DbUser } from "../db";
import {
  FileText,
  Printer,
  ChevronRight,
  TrendingDown,
  User,
  Activity,
  Award,
  BookOpen,
  ShoppingBag,
  Landmark,
  BadgeAlert,
  ArrowDownCircle,
  ArrowUpCircle,
  Calendar,
  Key,
  Lock,
  Unlock,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  Percent,
  Search
} from "lucide-react";

interface HalkhataPanelProps {
  activeUser: DbUser | null;
  isAuthenticated: boolean;
}

export const HalkhataPanel: React.FC<HalkhataPanelProps> = ({
  activeUser,
  isAuthenticated,
}) => {
  const { data, write, appDate, setAppDate } = useData();
  const [selectedBuyerId, setSelectedBuyerId] = useState("");
  const [isPrinting, setIsPrinting] = useState(false);
  const [showCloseDaySection, setShowCloseDaySection] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState("");

  const [buyerSearchQuery, setBuyerSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const buyers = data?.buyers || [];

  // Synchronize on buyer change
  React.useEffect(() => {
    if (selectedBuyerId) {
      const active = buyers.find((b) => b.id === selectedBuyerId);
      if (active) {
        setBuyerSearchQuery(`${active.nickname} (Debt: ₹${active.lifetime_debt.toLocaleString()})`);
      }
    } else {
      setBuyerSearchQuery("");
    }
  }, [selectedBuyerId, buyers]);

  // Handle outside clicks to close search suggestions
  React.useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const el = document.getElementById("buyer-search-container");
      if (el && !el.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const filteredBuyers = buyers.filter((b) =>
    (b.name || "").toLowerCase().includes(buyerSearchQuery.toLowerCase()) ||
    (b.nickname || "").toLowerCase().includes(buyerSearchQuery.toLowerCase()) ||
    (b.id || "").toLowerCase().includes(buyerSearchQuery.toLowerCase())
  );
  const transactions = data?.transactions || [];
  const collections = data?.daily_collections || [];
  const sources = data?.sources || [];

  const settings = data?.settings || [];
  const isDayClosed = settings.find((s) => s.key === `day_closed_${appDate}`)?.value === "true";

  // Calculations for Close Day
  const sourcePaymentsForDay = data?.source_payments?.filter((p) => p.date === appDate) || [];
  const amountPaidToSources = sourcePaymentsForDay.reduce((sum, p) => sum + (p.amount_paid_to_source || 0), 0);

  const collectionsForDay = collections.filter((c) => c.date === appDate);
  const amountReceivedFromBuyers = collectionsForDay.reduce((sum, c) => sum + (c.amount_paid || 0), 0);
  const approvedCollectionsForDay = collectionsForDay.filter((c) => c.is_approved).reduce((sum, c) => sum + (c.amount_paid || 0), 0);
  const pendingCollectionsForDay = collectionsForDay.filter((c) => !c.is_approved).reduce((sum, c) => sum + (c.amount_paid || 0), 0);

  const salesForDay = transactions.filter((t) => t.date === appDate);
  const totalSalesToday = salesForDay.reduce((sum, t) => sum + (t.total_price || 0), 0);
  const amountOwedToUs = Math.max(0, totalSalesToday - amountReceivedFromBuyers);

  const handleCloseDayToggle = async () => {
    if (!isAuthenticated || activeUser?.role !== "admin") {
      alert("Administrator privileges are required to lock or close the business day reporting sheets.");
      return;
    }
    
    if (!isDayClosed) {
      // Trying to close the day
      const currentHour = new Date().getHours();
      let shouldProceed = true;
      if (currentHour > 6 && currentHour <= 23) { // rough check for "not past 12 AM" (assuming market runs during day and closes late night/early morning)
        shouldProceed = window.confirm("It's not past 12 AM yet. Are you sure you want to proceed closing the day?");
      }

      if (!shouldProceed) return;

      await write("settings", "upsert", { key: `day_closed_${appDate}`, value: "true" });
      setFeedbackMsg(`🔒 Day ${appDate} successfully committed and closed!`);
      
      // Auto advance to next day
      const d = new Date(appDate);
      d.setDate(d.getDate() + 1);
      const nextDateStr = d.toISOString().split("T")[0];
      setTimeout(() => {
        setAppDate(nextDateStr);
        setFeedbackMsg("");
      }, 2000);
    } else {
      // Reopen
      await write("settings", "upsert", { key: `day_closed_${appDate}`, value: "false" });
      setFeedbackMsg(`🔓 Day ${appDate} reopened for ledger entry modifications!`);
      setTimeout(() => setFeedbackMsg(""), 4000);
    }
  };

  const handlePrint = () => {
    // We simulate beautiful printable receipt overlay or print window action
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 600);
  };

  // Find active selected buyer
  const activeBuyer = buyers.find((b) => b.id === selectedBuyerId);

  // Compile chronological timeline statement of purchases and payments
  let timelineItems: {
    type: "purchase" | "payment";
    id: string | number;
    date: string;
    description: string;
    weight?: number;
    pricePerKg?: number;
    chargeAmount: number;
    creditAmount: number;
    approved?: boolean;
    operator?: string;
  }[] = [];

  if (activeBuyer) {
    // 1. Grab purchases/transactions
    const buyerTxs = transactions.filter((tx) => tx.buyer_id === selectedBuyerId);
    buyerTxs.forEach((tx) => {
      timelineItems.push({
        type: "purchase",
        id: tx.id,
        date: tx.date || appDate,
        description: `Purchased: ${tx.fish_type}`,
        weight: tx.weight,
        pricePerKg: tx.price_per_kg,
        chargeAmount: tx.total_price,
        creditAmount: 0,
        operator: tx.added_by,
      });
    });

    // 2. Grab collections
    const buyerCollections = collections.filter((col) => col.buyer_id === selectedBuyerId);
    buyerCollections.forEach((col) => {
      timelineItems.push({
        type: "payment",
        id: col.id,
        date: col.date || appDate,
        description: "Cash Receipt Payment Received",
        chargeAmount: 0,
        creditAmount: col.amount_paid,
        approved: col.is_approved,
        operator: "Collector Station",
      });
    });

    // Sort chronologically (oldest to newest or vice-versa)
    timelineItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  // Running balance calculation helper
  const totalPurchases = timelineItems.reduce((sum, item) => sum + item.chargeAmount, 0);
  const totalApprovedPayments = timelineItems
    .filter((item) => item.type === "payment" && item.approved)
    .reduce((sum, item) => sum + item.creditAmount, 0);

  const calculatedDeficit = totalPurchases - totalApprovedPayments;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="space-y-6"
    >
      {/* Selector Heading */}
      <div className="bg-slate-950 border border-slate-850 p-5 rounded-2xl shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center md:text-left flex-grow">
          <h3 className="text-sm font-sans font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-1.5 justify-center md:justify-start">
            <Search className="w-4.5 h-4.5 text-teal-400" /> ক্রেতার খাতা অনুসন্ধান (Search Buyer Ledger)
          </h3>
          <p className="text-[10.5px] text-slate-500">
            Type nickname or details below to audit outstanding buyer debt timelines and statements
          </p>
        </div>

        <div className="w-full md:w-80 relative" id="buyer-search-container">
          <div className="relative">
            <input
              type="text"
              value={buyerSearchQuery}
              onFocus={() => {
                setShowSuggestions(true);
                // Clear query if user starts typing again so they see all suggestions
                if (selectedBuyerId) {
                  setBuyerSearchQuery("");
                }
              }}
              onChange={(e) => {
                setBuyerSearchQuery(e.target.value);
                setShowSuggestions(true);
              }}
              placeholder="🔍 Search buyer (e.g. Kashem, Raju)..."
              className="w-full text-xs text-slate-100 bg-slate-900 border border-slate-800 rounded-xl p-3 pr-10 focus:outline-none focus:ring-1 focus:ring-teal-500 font-sans"
            />
            {selectedBuyerId && (
              <button
                onClick={() => {
                  setSelectedBuyerId("");
                  setBuyerSearchQuery("");
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-rose-450 text-[10.5px] font-black uppercase hover:text-rose-400 transition"
                type="button"
              >
                Clear
              </button>
            )}
          </div>

          {showSuggestions && (
            <div className="absolute left-0 right-0 z-50 mt-1 max-h-56 overflow-y-auto bg-slate-950 border border-slate-850 rounded-xl shadow-2xl divide-y divide-slate-850 custom-scrollbar">
              {filteredBuyers.length === 0 ? (
                <div className="p-4 text-xs text-slate-500 text-center font-sans">
                  No matching buyers registered.
                </div>
              ) : (
                filteredBuyers.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => {
                      setSelectedBuyerId(b.id);
                      setBuyerSearchQuery(`${b.nickname} (Debt: ₹${b.lifetime_debt.toLocaleString()})`);
                      setShowSuggestions(false);
                    }}
                    type="button"
                    className="w-full text-left p-3 text-xs text-slate-200 hover:bg-slate-905 hover:bg-slate-900 transition flex justify-between items-center cursor-pointer"
                  >
                    <div>
                      <div className="font-bold text-slate-150">{b.name || b.nickname}</div>
                      <div className="text-[9px] text-slate-500 font-mono">ID: #{b.id.substring(0, 6)}</div>
                    </div>
                    <span className="font-mono text-teal-400 font-extrabold bg-slate-900/50 border border-slate-800 px-2 py-1 rounded">
                      ₹{b.lifetime_debt.toLocaleString()}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Close the Day Action Panel */}
      <div className="bg-slate-950 border border-slate-850 rounded-2xl shadow-lg p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-850 pb-3">
          <div className="space-y-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-amber-500" />
               দিনের সমাপ্তি সমাপ্তিকরণ এবং লক (Close Day Ledger Lock)
            </h4>
            <p className="text-[10px] text-slate-500 font-sans">
              Review aggregate receipts, outstanding debts, and disbursements before closing business operations.
            </p>
          </div>
          
          <button
            onClick={() => setShowCloseDaySection(!showCloseDaySection)}
            className="w-full sm:w-auto px-4 py-2 text-[11px] font-bold rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-850 transition duration-200 cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Activity className="w-3.5 h-3.5 text-amber-400" />
            {showCloseDaySection ? "Hide Day Summary" : "Show Day Summary"}
          </button>
        </div>

        {feedbackMsg && (
          <div className="p-3.5 rounded-xl border bg-teal-950/40 border-teal-800/60 text-teal-300 text-xs font-semibold font-sans animate-pulse">
            {feedbackMsg}
          </div>
        )}

        {(showCloseDaySection || isDayClosed) && (
          <div className="space-y-4 animate-slideDown">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Stat 1: Disbursed to sources */}
              <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Disbursed to Sources (আড়তে পরিশোধ)</div>
                <div className="text-xl font-bold font-mono text-rose-450 text-rose-450">
                  ₹ {amountPaidToSources.toLocaleString()}
                </div>
                <div className="text-[9px] text-slate-500 font-sans">
                  Total settled payments disbursed to loaders/fisherman groups
                </div>
              </div>

              {/* Stat 2: Received from buyers */}
              <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Received from Buyers (ক্রেতাদের থেকে আদায়)</div>
                <div className="text-xl font-bold font-mono text-emerald-450">
                  ₹ {amountReceivedFromBuyers.toLocaleString()}
                </div>
                <div className="text-[9px] text-slate-500 font-sans flex items-center gap-1">
                  <span>Approved: ₹{approvedCollectionsForDay.toLocaleString()}</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-slate-400">Pending: ₹{pendingCollectionsForDay.toLocaleString()}</span>
                </div>
              </div>

              {/* Stat 3: Amount the day owes us */}
              <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">What the Day Owes Us (আজকের বাকি)</div>
                <div className="text-xl font-bold font-mono text-amber-400">
                  ₹ {amountOwedToUs.toLocaleString()}
                </div>
                <div className="text-[9px] text-slate-500 font-sans">
                  Today's total sales (₹{totalSalesToday.toLocaleString()}) minus cash collected
                </div>
              </div>
            </div>

            {/* Quick Action Locks */}
            <div className="p-4 bg-slate-900/40 border border-slate-850 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  isDayClosed ? "bg-emerald-950 border border-emerald-800 text-emerald-400" : "bg-amber-950 border border-amber-800 text-amber-400 animate-pulse"
                }`}>
                  {isDayClosed ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-200">
                    Day Operations Status: {isDayClosed ? "CLOSED & SECURED (দিনের হিসাব বন্ধ)" : "OPEN & ACTIVE (দিনের হিসাব चालू)"}
                  </div>
                  <p className="text-[9.5px] text-slate-500 max-w-sm font-sans mt-0.5 leading-relaxed">
                    {isDayClosed
                      ? "This date is locked. Auction logs and manual buyer payments for this day are frozen in read-only audit mode."
                      : "The system is currently accepting bazaar trades, payments, and credit adjustments."}
                  </p>
                </div>
              </div>

              {activeUser?.role === "admin" && isAuthenticated ? (
                <button
                  onClick={handleCloseDayToggle}
                  className={`w-full sm:w-auto px-4 py-2.5 text-xs font-bold rounded-xl shadow-sm transition duration-200 cursor-pointer flex items-center justify-center gap-1.5 shrink-0 ${
                    isDayClosed
                      ? "bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800"
                      : "bg-emerald-600 hover:bg-emerald-750 text-white"
                  }`}
                >
                  {isDayClosed ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  {isDayClosed ? "Reopen Accounting Day" : "Close the Day & Lock Ledger"}
                </button>
              ) : (
                <div className="text-[10px] text-amber-500 bg-amber-950/60 p-2 border border-amber-900 rounded font-bold font-sans shrink-0">
                  ⚠️ Admin role required to lock dates.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {!activeBuyer ? (
        <div className="text-center py-20 bg-slate-950/40 rounded-2xl border border-dashed border-slate-850 text-slate-500 text-xs">
          💡 Select a client buyer account from the dropdown above to display their operational statement audit books.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Detailed capacity card - 4 cols */}
          <div className="lg:col-span-4 bg-slate-950 border border-slate-850 rounded-2xl p-5 shadow-xl space-y-5">
            <div className="space-y-1 pb-3 border-b border-slate-850 text-center">
              <span className="text-[10px] text-indigo-400 font-mono font-bold tracking-wider uppercase bg-slate-900 border border-slate-850/60 px-2 py-0.5 rounded-full">
                Ledger profile
              </span>
              <h2 className="text-lg font-black text-slate-150 text-slate-200 uppercase pt-2">
                {activeBuyer.nickname}
              </h2>
              <p className="text-[10px] text-slate-500 font-mono">
                System Account ID: #{activeBuyer.id}
              </p>
            </div>

            {/* Financial summaries list */}
            <div className="space-y-3.5 text-xs">
              <div className="bg-slate-900/50 p-2.5 rounded-xl border border-slate-850/80 flex justify-between items-center">
                <span className="text-slate-400">Total Outstanding Balance:</span>
                <span className="font-mono font-bold text-slate-205 text-rose-400 text-sm">
                  ₹ {activeBuyer.lifetime_debt.toLocaleString()}
                </span>
              </div>

              <div className="bg-slate-900/50 p-2.5 rounded-xl border border-slate-850/80 flex justify-between items-center">
                <span className="text-slate-400">Calculated Log Deficit:</span>
                <span className="font-mono font-bold text-teal-400">
                  ₹ {calculatedDeficit.toLocaleString()}
                </span>
              </div>

              <div className="bg-slate-900/50 p-2.5 rounded-xl border border-slate-850/80 flex justify-between items-center">
                <span className="text-slate-400">Permitted Credit Limit:</span>
                <span className="font-mono font-bold text-indigo-300">
                  ₹ {activeBuyer.credit_limit.toLocaleString()}
                </span>
              </div>

              {/* Progress indicator */}
              <div className="space-y-1.5 pt-1.5">
                <div className="flex justify-between items-center text-[10px] text-slate-500">
                  <span>Capacity Consumption Rate</span>
                  <span>{Math.round((activeBuyer.lifetime_debt / activeBuyer.credit_limit) * 100)}%</span>
                </div>
                <div className="h-2 w-full bg-slate-905 bg-slate-900 rounded-full overflow-hidden border border-slate-850">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      activeBuyer.lifetime_debt > activeBuyer.credit_limit ? "bg-rose-600 animate-pulse" : "bg-indigo-500"
                    }`}
                    style={{ width: `${Math.min(100, (activeBuyer.lifetime_debt / activeBuyer.credit_limit) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-850">
              <button
                onClick={handlePrint}
                className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-300 font-sans font-bold text-xs shadow-md border border-slate-830 border-slate-800 transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4 text-teal-400" /> Print Formal Arat Receipt
              </button>
            </div>

          </div>

          {/* Timeline transaction statements - 8 cols */}
          <div className="lg:col-span-8 bg-slate-950 border border-slate-850 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-850">
              <div className="space-y-0.5">
                <h4 className="text-xs font-sans font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-indigo-400" /> Ledger Statement Balance Sheet
                </h4>
                <p className="text-[10px] text-slate-500">
                  Recent activities in chronological sequencing descending order
                </p>
              </div>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-900/60 px-2 py-0.5 rounded border border-slate-850">
                Sum: {timelineItems.length} logs
              </span>
            </div>

            {timelineItems.length === 0 ? (
              <div className="text-center py-24 text-slate-600 text-xs font-sans border border-dashed border-slate-850 rounded-xl">
                No purchases or payment collections exist on files yet for {activeBuyer.nickname}.
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {timelineItems.map((item, index) => {
                  const isPurchase = item.type === "purchase";
                  return (
                    <div
                      key={`${item.id}-${index}`}
                      className="bg-slate-950/40 border border-slate-850 p-3.5 rounded-xl flex items-start justify-between gap-4 hover:border-slate-800 transition duration-150 font-sans"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg mt-0.5 ${isPurchase ? "bg-rose-500/10 text-rose-450 text-rose-400" : "bg-emerald-500/10 text-emerald-450 text-emerald-400"}`}>
                          {isPurchase ? <ArrowUpCircle className="w-4 h-4" /> : <ArrowDownCircle className="w-4 h-4" />}
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs font-bold text-slate-200">
                            {item.description}
                          </div>
                          {isPurchase && item.weight && item.pricePerKg && (
                            <div className="text-[10.5px] text-slate-400 font-mono">
                              Calculation: {item.weight} kg × ₹{item.pricePerKg}/kg
                            </div>
                          )}
                          <div className="text-[10px] text-slate-555 text-slate-500 font-mono flex items-center gap-2">
                            <span>Date: {item.date}</span>
                            <span>•</span>
                            <span>Recorded by: {item.operator || "Station"}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right space-y-1">
                        <div className={`text-xs font-mono font-bold tracking-tight ${isPurchase ? "text-rose-450 text-rose-400" : "text-emerald-400"}`}>
                          {isPurchase ? `+ ₹${item.chargeAmount.toLocaleString()}` : `- ₹${item.creditAmount.toLocaleString()}`}
                        </div>
                        {!isPurchase && (
                          <span className={`text-[8.5px] uppercase font-mono tracking-wider px-1 py-0.5 rounded font-extrabold ${
                            item.approved ? "bg-emerald-950/20 text-emerald-400" : "bg-amber-950/20 text-amber-500 animate-pulse"
                          }`}>
                            {item.approved ? "Approved" : "Pending Appr"}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}

      {/* RENDER INVISIBLE BEAUTIFUL INVOICE READY FOR WINDOW.PRINT FOR PHYSICAL ARAT HANDOUTS! */}
      {isPrinting && activeBuyer && (
        <div className="fixed inset-0 bg-white text-slate-950 z-[200] p-12 flex flex-col justify-between font-sans print:static print:inset-auto print:w-full print:h-auto print:transform-none" id="printable-statement-sheet-view">
          <style>{`
              @media print {
                @page {
                  size: A4 portrait;
                  margin: 10mm;
                }
                body * {
                  visibility: hidden !important;
                }
                #printable-statement-sheet-view, #printable-statement-sheet-view * {
                  visibility: visible !important;
                }
                #printable-statement-sheet-view {
                  display: block !important;
                  position: static !important;
                  width: 100% !important;
                  height: auto !important;
                  background: white !important;
                  color: black !important;
                  padding: 0 !important;
                  margin: 0 !important;
                  overflow: visible !important;
                }
              }
          `}</style>
          <div className="space-y-6">
            
            {/* Invoice header */}
            <div className="flex justify-between items-start border-b-2 border-slate-300 pb-5">
              <div className="space-y-1">
                <h1 className="text-xl font-bold tracking-wide uppercase text-slate-900">New Fish Center</h1>
                <p className="text-[10px] text-slate-505 text-slate-650 tracking-wider">Wholesale Fish Arat Ledger & Sales Station</p>
                <p className="text-[9.5px] text-slate-500 font-mono">Vizag Harbor & Digha Harbor, India</p>
              </div>
              <div className="text-right">
                <h2 className="text-md font-bold uppercase text-slate-805">Buyer Halkhata Account Sheet</h2>
                <p className="text-[10px] font-mono mt-1">Print Session: {new Date().toLocaleDateString()}</p>
                <p className="text-[10px] font-mono">Operator ID: {activeUser?.name || "System"}</p>
              </div>
            </div>

            {/* Buyer/Arat context info */}
            <div className="grid grid-cols-2 gap-6 bg-slate-55 bg-slate-100 p-4 rounded-xl border border-slate-200">
              <div className="text-xs space-y-1">
                <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Party Details (Buyer Account)</div>
                <div className="font-bold text-sm text-slate-900">{activeBuyer.nickname}</div>
                <div className="text-slate-600">Merchant Account ID: #{activeBuyer.id}</div>
              </div>
              <div className="text-xs space-y-1 text-right">
                <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Party Liability Summary</div>
                <div className="font-bold text-sm text-rose-700">Owed Today: ₹{activeBuyer.lifetime_debt.toLocaleString()}</div>
                <div className="text-slate-605 text-slate-600">Original Capacity Limit: ₹{activeBuyer.credit_limit.toLocaleString()}</div>
              </div>
            </div>

            {/* Invoiced items list table */}
            <div className="space-y-3">
              <h3 className="text-[10px] uppercase font-bold text-slate-700 tracking-wider">Current Account Statements</h3>
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-300 bg-slate-205 bg-slate-200 p-2 font-bold select-none text-slate-700">
                    <th className="py-2.5 px-2">Date</th>
                    <th className="py-2.5 px-2">Activity Description</th>
                    <th className="py-2.5 px-2 text-right">Debit Owed (+)</th>
                    <th className="py-2.5 px-2 text-right">Credit paid (-)</th>
                    <th className="py-2.5 px-2 text-right">Approved Status</th>
                  </tr>
                </thead>
                <tbody>
                  {timelineItems.slice(0, 15).map((item, index) => (
                    <tr key={index} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="py-2 px-2 font-mono text-[10px]">{item.date}</td>
                      <td className="py-2 px-2 font-semibold">
                        {item.description}
                        {item.weight && (
                          <span className="font-mono text-[9px] text-slate-500 block">Calculated: {item.weight}kg @ ₹{item.pricePerKg}/kg</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-rose-700">{item.chargeAmount > 0 ? `₹${item.chargeAmount.toLocaleString()}` : "-"}</td>
                      <td className="py-2 px-2 text-right font-mono text-emerald-700">{item.creditAmount > 0 ? `₹${item.creditAmount.toLocaleString()}` : "-"}</td>
                      <td className="py-2 px-2 text-right uppercase font-mono text-[9px] font-bold text-slate-600">{item.approved !== undefined ? (item.approved ? "Closed" : "Pending") : "Confirmed"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>

          {/* Signatures block footer */}
          <div className="grid grid-cols-2 gap-12 pt-12 text-center text-xs">
            <div className="space-y-1.5">
              <div className="h-0.5 bg-slate-300 mx-auto w-3/4"></div>
              <div className="font-bold text-slate-800">Receiver Party Signee</div>
              <div className="text-[10px] text-slate-500 font-mono">For {activeBuyer.nickname}</div>
            </div>
            <div className="space-y-1.5">
              <div className="h-0.5 bg-slate-300 mx-auto w-3/4"></div>
              <div className="font-bold text-slate-800">Arat Authorized Cashier</div>
              <div className="text-[10px] text-slate-500 font-mono">New Fish Center Accounts Team</div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};
