/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { useData } from "./DataContext";
import { PlusCircle, Search, Anchor, Scale, Landmark, Percent, Receipt, Lock, CheckCircle2, ChevronRight, Calculator, Archive, Trash2, Calendar, TrendingUp, Printer } from "lucide-react";
import { User as DbUser } from "../db";
import { shareAsPDF } from "../utils/pdf";
import { SourcePaymentFlow } from "./SourcePaymentFlow";

interface SourcePanelProps {
  activeUser: DbUser | null;
  isAuthenticated: boolean;
}

const SourceBillGenerator: React.FC<{
  source: any;
  transactions: any[];
  appDate: string;
  payment?: any;
}> = ({ source, transactions, appDate, payment }) => {
  const [items, setItems] = useState<{ id: string; fishType: string; weight: string; rate: string; }[]>([]);
  const [isPrinting, setIsPrinting] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);

  useEffect(() => {
    const rawItems: { id: string; fishType: string; weight: string; rate: string }[] = [];
    const fishTypes = Array.from(new Set(transactions.map((t: any) => t.fish_type || "Unsorted"))) as string[];
    
    fishTypes.forEach((ft, idx) => {
      const fTx = transactions.filter(t => (t.fish_type || "Unsorted") === ft);
      const wt = fTx.reduce((sum, t) => sum + (t.weight || 0), 0);
      rawItems.push({
        id: idx.toString(),
        fishType: ft,
        weight: wt.toString(),
        rate: source.rate_per_kg.toString()
      });
    });

    if (rawItems.length === 0) {
       rawItems.push({ id: '0', fishType: 'Unsorted Catch', weight: '0', rate: source.rate_per_kg.toString() });
    }
    
    setItems(rawItems);
  }, [source, transactions]);
  
  const totalGrossP = items.reduce((sum, it) => sum + (parseFloat(it.weight) || 0) * (parseFloat(it.rate) || 0), 0);
  const commissionDeducted = payment?.commission_amount || 0;
  // We deduce advance paid backward if we know net_paid and commission, since net_paid = total - commission - advance.
  const advanceDeducted = payment ? (totalGrossP - commissionDeducted - payment.net_paid) : 0;
  const netDueP = payment ? payment.net_paid : totalGrossP;

  const handlePrint = async () => {
    setLoadingPdf(true);
    setIsPrinting(true);
    // Let react render the print version briefly
    setTimeout(async () => {
      try {
        await shareAsPDF(
          `source-bill-${source.id}`,
          `Payout_Bill_${source.name.replace(/\s+/g, '_')}_${appDate}.pdf`,
          `Source Payout Invoice: ${source.name}`,
          `Generated electronic payout invoice for ${source.name} on ${appDate}.`,
          'download'
        );
      } catch (err) {
        console.error("PDF generation failed", err);
        alert("Warning: Could not create PDF. Falling back to native print.");
        window.print();
      } finally {
        setIsPrinting(false);
        setLoadingPdf(false);
      }
    }, 150);
  };

  return (
    <div className="mt-3 p-3 bg-white border-2 border-zinc-200 shadow-sm rounded-2xl space-y-4">
      <div className="flex justify-between items-center mb-2">
         <h4 className="font-black text-zinc-800 uppercase text-xs">🧾 Source Payout Bill</h4>
      </div>
      
      {/* Read-Only Views */}
      <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
        {items.map((item) => (
          <div key={item.id} className="grid grid-cols-12 gap-1.5 p-2 bg-zinc-50 border border-zinc-200 rounded-2xl text-[10px]">
             <div className="col-span-6">
               <span className="text-[8px] font-bold text-zinc-500 uppercase block mb-0.5">Item/Fish Type</span>
               <div className="font-sans font-bold text-zinc-800">{item.fishType}</div>
             </div>
             <div className="col-span-3">
               <span className="text-[8px] font-bold text-zinc-500 uppercase block mb-0.5">Weight (KG)</span>
               <div className="font-mono text-zinc-800">{parseFloat(item.weight).toLocaleString()} kg</div>
             </div>
             <div className="col-span-3">
               <span className="text-[8px] font-bold text-zinc-500 uppercase block mb-0.5">Rate/KG (₹)</span>
               <div className="font-mono text-zinc-800">₹{parseFloat(item.rate).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
             </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 pt-2">
         <div className="bg-zinc-50 p-3 rounded-2xl border border-zinc-200 shadow-sm text-xs space-y-1">
             <div className="flex justify-between text-zinc-600">
               <span>Gross Purchase Value:</span>
               <span className="font-mono text-zinc-800 font-bold">₹{totalGrossP.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
             </div>
             {commissionDeducted > 0 && (
               <div className="flex justify-between text-rose-600">
                 <span>Less - Commission Deducted:</span>
                 <span className="font-mono">- ₹{commissionDeducted.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
               </div>
             )}
             {advanceDeducted > 0 && (
               <div className="flex justify-between text-rose-600">
                 <span>Less - Advance Paid:</span>
                 <span className="font-mono">- ₹{advanceDeducted.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
               </div>
             )}
             <div className="flex justify-between font-black text-emerald-800 pt-2 border-t border-zinc-200 mt-2">
               <span>Net Paid To Source:</span>
               <span className="font-mono">₹{netDueP.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
             </div>
         </div>
      </div>

      <div className="flex justify-end pt-2">
        <button 
          onClick={handlePrint} 
          disabled={loadingPdf}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold py-2 px-4 rounded-2xl text-xs flex items-center justify-center gap-1.5 w-full shadow"
        >
          {loadingPdf ? <span className="animate-pulse">Building PDF...</span> : <><Printer className="w-3.5 h-3.5" /> Generates PDF Invoice</>}
        </button>
      </div>

      {/* Hidden Print Canvas Area */}
      <div className="fixed -left-[4000px] top-0 opacity-0 pointer-events-none">
        <div id={`source-bill-${source.id}`} className="bg-white p-8 space-y-6 font-sans w-[800px] max-w-none print:w-full select-text text-zinc-900 border-2 border-transparent">
          <div className="border-b-2 border-zinc-900 pb-4 flex justify-between items-start">
            <div>
              <h3 className="text-3xl font-black tracking-tight text-zinc-950 uppercase">NEW FISH CENTER</h3>
              <p className="text-[10px] text-zinc-800 font-extrabold tracking-wider font-mono uppercase">Commission Agent and Wholesaler • Proprietor: Chanchal Das</p>
              <p className="text-[10px] text-zinc-600 mt-0.5 uppercase">BALIA, Chakdaha, Nadia</p>
            </div>
            <div className="text-right">
              <div className="text-lg font-black text-zinc-950 font-mono tracking-wider">PAYOUT BILL</div>
              <div className="text-xs text-zinc-600 font-semibold font-mono mt-1">Date: {appDate}</div>
              <div className="text-[10px] text-zinc-500 font-mono">Invoice #: S-{source.id.toString().slice(-6)}</div>
            </div>
          </div>
          
          <div className="bg-zinc-100 p-3 rounded-2xl border border-zinc-200 flex justify-between items-center">
             <div>
               <div className="text-[10px] uppercase font-bold text-zinc-500">Source / Vessel Name</div>
               <div className="text-lg font-black text-indigo-900">{source.name}</div>
             </div>
          </div>

          <table className="w-full text-sm border-collapse font-sans mt-4">
            <thead>
              <tr className="bg-zinc-900 text-white uppercase text-[10px] font-bold tracking-wider">
                 <th className="text-left py-2 px-3">Fish Type / Details</th>
                 <th className="text-right py-2 px-3">Weight (KG)</th>
                 <th className="text-right py-2 px-3">Rate/KG (₹)</th>
                 <th className="text-right py-2 px-3">Total Value</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => {
                const w = parseFloat(it.weight) || 0;
                const r = parseFloat(it.rate) || 0;
                return (
                  <tr key={it.id} className={`border-b ${i % 2 === 0 ? "bg-zinc-50" : "bg-white"} border-zinc-200 text-[11px] font-bold text-zinc-800`}>
                    <td className="py-2.5 px-3 uppercase">{it.fishType}</td>
                    <td className="text-right py-2.5 px-3 font-mono">{w.toLocaleString()}</td>
                    <td className="text-right py-2.5 px-3 font-mono">{r.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td className="text-right py-2.5 px-3 font-mono text-zinc-900">₹{(w * r).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div className="flex justify-end pt-4">
             <div className="w-1/2 space-y-2 text-xs">
                <div className="flex justify-between items-center font-bold text-zinc-700 py-1">
                  <span className="uppercase text-[9px] tracking-wider">Gross Purchase Value:</span>
                  <span className="font-mono">₹{totalGrossP.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>
                {commissionDeducted > 0 && (
                  <div className="flex justify-between items-center font-bold text-red-600 py-1">
                    <span className="uppercase text-[9px] tracking-wider">Less - Commission Deducted:</span>
                    <span className="font-mono">- ₹{commissionDeducted.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                )}
                <div className="flex justify-between items-center font-bold text-red-600 py-1 border-b border-zinc-300 pb-2">
                  <span className="uppercase text-[9px] tracking-wider">Less - Advance Paid:</span>
                  <span className="font-mono">- ₹{advanceDeducted.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>
                <div className="flex justify-between items-center font-black text-lg text-emerald-800 py-2">
                  <span className="uppercase text-[12px] tracking-wider">Total Net Paid:</span>
                  <span className="font-mono">₹{netDueP.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>
             </div>
          </div>

          <div className="mt-12 mb-4 pt-16 flex justify-between items-end border-t-2 border-zinc-100 px-6">
             <div className="text-center">
                <div className="w-32 border-b border-zinc-400 mb-1"></div>
                <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Receiver Signature</div>
             </div>
             <div className="text-center">
                <div className="text-sm font-black text-zinc-800 italic font-mono">Chanchal Das</div>
                <div className="w-32 border-b border-zinc-400 my-1 mx-auto"></div>
                <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Authorized Signatory</div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

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

  const sources = data?.sources || [];
  const transactions = data?.transactions || [];
  const sourcePayments = data?.source_payments || [];
  const appDate = "2026-06-09";

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

  // Run Settle Calculation on a Source
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
    
    setTimeout(() => {
      document.getElementById("settlement-panel-box")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
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
      <div className="bg-white border border-zinc-200 p-3 rounded-2xl flex items-center justify-between shadow-sm text-xs font-sans">
         <div className="flex items-center gap-2">
           <Anchor className="w-4 h-4 text-indigo-600" />
           <span className="text-zinc-500 font-medium whitespace-nowrap">Active In Harbor:</span>
           <span className="font-bold text-zinc-800">{sources.filter((s) => !s.is_completed).length}</span>
         </div>
         <div className="flex items-center gap-2 border-l border-zinc-200 pl-3">
           <Receipt className="w-4 h-4 text-teal-600" />
           <span className="text-zinc-500 font-medium whitespace-nowrap">Market Commissions:</span>
           <span className="font-bold text-emerald-700 font-mono">₹{sourcePayments.reduce((sum, p) => sum + (p.commission || 0), 0).toLocaleString()}</span>
         </div>
         <div className="flex items-center gap-2 border-l border-zinc-200 pl-3">
           <Percent className="w-4 h-4 text-blue-600" />
           <span className="text-zinc-500 font-medium whitespace-nowrap">Settled Outflow:</span>
           <span className="font-bold text-zinc-800 font-mono">₹{sourcePayments.reduce((sum, p) => sum + (p.amount_paid_to_source || 0), 0).toLocaleString()}</span>
         </div>
      </div>

      {/* Primary Actions Drawer Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-zinc-50 border border-zinc-200 p-4 rounded-2xl">
        <div className="text-xs text-zinc-500 italic">
          ⚓ Register Sources representing raw suppliers or hatcheries before selling.
        </div>

        <button
          onClick={() => {
            if (!isAuthorizedToLog) {
              alert("Your current operator role does not have authorization to add fishing sources! Swapping to Admin or Auctioneer is required.");
              return;
            }
            setShowAddSourceForm(!showAddSourceForm);
          }}
          className={`w-full sm:w-auto px-4 py-2 text-xs font-semibold rounded-2xl shadow-sm flex items-center justify-center gap-1.5 transition duration-200 cursor-pointer ${
            isAuthorizedToLog
              ? "bg-indigo-600 hover:bg-indigo-700 text-white"
              : "bg-zinc-200 text-zinc-400 border border-zinc-300 cursor-not-allowed"
          }`}
          id="btn-add-source"
        >
          <PlusCircle className="w-4 h-4" />
          Add Incoming Source / Loader
        </button>
      </div>

      {/* Add Source Form Drawer */}
      {showAddSourceForm && (
        <form onSubmit={handleAddSource} className="bg-zinc-50 border border-zinc-200 p-5 rounded-2xl space-y-4 animate-slideDown shadow-inner">
          <div className="flex items-center gap-2 pb-2 border-b border-zinc-200">
            <PlusCircle className="w-4 h-4 text-indigo-600 animate-pulse" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-700 font-sans">
              Register Incoming Fish Source / Source Group
            </h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-sans font-bold text-zinc-600 block">
                Source ID / Fisherman Group Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                placeholder="e.g. Digha Estuary Source 04"
                required
                className="w-full text-xs text-zinc-700 bg-white border border-zinc-300 rounded-2xl p-2.5 outline-none focus:ring-1 focus:ring-indigo-500"
                id="form-source-name"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-sans font-bold text-zinc-600 block">
                Base Purchase Rate / kg (INR) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={ratePerKg}
                onChange={(e) => setRatePerKg(e.target.value)}
                placeholder="e.g. 210"
                required
                className="w-full text-xs text-zinc-700 bg-white border border-zinc-300 rounded-2xl p-2.5 outline-none focus:ring-1 focus:ring-indigo-500"
                id="form-source-rate"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-sans font-bold text-zinc-600 block">
                Arrival Unloading Date
              </label>
              <input
                type="date"
                value={sourceDate}
                onChange={(e) => setSourceDate(e.target.value)}
                className="w-full text-xs text-zinc-700 bg-white border border-zinc-300 rounded-2xl p-2.5 outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-200">
            <button
              type="button"
              onClick={() => setShowAddSourceForm(false)}
              className="px-4 py-2 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 text-xs font-semibold rounded-2xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-2xl shadow cursor-pointer"
              id="btn-save-source"
            >
              Create Source Group
            </button>
          </div>
        </form>
      )}

      {/* Main layout: active sources and settlements stacked */}
      <div className="flex flex-col gap-6 w-full">
        {/* Unsettled active sources - Full width */}
        <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm flex flex-col w-full">
          <div className="px-5 py-4 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
            <h4 className="font-sans font-bold text-xs uppercase tracking-wider text-zinc-700">
              Active Fish Sources in Harbor
            </h4>
            <span className="text-[10px] bg-sky-100 text-sky-800 font-semibold px-2 py-0.5 rounded-full">
              In Stock / Loading
            </span>
          </div>

          <div className="divide-y divide-zinc-100 flex-grow max-h-[500px] overflow-y-auto">
            {sources.filter((s) => !s.is_archived).length === 0 ? (
              <div className="p-12 text-center text-zinc-400 text-xs text-sans">
                No active fishing sources logged. Add an incoming source to start.
              </div>
            ) : (
              sources
                .filter((s) => !s.is_archived)
                .map((src) => {
                  const srcTx = transactions.filter((tx) => tx.source_id === src.id);
                  const kgSum = srcTx.reduce((sum, tx) => sum + (tx.weight || 0), 0);
                  const saleSum = srcTx.reduce((sum, tx) => sum + (tx.total_price || 0), 0);

                  return (
                    <div key={src.id} className="p-4 hover:bg-zinc-50 transition duration-150 space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-2xl flex items-center justify-center text-white ${
                            src.is_completed ? "bg-zinc-400 animate-none" : "bg-indigo-600 animate-pulse"
                          }`}>
                            <Anchor className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-zinc-800 font-sans">{src.name}</div>
                            <div className="text-[10px] text-zinc-500 font-semibold flex items-center gap-1 font-mono">
                              <Calendar className="w-3.5 h-3.5" /> Date Arrived: {src.date}
                            </div>
                          </div>
                        </div>

                        {src.is_completed ? (
                          <span className="text-[10px] bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full border border-zinc-200 font-semibold">
                            Completed & Paid
                          </span>
                        ) : (
                          <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-100 font-bold">
                            Active Auction
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-2 bg-zinc-50 rounded-2xl p-2.5 text-center text-[10px] text-zinc-600 font-mono">
                        <div>
                          <div className="text-zinc-500 uppercase font-sans font-bold text-[8px]">Base Rate</div>
                          <div className="font-bold text-zinc-800">₹{src.rate_per_kg}/kg</div>
                        </div>
                        <div>
                          <div className="text-zinc-500 uppercase font-sans font-bold text-[8px]">Sold Out</div>
                          <div className="font-bold text-blue-700">{kgSum.toLocaleString()} kg</div>
                        </div>
                        <div>
                          <div className="text-zinc-500 uppercase font-sans font-bold text-[8px]">Source Yield</div>
                          <div className="font-bold text-emerald-700">₹ {saleSum.toLocaleString()}</div>
                        </div>
                      </div>

                      {/* Yield Report toggle */}
                      <div className="bg-zinc-50 rounded-2xl p-2.5 border border-zinc-100 space-y-2">
                        <button
                          type="button"
                          onClick={() => setExpandedReportSourceId(expandedReportSourceId === src.id ? null : src.id)}
                          className="w-full text-center text-[10.5px] font-sans font-bold text-indigo-600 hover:text-indigo-805 transition flex items-center justify-center gap-1 cursor-pointer select-none py-1 bg-white border border-zinc-200 rounded shadow-xs"
                        >
                          {expandedReportSourceId === src.id ? "▲ Close" : "Pay the Sources (Open)"}
                        </button>

                        {src.is_completed && (
                          <button
                            type="button"
                            onClick={() => setExpandedReportSourceId(expandedReportSourceId === 'pdf_' + src.id ? null : 'pdf_' + src.id)}
                            className="w-full text-center text-[10.5px] font-sans font-bold text-rose-600 hover:text-rose-800 transition flex items-center justify-center gap-1 cursor-pointer select-none py-1 bg-white border border-zinc-200 rounded shadow-xs mt-1"
                          >
                            {expandedReportSourceId === 'pdf_' + src.id ? "▲ Close Invoice Builder" : "🧾 Generate Bill / Source Payout Slip"}
                          </button>
                        )}

                        {(expandedReportSourceId === src.id || expandedReportSourceId === 'pdf_' + src.id) && (
                          <div className="pt-2 animate-slideDown">
                            <SourcePaymentFlow 
                              source={src} 
                              transactions={srcTx} 
                              appDate={appDate} 
                              onClose={() => setExpandedReportSourceId(null)} 
                            />
                          </div>
                        )}
                      </div>

                      {/* Settle Actions */}
                      <div className="flex items-center justify-between pt-1">
                        <button
                          onClick={() => handleArchiveSource(src.id)}
                          className="text-[10px] text-zinc-500 hover:text-zinc-700 flex items-center gap-1 cursor-pointer"
                          title="Hide from dashboard view"
                        >
                          <Archive className="w-3.5 h-3.5" />
                          <span>Archive Source</span>
                        </button>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>





      </div>

      {/* Structured Payments History table */}
      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 bg-zinc-50 border-b border-zinc-200 flex justify-between items-center">
          <h4 className="font-sans font-bold text-xs uppercase tracking-wider text-zinc-700">
            Historic Source Settlement History ({sourcePayments.length})
          </h4>
          <span className="text-[10px] text-zinc-500">
            Audit logs of market pay-outs
          </span>
        </div>

        {sourcePayments.length === 0 ? (
          <div className="p-8 text-center text-zinc-400 text-xs">
            No payments settled yet.
          </div>
        ) : (
          <div className="overflow-x-auto text-[11px]">
            <table className="w-full text-left border-collapse font-sans text-xs">
              <thead>
                <tr className="bg-zinc-50 text-zinc-500 font-sans border-b border-zinc-200 text-[10px] tracking-wider uppercase font-bold">
                  <th className="p-4 text-left">Source ID</th>
                  <th className="p-4 text-right">Aggr. Weight logged</th>
                  <th className="p-4 text-right">contract price / kg</th>
                  <th className="p-4 text-right">gross auction proceeds</th>
                  <th className="p-4 text-right">Market Commission Deducted</th>
                  <th className="p-4 text-right font-bold text-indigo-700">net cash paid outflow</th>
                  <th className="p-4 text-right">Settled Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-zinc-700">
                {sourcePayments.map((pay) => {
                  const source = sources.find((s) => s.id === pay.source_id);
                  return (
                    <tr key={pay.id} className="hover:bg-zinc-50 transition duration-150">
                      <td className="p-4 font-bold text-indigo-800 flex items-center gap-1.5">
                        <Anchor className="w-3.5 h-3.5 text-zinc-400" />
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
    </div>
  );
};
