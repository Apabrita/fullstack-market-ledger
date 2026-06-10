/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useData } from "./DataContext";
import { User as DbUser } from "../db";
import {
  FileCode,
  Search,
  Filter,
  TrendingDown,
  ShoppingBag,
  Landmark,
  Anchor,
  Settings,
  HardDrive,
  Users,
  Activity,
  Trash2
} from "lucide-react";

interface HistoryPanelProps {
  activeUser: DbUser | null;
  isAuthenticated: boolean;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  activeUser,
  isAuthenticated,
}) => {
  const { data, queue } = useData();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "purchases" | "collections" | "settlements" | "crew">("all");

  const buyers = data?.buyers || [];
  const sources = data?.sources || [];
  const transactions = data?.transactions || [];
  const collections = data?.daily_collections || [];
  const sourcePayments = data?.source_payments || [];
  const usersList = data?.users || [];

  // Compile a master chronological audit log
  let masterHistoryLog: {
    id: string | number;
    timestamp: number;
    date: string;
    category: "purchases" | "collections" | "settlements" | "crew";
    title: string;
    detail: string;
    operator: string;
    amount?: number;
    localQueued: boolean;
  }[] = [];

  // 1. Gather auctions
  transactions.forEach((tx) => {
    const buyer = buyers.find((b) => b.id === tx.buyer_id);
    const buyerName = buyer ? buyer.nickname : `Buyer: ID-${tx.buyer_id}`;
    const source = sources.find((s) => s.id === tx.source_id);
    const sourceName = source ? source.name : `Source: ID-${tx.source_id}`;

    const isQueued = queue.some((q) => q.table === "transactions" && q.id === tx.id);

    masterHistoryLog.push({
      id: tx.id,
      timestamp: tx.id && typeof tx.id === "string" && tx.id.startsWith("temp_t_") 
        ? parseInt(tx.id.replace("temp_t_", "")) 
        : new Date(tx.date).getTime() || Date.now() - 3600000,
      date: tx.date || "2026-06-09",
      category: "purchases",
      title: "Auction Transaction Registered",
      detail: `${buyerName} bought ${tx.weight}kg of ${tx.fish_type} from ${sourceName} @ ₹${tx.price_per_kg}/kg`,
      operator: tx.added_by || "Station Operator",
      amount: tx.total_price,
      localQueued: isQueued,
    });
  });

  // 2. Gather collections payments
  collections.forEach((col) => {
    const buyer = buyers.find((b) => b.id === col.buyer_id);
    const buyerName = buyer ? buyer.nickname : `Buyer: ID-${col.buyer_id}`;

    const isQueued = queue.some((q) => q.table === "daily_collections" && q.id === col.id);

    masterHistoryLog.push({
      id: col.id,
      timestamp: col.id && typeof col.id === "string" && col.id.startsWith("temp_col_")
        ? parseInt(col.id.replace("temp_col_", ""))
        : col.id && typeof col.id === "string" && col.id.startsWith("temp_c_")
        ? parseInt(col.id.replace("temp_c_", ""))
        : new Date(col.date).getTime() || Date.now() - 5400000,
      date: col.date || "2026-06-09",
      category: "collections",
      title: col.is_approved ? "Payment Approved & Credited" : "Payment Collected (Pending)",
      detail: `Received ${col.is_approved ? "Approved" : "Draft"} Cash Collection receipt sum from ${buyerName}`,
      operator: "Accounts Cashier",
      amount: col.amount_paid,
      localQueued: isQueued,
    });
  });

  // 3. Gather source payments settlements
  sourcePayments.forEach((p) => {
    const source = sources.find((s) => s.id === p.source_id);
    const sourceName = source ? source.name : `Source ID: ${p.source_id}`;

    const isQueued = queue.some((q) => q.table === "source_payments" && q.id === p.id);

    masterHistoryLog.push({
      id: p.id,
      timestamp: p.id && typeof p.id === "string" && p.id.startsWith("temp_p_")
        ? parseInt(p.id.replace("temp_p_", ""))
        : new Date(p.date).getTime() || Date.now() - 7200000,
      date: p.date || "2026-06-09",
      category: "settlements",
      title: "Source Outflow Settled",
      detail: `Settled ship account ${sourceName} for total ${p.total_kg}kg sales. Commission deducted: ₹${p.commission}`,
      operator: "Admin Auditor",
      amount: p.amount_paid_to_source,
      localQueued: isQueued,
    });
  });

  // 4. Gather crew/user additions
  usersList.forEach((u) => {
    const isQueued = queue.some((q) => q.table === "users" && q.id === u.id);
    masterHistoryLog.push({
      id: u.id,
      timestamp: u.id && typeof u.id === "string" && u.id.startsWith("temp_u_")
        ? parseInt(u.id.replace("temp_u_", ""))
        : Date.now() - 86400000,
      date: "System Core",
      category: "crew",
      title: "Team Member Station Configured",
      detail: `Registered team operator: ${u.name} with system permission access [${u.role}]`,
      operator: "System Architect",
      localQueued: isQueued,
    });
  });

  // Sort logs: newest first
  masterHistoryLog.sort((a, b) => b.timestamp - a.timestamp);

  // Group financial summaries Day-wise to satisfy the "save history of what we paid to sources & received from buyers day-wise" requirement
  const dayWiseCashbook: {
    [date: string]: {
      totalInflows: number;
      totalOutflows: number;
      collectionsCount: number;
      settlementsCount: number;
      details: string[];
    };
  } = {};

  // Aggregate collections (inflows)
  collections.forEach((col) => {
    if (!col.amount_paid) return;
    const dateStr = col.date || "2026-06-09";
    const buyer = buyers.find((b) => b.id === col.buyer_id);
    const name = buyer ? buyer.nickname : "Buyer";

    if (!dayWiseCashbook[dateStr]) {
      dayWiseCashbook[dateStr] = { totalInflows: 0, totalOutflows: 0, collectionsCount: 0, settlementsCount: 0, details: [] };
    }
    dayWiseCashbook[dateStr].totalInflows += col.amount_paid;
    dayWiseCashbook[dateStr].collectionsCount += 1;
    dayWiseCashbook[dateStr].details.push(`Inflow: Received ₹${col.amount_paid.toLocaleString()} from ${name}`);
  });

  // Aggregate source payments (outflows)
  sourcePayments.forEach((sp) => {
    if (!sp.amount_paid_to_source) return;
    const dateStr = sp.date || "2026-06-09";
    const source = sources.find((s) => s.id === sp.source_id);
    const name = source ? source.name : "Source";

    if (!dayWiseCashbook[dateStr]) {
      dayWiseCashbook[dateStr] = { totalInflows: 0, totalOutflows: 0, collectionsCount: 0, settlementsCount: 0, details: [] };
    }
    dayWiseCashbook[dateStr].totalOutflows += sp.amount_paid_to_source;
    dayWiseCashbook[dateStr].settlementsCount += 1;
    dayWiseCashbook[dateStr].details.push(`Outflow: Settled source ${name} with payout of ₹${sp.amount_paid_to_source.toLocaleString()}`);
  });

  const sortedCashbookDays = Object.keys(dayWiseCashbook).sort((a, b) => b.localeCompare(a));

  // Apply filters
  const filteredLog = masterHistoryLog.filter((log) => {
    const term = searchQuery.toLowerCase();
    const matchesSearch =
      log.title.toLowerCase().includes(term) ||
      log.detail.toLowerCase().includes(term) ||
      log.operator.toLowerCase().includes(term);

    // simple mapping matching
    const cat = categoryFilter;
    const matchesCategory =
      cat === "all" ||
      (cat === "purchases" && log.category === "purchases") ||
      (cat === "collections" && log.category === "collections") ||
      (cat === "settlements" && log.category === "settlements") ||
      (cat === "crew" && log.category === "crew");

    return matchesSearch && matchesCategory;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="space-y-6"
    >
      {/* Day-by-Day Cashbook Balance Audit Card */}
      <div className="bg-zinc-950 border border-zinc-800 p-5 rounded-2xl shadow-2xl shadow-black/10 space-y-4">
        <div>
          <h3 className="text-xs font-sans font-extrabold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
            <Landmark className="w-4 h-4 text-emerald-400" /> Day-Wise Ledger Cashbook Journal ({sortedCashbookDays.length} Days)
          </h3>
          <p className="text-[10px] text-zinc-500 font-sans mt-0.5">
            Automatic chronological aggregate of source payments and buyer collection receipts
          </p>
        </div>

        {sortedCashbookDays.length === 0 ? (
          <div className="text-center py-6 text-zinc-600 text-[11px] font-mono">
            No payments or collection receipts settled on this device yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sortedCashbookDays.map((dateStr) => {
              const day = dayWiseCashbook[dateStr];
              const netBalance = day.totalInflows - day.totalOutflows;
              return (
                <div key={dateStr} className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-2xl space-y-2.5">
                  <div className="flex justify-between items-center border-b border-zinc-800 pb-1.5">
                    <span className="text-xs font-bold font-mono text-emerald-400 flex items-center gap-1">
                      📅 Date: {dateStr}
                    </span>
                    <span className={`text-[10px] font-mono leading-none ${netBalance >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      Net: {netBalance >= 0 ? "+" : "-"}₹{Math.abs(netBalance).toLocaleString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center text-[10px] font-mono">
                    <div className="bg-emerald-950/20 text-emerald-400 p-1.5 rounded border border-emerald-900/30">
                      <div>IN (Buyer Paid)</div>
                      <div className="font-extrabold text-[11px] mt-0.5 text-white">₹{day.totalInflows.toLocaleString()}</div>
                    </div>
                    <div className="bg-rose-950/20 text-rose-400 p-1.5 rounded border border-rose-900/30 font-bold">
                      <div>OUT (Settlements)</div>
                      <div className="font-extrabold text-[11px] mt-0.5 text-white">₹{day.totalOutflows.toLocaleString()}</div>
                    </div>
                  </div>

                  <div className="text-[8.5px] text-zinc-500 text-zinc-500 divide-y divide-zinc-800 bg-zinc-950/40 p-2 rounded">
                    <div className="font-bold text-zinc-400 uppercase tracking-wider pb-1">Historical Line Items:</div>
                    {day.details.map((item, index) => (
                      <div key={index} className="py-1 font-mono text-zinc-400 flex items-center gap-1">
                        • {item}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Search Filter Head Segment */}
      <div className="bg-zinc-950 border border-zinc-800 p-5 rounded-2xl shadow-lg flex flex-col md:flex-row items-center gap-4">
        
        {/* Search Field */}
        <div className="relative w-full md:flex-grow">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search master logs by fish type, buyers name, or operator stamps..."
            className="w-full text-xs text-zinc-100 bg-zinc-900 border border-zinc-800 rounded-2xl py-3 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-teal-500 font-sans"
          />
        </div>

        {/* Category toggles */}
        <div className="flex border border-zinc-800 bg-zinc-900 p-1 rounded-2xl gap-1 shrink-0 text-xs w-full md:w-auto overflow-x-auto scrollbar-none">
          <button
            onClick={() => setCategoryFilter("all")}
            className={`px-3 py-1.5 rounded-2xl select-none font-bold cursor-pointer transition ${
              categoryFilter === "all" ? "bg-teal-600 text-white" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            All Logs
          </button>
          <button
            onClick={() => setCategoryFilter("purchases")}
            className={`px-3 py-1.5 rounded-2xl select-none font-bold cursor-pointer transition ${
              categoryFilter === "purchases" ? "bg-teal-600 text-white" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Auctions
          </button>
          <button
            onClick={() => setCategoryFilter("collections")}
            className={`px-3 py-1.5 rounded-2xl select-none font-bold cursor-pointer transition ${
              categoryFilter === "collections" ? "bg-teal-600 text-white" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Collections
          </button>
          <button
            onClick={() => setCategoryFilter("settlements")}
            className={`px-3 py-1.5 rounded-2xl select-none font-bold cursor-pointer transition ${
              categoryFilter === "settlements" ? "bg-teal-600 text-white" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Source Payments
          </button>
        </div>

      </div>

      {/* History table log stream */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 shadow-2xl shadow-black/10 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="space-y-0.5">
            <h3 className="text-xs font-sans font-extrabold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
              <Activity className="w-4.5 h-4.5 text-teal-400" /> Chronological System Audit Timeline
            </h3>
            <p className="text-[10px] text-zinc-500 font-sans">
              Decentralized offline-first transaction security tracking stream
            </p>
          </div>
          <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
            Yielded: {filteredLog.length} ledger history rows
          </span>
        </div>

        {filteredLog.length === 0 ? (
          <div className="text-center py-20 text-zinc-600 text-xs font-sans border border-dashed border-zinc-800 rounded-2xl">
            No operations matches found inside the physical database audit.
          </div>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            <AnimatePresence initial={false}>
              {filteredLog.map((log, idx) => (
                <motion.div
                  key={`${log.id}-${idx}`}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="bg-zinc-950/40 border border-zinc-800 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-zinc-800 transition duration-150 font-sans"
                >
                  <div className="flex items-start gap-3">
                    {/* Category icon */}
                    <div className={`p-2 rounded-2xl mt-0.5 shrink-0 ${
                      log.category === "purchases" ? "bg-blue-500/10 text-blue-400" :
                      log.category === "collections" ? "bg-emerald-500/10 text-emerald-400" :
                      log.category === "settlements" ? "bg-indigo-500/10 text-indigo-400" :
                      "bg-purple-500/10 text-purple-400"
                    }`}>
                      {log.category === "purchases" ? <ShoppingBag className="w-4 h-4" /> :
                       log.category === "collections" ? <Landmark className="w-4 h-4" /> :
                       log.category === "settlements" ? <Anchor className="w-4 h-4" /> :
                       <Users className="w-4 h-4" />}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black text-zinc-200">
                          {log.title}
                        </span>
                        {log.localQueued && (
                          <span className="text-[9px] uppercase font-mono tracking-wider font-bold bg-amber-950/40 text-amber-500 border border-amber-900/40 px-1.5 py-0.2 rounded flex items-center gap-1 shrink-0 animate-pulse">
                            <HardDrive className="w-2.5 h-2.5" /> Offline Buffered Writing
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 leading-relaxed font-sans">{log.detail}</p>
                      
                      <div className="text-[10px] text-zinc-500 font-mono flex flex-wrap gap-x-2">
                        <span>Stamp Date: {log.date}</span>
                        <span>•</span>
                        <span>Operator Stamp: {log.operator}</span>
                        <span>•</span>
                        <span>Audit key: #{String(log.id).substring(0, 10)}</span>
                      </div>
                    </div>
                  </div>

                  {log.amount !== undefined && (
                    <div className="text-right shrink-0">
                      <span className="text-xs font-mono font-bold text-zinc-200 bg-zinc-900 px-3 py-1.5 rounded-2xl border border-zinc-800">
                        ₹ {log.amount.toLocaleString()}
                      </span>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

    </motion.div>
  );
};
