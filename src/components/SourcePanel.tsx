/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { useData } from "./DataContext";
import { PlusCircle, Search, Anchor, Scale, Landmark, Percent, Receipt, Lock, CheckCircle2, ChevronRight, Calculator, Archive, Trash2, Calendar, TrendingUp } from "lucide-react";
import { User as DbUser } from "../db";

interface SourcePanelProps {
  activeUser: DbUser | null;
  isAuthenticated: boolean;
}

export const SourcePanel: React.FC<SourcePanelProps> = ({ activeUser, isAuthenticated }) => {
  const { data, write } = useData();
  const [showAddSourceForm, setShowAddSourceForm] = useState(false);
  const [activeSettleSourceId, setActiveSettleSourceId] = useState<string | number | null>(null);
  const [expandedReportSourceId, setExpandedReportSourceId] = useState<string | number | null>(null);

  // New Source form states
  const [sourceName, setSourceName] = useState("");
  const [ratePerKg, setRatePerKg] = useState("");
  const [sourceDate, setSourceDate] = useState("2026-06-09");

  // Credit Settlement Form States
  const [amountPaidToSource, setAmountPaidToSource] = useState("");
  const [customCommission, setCustomCommission] = useState("");
  const [settleMethod, setSettleMethod] = useState<"auto" | "manual">("auto");
  const [manualWeight, setManualWeight] = useState("");
  const [manualRatePerKg, setManualRatePerKg] = useState("");
  const [commissionType, setCommissionType] = useState<"percent" | "flat">("flat");
  const [commissionPercent, setCommissionPercent] = useState("5");

  // States for unified Margin Analyst Panel
  const [analystDateFilter, setAnalystDateFilter] = useState<string>("all");
  const [analystSourceFilter, setAnalystSourceFilter] = useState<string>("all");
  const [analystFishFilter, setAnalystFishFilter] = useState<string>("all");

  const sources = data?.sources || [];
  const transactions = data?.transactions || [];
  const sourcePayments = data?.source_payments || [];

  // Group transactions by date, source, and fish type for administrative margin analysis
  const marginAnalysisRows = React.useMemo(() => {
    const map: { [key: string]: {
      date: string;
      sourceId: string | number;
      sourceName: string;
      sourceRate: number;
      fishType: string;
      totalKg: number;
      totalRevenue: number;
      totalCost: number;
      meanPrice: number;
      profit: number;
      profitPercent: number;
      transactionsCount: number;
    }} = {};

    transactions.forEach((tx) => {
      const srcId = tx.source_id;
      const src = sources.find((s) => s.id === srcId);
      if (!src) return;

      const dateStr = src.date || tx.date || "2026-06-09";
      const fType = tx.fish_type || "Unsorted Lot";
      const key = `${dateStr}__${srcId}__${fType}`;

      if (!map[key]) {
        map[key] = {
          date: dateStr,
          sourceId: srcId,
          sourceName: src.name,
          sourceRate: src.rate_per_kg || 0,
          fishType: fType,
          totalKg: 0,
          totalRevenue: 0,
          totalCost: 0,
          meanPrice: 0,
          profit: 0,
          profitPercent: 0,
          transactionsCount: 0,
        };
      }

      const kg = tx.weight || 0;
      const rev = tx.total_price || 0;

      map[key].totalKg += kg;
      map[key].totalRevenue += rev;
      map[key].transactionsCount += 1;
    });

    // Solve calculations
    Object.keys(map).forEach((k) => {
      const item = map[k];
      item.totalCost = item.totalKg * item.sourceRate;
      item.meanPrice = item.totalKg > 0 ? item.totalRevenue / item.totalKg : 0;
      item.profit = item.totalRevenue - item.totalCost;
      item.profitPercent = item.totalCost > 0 ? (item.profit / item.totalCost) * 100 : 0;
    });

    return Object.values(map).sort((a, b) => b.date.localeCompare(a.date) || a.sourceName.localeCompare(b.sourceName) || a.fishType.localeCompare(b.fishType));
  }, [transactions, sources]);

  // Get unique filters
  const uniqueDates = React.useMemo(() => {
    return (Array.from(new Set(marginAnalysisRows.map((r) => r.date))) as string[]).sort((a, b) => b.localeCompare(a));
  }, [marginAnalysisRows]);

  const uniqueSourceIdsAndNames = React.useMemo(() => {
    const seen = new Set();
    const result: { id: string | number; name: string }[] = [];
    marginAnalysisRows.forEach((r) => {
      if (!seen.has(r.sourceId)) {
        seen.add(r.sourceId);
        result.push({ id: r.sourceId, name: r.sourceName });
      }
    });
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [marginAnalysisRows]);

  const uniqueFishTypes = React.useMemo(() => {
    return (Array.from(new Set(marginAnalysisRows.map((r) => r.fishType))) as string[]).sort((a, b) => a.localeCompare(b));
  }, [marginAnalysisRows]);

  const filteredAnalysisRows = React.useMemo(() => {
    return marginAnalysisRows.filter((r) => {
      const matchesDate = analystDateFilter === "all" || r.date === analystDateFilter;
      const matchesSource = analystSourceFilter === "all" || String(r.sourceId) === analystSourceFilter;
      const matchesFish = analystFishFilter === "all" || r.fishType.toLowerCase() === analystFishFilter.toLowerCase();
      return matchesDate && matchesSource && matchesFish;
    });
  }, [marginAnalysisRows, analystDateFilter, analystSourceFilter, analystFishFilter]);

  const analysisSummary = React.useMemo(() => {
    let totalKg = 0;
    let totalRevenue = 0;
    let totalCost = 0;

    filteredAnalysisRows.forEach((r) => {
      totalKg += r.totalKg;
      totalRevenue += r.totalRevenue;
      totalCost += r.totalCost;
    });

    const totalProfit = totalRevenue - totalCost;
    const profitMarginPercent = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;
    const overallMeanPrice = totalKg > 0 ? totalRevenue / totalKg : 0;

    return {
      totalKg,
      totalRevenue,
      totalCost,
      totalProfit,
      profitMarginPercent,
      overallMeanPrice,
    };
  }, [filteredAnalysisRows]);

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceName || !ratePerKg) return;

    const rateNum = parseFloat(ratePerKg);
    const newSource = {
      id: `temp_s_${Date.now()}`,
      name: sourceName,
      rate_per_kg: rateNum,
      date: sourceDate,
      is_completed: false,
      is_archived: false,
    };

    await write("sources", "insert", newSource);

    setSourceName("");
    setRatePerKg("");
    setShowAddSourceForm(false);
  };

  const handleArchiveSource = async (srcId: string | number) => {
    const src = sources.find((s) => s.id === srcId);
    if (!src) return;

    const updated = { ...src, is_completed: true, is_archived: true };
    await write("sources", "update", updated);
  };

  // Run Settle Calculation on a Trawler
  const handleInitiateSettle = (srcId: string | number) => {
    const src = sources.find((s) => s.id === srcId);
    if (!src) return;

    // Filter transactions for this source
    const srcTx = transactions.filter((tx) => tx.source_id === srcId);
    const totalKg = srcTx.reduce((sum, tx) => sum + (tx.weight || 0), 0);
    const saleTotal = srcTx.reduce((sum, tx) => sum + (tx.total_price || 0), 0);

    // Default Commission = 5% of saleTotal
    const defaultComm = Math.round(saleTotal * 0.05);
    const defaultPaid = Math.max(0, saleTotal - defaultComm);

    setCustomCommission(defaultComm.toString());
    setAmountPaidToSource(defaultPaid.toString());
    setSettleMethod("auto");
    setManualWeight(totalKg.toString());
    setManualRatePerKg(src.rate_per_kg.toString());
    setCommissionType("flat");
    setCommissionPercent("5");
    setActiveSettleSourceId(srcId);
  };

  const handleSaveSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSettleSourceId) return;

    const src = sources.find((s) => s.id === activeSettleSourceId);
    if (!src) return;

    const srcTx = transactions.filter((tx) => tx.source_id === activeSettleSourceId);
    const calculatedKg = srcTx.reduce((sum, tx) => sum + (tx.weight || 0), 0);
    const calculatedProceeds = srcTx.reduce((sum, tx) => sum + (tx.total_price || 0), 0);

    const activeWeight = settleMethod === "manual" ? parseFloat(manualWeight) || 0 : calculatedKg;
    const activeRate = settleMethod === "manual" ? parseFloat(manualRatePerKg) || 0 : src.rate_per_kg;

    const costOfGoodsRaw = activeWeight * activeRate;
    const saleTotal = settleMethod === "manual" ? costOfGoodsRaw : calculatedProceeds;

    let activeCommission = 0;
    if (commissionType === "percent") {
      activeCommission = Math.round(saleTotal * (parseFloat(commissionPercent) || 0) / 100);
    } else {
      activeCommission = parseFloat(customCommission) || 0;
    }

    const finalAmountPaidToSource = parseFloat(amountPaidToSource) || Math.max(0, saleTotal - activeCommission);

    // 1. Create source_payments row
    const newPayment = {
      id: `temp_p_${Date.now()}`,
      source_id: activeSettleSourceId,
      date: src.date || "2026-06-09",
      total_kg: activeWeight,
      rate_per_kg: activeRate,
      sale_total: saleTotal,
      amount_paid_to_source: finalAmountPaidToSource,
      commission: activeCommission,
      is_settled: true,
    };

    await write("source_payments", "insert", newPayment);

    // 2. Mark the source as completed (settled)
    const updatedSource = {
      ...src,
      is_completed: true,
    };
    await write("sources", "update", updatedSource);

    setActiveSettleSourceId(null);
  };

  const isAdmin = activeUser?.role === "admin" && isAuthenticated;
  const isAuthorizedToLog = isAuthenticated && (activeUser?.role === "admin" || activeUser?.role === "auctioneer");

  return (
    <div className="space-y-6" id="sources-logistics-panel">
      {/* 1. Header and Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 p-5 rounded-xl flex items-center space-x-4 shadow-sm">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
            <Anchor className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium font-sans">Active Trawlers Today</div>
            <div className="text-xl font-bold text-slate-800">
              {sources.filter((s) => !s.is_completed).length} In Harbor
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-xl flex items-center space-x-4 shadow-sm">
          <div className="p-3 bg-teal-50 text-teal-600 rounded-lg font-sans">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium font-sans">Market Commissions (Total)</div>
            <div className="text-xl font-bold text-emerald-800 font-mono">
              ₹ {sourcePayments.reduce((sum, p) => sum + (p.commission || 0), 0).toLocaleString()}
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-xl flex items-center space-x-4 shadow-sm">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <Percent className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium font-sans">Total Settled Outflow</div>
            <div className="text-xl font-bold text-slate-800 font-mono">
              ₹ {sourcePayments.reduce((sum, p) => sum + (p.amount_paid_to_source || 0), 0).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Primary Actions Drawer Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-50 border border-slate-200 p-4 rounded-xl">
        <div className="text-xs text-slate-500 italic">
          ⚓ Register Trawlers representing raw suppliers or hatcheries before selling.
        </div>

        <button
          onClick={() => {
            if (!isAuthorizedToLog) {
              alert("Your current operator role does not have authorization to add fishing sources! Swapping to Admin or Auctioneer is required.");
              return;
            }
            setShowAddSourceForm(!showAddSourceForm);
          }}
          className={`w-full sm:w-auto px-4 py-2 text-xs font-semibold rounded-lg shadow-sm flex items-center justify-center gap-1.5 transition duration-200 cursor-pointer ${
            isAuthorizedToLog
              ? "bg-indigo-650 hover:bg-indigo-700 text-white"
              : "bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed"
          }`}
          id="btn-add-source"
        >
          <PlusCircle className="w-4 h-4" />
          Add Incoming Trawler / Loader
        </button>
      </div>

      {/* Add Source Form Drawer */}
      {showAddSourceForm && (
        <form onSubmit={handleAddSource} className="bg-slate-50 border border-slate-200 p-5 rounded-xl space-y-4 animate-slideDown shadow-inner">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
            <PlusCircle className="w-4 h-4 text-indigo-600 animate-pulse" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-sans">
              Register Incoming Fish Trawler / Source Group
            </h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-sans font-bold text-slate-600 block">
                Trawler ID / Fisherman Group Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                placeholder="e.g. Digha Estuary Trawler 04"
                required
                className="w-full text-xs text-slate-700 bg-white border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-indigo-500"
                id="form-source-name"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-sans font-bold text-slate-600 block">
                Base Purchase Rate / kg (INR) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={ratePerKg}
                onChange={(e) => setRatePerKg(e.target.value)}
                placeholder="e.g. 210"
                required
                className="w-full text-xs text-slate-700 bg-white border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-indigo-500"
                id="form-source-rate"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-sans font-bold text-slate-600 block">
                Arrival Unloading Date
              </label>
              <input
                type="date"
                value={sourceDate}
                onChange={(e) => setSourceDate(e.target.value)}
                className="w-full text-xs text-slate-700 bg-white border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-205">
            <button
              type="button"
              onClick={() => setShowAddSourceForm(false)}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-650 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow cursor-pointer"
              id="btn-save-source"
            >
              Create Source Group
            </button>
          </div>
        </form>
      )}

      {/* Main layout: active sources and settlements stacked */}
      <div className="flex flex-col gap-6 w-full">
        {/* Unsettled active trawlers - Full width */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col w-full">
          <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h4 className="font-sans font-bold text-xs uppercase tracking-wider text-slate-700">
              Active Fish Trawlers in Harbor
            </h4>
            <span className="text-[10px] bg-sky-100 text-sky-800 font-semibold px-2 py-0.5 rounded-full">
              In Stock / Loading
            </span>
          </div>

          <div className="divide-y divide-slate-100 flex-grow max-h-[500px] overflow-y-auto">
            {sources.filter((s) => !s.is_archived).length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs text-sans">
                No active fishing sources logged. Add an incoming trawler to start.
              </div>
            ) : (
              sources
                .filter((s) => !s.is_archived)
                .map((src) => {
                  const srcTx = transactions.filter((tx) => tx.source_id === src.id);
                  const kgSum = srcTx.reduce((sum, tx) => sum + (tx.weight || 0), 0);
                  const saleSum = srcTx.reduce((sum, tx) => sum + (tx.total_price || 0), 0);

                  return (
                    <div key={src.id} className="p-4 hover:bg-slate-50 transition duration-150 space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white ${
                            src.is_completed ? "bg-slate-400 animate-none" : "bg-indigo-600 animate-pulse"
                          }`}>
                            <Anchor className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-800 font-sans">{src.name}</div>
                            <div className="text-[10px] text-slate-500 font-semibold flex items-center gap-1 font-mono">
                              <Calendar className="w-3.5 h-3.5" /> Date Arrived: {src.date}
                            </div>
                          </div>
                        </div>

                        {src.is_completed ? (
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200 font-semibold">
                            Completed & Paid
                          </span>
                        ) : (
                          <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-100 font-bold">
                            Active Auction
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-2 bg-slate-50 rounded-lg p-2.5 text-center text-[10px] text-slate-600 font-mono">
                        <div>
                          <div className="text-slate-450 uppercase font-sans font-bold text-[8px]">Base Rate</div>
                          <div className="font-bold text-slate-800">₹{src.rate_per_kg}/kg</div>
                        </div>
                        <div>
                          <div className="text-slate-450 uppercase font-sans font-bold text-[8px]">Sold Out</div>
                          <div className="font-bold text-blue-700">{kgSum.toLocaleString()} kg</div>
                        </div>
                        <div>
                          <div className="text-slate-450 uppercase font-sans font-bold text-[8px]">Trawler Yield</div>
                          <div className="font-bold text-emerald-700">₹ {saleSum.toLocaleString()}</div>
                        </div>
                      </div>

                      {/* Yield Report toggle */}
                      <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 space-y-2">
                        <button
                          type="button"
                          onClick={() => setExpandedReportSourceId(expandedReportSourceId === src.id ? null : src.id)}
                          className="w-full text-center text-[10.5px] font-sans font-bold text-indigo-600 hover:text-indigo-805 transition flex items-center justify-center gap-1 cursor-pointer select-none py-1 bg-white border border-slate-200 rounded shadow-xs"
                        >
                          {expandedReportSourceId === src.id ? "▲ Close Crop Yield Report" : "📋 View Species Breakdown & Profit Math"}
                        </button>

                        {expandedReportSourceId === src.id && (
                          <div className="space-y-3 pt-2 text-[10px] text-slate-700 animate-slideDown">
                            <div className="font-sans font-black uppercase text-[8.5px] tracking-wider text-slate-500 border-b pb-1">
                              Species Performance Summary
                            </div>
                            
                            {/* Compute unique fish types for this supplier/trawler */}
                            {Array.from(new Set(srcTx.map(t => t.fish_type))).length === 0 ? (
                              <div className="text-center text-slate-400 py-2">No transactions recorded for this supplier.</div>
                            ) : (
                              <div className="space-y-3.5">
                                {Array.from(new Set(srcTx.map(t => t.fish_type))).map((fishName) => {
                                  const fishTx = srcTx.filter(t => t.fish_type === fishName);
                                  const fWeight = fishTx.reduce((sum, t) => sum + (t.weight || 0), 0);
                                  const fRevenue = fishTx.reduce((sum, t) => sum + (t.total_price || 0), 0);
                                  const meanBidPrice = fWeight > 0 ? fRevenue / fWeight : 0;
                                  const basePaidToTrawler = fWeight * src.rate_per_kg;
                                  const absoluteProfit = fRevenue - basePaidToTrawler;

                                  return (
                                    <div key={fishName} className="p-2.0 bg-white border border-slate-150 rounded-lg space-y-2">
                                      <div className="flex justify-between items-center text-[11px] font-sans font-black text-slate-800">
                                        <span className="text-teal-700 uppercase bg-teal-50 px-1.5 py-0.5 rounded border border-teal-100">{fishName}</span>
                                        <span className="font-mono text-indigo-700">{fWeight.toLocaleString()} KG Sold</span>
                                      </div>

                                      {/* Profit Math metrics */}
                                      <div className="grid grid-cols-2 gap-2 text-[9px] font-mono text-slate-600 border-t border-slate-100 pt-1.5">
                                        <div>
                                          <div>Weighted Mean Price:</div>
                                          <div className="font-bold text-slate-900">₹{meanBidPrice.toFixed(2)}/kg</div>
                                        </div>
                                        <div>
                                          <div>Contract Cost Rate:</div>
                                          <div className="font-bold text-slate-900">₹{src.rate_per_kg}/kg</div>
                                        </div>
                                        <div>
                                          <div>Gross Crop Auction Value:</div>
                                          <div className="font-bold text-slate-900">₹{fRevenue.toLocaleString()}</div>
                                        </div>
                                        <div>
                                          <div>Middleman Profit Math:</div>
                                          <div className={`font-black ${absoluteProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                            ₹{absoluteProfit.toLocaleString()} ({absoluteProfit >= 0 ? "+" : ""}{((absoluteProfit / (basePaidToTrawler || 1)) * 100).toFixed(1)}%)
                                          </div>
                                        </div>
                                      </div>

                                      {/* Purchaser History timelines */}
                                      <div className="bg-slate-50 p-1.5 rounded text-[8.5px] space-y-1 mt-1 font-sans">
                                        <div className="font-bold text-slate-400 uppercase tracking-wide">Sales Breakdown details:</div>
                                        {fishTx.map((t) => {
                                          const buyer = data?.buyers?.find((b) => b.id === t.buyer_id);
                                          return (
                                            <div key={t.id} className="flex justify-between items-center border-b border-white pb-0.5 last:border-0 font-mono text-slate-650">
                                              <span>
                                                👤 {buyer?.nickname || "Unknown Buyer"}
                                              </span>
                                              <span>
                                                {t.weight} kg @ ₹{t.price_per_kg}/kg (by <strong className="text-indigo-600 font-sans">{t.added_by || "Staff"}</strong>)
                                              </span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Settle Actions */}
                      <div className="flex items-center justify-between pt-1">
                        <button
                          onClick={() => handleArchiveSource(src.id)}
                          className="text-[10px] text-slate-500 hover:text-slate-750 flex items-center gap-1 cursor-pointer"
                          title="Hide from dashboard view"
                        >
                          <Archive className="w-3.5 h-3.5" />
                          <span>Archive Trawler</span>
                        </button>

                        {!src.is_completed && (
                          <button
                            onClick={() => handleInitiateSettle(src.id)}
                            disabled={!isAdmin}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1 border shadow-sm transition ${
                              isAdmin
                                ? "bg-indigo-650 border-indigo-700 text-white hover:bg-indigo-700 cursor-pointer"
                                : "bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100 cursor-help"
                            }`}
                            title={isAdmin ? "Initiate mathematical settlement balance" : "Admin operator required to execute credit payout settlements."}
                          >
                            <Calculator className="w-3.5 h-3.5" />
                            Settle Accounts
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>

        {/* Structured Settlement Calculator Panel - Full width */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col w-full">
          <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h4 className="font-sans font-bold text-xs uppercase tracking-wider text-slate-700">
              Accounts Settlement Panel
            </h4>
            <Landmark className="w-4 h-4 text-indigo-600" />
          </div>

          <div className="p-5 flex-grow space-y-4">
            {activeSettleSourceId ? (
              (() => {
                const src = sources.find((s) => s.id === activeSettleSourceId);
                if (!src) return null;

                const srcTx = transactions.filter((tx) => tx.source_id === activeSettleSourceId);
                const calculatedKg = srcTx.reduce((sum, tx) => sum + (tx.weight || 0), 0);
                const calculatedProceeds = srcTx.reduce((sum, tx) => sum + (tx.total_price || 0), 0);

                const activeWeight = settleMethod === "manual" ? parseFloat(manualWeight) || 0 : calculatedKg;
                const activeRate = settleMethod === "manual" ? parseFloat(manualRatePerKg) || 0 : src.rate_per_kg;

                const costOfGoodsRaw = activeWeight * activeRate;
                const saleTotal = settleMethod === "manual" ? costOfGoodsRaw : calculatedProceeds;

                // Commission Math
                let activeCommission = 0;
                if (commissionType === "percent") {
                  activeCommission = Math.round(saleTotal * (parseFloat(commissionPercent) || 0) / 100);
                } else {
                  activeCommission = parseFloat(customCommission) || 0;
                }

                const calculatedPayout = Math.max(0, saleTotal - activeCommission);

                return (
                  <form onSubmit={handleSaveSettlement} className="space-y-4 animate-fadeIn">
                    <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-slate-700 text-xs flex items-start gap-2 leading-relaxed">
                      <Calculator className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                      <div>
                        Currently settling ledger values for <strong>{src.name}</strong>. Choose standard calculations or customize the numbers manually.
                      </div>
                    </div>

                    {/* Settle Method Segment Block */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Settlement Sourcing Method
                      </label>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setSettleMethod("auto");
                            // Recalculate default comm
                            const defaultComm = Math.round(calculatedProceeds * 0.05);
                            setCustomCommission(defaultComm.toString());
                            setAmountPaidToSource(Math.max(0, calculatedProceeds - defaultComm).toString());
                          }}
                          className={`py-2 px-3 rounded-lg border text-center font-semibold transition cursor-pointer ${
                            settleMethod === "auto"
                              ? "bg-indigo-50 border-indigo-500 text-indigo-700 font-bold"
                              : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          Auto-Calculate Trades
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSettleMethod("manual");
                            setManualWeight(calculatedKg.toString());
                            setManualRatePerKg(src.rate_per_kg.toString());
                            // update commissions
                            const weightNum = parseFloat(calculatedKg.toString()) || 0;
                            const rateNum = parseFloat(src.rate_per_kg.toString()) || 0;
                            const projectedProceeds = weightNum * rateNum;
                            const defaultComm = Math.round(projectedProceeds * 0.05);
                            setCustomCommission(defaultComm.toString());
                            setAmountPaidToSource(Math.max(0, projectedProceeds - defaultComm).toString());
                          }}
                          className={`py-2 px-3 rounded-lg border text-center font-semibold transition cursor-pointer ${
                            settleMethod === "manual"
                              ? "bg-indigo-50 border-indigo-500 text-indigo-700 font-bold"
                              : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          Manual Cargo Override
                        </button>
                      </div>
                    </div>

                    {/* Manual Cargo Entry Form inputs */}
                    {settleMethod === "manual" && (
                      <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-lg grid grid-cols-2 gap-3 text-xs animate-slideDown">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-amber-855 text-amber-800 uppercase block">Manual Weight (KG)</label>
                          <input
                            type="number"
                            value={manualWeight}
                            onChange={(e) => {
                              setManualWeight(e.target.value);
                              // Sync payout
                              const w = parseFloat(e.target.value) || 0;
                              const r = parseFloat(manualRatePerKg) || 0;
                              const proceeds = w * r;
                              let comm = 0;
                              if (commissionType === "percent") {
                                comm = Math.round(proceeds * (parseFloat(commissionPercent) || 0) / 100);
                              } else {
                                comm = parseFloat(customCommission) || 0;
                              }
                              setAmountPaidToSource(Math.max(0, proceeds - comm).toString());
                            }}
                            className="w-full bg-white border border-amber-300 rounded p-2 text-slate-700 outline-none font-mono font-bold"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-amber-855 text-amber-800 uppercase block">Manual Price per kg (₹)</label>
                          <input
                            type="number"
                            value={manualRatePerKg}
                            onChange={(e) => {
                              setManualRatePerKg(e.target.value);
                              const w = parseFloat(manualWeight) || 0;
                              const r = parseFloat(e.target.value) || 0;
                              const proceeds = w * r;
                              let comm = 0;
                              if (commissionType === "percent") {
                                comm = Math.round(proceeds * (parseFloat(commissionPercent) || 0) / 100);
                              } else {
                                comm = parseFloat(customCommission) || 0;
                              }
                              setAmountPaidToSource(Math.max(0, proceeds - comm).toString());
                            }}
                            className="w-full bg-white border border-amber-300 rounded p-2 text-slate-700 outline-none font-mono font-bold"
                          />
                        </div>
                      </div>
                    )}

                    {/* Commission Type Selector */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Commission Calculation Rule
                      </label>
                      <div className="flex gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setCommissionType("flat");
                            const proceeds = settleMethod === "manual" ? (parseFloat(manualWeight) || 0) * (parseFloat(manualRatePerKg) || 0) : calculatedProceeds;
                            const defaultComm = Math.round(proceeds * 0.05);
                            setCustomCommission(defaultComm.toString());
                            setAmountPaidToSource(Math.max(0, proceeds - defaultComm).toString());
                          }}
                          className={`flex-1 py-1.5 px-3 rounded border text-center font-medium transition cursor-pointer ${
                            commissionType === "flat"
                              ? "bg-indigo-50 border-indigo-300 text-indigo-700 font-bold"
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          Flat INR Commission
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCommissionType("percent");
                            const proceeds = settleMethod === "manual" ? (parseFloat(manualWeight) || 0) * (parseFloat(manualRatePerKg) || 0) : calculatedProceeds;
                            const pct = parseFloat(commissionPercent) || 5;
                            const comm = Math.round(proceeds * pct / 100);
                            setAmountPaidToSource(Math.max(0, proceeds - comm).toString());
                          }}
                          className={`flex-1 py-1.5 px-3 rounded border text-center font-medium transition cursor-pointer ${
                            commissionType === "percent"
                              ? "bg-indigo-50 border-indigo-300 text-indigo-700 font-bold"
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          Percentage Commission (%)
                        </button>
                      </div>
                    </div>

                    {/* Percentage Preset Row */}
                    {commissionType === "percent" && (
                      <div className="flex gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] animate-slideDown">
                        <span className="text-slate-500 self-center font-sans pr-1">Fast Presets:</span>
                        {["2", "3", "5", "7", "10"].map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => {
                              setCommissionPercent(pct);
                              const proceeds = settleMethod === "manual" ? (parseFloat(manualWeight) || 0) * (parseFloat(manualRatePerKg) || 0) : calculatedProceeds;
                              const comm = Math.round(proceeds * parseFloat(pct) / 100);
                              setAmountPaidToSource(Math.max(0, proceeds - comm).toString());
                            }}
                            className={`flex-1 py-1 px-2 rounded text-center font-semibold border transition cursor-pointer ${
                              commissionPercent === pct
                                ? "bg-indigo-600 border-indigo-650 text-white"
                                : "bg-white text-slate-700 hover:bg-slate-100 border-slate-200"
                            }`}
                          >
                            {pct}%
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Live Computed Stats Ledger */}
                    <div className="space-y-1 text-xs font-mono bg-slate-900 text-slate-300 rounded-lg p-3.5 border border-slate-800">
                      <div className="flex justify-between border-b border-slate-800 pb-1.5 font-sans">
                        <span className="text-slate-450 uppercase text-[9px] font-bold">Ledger Balance Parameters</span>
                        <span className="text-slate-300 uppercase text-[9px] font-bold">Auditing Flow</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-850">
                        <span className="text-slate-400">Selected Cargo Weight:</span>
                        <span className="text-slate-100 font-bold">{activeWeight.toLocaleString()} KG</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-850">
                        <span className="text-slate-400">Buying Unit Cost:</span>
                        <span className="text-slate-100">₹{activeRate.toLocaleString()}/kg</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-850">
                        <span className="text-slate-400 text-teal-400">Total Purchase Value:</span>
                        <span className="text-teal-400 font-bold">₹{costOfGoodsRaw.toLocaleString()}</span>
                      </div>
                      {settleMethod === "auto" && (
                        <div className="flex justify-between py-1 border-b border-slate-850">
                          <span className="text-slate-400">Actual Auction Receipts:</span>
                          <span className="text-blue-400 font-bold">₹{calculatedProceeds.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between py-1.5 text-xs">
                        <span className="text-orange-400 font-bold flex items-center gap-1 font-sans">
                          <Percent className="w-3" /> Charged Commission:
                        </span>
                        <span className="text-orange-400 font-bold">₹{activeCommission.toLocaleString()} ({commissionType === "percent" ? `${commissionPercent}%` : "flat"})</span>
                      </div>
                    </div>

                    {/* Final Payment Custom Input Details */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Commission editable if flat */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-555 text-slate-600 uppercase tracking-widest block">
                          Commissions Amount (INR)
                        </label>
                        <input
                          type="number"
                          value={commissionType === "percent" ? activeCommission : customCommission}
                          disabled={commissionType === "percent"}
                          onChange={(e) => {
                            if (commissionType === "flat") {
                              setCustomCommission(e.target.value);
                              const ded = parseFloat(e.target.value) || 0;
                              setAmountPaidToSource(Math.max(0, saleTotal - ded).toString());
                            }
                          }}
                          className={`w-full text-xs text-slate-705 text-slate-700 bg-white border border-slate-300 rounded-lg p-2.5 outline-none font-mono font-bold ${
                            commissionType === "percent" ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "focus:ring-1 focus:ring-indigo-500"
                          }`}
                        />
                      </div>

                      {/* Net Payout Override Block (Fixed amount paid) */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest block">
                          Direct Net Payout (Fixed)
                        </label>
                        <input
                          type="number"
                          value={amountPaidToSource}
                          onChange={(e) => setAmountPaidToSource(e.target.value)}
                          placeholder={calculatedPayout.toString()}
                          className="w-full text-xs text-slate-700 bg-white border border-emerald-300 rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-emerald-500 font-mono font-bold text-emerald-700"
                          title="Type any fixed amount here to override calculations completely"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 justify-end pt-3 border-t border-slate-150 font-sans">
                      <button
                        type="button"
                        onClick={() => setActiveSettleSourceId(null)}
                        className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
                      >
                        Abort
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-indigo-650 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm cursor-pointer"
                        id="btn-confirm-settlement"
                      >
                        Confirm Payout & Settle
                      </button>
                    </div>
                  </form>
                );
              })()
            ) : (
              <div className="h-full flex flex-col items-center justify-center py-10 text-center text-slate-400 space-y-3">
                <Landmark className="w-10 h-10 text-slate-300" />
                <div className="text-xs font-bold text-slate-600">Select a Trawler to calculate credit payments</div>
                <p className="text-[11px] text-slate-405 leading-relaxed max-w-xs">
                  Settle trawler accounts to deduct bazaar commission, compute aggregate weights, and document outward capital flow.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Structured Payments History table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <h4 className="font-sans font-bold text-xs uppercase tracking-wider text-slate-700">
            Historic Trawler Settlement History ({sourcePayments.length})
          </h4>
          <span className="text-[10px] text-slate-500">
            Audit logs of market pay-outs
          </span>
        </div>

        {sourcePayments.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No payments settled yet.
          </div>
        ) : (
          <div className="overflow-x-auto text-[11px]">
            <table className="w-full text-left border-collapse font-sans text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-sans border-b border-slate-200 text-[10px] tracking-wider uppercase font-bold">
                  <th className="p-4 text-left">Trawler ID</th>
                  <th className="p-4 text-right">Aggr. Weight logged</th>
                  <th className="p-4 text-right">contract price / kg</th>
                  <th className="p-4 text-right">gross auction proceeds</th>
                  <th className="p-4 text-right">Market Commission Deducted</th>
                  <th className="p-4 text-right font-bold text-indigo-700">net cash paid outflow</th>
                  <th className="p-4 text-right">Settled Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {sourcePayments.map((pay) => {
                  const source = sources.find((s) => s.id === pay.source_id);
                  return (
                    <tr key={pay.id} className="hover:bg-slate-50 transition duration-150">
                      <td className="p-4 font-bold text-indigo-850 flex items-center gap-1.5">
                        <Anchor className="w-3.5 h-3.5 text-slate-400" />
                        <span>{source ? source.name : `Source (#${pay.source_id})`}</span>
                      </td>
                      <td className="p-4 text-right font-mono font-medium">{pay.total_kg} kg</td>
                      <td className="p-4 text-right font-mono">₹{pay.rate_per_kg}/kg</td>
                      <td className="p-4 text-right font-mono font-medium">₹{pay.sale_total.toLocaleString()}</td>
                      <td className="p-4 text-right font-mono text-emerald-700 font-bold">
                        ₹{pay.commission.toLocaleString()}
                      </td>
                      <td className="p-4 text-right font-mono text-indigo-700 font-bold">
                        ₹{pay.amount_paid_to_source.toLocaleString()}
                      </td>
                      <td className="p-4 text-right">
                        <span className="bg-indigo-50 border border-indigo-150 text-[10px] text-indigo-700 px-2.5 py-0.5 rounded-full font-bold">
                          {pay.date || "2026-06-09"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Administrative Profit & Margin Analyst Hub */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm space-y-4 p-5 animate-slideDown" id="admin-margin-analyst">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-150 pb-4 gap-2">
          <div>
            <h4 className="font-sans font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-indigo-600 animate-pulse" /> Administrative profit & margin analyst hub
            </h4>
            <p className="text-[10px] text-slate-505 text-slate-500 mt-0.5">
              Multi-dimensional cross-reference analyzer grouped by date, source trawler, and fish variety/crate
            </p>
          </div>
          <span className="text-[10px] bg-indigo-50 border border-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full font-mono font-bold select-none">
            {filteredAnalysisRows.length} Rows Computed
          </span>
        </div>

        {/* Dynamic Select Filters Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Date Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-sans font-bold text-slate-500 uppercase tracking-wider block">Arrival Date</label>
            <select
              value={analystDateFilter}
              onChange={(e) => setAnalystDateFilter(e.target.value)}
              className="w-full text-xs text-slate-700 bg-white border border-slate-200 rounded-lg p-2 outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">📅 All Dates</option>
              {uniqueDates.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Source Trawler Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-sans font-bold text-slate-500 uppercase tracking-wider block">Source Trawler</label>
            <select
              value={analystSourceFilter}
              onChange={(e) => setAnalystSourceFilter(e.target.value)}
              className="w-full text-xs text-slate-700 bg-white border border-slate-200 rounded-lg p-2 outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">⚓ All Sources</option>
              {uniqueSourceIdsAndNames.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Fish Variety Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-sans font-bold text-slate-500 uppercase tracking-wider block">Fish Type</label>
            <select
              value={analystFishFilter}
              onChange={(e) => setAnalystFishFilter(e.target.value)}
              className="w-full text-xs text-slate-700 bg-white border border-slate-200 rounded-lg p-2 outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">🐟 All Species Varieties</option>
              {uniqueFishTypes.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Multi-Dimensional Dashboard Key Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50/50 p-4 rounded-xl border border-slate-150">
          <div className="text-center p-2 bg-white rounded-lg border border-slate-150">
            <div className="text-[8.5px] font-bold text-slate-450 text-slate-400 uppercase tracking-widest">Aggregate Sold</div>
            <div className="text-[13px] md:text-sm font-black font-mono text-indigo-700 mt-1">
              {analysisSummary.totalKg.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg
            </div>
          </div>
          <div className="text-center p-2 bg-white rounded-lg border border-slate-150">
            <div className="text-[8.5px] font-bold text-slate-450 text-slate-400 uppercase tracking-widest">Auction Revenues</div>
            <div className="text-[13px] md:text-sm font-black font-mono text-emerald-600 mt-1">
              ₹ {analysisSummary.totalRevenue.toLocaleString()}
            </div>
          </div>
          <div className="text-center p-2 bg-white rounded-lg border border-slate-150">
            <div className="text-[8.5px] font-bold text-slate-450 text-slate-400 uppercase tracking-widest">Base Raw Cost</div>
            <div className="text-[13px] md:text-sm font-black font-mono text-slate-600 mt-1">
              ₹ {analysisSummary.totalCost.toLocaleString()}
            </div>
          </div>
          <div className="text-center p-2 bg-white rounded-lg border border-slate-150">
            <div className="text-[8.5px] font-bold text-slate-450 text-slate-400 uppercase tracking-widest">Dealer Net Margin</div>
            <div className={`text-[13px] md:text-sm font-black font-mono mt-1 ${
              analysisSummary.totalProfit >= 0 ? "text-emerald-650 text-emerald-650 text-emerald-500" : "text-rose-500"
            }`}>
              ₹ {analysisSummary.totalProfit.toLocaleString()}{" "}
              <span className="text-[9.5px]">
                ({analysisSummary.totalProfit >= 0 ? "+" : ""}{analysisSummary.profitMarginPercent.toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>

        {/* Aggregated Analytical Grid Results */}
        {filteredAnalysisRows.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs font-sans">
            No matching sales transactions matched the filtered parameters.
          </div>
        ) : (
          <div className="overflow-x-auto min-w-full">
            <table className="w-full text-left border-collapse font-sans text-xs">
              <thead>
                <tr className="bg-slate-55 bg-slate-50 text-slate-500 font-sans border-b border-slate-205 border-b border-slate-200 text-[10px] tracking-wider uppercase font-extrabold pb-2">
                  <th className="p-3">Arrival Date</th>
                  <th className="p-3">Source Trawler</th>
                  <th className="p-3">Fish Type</th>
                  <th className="p-3 text-right">Sold Quantity</th>
                  <th className="p-3 text-right text-indigo-700">Mean Price / kg</th>
                  <th className="p-3 text-right">Contract Cost / kg</th>
                  <th className="p-3 text-right text-emerald-600">Market Proceeds</th>
                  <th className="p-3 text-right">Purchase Cost</th>
                  <th className="p-3 text-right">Gross Profit Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 text-[11px]">
                {filteredAnalysisRows.map((row, index) => {
                  return (
                    <tr key={index} className="hover:bg-slate-50 transition duration-150 font-sans">
                      <td className="p-3 text-slate-500 font-mono">
                        {row.date}
                      </td>
                      <td className="p-3 font-semibold text-slate-800">
                        {row.sourceName}
                      </td>
                      <td className="p-3">
                        <span className="text-[10px] uppercase font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-100">
                          {row.fishType}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono font-bold">
                        {row.totalKg.toLocaleString()} kg
                      </td>
                      <td className="p-3 text-right font-mono font-black text-indigo-700">
                        ₹ {row.meanPrice.toFixed(2)}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-500">
                        ₹ {row.sourceRate.toFixed(2)}
                      </td>
                      <td className="p-3 text-right font-mono text-emerald-650 text-emerald-600 font-bold">
                        ₹ {row.totalRevenue.toLocaleString()}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-500">
                        ₹ {row.totalCost.toLocaleString()}
                      </td>
                      <td className={`p-3 text-right font-mono font-black ${
                        row.profit >= 0 ? "text-emerald-500" : "text-rose-500"
                      }`}>
                        <div className="leading-tight">
                          ₹ {row.profit.toLocaleString()}
                        </div>
                        <div className="text-[9.5px] font-bold opacity-80 leading-tight block">
                          {row.profit >= 0 ? "+" : ""}{row.profitPercent.toFixed(1)}%
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
