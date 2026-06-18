import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Share, Download, LogOut, CheckCircle, FileText, ArrowRight, X, Share2, Printer } from 'lucide-react';
import { useData } from './DataContext';
import { shareAsPDF } from '../utils/pdf';

interface PdfExportViewProps {
  onClose: () => void;
  defaultTab?: "auction" | "source_payment" | "collection" | "collection_slip" | "day_closing";
}

export const PdfExportView: React.FC<PdfExportViewProps> = ({ onClose, defaultTab = "auction" }) => {
  const { data, appDate } = useData();
  const [activePdfTab, setActivePdfTab] = React.useState(defaultTab);
  const [slipCategory, setSlipCategory] = React.useState<"buyers" | "sources">("buyers");
  const [selectedAuctioneerFilter, setSelectedAuctioneerFilter] = React.useState<string>("All");
  const [scaleFactor, setScaleFactor] = React.useState(1);
  React.useEffect(() => {
    let timer: any;
    const updateScale = () => {
      const parent = document.getElementById('dashboard-preview-parent');
      if (!parent) {
        timer = setTimeout(updateScale, 50);
        return;
      }
      const width = parent.clientWidth;
      const height = parent.clientHeight;
      const scaleX = (width - 32) / 794;
      const scaleY = (height - 32) / 1123;
      const newScale = Math.min(scaleX, scaleY);
      setScaleFactor(Math.max(0.15, Math.min(1, newScale)));
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => {
      window.removeEventListener('resize', updateScale);
      clearTimeout(timer);
    };
  }, [activePdfTab]);

  const fmt = (v: number) => "₹" + Math.round(v).toLocaleString();
  const fmtKg = (v: number) => v.toFixed(1) + " kg";

  const buyers = data?.buyers || [];
  const sources = data?.sources || [];
  const transactions = (data?.transactions || []).filter((tx: any) => tx.date === appDate);
  const collections = (data?.daily_collections || []).filter((c: any) => c.date === appDate);
  const sourcePayments = (data?.source_payments || []).filter((p: any) => p.date === appDate);

  const uniqueAuctioneers = Array.from(
    new Set(transactions.map((tx: any) => tx.added_by || "Unknown Auctioneer"))
  );

  const filteredPrintedTransactions = selectedAuctioneerFilter === "All"
    ? transactions
    : transactions.filter((tx: any) => (tx.added_by || "Unknown Auctioneer") === selectedAuctioneerFilter);

  const totalSalesVolume = transactions.reduce((sum: number, tx: any) => sum + (tx.total_price || 0), 0);
  const totalWeightSold = transactions.reduce((sum: number, tx: any) => sum + (tx.weight || 0), 0);
  const approvedCollections = collections.filter((c: any) => c.is_approved);
  const totalCollectionsReceived = approvedCollections.reduce((sum: number, c: any) => sum + (c.amount_paid || 0), 0);
  const pendingCollections = collections.filter((c: any) => !c.is_approved);
  const totalCollectionsPending = pendingCollections.reduce((sum: number, c: any) => sum + (c.amount_paid || 0), 0);
  const activeSourcesCount = sources.filter((s: any) => !s.is_completed).length;
  const totalCommissions = sourcePayments.reduce((sum: number, p: any) => sum + (p.commission || 0), 0);
  const totalProfit = sourcePayments.reduce((sum: number, p: any) => sum + ((p.sale_total || 0) - (p.amount_paid_to_source || 0)), 0);

  const buyerBalancesList = buyers.map((b: any) => {
    const bTxList = transactions.filter((tx: any) => String(tx.buyer_id) === String(b.id));
    const todayPurchases = bTxList.reduce((sum: number, tx: any) => sum + (tx.total_price || 0), 0);
    const todayWeight = bTxList.reduce((sum: number, tx: any) => sum + (tx.weight || 0), 0);
    
    const bColList = collections.filter((col: any) => String(col.buyer_id) === String(b.id));
    const todayPaid = bColList.reduce((sum: number, col: any) => sum + (col.amount_paid || 0), 0);
    const approvedCash = bColList.filter((col: any) => col.is_approved).reduce((sum: number, col: any) => sum + (col.amount_paid || 0), 0);
    const pendingCash = bColList.filter((col: any) => !col.is_approved).reduce((sum: number, col: any) => sum + (col.amount_paid || 0), 0);
    
    // Previous balance before today's shift starts
    const prevRollover = Math.max(0, b.lifetime_debt - todayPurchases + todayPaid);
    
    return {
      buyer: b,
      prevRollover,
      todayPurchases,
      todayWeight,
      todayPaid,
      approvedCash,
      pendingCash,
      currentBalance: b.lifetime_debt
    };
  });

  return (
    
          <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-3 select-none backdrop-blur-sm print:static print:inset-auto print:bg-white print:p-0 print:block print:transform-none print:w-full print:h-auto">
            <style>{`
              @media print {
                @page {
                  size: A4 portrait;
                  margin: 10mm;
                }
                html, body, #root {
                  height: auto !important;
                  width: auto !important;
                  overflow: visible !important;
                  position: static !important;
                  background: white !important;
                }
                body * {
                  visibility: hidden !important;
                }
                #print-sheet-canvas, #print-sheet-canvas * {
                  visibility: visible !important;
                  color: black !important;
                  background-color: transparent !important;
                  box-shadow: none !important;
                  text-shadow: none !important;
                  border-color: #000 !important;
                }
                #print-sheet-canvas {
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 100% !important;
                  height: auto !important;
                  display: block !important;
                  padding: 0 !important;
                  margin: 0 !important;
                  overflow: visible !important;
                }
                /* Print specific SVG styles */
                #print-sheet-canvas svg {
                  stroke: black !important;
                }
              }
            `}</style>
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl relative print:max-w-none print:max-h-none print:overflow-visible print:border-none print:shadow-none print:bg-white print:rounded-none"
            >
              {/* Modal control bar */}
              <div className="bg-zinc-950 border-b border-zinc-800 p-4 flex justify-between items-center shrink-0 print:hidden">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <h4 className="text-xs font-black text-zinc-200 uppercase tracking-widest font-mono">
                    Print / Export To PDF Options
                  </h4>
                </div>
                <button
                  onClick={() => onClose()}
                  className="p-1.5 bg-zinc-900 rounded-2xl text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* PDF Type Toggle Bar (print:hidden) */}
              <div className="bg-zinc-950 border-b border-zinc-800 px-4 py-2.5 flex flex-wrap gap-2 items-center justify-between shrink-0 print:hidden">
                <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider font-mono">
                  Select Print Type:
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2 md:mt-0">
                  <button
                    type="button"
                    onClick={() => setActivePdfTab("auction")}
                    className={`px-3 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-wider transition duration-150 cursor-pointer ${
                      activePdfTab === "auction"
                        ? "bg-teal-600 text-white shadow-md shadow-teal-950/40"
                        : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    📊 Select Auction Log
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePdfTab("source_payment")}
                    className={`px-3 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-wider transition duration-150 cursor-pointer ${
                      activePdfTab === "source_payment"
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-950/40"
                        : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    ⚓ Select Source Payouts
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePdfTab("collection")}
                    className={`px-3 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-wider transition duration-150 cursor-pointer ${
                      activePdfTab === "collection"
                        ? "bg-emerald-600 text-white shadow-md shadow-emerald-950/40"
                        : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    💰 Select Collections Ledger
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePdfTab("collection_slip")}
                    className={`px-3 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-wider transition duration-150 cursor-pointer ${
                      activePdfTab === "collection_slip"
                        ? "bg-amber-605 bg-amber-600 text-white shadow-md shadow-amber-950/40"
                        : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    🧾 Select Individual Slips
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePdfTab("day_closing")}
                    className={`px-3 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-wider transition duration-150 cursor-pointer ${
                      activePdfTab === "day_closing"
                        ? "bg-rose-600 text-white shadow-md shadow-rose-950/40"
                        : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    ☁️ Snapshot / Day Close
                  </button>
                </div>
              </div>

              {/* Scrollable Document Preview Area */}
              <div 
                id="dashboard-preview-parent"
                className="flex-grow overflow-y-auto bg-zinc-200/80 p-4 md:p-8 flex justify-center items-start print:bg-transparent print:p-0 print:overflow-visible"
              >
                <div 
                  className="shrink-0 origin-top transition-transform duration-100 print:transform-none"
                  style={{
                    width: scaleFactor < 1 ? `${794 * scaleFactor}px` : '794px',
                    minHeight: scaleFactor < 1 ? `${1123 * scaleFactor}px` : '1123px',
                    overflow: 'visible'
                  }}
                >
                  <div
                    id="print-sheet-canvas"
                    className="bg-white text-zinc-900 space-y-6 font-sans select-text shadow-sm ring-1 ring-black/5 shrink-0 print:shadow-none print:ring-0 print:p-0 print:max-w-none print:w-full print:min-h-0 print:h-auto"
                    style={{
                      width: '794px',
                      minHeight: '1123px',
                      height: 'auto',
                      padding: '48px',
                      boxSizing: 'border-box',
                      transform: `scale(${scaleFactor})`,
                      transformOrigin: 'top left',
                    }}
                  >
                  {/* Official letterhead */}
                <div className="border-b-2 border-zinc-900 pb-4 flex justify-between items-start">
                                  <div>
                                    <h3 className="text-3xl font-black tracking-tight text-zinc-950 uppercase">
                                      NEW FISH CENTER
                                    </h3>
                                    <p className="text-[10px] text-zinc-600 font-extrabold tracking-wider font-mono uppercase">
                                      Commission Agent and Wholesaler • Proprietor: Chanchal Das
                                    </p>
                                    <p className="text-[10px] text-zinc-500 mt-0.5 uppercase">
                                      BALIA, Chakdaha, Nadia
                                    </p>
                                  </div>
                                  <div className="text-right font-mono">
                                    <div className="bg-zinc-950 text-white font-bold text-[8.5px] px-2.5 py-1 rounded tracking-wider uppercase">
                                      {activePdfTab === "auction" && "Auction Purpose PDF"}
                                      {activePdfTab === "source_payment" && "Source Payment PDF"}
                                      {activePdfTab === "collection" && "Collection Purpose PDF"}
                                      {activePdfTab === "collection_slip" && "Buyer Invoice Slip PDF"}
                                      {activePdfTab === "day_closing" && "Business Day Closing PDF"}
                                    </div>
                                    <div className="text-lg font-black text-zinc-950 mt-1.5 uppercase">
                                      DATE: {appDate}
                                    </div>
                                    <div className="text-[9px] text-zinc-500 mt-1">
                                      Printed: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
                                    </div>
                                  </div>
                </div>

                {/* Sub-header stating the PDF's primary intent and device scope */}
                <div className="border-l-4 border-zinc-900 pl-3.5 py-1 text-xs">
                  <p className="font-bold text-zinc-950 uppercase tracking-wide">
                    {activePdfTab === "auction" && "Daily Auction Dispatch Journal (Auction Log)"}
                    {activePdfTab === "source_payment" && "Source Commission & Net Payout Settlement (Source Payout)"}
                    {activePdfTab === "collection" && "Daily Revenue Collections & Cashier Vault Logs (Collection Journal)"}
                    {activePdfTab === "collection_slip" && "Buyer Balance Collection Slips (Scissor Cut-Out Invoice Cards)"}
                    {activePdfTab === "day_closing" && "Daily Market Business Analytics & End of Time Snapshot (Day Close)"}
                  </p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    Authorized Terminal User: <strong className="text-zinc-900">{(data as any)?.activeUser?.name || "Apon Das (Admin)"}</strong> | License Scope: {(data as any)?.activeUser?.role || "Manager"} Permission
                    {activePdfTab === "auction" && selectedAuctioneerFilter !== "All" && (
                      <span className="block mt-1 uppercase text-zinc-800 text-[11px] font-bold tracking-wider">
                        Individual Seller Generated: <span className="text-zinc-950 font-black">{selectedAuctioneerFilter}</span>
                      </span>
                    )}
                  </p>
                </div>

                {activePdfTab === "auction" && (
                  <div className="space-y-4">
                    {/* Auctioneer selection options (print:hidden) */}
                    <div className="bg-zinc-50 border border-zinc-200 p-3 rounded-2xl space-y-2 print:hidden">
                      <div className="text-[10px] font-sans font-black uppercase text-zinc-500 tracking-wide flex items-center gap-1.5">
                        <span>👥 Filter by Active Auctioneer Option (Select "What they sold today"):</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedAuctioneerFilter("All")}
                          className={`px-3 py-1.5 rounded-2xl text-[9.5px] font-bold uppercase transition duration-150 cursor-pointer ${
                            selectedAuctioneerFilter === "All"
                              ? "bg-zinc-900 border border-zinc-900 text-white"
                              : "bg-zinc-200 hover:bg-zinc-350 text-zinc-700"
                          }`}
                        >
                          All ({transactions.length} entries)
                        </button>
                        {uniqueAuctioneers.map((auctioneer) => {
                          const count = transactions.filter(t => (t.added_by || "Apon Das (Admin)") === auctioneer).length;
                          return (
                            <button
                              type="button"
                              key={auctioneer}
                              onClick={() => setSelectedAuctioneerFilter(auctioneer)}
                              className={`px-3 py-1.5 rounded-2xl text-[9.5px] font-bold uppercase transition duration-150 cursor-pointer ${
                                selectedAuctioneerFilter === auctioneer
                                  ? "bg-teal-600 border border-teal-700 text-white"
                                  : "bg-zinc-200 hover:bg-zinc-350 text-zinc-700"
                              }`}
                            >
                              👤 Option: {auctioneer} ({count} sold)
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Summary micro KPIs based on selection */}
                    {(() => {
                      const fSales = filteredPrintedTransactions.reduce((sum, tx) => sum + (tx.total_price || 0), 0);
                      const fWeight = filteredPrintedTransactions.reduce((sum, tx) => sum + (tx.weight || 0), 0);
                      return (
                        <div className="grid grid-cols-3 gap-2.5 text-center">
                          <div className="border border-zinc-300 p-2 rounded-2xl bg-zinc-50/50">
                            <span className="text-[8.5px] text-zinc-500 font-extrabold uppercase font-sans tracking-wide">
                              {selectedAuctioneerFilter === "All" ? "Gross Auctions" : `Sales by ${selectedAuctioneerFilter}`}
                            </span>
                            <div className="text-xs font-black text-zinc-950 font-mono">₹{Math.round(fSales).toLocaleString()}</div>
                          </div>
                          <div className="border border-zinc-300 p-2 rounded-2xl bg-zinc-50/50">
                            <span className="text-[8.5px] text-zinc-500 font-extrabold uppercase font-sans tracking-wide">Selected Weight</span>
                            <div className="text-xs font-black text-zinc-950 font-mono">{fWeight.toFixed(2)} kg</div>
                          </div>
                          <div className="border border-zinc-300 p-2 rounded-2xl bg-zinc-50/50">
                            <span className="text-[8.5px] text-zinc-500 font-extrabold uppercase font-sans tracking-wide">Selected Trades</span>
                            <div className="text-xs font-black text-zinc-950 font-mono">{filteredPrintedTransactions.length} sales</div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Active filter stamp printed in the ledger header */}
                    <div className="flex justify-between items-center text-[9px] font-mono text-zinc-600 border-b border-dashed border-zinc-200 pb-1.5 pt-0.5">
                      <span className="font-bold uppercase tracking-wider">
                        Active Filter Scope: {selectedAuctioneerFilter === "All" ? "ALL COMMISSION AGENTS COMBINED" : `INDIVIDUAL AUCTIONEER: ${selectedAuctioneerFilter.toUpperCase()}`}
                      </span>
                      <span>{filteredPrintedTransactions.length} records found • {appDate}</span>
                    </div>

                    <div className="space-y-4">
                      {sources.map(src => {
                        const srcTxs = filteredPrintedTransactions.filter(t => t.source_id === src.id);
                        if (srcTxs.length === 0) return null;

                        return (
                          <div key={src.id} className="border border-zinc-300 rounded-2xl p-3 space-y-2 bg-zinc-50/40">
                            <div className="font-bold text-[11px] text-zinc-900 border-b border-zinc-200 pb-1 uppercase tracking-wider">
                              ⚓ Source: {src.name}
                            </div>
                            
                            {Object.entries(
                              srcTxs.reduce((acc, t) => {
                                const k = t.fish_type || "Unspecified Crate";
                                if (!acc[k]) acc[k] = [];
                                acc[k].push(t);
                                return acc;
                              }, {} as Record<string, typeof srcTxs>)
                            ).map(([crateName, crateTxs]) => (
                              <div key={crateName} className="mt-2 text-left">
                                <div className="text-[9px] font-extrabold text-teal-800 uppercase tracking-widest pl-1 mb-1">
                                  📦 Crate: {crateName}
                                </div>
                                <table className="w-full text-left text-[10.5px] border-collapse bg-white border border-zinc-200">
                                  <thead>
                                    <tr className="border-b border-zinc-300 text-zinc-500 font-bold bg-zinc-100/60 text-[8.5px] uppercase font-mono">
                                      <th className="py-1 px-1">#</th>
                                      <th className="py-1">Auctioneer Agent</th>
                                      <th className="py-1 text-center">Weight</th>
                                      <th className="py-1 text-center">Rate/KG</th>
                                      <th className="py-1 text-center">To Buyer</th>
                                      <th className="py-1 text-right px-1">Auction Total</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {crateTxs.map((tx, idx) => {
                                      const buyerNick = buyers.find((b) => String(b.id) === String(tx.buyer_id))?.nickname || tx.buyer_id;
                                      const clerkName = tx.added_by || (data as any)?.activeUser?.name || "Apon Das (Admin)";
                                      return (
                                        <tr key={tx.id || idx} className="border-b border-zinc-100 font-mono text-zinc-800">
                                          <td className="py-1 px-1 font-bold text-zinc-400">#{idx + 1}</td>
                                          <td className="py-1 font-bold font-sans text-zinc-950">{clerkName}</td>
                                          <td className="py-1 text-center font-bold">{tx.weight} kg</td>
                                          <td className="py-1 text-center">₹{tx.price_per_kg}</td>
                                          <td className="py-1 text-center font-semibold font-sans text-indigo-900">{buyerNick}</td>
                                          <td className="py-1 text-right px-1 font-bold text-zinc-950">₹{Math.round(tx.total_price).toLocaleString()}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            ))}
                          </div>
                        );
                      })}

                      {filteredPrintedTransactions.length === 0 && (
                        <div className="py-6 text-center text-zinc-500 italic">
                          No active fish auctions found under this filter/user today.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 2. SOURCE PAYMENT TAB CONTENT */}
                {activePdfTab === "source_payment" && (
                  <div className="space-y-4">
                    {/* Summary micro KPIs */}
                    <div className="grid grid-cols-3 gap-2.5 text-center">
                      <div className="border border-zinc-300 p-2 rounded-2xl bg-zinc-50/50">
                        <span className="text-[8.5px] text-zinc-500 font-extrabold uppercase font-sans tracking-wide">Gross Sales</span>
                        <div className="text-xs font-black text-zinc-950 font-mono">₹{Math.round(totalSalesVolume).toLocaleString()}</div>
                      </div>
                      <div className="border border-zinc-300 p-2 rounded-2xl bg-zinc-50/50">
                        <span className="text-[8.5px] text-zinc-500 font-extrabold uppercase font-sans tracking-wide">Arat Agency Fee</span>
                        <div className="text-xs font-black text-zinc-950 font-mono">₹{totalCommissions.toLocaleString()}</div>
                      </div>
                      <div className="border border-zinc-300 p-2 rounded-2xl bg-zinc-50/50">
                        <span className="text-[8.5px] text-zinc-500 font-extrabold uppercase font-sans tracking-wide">Net Payout Scheduled</span>
                        <div className="text-xs font-black text-zinc-950 font-mono font-bold text-indigo-700">₹{(totalSalesVolume - totalCommissions).toLocaleString()}</div>
                      </div>
                    </div>

                    <p className="text-[10px] text-zinc-500 text-zinc-500 italic">
                      Below lists exactly how much fish was auctioned per source in each discrete trade weight landing, the respective auction values gained per kg, and the net payout allocated to the source after agency commission.
                    </p>

                    <div className="space-y-4">
                      {sources.map((src) => {
                        const txs = transactions.filter((t) => t.source_id === src.id);
                        if (txs.length === 0) return null;
                        
                        const srcGross = txs.reduce((sum, t) => sum + (t.total_price || 0), 0);
                        const pmt = sourcePayments.find(p => p.source_id === src.id);
                        const srcComm = pmt ? pmt.commission : 0;
                        const srcGrossCalculated = pmt && typeof pmt.sale_total !== 'undefined' ? pmt.sale_total : srcGross;
                        const srcNet = pmt && typeof pmt.amount_paid_to_source !== 'undefined' ? pmt.amount_paid_to_source : srcGross;

                        return (
                          <div key={src.id} className="border border-zinc-300 rounded-2xl p-3 space-y-2 bg-zinc-50/40">
                            <div className="flex justify-between items-center border-b border-zinc-200 pb-1 flex-wrap">
                              <span className="font-bold text-[11px] text-zinc-900 uppercase">
                                ⚓ {src.name} • Landings Count: {txs.length}
                              </span>
                              <div className="text-[10.5px] font-mono flex gap-3 text-zinc-600 font-bold">
                                <span>Gross: ₹{Math.round(srcGross).toLocaleString()}</span>
                                <span className="text-rose-700">Fee: ₹{Math.round(srcComm).toLocaleString()}</span>
                                <span className="text-teal-700">Payout: ₹{Math.round(srcNet).toLocaleString()}</span>
                              </div>
                            </div>

                            <table className="w-full text-[10px] text-left border-collapse">
                              <thead>
                                <tr className="border-b border-zinc-300 text-zinc-500 font-bold font-mono uppercase text-[8.5px]">
                                  <th className="py-1">Trade Weight</th>
                                  <th className="py-1 text-center">Auction Rate</th>
                                  <th className="py-1 text-right">Sale Value</th>
                                </tr>
                              </thead>
                              <tbody>
                                {Object.entries(
                                  txs.reduce((acc, t) => {
                                    const k = t.fish_type || "Unspecified Crate";
                                    if (!acc[k]) acc[k] = [];
                                    acc[k].push(t);
                                    return acc;
                                  }, {} as Record<string, typeof txs>)
                                ).map(([crateName, crateTxs]) => (
                                  <React.Fragment key={crateName}>
                                    <tr className="bg-zinc-100">
                                      <td colSpan={3} className="py-1.5 px-2 font-extrabold text-[9px] text-teal-800 uppercase tracking-widest">
                                        📦 Crate: {crateName}
                                      </td>
                                    </tr>
                                    {crateTxs.map((t, tIdx) => {
                                      // no individual netval
                                      return (
                                        <tr key={t.id || tIdx} className="border-b border-zinc-100 font-mono text-zinc-800">
                                          <td className="py-1.5 pl-4 font-bold">{t.weight} kg</td>
                                          <td className="py-1.5 text-center">₹{t.price_per_kg}/kg</td>
                                          <td className="py-1.5 text-right">₹{Math.round(t.total_price).toLocaleString()}</td>
                                          
                                        </tr>
                                      );
                                    })}
                                    <tr className="border-b-2 border-zinc-200">
                                      <td className="py-1.5 pl-4 font-bold text-zinc-600 text-[9px] uppercase font-sans">Subtotal</td>
                                      <td className="py-1.5"></td>
                                      <td className="py-1.5 text-right font-bold text-zinc-600">₹{Math.round(crateTxs.reduce((sum, t) => sum + t.total_price, 0)).toLocaleString()}</td>
                                      
                                    </tr>
                                  </React.Fragment>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        );
                      })}

                      {sources.filter(s => transactions.some(t => t.source_id === s.id)).length === 0 && (
                        <div className="border border-zinc-300 rounded-2xl p-3 space-y-2 bg-zinc-50/40">
                          <div className="flex justify-between items-center border-b border-zinc-200 pb-1 flex-wrap">
                            <span className="font-bold text-[11px] text-zinc-900 uppercase">
                              ⚓ Empty Source • Landings Count: 0
                            </span>
                          </div>
                          <table className="w-full text-[10px] text-left border-collapse">
                            <thead>
                              <tr className="border-b border-zinc-300 text-zinc-500 font-bold font-mono uppercase text-[8.5px]">
                                <th className="py-1">Fish Type / Purpose</th>
                                <th className="py-1 text-center">Trade Weight</th>
                                <th className="py-1 text-center">Auction Rate</th>
                                <th className="py-1 text-right">Sale Value</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td colSpan={4} className="py-6 text-center text-zinc-500 italic">
                                  No landings or source trades registered for payment today.
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 3. COLLECTION TAB CONTENT */}
                {activePdfTab === "collection" && (
                  <div className="space-y-4">
                    {/* Summary micro KPIs */}
                    <div className="grid grid-cols-3 gap-2.5 text-center">
                      <div className="border border-zinc-300 p-2 rounded-2xl bg-zinc-50/50">
                        <span className="text-[8.5px] text-zinc-500 font-extrabold uppercase font-sans tracking-wide">Approved Cash</span>
                        <div className="text-xs font-black text-zinc-950 font-mono">₹{Math.round(totalCollectionsReceived).toLocaleString()}</div>
                      </div>
                      <div className="border border-zinc-300 p-2 rounded-2xl bg-zinc-50/50">
                        <span className="text-[8.5px] text-zinc-500 font-extrabold uppercase font-sans tracking-wide">Pending verification</span>
                        <div className="text-xs font-black text-zinc-950 font-mono text-amber-700">₹{Math.round(totalCollectionsPending).toLocaleString()}</div>
                      </div>
                      <div className="border border-zinc-300 p-2 rounded-2xl bg-zinc-50/50">
                        <span className="text-[8.5px] text-zinc-500 font-extrabold uppercase font-sans tracking-wide">Total Cleared</span>
                        <div className="text-xs font-black text-zinc-950 font-mono font-bold text-teal-700">₹{Math.round(totalCollectionsReceived + totalCollectionsPending).toLocaleString()}</div>
                      </div>
                    </div>

                    <table className="w-full text-left text-[10.5px] border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-400 text-zinc-600 font-bold bg-zinc-100/60 uppercase font-mono text-[9px]">
                          <th className="py-1 px-1">Buyer Nickname</th>
                          <th className="py-1 text-center font-mono">Start Rollover</th>
                          <th className="py-1 text-center font-mono">Today's Purchases</th>
                          <th className="py-1 text-center font-mono">Today's Paid</th>
                          <th className="py-1 text-center font-mono">Current Outstanding</th>
                          <th className="py-1 text-right">Ledger Trend</th>
                        </tr>
                      </thead>
                      <tbody>
                        {buyerBalancesList.map(({ buyer, prevRollover, todayPurchases, todayPaid, currentBalance }, idx) => {
                          const netDelta = todayPurchases - todayPaid;
                          return (
                            <tr key={buyer.id || idx} className="border-b border-zinc-200">
                              <td className="py-1.5 px-1 font-bold text-zinc-950 font-sans">{buyer.nickname}</td>
                              <td className="py-1.5 text-center font-mono text-zinc-600">₹{Math.round(prevRollover).toLocaleString()}</td>
                              <td className="py-1.5 text-center font-mono text-rose-800">+₹{Math.round(todayPurchases).toLocaleString()}</td>
                              <td className="py-1.5 text-center font-mono font-bold text-emerald-800 text-emerald-800">-₹{Math.round(todayPaid).toLocaleString()}</td>
                              <td className="py-1.5 text-center font-mono font-black text-zinc-950 bg-amber-50">₹{Math.round(currentBalance).toLocaleString()}</td>
                              <td className="py-1.5 text-right font-mono text-[8.5px] uppercase">
                                {netDelta > 0 && <span className="text-rose-700 font-extrabold">📈 Grew (+₹{Math.round(netDelta).toLocaleString()})</span>}
                                {netDelta < 0 && <span className="text-emerald-700 font-extrabold">📉 Reduced (-₹{Math.round(Math.abs(netDelta)).toLocaleString()})</span>}
                                {netDelta === 0 && <span className="text-zinc-500 font-medium">Stable</span>}
                              </td>
                            </tr>
                          );
                        })}
                        {buyerBalancesList.length === 0 && (
                          <tr>
                            <td colSpan={6} className="py-6 text-center text-zinc-500 italic font-sans">
                              No active wholesale customer accounts in ledger today.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 4. COLLECTION SLIP TAB CONTENT */}
                {activePdfTab === "collection_slip" && (
                  <div className="space-y-4">
                    {/* Toggle button row (print:hidden) */}
                    <div className="bg-zinc-50 border border-zinc-200 p-3 rounded-2xl space-y-2.5 print:hidden">
                      <div className="text-[10px] font-sans font-black uppercase text-zinc-500 tracking-wide">
                        Select Individual Slip Sub-section (Recorded as internal business files):
                      </div>
                      <div className="flex gap-2 max-w-sm">
                        <button
                          type="button"
                          onClick={() => setSlipCategory("buyers")}
                          className={`flex-1 py-1.5 text-center rounded-2xl text-[10px] font-black transition-all cursor-pointer uppercase border ${
                            slipCategory === "buyers"
                              ? "bg-amber-600 border-amber-700 text-white shadow-md shadow-amber-900/20"
                              : "bg-zinc-200 hover:bg-zinc-300 text-zinc-700 border-zinc-300"
                          }`}
                        >
                          👥 Buyers (Owes Us)
                        </button>
                        <button
                          type="button"
                          onClick={() => setSlipCategory("sources")}
                          className={`flex-1 py-1.5 text-center rounded-2xl text-[10px] font-black transition-all cursor-pointer uppercase border ${
                            slipCategory === "sources"
                              ? "bg-indigo-600 border-indigo-700 text-white shadow-md shadow-indigo-900/40"
                              : "bg-zinc-200 hover:bg-zinc-300 text-zinc-700 border-zinc-300"
                          }`}
                        >
                          ⚓ Sources (We Owe Them)
                        </button>
                      </div>
                    </div>

                    <div className="font-sans">
                      {slipCategory === "buyers" ? (
                        <div className="space-y-4">
                          <div className="border-b border-zinc-200 pb-1 print:hidden">
                            <h4 className="text-[10px] font-bold text-zinc-600 uppercase">👥 Individual Buyer Outstanding Slips</h4>
                            <p className="text-[8.5px] text-zinc-500 italic">Showing buyers with lifetime outstanding balances owed until today.</p>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {buyerBalancesList.filter(b => b.currentBalance > 0).length === 0 ? (
                                <div className="border-2 border-dashed border-zinc-300 p-4 rounded-2xl bg-zinc-50/45 space-y-2 relative" style={{ pageBreakInside: "avoid" }}>
                                  <div className="absolute top-1 right-2 text-zinc-400 text-[8px] uppercase font-mono select-none">Blank Buyer Copy</div>
                                  <div className="border-b border-zinc-200 pb-1.5 flex justify-between items-start">
                                    <div>
                                      <h4 className="font-extrabold text-[12px] text-zinc-950 uppercase tracking-tight">_______________</h4>
                                      <p className="text-[8px] text-zinc-500 font-mono">ID: _______ • Customer Ledger Dues</p>
                                    </div>
                                    <div className="text-[8px] text-zinc-500 font-mono text-right font-black">{appDate}</div>
                                  </div>
                                  <div className="py-1">
                                    <div className="text-[8.5px] text-zinc-500 font-sans font-bold uppercase tracking-wider">How much has buyer owed until today:</div>
                                    <div className="text-[18px] font-black text-rose-300 font-mono mt-0.5">₹0</div>
                                  </div>
                                </div>
                            ) : (
                              buyerBalancesList.map(({ buyer, currentBalance }) => {
                                if (currentBalance === 0) return null;
                                return (
                                  <div 
                                    key={buyer.id} 
                                    className="border-2 border-dashed border-zinc-300 p-4 rounded-2xl bg-zinc-50/45 space-y-2 relative"
                                    style={{ pageBreakInside: "avoid" }}
                                  >
                                  <div className="absolute top-1.5 right-2 text-zinc-400 text-[7.5px] uppercase font-mono select-none">
                                    Dual Invoice Statement
                                  </div>
                                  <div className="border-b border-zinc-200 pb-2 flex justify-between items-start">
                                    <div>
                                      <h4 className="font-extrabold text-[12.5px] text-zinc-950 uppercase tracking-tight">
                                        {buyer.nickname}
                                      </h4>
                                      <p className="text-[8px] text-zinc-500 font-mono">
                                        Customer ID: {buyer.id} • Dues Statement
                                      </p>
                                    </div>
                                    <div className="text-[8px] text-zinc-500 font-mono text-right font-black">
                                      Date: {appDate}
                                    </div>
                                  </div>
                                  
                                  {/* Dual Options Grid */}
                                  <div className="grid grid-cols-2 gap-3 divide-x divide-zinc-200">
                                    {/* Option A: Owed Today */}
                                    <div className="space-y-1 pr-1.5">
                                      <div className="bg-amber-500/5 border border-amber-500/20 p-2 rounded-xl">
                                        <span className="text-[7.5px] font-black text-amber-805 uppercase tracking-wider block">Option A</span>
                                        <span className="text-[7px] text-zinc-650 font-semibold block leading-tight">Owed Today</span>
                                        <div className="text-[15px] font-black text-amber-950 font-mono mt-0.5">
                                          ₹{(() => {
                                            const itemVal = buyerBalancesList.find(x => x.buyer.id === buyer.id);
                                            return Math.round(itemVal ? itemVal.todayPurchases : 0).toLocaleString();
                                          })()}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Option B: Total Outstanding */}
                                    <div className="space-y-1 pl-3">
                                      <div className="bg-rose-500/5 border border-rose-500/20 p-2 rounded-xl">
                                        <span className="text-[7.5px] font-black text-rose-805 uppercase tracking-wider block">Option B</span>
                                        <span className="text-[7px] text-zinc-650 font-semibold block leading-tight">Total Outstanding</span>
                                        <div className="text-[15px] font-black text-rose-950 font-mono mt-0.5">
                                          ₹{Math.round(currentBalance).toLocaleString()}
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Mathematical representation */}
                                  <div className="bg-zinc-50 p-2 rounded-xl text-[8px] text-zinc-605 font-mono space-y-1">
                                    {(() => {
                                      const itemVal = buyerBalancesList.find(x => x.buyer.id === buyer.id) || { prevRollover: 0, todayPurchases: 0, todayPaid: 0 };
                                      return (
                                        <>
                                          <div className="flex justify-between">
                                            <span>Previous Balance:</span>
                                            <span>₹{Math.round(itemVal.prevRollover).toLocaleString()}</span>
                                          </div>
                                          <div className="flex justify-between text-amber-700 font-bold">
                                            <span>Today's Purchases (+):</span>
                                            <span>₹{Math.round(itemVal.todayPurchases).toLocaleString()}</span>
                                          </div>
                                          <div className="flex justify-between text-emerald-700 font-bold border-b border-zinc-200 pb-0.5">
                                            <span>Today's Payments (-):</span>
                                            <span>₹{Math.round(itemVal.todayPaid).toLocaleString()}</span>
                                          </div>
                                          <div className="flex justify-between text-zinc-950 font-black">
                                            <span>Current Outstanding Balance:</span>
                                            <span>₹{Math.round(currentBalance).toLocaleString()}</span>
                                          </div>
                                        </>
                                      );
                                    })()}
                                  </div>

                                  <div className="border-t border-zinc-200 pt-1.5 text-[7px] text-zinc-400 font-mono flex justify-between">
                                    <span>Generated via NFC Systems</span>
                                    <span>Authorized Signature</span>
                                  </div>
                                </div>
                              );
                            }))}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="border-b border-zinc-200 pb-1 print:hidden">
                            <h4 className="text-[10px] font-bold text-zinc-600 uppercase">⚓ Individual Source Vessel Settlement Slips</h4>
                            <p className="text-[8.5px] text-zinc-500 italic">Showing sources & landing sources net catch payouts paid today and outstandings.</p>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {(() => {
                              const list = sources.map((s) => {
                                const sTxList = transactions.filter((tx) => tx.source_id === s.id);
                                const saleSum = sTxList.reduce((sum, tx) => sum + (tx.total_price || 0), 0);
                                
                                const sPayList = sourcePayments.filter((p) => p.source_id === s.id);
                                const paidToday = sPayList.reduce((sum, p) => sum + (p.amount_paid_to_source || 0), 0);
                                const commDeducted = sPayList.reduce((sum, p) => sum + (p.commission || 0), 0);
                                
                                const defaultComm = Math.round(saleSum * 0.05);
                                const netExpect = s.is_completed ? (saleSum - commDeducted) : (saleSum - defaultComm);
                                const oweThemTotal = Math.max(0, netExpect - paidToday);

                                return {
                                  source: s,
                                  paidToday,
                                  oweThemTotal
                                };
                              });

                              const activeList = list.filter(({ paidToday, oweThemTotal }) => paidToday > 0 || oweThemTotal > 0);
                              
                              if (activeList.length === 0) {
                                return (
                                  <div className="border-2 border-dashed border-indigo-200 p-4 rounded-2xl bg-indigo-50/20 space-y-2.5 relative" style={{ pageBreakInside: "avoid" }}>
                                    <div className="absolute top-1 right-2 text-indigo-400 text-[8px] uppercase font-mono select-none">Blank Source Copy</div>
                                    <div className="border-b border-indigo-100 pb-1.5 flex justify-between items-start">
                                      <div>
                                        <h4 className="font-extrabold text-[12px] text-indigo-950 uppercase tracking-tight">_______________</h4>
                                        <p className="text-[8px] text-indigo-600 font-mono">ID: _______ • Vessel Catch Record</p>
                                      </div>
                                      <div className="text-[8px] text-indigo-500 font-mono text-right font-bold">{appDate}</div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 py-1">
                                      <div>
                                        <div className="text-[8px] text-zinc-500 uppercase font-bold tracking-wide">Paid Out Today:</div>
                                        <div className="text-[14px] font-black font-mono text-emerald-300">₹0</div>
                                      </div>
                                      <div>
                                        <div className="text-[8px] uppercase font-bold text-zinc-500 tracking-wide">We Owe Them (Until Today):</div>
                                        <div className="text-[14px] font-black font-mono text-indigo-300">₹0</div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              }

                              return activeList.map(({ source, paidToday, oweThemTotal }) => {
                                return (
                                  <div 
                                    key={source.id} 
                                    className="border-2 border-dashed border-indigo-200 p-4 rounded-2xl bg-indigo-50/20 space-y-2.5 relative"
                                    style={{ pageBreakInside: "avoid" }}
                                  >
                                    <div className="absolute top-1 right-2 text-indigo-400 text-[8px] uppercase font-mono select-none">
                                      Source Copy
                                    </div>
                                    <div className="border-b border-indigo-100 pb-1.5 flex justify-between items-start">
                                      <div>
                                        <h4 className="font-extrabold text-[12px] text-indigo-950 uppercase tracking-tight">
                                          {source.name}
                                        </h4>
                                        <p className="text-[8px] text-indigo-600 font-mono">
                                          ID: {source.id} • Vessel Catch Record
                                        </p>
                                      </div>
                                      <div className="text-[8px] text-indigo-500 font-mono text-right font-bold">
                                        {appDate}
                                      </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-3 py-1">
                                      <div>
                                        <div className="text-[8px] text-zinc-500 uppercase font-bold tracking-wide">Paid Out Today:</div>
                                        <div className="text-[14px] font-black font-mono text-emerald-800">
                                          ₹{Math.round(paidToday).toLocaleString()}
                                        </div>
                                      </div>
                                      <div>
                                        <div className="text-[8px] uppercase font-bold text-zinc-500 tracking-wide">We Owe Them (Until Today):</div>
                                        <div className="text-[14px] font-black font-mono text-indigo-950">
                                          ₹{Math.round(oweThemTotal).toLocaleString()}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="border-t border-indigo-100 pt-1.5 text-[7.5px] text-indigo-400 font-mono flex justify-between">
                                      <span>Timestamp: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</span>
                                      <span>Private Settlement File</span>
                                    </div>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {/* 5. DAY CLOSING SNAPSHOT TAB CONTENT */}
                {activePdfTab === "day_closing" && (
                  <div className="space-y-6">
                    {/* Header Statement */}
                    <div className="text-center pb-2 border-b-2 border-zinc-900 border-dotted space-y-1">
                       <h2 className="text-2xl font-black uppercase text-zinc-950 font-sans tracking-tight">Daily Halt & Final Financial Summary</h2>
                       <p className="text-[12px] font-mono text-zinc-600">The total consolidated end-of-day market performance snapshot for {appDate}</p>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-zinc-50 border border-zinc-200 p-4 rounded-xl text-center space-y-1">
                        <div className="text-[9px] uppercase font-black text-zinc-500 tracking-widest font-mono">Total Volume Handled</div>
                        <div className="text-xl font-bold font-mono text-zinc-900">{totalWeightSold.toFixed(2)} KG</div>
                      </div>
                      <div className="bg-zinc-50 border border-zinc-200 p-4 rounded-xl text-center space-y-1">
                        <div className="text-[9px] uppercase font-black text-zinc-500 tracking-widest font-mono">Gross Auctions</div>
                        <div className="text-xl font-bold font-mono text-cyan-700 block">₹{totalSalesVolume.toLocaleString()}</div>
                      </div>
                      <div className="bg-zinc-50 border border-zinc-200 p-4 rounded-xl text-center space-y-1">
                         <div className="text-[9px] uppercase font-black text-zinc-500 tracking-widest font-mono">Net Full Profit</div>
                         <div className="text-xl font-bold font-mono text-indigo-700 block">₹{totalProfit.toLocaleString()}</div>
                      </div>
                      <div className="bg-zinc-50 border border-zinc-200 p-4 rounded-xl text-center space-y-1">
                         <div className="text-[9px] uppercase font-black text-zinc-500 tracking-widest font-mono">Cash Realized Today</div>
                         <div className="text-xl font-bold font-mono text-emerald-700 block">₹{totalCollectionsReceived.toLocaleString()}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       {/* Left side: Source Summaries */}
                       <div className="border border-zinc-300 rounded-xl overflow-hidden shadow-sm">
                         <div className="bg-zinc-100 text-[10px] uppercase font-black tracking-wider text-zinc-500 p-2.5 text-center border-b border-zinc-300">
                           Source Ledger Debits
                         </div>
                         <div className="p-3 divide-y divide-zinc-100">
                            {sources.length === 0 && <div className="text-xs text-zinc-400 text-center py-4">No sources active today.</div>}
                            {sources.map(s => {
                              const pDay = sourcePayments.filter(p => p.source_id === s.id).reduce((sum, p) => sum + (p.amount_paid_to_source || 0), 0);
                              return (
                                <div key={s.id} className="py-2 flex justify-between items-center text-xs">
                                  <span className="font-bold text-zinc-800">{s.name}</span>
                                  <span className="font-mono text-zinc-600">Paid: ₹{pDay.toLocaleString()}</span>
                                </div>
                              );
                            })}
                         </div>
                       </div>

                       {/* Right side: Top Owe Buyers */}
                       <div className="border border-zinc-300 rounded-xl overflow-hidden shadow-sm">
                         <div className="bg-zinc-100 text-[10px] uppercase font-black tracking-wider text-zinc-500 p-2.5 text-center border-b border-zinc-300">
                           Top Pending Market Dues (Buyers)
                         </div>
                         <div className="p-3 divide-y divide-zinc-100">
                            {buyers.slice().sort((a,b) => b.lifetime_debt - a.lifetime_debt).slice(0, 10).map(b => (
                                <div key={b.id} className="py-2 flex justify-between items-center text-xs">
                                  <span className="font-bold text-rose-900">{b.nickname || b.id}</span>
                                  <span className="font-mono text-rose-700 font-bold">₹{Math.round(b.lifetime_debt).toLocaleString()}</span>
                                </div>
                            ))}
                         </div>
                       </div>
                    </div>

                    {/* Detailed Transaction Log */}
                    <div className="border border-zinc-300 rounded-xl overflow-hidden shadow-sm mt-6">
                      <div className="bg-zinc-100 text-[10px] uppercase font-black tracking-wider text-zinc-500 p-2.5 text-center border-b border-zinc-300">
                        Detailed Trade Ledger for {appDate}
                      </div>
                      <div className="p-0 overflow-x-auto">
                        <table className="w-full text-left text-[9px] sm:text-xs whitespace-nowrap font-mono">
                          <thead>
                            <tr className="text-zinc-500 border-b border-zinc-200 bg-zinc-50">
                              <th className="p-2 font-bold uppercase">Time</th>
                              <th className="p-2 font-bold uppercase">Source</th>
                              <th className="p-2 font-bold uppercase">Buyer</th>
                              <th className="p-2 font-bold uppercase">Fish</th>
                              <th className="p-2 font-bold text-right uppercase">Weight</th>
                              <th className="p-2 font-bold text-right uppercase">Rate</th>
                              <th className="p-2 font-bold text-right uppercase">Value</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100">
                            {transactions.length === 0 ? (
                              <tr><td colSpan={7} className="p-4 text-center text-zinc-400 font-sans">No transactions recorded today.</td></tr>
                            ) : (
                              transactions.map((tx) => {
                                const src = sources.find(s => s.id === tx.source_id);
                                const buy = buyers.find(b => b.id === tx.buyer_id);
                                const timeStr = new Date((tx as any).timestamp || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                                return (
                                  <tr key={tx.id} className="hover:bg-zinc-50">
                                    <td className="p-2 text-zinc-400">{timeStr}</td>
                                    <td className="p-2 font-bold text-zinc-700">{src?.name || 'Unknown'}</td>
                                    <td className="p-2 font-bold text-indigo-700">{buy?.nickname || 'Unknown'}</td>
                                    <td className="p-2 text-zinc-600">{tx.fish_type || 'Unsorted'}</td>
                                    <td className="p-2 text-right">{tx.weight} kg</td>
                                    <td className="p-2 text-right">₹{tx.price_per_kg}</td>
                                    <td className="p-2 text-right font-bold text-zinc-900">₹{tx.total_price.toLocaleString()}</td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
                </div>{/* end of print-sheet-canvas */}
              </div>{/* end of scale wrapper */}
            </div>{/* end of dashboard-preview-parent container */}

              {/* Action operations footer row (print:hidden) */}
              <div className="bg-zinc-950 border-t border-zinc-805 p-4 flex flex-col sm:flex-row justify-end items-center gap-3 shrink-0 select-none print:hidden">
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <button
                    onClick={async () => {
                      const title = `New Fish Center - ${activePdfTab.toUpperCase()} - ${appDate}`;
                      const text = `I am sharing the ${activePdfTab.toUpperCase()} ledger sheet from New Fish Center for ${appDate}.`;
                      const filename = `NFC_${activePdfTab.toUpperCase()}_${appDate}.pdf`;
                      
                      // Temporarily reset scale to 1 for perfect high resolution capture
                      const prevScale = scaleFactor;
                      setScaleFactor(1);
                      
                      setTimeout(async () => {
                        try {
                          await shareAsPDF('print-sheet-canvas', filename, title, text, 'share');
                        } finally {
                          setScaleFactor(prevScale);
                        }
                      }, 250);
                    }}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg shadow-teal-950/40 cursor-pointer active:scale-95 transition"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Share PDF</span>
                  </button>
                  <button
                    onClick={() => {
                      const prevScale = scaleFactor;
                      setScaleFactor(1.0); // force unscaled crisp font capturing
                      const filename = `NFC_${activePdfTab.toUpperCase()}_${appDate}.pdf`;
                      const title = `New Fish Center - ${activePdfTab.toUpperCase()} - ${appDate}`;
                      const text = `I am downloading the ${activePdfTab.toUpperCase()} ledger sheet from New Fish Center for ${appDate}.`;
                      
                      setTimeout(async () => {
                        try {
                          await shareAsPDF('print-sheet-canvas', filename, title, text, 'download');
                        } finally {
                          setScaleFactor(prevScale);
                        }
                      }, 250);
                    }}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-900/40 cursor-pointer active:scale-95 transition"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Sheet</span>
                  </button>
                </div>
              </div>
            </motion.div>
          
</div>
  );
};
