/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useData } from "./DataContext";
import { User as DbUser, expandFishType } from "../db";
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
    (b.nickname || "").toLowerCase().includes(String(buyerSearchQuery).toLowerCase()) ||
    String(b.id || "").toLowerCase().includes(String(buyerSearchQuery).toLowerCase())
  );
  const transactions = data?.transactions || [];
  const collections = data?.daily_collections || [];
  const sources = data?.sources || [];

  const settings = data?.settings || [];
  const isDayClosed = settings.find((s) => s.key === `day_closed_${appDate}`)?.value === "true";

  // Calculations for Close Day
  const sourcePaymentsForDay = data?.source_payments?.filter((p) => String(p.date) === String(appDate)) || [];
  const amountPaidToSources = sourcePaymentsForDay.reduce((sum, p) => sum + Number(p.amount_paid_to_source || 0), 0);

  const collectionsForDay = collections.filter((c) => String(c.date) === String(appDate));
  const amountReceivedFromBuyers = collectionsForDay.reduce((sum, c) => sum + Number(c.amount_paid || 0), 0);
  const approvedCollectionsForDay = collectionsForDay.filter((c) => c.is_approved).reduce((sum, c) => sum + Number(c.amount_paid || 0), 0);
  const pendingCollectionsForDay = collectionsForDay.filter((c) => !c.is_approved).reduce((sum, c) => sum + Number(c.amount_paid || 0), 0);

  const salesForDay = transactions.filter((t) => String(t.date) === String(appDate));
  const totalSalesToday = salesForDay.reduce((sum, t) => sum + Number(t.total_price || 0), 0);
  const amountOwedToUs = Math.max(0, totalSalesToday - amountReceivedFromBuyers);

  const exportDayExcel = async () => {
    try {
      const getBuyerName = (id: any) => data?.buyers?.find((b) => String(b.id) === String(id))?.nickname || String(id);
      const getSourceName = (id: any) => data?.sources?.find((s) => String(s.id) === String(id))?.name || String(id);
      const getUserName = (id: any) => data?.users?.find((u) => String(u.id) === String(id))?.name || String(id);

      const exportData: any[] = [];

      // 1. Transactions (Auctions) for this specific day
      exportData.push({"TABLE": "*** DAILY AUCTIONS ***"});
      const txData = [...salesForDay]
        .sort((a,b) => {
          const sA = getSourceName(a.source_id);
          const sB = getSourceName(b.source_id);
          if (sA !== sB) return sA.localeCompare(sB);
          
          const fA = a.fish_type || "Unspecified";
          const fB = b.fish_type || "Unspecified";
          if (fA !== fB) return fA.localeCompare(fB);

          return String(b.date).localeCompare(String(a.date));
        })
        .map(tx => ({
          "Time": new Date(tx.date).toLocaleTimeString(),
          "Source Name": getSourceName(tx.source_id),
          "Crate / Fish Type": expandFishType(tx.fish_type),
          "Buyer Name": getBuyerName(tx.buyer_id),
          "Authorizing Operator": getUserName(tx.added_by),
          "Lot Weight (Kg)": tx.weight,
          "Rate Per Kg (BDT)": tx.price_per_kg,
          "Total Amount (BDT)": tx.total_price
        }));
      exportData.push(...txData);

      // 2. Collections (Jama) for this specific day
      exportData.push({});
      exportData.push({"TABLE": "*** DAILY COLLECTIONS ***"});
      const colData = [...collectionsForDay]
        .sort((a,b) => String(b.date).localeCompare(String(a.date)))
        .map(col => ({
          "Time": new Date(col.date).toLocaleTimeString(),
          "Buyer Name": getBuyerName(col.buyer_id),
          "Amount Paid (BDT)": col.amount_paid,
          "Total Outstanding": col.total_owed_today,
          "Approval Status": col.is_approved ? 'Approved' : 'Pending'
        }));
      exportData.push(...colData);

      // 3. Source Payments for this specific day
      exportData.push({});
      exportData.push({"TABLE": "*** DAILY SOURCE PAYMENTS ***"});
      const spForDay = data?.source_payments?.filter(s => s.date.startsWith(appDate)) || [];
      const spData = [...spForDay]
        .sort((a,b) => String(b.date).localeCompare(String(a.date)))
        .map(sp => ({
          "Time": new Date(sp.date).toLocaleTimeString(),
          "Source Name": getSourceName(sp.source_id),
          "Gross Sale (BDT)": sp.sale_total,
          "Commission (BDT)": sp.commission,
          "Net Paid to Source (BDT)": sp.amount_paid_to_source,
          "Settlement Status": sp.is_settled ? 'Settled' : 'Unsettled'
        }));
      exportData.push(...spData);

      const { downloadCSV } = await import('../utils/fileExport');
      await downloadCSV(exportData, `NFC_DAILY_REPORT_${appDate}.csv`);
    } catch (err) {
      console.error("Failed to export CSV", err);
    }
  };

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

      await exportDayExcel();
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
    const buyerTxs = transactions.filter((tx) => String(tx.buyer_id) === String(selectedBuyerId));
    buyerTxs.forEach((tx) => {
      timelineItems.push({
        type: "purchase",
        id: tx.id,
        date: tx.date || appDate,
        description: `Crate: ${tx.fish_type ? expandFishType(tx.fish_type) : '-'}`,
        weight: tx.weight,
        pricePerKg: tx.price_per_kg,
        chargeAmount: tx.total_price,
        creditAmount: 0,
        operator: tx.added_by,
      });
    });

    // 2. Grab collections
    const buyerCollections = collections.filter((col) => String(col.buyer_id) === String(selectedBuyerId));
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
      <div className="bg-zinc-950 border border-zinc-800 p-5 rounded-2xl shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center md:text-left flex-grow">
          <h3 className="text-sm font-sans font-extrabold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5 justify-center md:justify-start">
            <Search className="w-4.5 h-4.5 text-teal-400" /> ক্রেতার খাতা অনুসন্ধান (Search Buyer Ledger)
          </h3>
          <p className="text-[10.5px] text-zinc-500">
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
              className="w-full text-xs text-zinc-100 bg-zinc-900 border border-zinc-800 rounded-2xl p-3 pr-10 focus:outline-none focus:ring-1 focus:ring-teal-500 font-sans"
            />
            {selectedBuyerId && (
              <button
                onClick={() => {
                  setSelectedBuyerId("");
                  setBuyerSearchQuery("");
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-rose-500 text-[10.5px] font-black uppercase hover:text-rose-400 transition"
                type="button"
              >
                Clear
              </button>
            )}
          </div>

          {showSuggestions && (
            <div className="absolute left-0 right-0 z-50 mt-1 max-h-56 overflow-y-auto bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl divide-y divide-zinc-800 custom-scrollbar">
              {filteredBuyers.length === 0 ? (
                <div className="p-4 text-xs text-zinc-500 text-center font-sans">
                  No matching buyers registered.
                </div>
              ) : (
                filteredBuyers.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => {
                      setSelectedBuyerId(String(b.id));
                      setBuyerSearchQuery(`${b.nickname} (Debt: ₹${b.lifetime_debt.toLocaleString()})`);
                      setShowSuggestions(false);
                    }}
                    type="button"
                    className="w-full text-left p-3 text-xs text-zinc-200 hover:bg-zinc-900 transition flex justify-between items-center cursor-pointer"
                  >
                    <div>
                      <div className="font-bold text-zinc-150">{b.nickname}</div>
                      <div className="text-[9px] text-zinc-500 font-mono">ID: #{String(b.id).substring(0, 6)}</div>
                    </div>
                    <span className="font-mono text-teal-400 font-extrabold bg-zinc-900/50 border border-zinc-800 px-2 py-1 rounded">
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
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl shadow-lg p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
          <div className="space-y-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-amber-500" />
               দিনের সমাপ্তি সমাপ্তিকরণ এবং লক (Close Day Ledger Lock)
            </h4>
            <p className="text-[10px] text-zinc-500 font-sans">
              Review aggregate receipts, outstanding debts, and disbursements before closing business operations.
            </p>
          </div>
          
          <button
            onClick={() => setShowCloseDaySection(!showCloseDaySection)}
            className="w-full sm:w-auto px-4 py-2 text-[11px] font-bold rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 transition duration-200 cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Activity className="w-3.5 h-3.5 text-amber-400" />
            {showCloseDaySection ? "Hide Day Summary" : "Show Day Summary"}
          </button>
        </div>

        {feedbackMsg && (
          <div className="p-3.5 rounded-2xl border bg-teal-950/40 border-teal-800/60 text-teal-300 text-xs font-semibold font-sans animate-pulse">
            {feedbackMsg}
          </div>
        )}

        {(showCloseDaySection || isDayClosed) && (
          <div className="space-y-4 animate-slideDown">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Stat 1: Disbursed to sources */}
              <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl space-y-1">
                <div className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Disbursed to Sources (আড়তে পরিশোধ)</div>
                <div className="text-xl font-bold font-mono text-rose-500 text-rose-500">
                  ₹ {amountPaidToSources.toLocaleString()}
                </div>
                <div className="text-[9px] text-zinc-500 font-sans">
                  Total settled payments disbursed to loaders/fisherman groups
                </div>
              </div>

              {/* Stat 2: Received from buyers */}
              <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl space-y-1">
                <div className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Received from Buyers (ক্রেতাদের থেকে আদায়)</div>
                <div className="text-xl font-bold font-mono text-emerald-500">
                  ₹ {amountReceivedFromBuyers.toLocaleString()}
                </div>
                <div className="text-[9px] text-zinc-500 font-sans flex items-center gap-1">
                  <span>Approved: ₹{approvedCollectionsForDay.toLocaleString()}</span>
                  <span className="text-zinc-600">|</span>
                  <span className="text-zinc-400">Pending: ₹{pendingCollectionsForDay.toLocaleString()}</span>
                </div>
              </div>

              {/* Stat 3: Amount the day owes us */}
              <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl space-y-1">
                <div className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">What the Day Owes Us (আজকের বাকি)</div>
                <div className="text-xl font-bold font-mono text-amber-400">
                  ₹ {amountOwedToUs.toLocaleString()}
                </div>
                <div className="text-[9px] text-zinc-500 font-sans">
                  Today's total sales (₹{totalSalesToday.toLocaleString()}) minus cash collected
                </div>
              </div>
            </div>

            {/* Quick Action Locks */}
            <div className="p-4 bg-zinc-900/40 border border-zinc-800 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  isDayClosed ? "bg-emerald-950 border border-emerald-800 text-emerald-400" : "bg-amber-950 border border-amber-800 text-amber-400 animate-pulse"
                }`}>
                  {isDayClosed ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                </div>
                <div>
                  <div className="text-xs font-bold text-zinc-200">
                    Day Operations Status: {isDayClosed ? "CLOSED & SECURED (দিনের হিসাব বন্ধ)" : "OPEN & ACTIVE (দিনের হিসাব चालू)"}
                  </div>
                  <p className="text-[9.5px] text-zinc-500 max-w-sm font-sans mt-0.5 leading-relaxed">
                    {isDayClosed
                      ? "This date is locked. Auction logs and manual buyer payments for this day are frozen in read-only audit mode."
                      : "The system is currently accepting bazaar trades, payments, and credit adjustments."}
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-2">
                <button
                  onClick={exportDayExcel}
                  className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold rounded-2xl shadow-sm transition border cursor-pointer flex items-center justify-center gap-1.5 shrink-0 bg-blue-900/50 hover:bg-blue-800 text-blue-300 border-blue-800"
                >
                  📥 Download Data (.csv)
                </button>
                {activeUser?.role === "admin" && isAuthenticated ? (
                  <button
                    onClick={handleCloseDayToggle}
                    className={`w-full sm:w-auto px-4 py-2.5 text-xs font-bold rounded-2xl shadow-sm transition duration-200 cursor-pointer flex items-center justify-center gap-1.5 shrink-0 ${
                      isDayClosed
                        ? "bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800"
                        : "bg-emerald-600 hover:bg-emerald-700 text-white"
                    }`}
                  >
                    {isDayClosed ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                    {isDayClosed ? "Reopen Day" : "Close Day"}
                  </button>
                ) : (
                  <div className="text-[10px] text-amber-500 bg-amber-950/60 p-2 border border-amber-900 rounded font-bold font-sans shrink-0">
                    ⚠️ Admin role required to lock dates.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {!activeBuyer ? (
        <div className="text-center py-20 bg-zinc-950/40 rounded-2xl border border-dashed border-zinc-800 text-zinc-500 text-xs">
          💡 Select a client buyer account from the dropdown above to display their operational statement audit books.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Detailed capacity card - 4 cols */}
          <div className="lg:col-span-4 bg-zinc-950 border border-zinc-800 rounded-2xl p-5 shadow-2xl shadow-black/10 space-y-5">
            <div className="space-y-1 pb-3 border-b border-zinc-800 text-center">
              <span className="text-[10px] text-indigo-400 font-mono font-bold tracking-wider uppercase bg-zinc-900 border border-zinc-800/60 px-2 py-0.5 rounded-full">
                Ledger profile
              </span>
              <h2 className="text-lg font-black text-zinc-150 text-zinc-200 uppercase pt-2">
                {activeBuyer.nickname}
              </h2>
              <p className="text-[10px] text-zinc-500 font-mono">
                System Account ID: #{activeBuyer.id}
              </p>
            </div>

            {/* Financial summaries list */}
            <div className="space-y-3.5 text-xs">
              <div className="bg-zinc-900/50 p-2.5 rounded-2xl border border-zinc-800/80 flex justify-between items-center">
                <span className="text-zinc-400">Total Outstanding Balance:</span>
                <span className="font-mono font-bold text-zinc-200 text-rose-400 text-sm">
                  ₹ {activeBuyer.lifetime_debt.toLocaleString()}
                </span>
              </div>

              <div className="bg-zinc-900/50 p-2.5 rounded-2xl border border-zinc-800/80 flex justify-between items-center">
                <span className="text-zinc-400">Calculated Log Deficit:</span>
                <span className="font-mono font-bold text-teal-400">
                  ₹ {calculatedDeficit.toLocaleString()}
                </span>
              </div>

              <div className="bg-zinc-900/50 p-2.5 rounded-2xl border border-zinc-800/80 flex justify-between items-center">
                <span className="text-zinc-400">Permitted Credit Limit:</span>
                <span className="font-mono font-bold text-indigo-300">
                  ₹ {activeBuyer.credit_limit.toLocaleString()}
                </span>
              </div>

              {/* Progress indicator */}
              <div className="space-y-1.5 pt-1.5">
                <div className="flex justify-between items-center text-[10px] text-zinc-500">
                  <span>Capacity Consumption Rate</span>
                  <span>{Math.round((activeBuyer.lifetime_debt / activeBuyer.credit_limit) * 100)}%</span>
                </div>
                <div className="h-2 w-full bg-zinc-900 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      activeBuyer.lifetime_debt > activeBuyer.credit_limit ? "bg-rose-600 animate-pulse" : "bg-indigo-500"
                    }`}
                    style={{ width: `${Math.min(100, (activeBuyer.lifetime_debt / activeBuyer.credit_limit) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-800">
              <button
                onClick={handlePrint}
                className="w-full py-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-sans font-bold text-xs shadow-md border border-zinc-830 border-zinc-800 transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4 text-teal-400" /> Print Formal Arat Receipt
              </button>
            </div>

          </div>

          {/* Timeline transaction statements - 8 cols */}
          <div className="lg:col-span-8 bg-zinc-950 border border-zinc-800 rounded-2xl p-5 shadow-2xl shadow-black/10 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="space-y-0.5">
                <h4 className="text-xs font-sans font-extrabold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-indigo-400" /> Ledger Statement Balance Sheet
                </h4>
                <p className="text-[10px] text-zinc-500">
                  Recent activities in chronological sequencing descending order
                </p>
              </div>
              <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900/60 px-2 py-0.5 rounded border border-zinc-800">
                Sum: {timelineItems.length} logs
              </span>
            </div>

            {timelineItems.length === 0 ? (
              <div className="text-center py-24 text-zinc-600 text-xs font-sans border border-dashed border-zinc-800 rounded-2xl">
                No purchases or payment collections exist on files yet for {activeBuyer.nickname}.
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {timelineItems.map((item, index) => {
                  const isPurchase = item.type === "purchase";
                  return (
                    <div
                      key={`${item.id}-${index}`}
                      className="bg-zinc-950/40 border border-zinc-800 p-3.5 rounded-2xl flex items-start justify-between gap-4 hover:border-zinc-800 transition duration-150 font-sans"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-2xl mt-0.5 ${isPurchase ? "bg-rose-500/10 text-rose-500 text-rose-400" : "bg-emerald-500/10 text-emerald-500 text-emerald-400"}`}>
                          {isPurchase ? <ArrowUpCircle className="w-4 h-4" /> : <ArrowDownCircle className="w-4 h-4" />}
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs font-bold text-zinc-200">
                            {item.description}
                          </div>
                          {isPurchase && item.weight && item.pricePerKg && (
                            <div className="text-[10.5px] text-zinc-400 font-mono">
                              Calculation: {item.weight} kg × ₹{item.pricePerKg}/kg
                            </div>
                          )}
                          <div className="text-[10px] text-zinc-555 text-zinc-500 font-mono flex items-center gap-2">
                            <span>Date: {item.date}</span>
                            <span>•</span>
                            <span>Recorded by: {item.operator || "Station"}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right space-y-1">
                        <div className={`text-xs font-mono font-bold tracking-tight ${isPurchase ? "text-rose-500 text-rose-400" : "text-emerald-400"}`}>
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
        <div className="fixed inset-0 bg-white text-zinc-950 z-[200] p-12 flex flex-col justify-between font-sans print:static print:inset-auto print:w-full print:h-auto print:transform-none" id="printable-statement-sheet-view">
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
            <div className="flex justify-between items-start border-b-2 border-zinc-300 pb-5">
              <div className="space-y-1">
                <h1 className="text-3xl font-black tracking-tight text-zinc-950 uppercase">NEW FISH CENTER</h1>
                <p className="text-[10px] text-zinc-800 font-extrabold tracking-wider font-mono uppercase">Commission Agent and Wholesaler • Proprietor: Chanchal Das</p>
                <p className="text-[10px] text-zinc-600 mt-0.5 uppercase">BALIA, Chakdaha, Nadia</p>
              </div>
              <div className="text-right">
                <h2 className="text-md font-bold uppercase text-zinc-805">Buyer Halkhata Account Sheet</h2>
                <p className="text-[10px] font-mono mt-1">Print Session: {new Date().toLocaleDateString()}</p>
                <p className="text-[10px] font-mono">Operator ID: {activeUser?.name || "System"}</p>
              </div>
            </div>

            {/* Buyer/Arat context info */}
            <div className="grid grid-cols-2 gap-6 bg-zinc-55 bg-zinc-100 p-4 rounded-2xl border border-zinc-200">
              <div className="text-xs space-y-1">
                <div className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold">Party Details (Buyer Account)</div>
                <div className="font-bold text-sm text-zinc-900">{activeBuyer.nickname}</div>
                <div className="text-zinc-600">Merchant Account ID: #{activeBuyer.id}</div>
              </div>
              <div className="text-xs space-y-1 text-right">
                <div className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold">Party Liability Summary</div>
                <div className="font-bold text-sm text-rose-700">Owed Today: ₹{activeBuyer.lifetime_debt.toLocaleString()}</div>
                <div className="text-zinc-605 text-zinc-600">Original Capacity Limit: ₹{activeBuyer.credit_limit.toLocaleString()}</div>
              </div>
            </div>

            {/* Invoiced items list table */}
            <div className="space-y-3">
              <h3 className="text-[10px] uppercase font-bold text-zinc-700 tracking-wider">Current Account Statements</h3>
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-300 bg-zinc-200 bg-zinc-200 p-2 font-bold select-none text-zinc-700">
                    <th className="py-2.5 px-2">Date</th>
                    <th className="py-2.5 px-2">Activity Description</th>
                    <th className="py-2.5 px-2 text-right">Debit Owed (+)</th>
                    <th className="py-2.5 px-2 text-right">Credit paid (-)</th>
                    <th className="py-2.5 px-2 text-right">Approved Status</th>
                  </tr>
                </thead>
                <tbody>
                  {timelineItems.slice(0, 15).map((item, index) => (
                    <tr key={index} className="border-b border-zinc-200 hover:bg-zinc-50">
                      <td className="py-2 px-2 font-mono text-[10px]">{item.date}</td>
                      <td className="py-2 px-2 font-semibold">
                        {item.description}
                        {item.weight && (
                          <span className="font-mono text-[9px] text-zinc-500 block">Calculated: {item.weight}kg @ ₹{item.pricePerKg}/kg</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-rose-700">{item.chargeAmount > 0 ? `₹${item.chargeAmount.toLocaleString()}` : "-"}</td>
                      <td className="py-2 px-2 text-right font-mono text-emerald-700">{item.creditAmount > 0 ? `₹${item.creditAmount.toLocaleString()}` : "-"}</td>
                      <td className="py-2 px-2 text-right uppercase font-mono text-[9px] font-bold text-zinc-600">{item.approved !== undefined ? (item.approved ? "Closed" : "Pending") : "Confirmed"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>

          {/* Signatures block footer */}
          <div className="grid grid-cols-2 gap-12 pt-12 text-center text-xs">
            <div className="space-y-1.5">
              <div className="h-0.5 bg-zinc-300 mx-auto w-3/4"></div>
              <div className="font-bold text-zinc-800">Receiver Party Signee</div>
              <div className="text-[10px] text-zinc-500 font-mono">For {activeBuyer.nickname}</div>
            </div>
            <div className="space-y-1.5">
              <div className="h-0.5 bg-zinc-300 mx-auto w-3/4"></div>
              <div className="font-bold text-zinc-800">Arat Authorized Cashier</div>
              <div className="text-[10px] text-zinc-500 font-mono">New Fish Center Accounts Team</div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};
