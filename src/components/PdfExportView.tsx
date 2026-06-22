import React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Share,
  Download,
  LogOut,
  CheckCircle,
  FileText,
  ArrowRight,
  X,
  Share2,
  Printer,
} from "lucide-react";
import { useData } from "./DataContext";
import { shareAsPDF } from "../utils/pdf";

interface PdfExportViewProps {
  onClose: () => void;
  defaultTab?:
    | "auction"
    | "source_payment"
    | "collection"
    | "collection_slip"
    | "day_closing";
}

export const PdfExportView: React.FC<PdfExportViewProps> = ({
  onClose,
  defaultTab = "auction",
}) => {
  const { data, appDate } = useData();
  const [activePdfTab, setActivePdfTab] = React.useState(defaultTab);
  const [slipCategory, setSlipCategory] = React.useState<"buyers" | "sources">(
    "buyers",
  );
  const [selectedAuctioneerFilter, setSelectedAuctioneerFilter] =
    React.useState<string>("All");
  const [selectedBuyerSlipFilter, setSelectedBuyerSlipFilter] =
    React.useState<string>("All");
  const [selectedSourceSlipFilter, setSelectedSourceSlipFilter] =
    React.useState<string>("All");
  const [buyerSearchFilter, setBuyerSearchFilter] = React.useState<string>("");
  const [sourceSearchFilter, setSourceSearchFilter] =
    React.useState<string>("");
  const [scaleFactor, setScaleFactor] = React.useState(1);
  const [boxHeights, setBoxHeights] = React.useState<Record<string, number>>(
    {},
  );

  React.useLayoutEffect(() => {
    const parent = document.getElementById("print-sheet-canvas");
    if (!parent) return;
    const elements = parent.querySelectorAll("[data-box-id]");
    let changed = false;
    const newHeights = { ...boxHeights };
    elements.forEach((el) => {
      const id = el.getAttribute("data-box-id");
      if (id) {
        const h = (el as HTMLElement).offsetHeight;
        if (newHeights[id] !== h) {
          newHeights[id] = h;
          changed = true;
        }
      }
    });
    if (changed) {
      setBoxHeights(newHeights);
    }
  });

  React.useEffect(() => {
    let timer: any;
    const updateScale = () => {
      const parent = document.getElementById("dashboard-preview-parent");
      if (!parent) {
        timer = setTimeout(updateScale, 50);
        return;
      }
      const width = parent.clientWidth;
      const height = parent.clientHeight;
      const isMobile = window.innerWidth < 768;

      const scaleX = (width - 32) / 794;
      const scaleY = (height - 32) / 1123;

      // On mobile, allow the user to pan around the PDF rather than shrinking it too small.
      if (isMobile) {
        setScaleFactor(Math.max(0.45, Math.min(1, scaleX)));
      } else {
        const newScale = Math.min(scaleX, scaleY);
        setScaleFactor(Math.max(0.15, Math.min(1, newScale)));
      }
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => {
      window.removeEventListener("resize", updateScale);
      clearTimeout(timer);
    };
  }, [activePdfTab]);

  const fmt = (v: number) => "₹" + Math.round(v).toLocaleString();
  const fmtKg = (v: number) => v.toFixed(1) + " kg";

  const buyers = data?.buyers || [];
  const sources = data?.sources || [];
  const transactions = (data?.transactions || []).filter(
    (tx: any) => tx.date === appDate,
  );
  const collections = (data?.daily_collections || []).filter(
    (c: any) => c.date === appDate,
  );
  const sourcePayments = (data?.source_payments || []).filter(
    (p: any) => p.date === appDate,
  );

  const uniqueAuctioneers = Array.from(
    new Set(transactions.map((tx: any) => tx.added_by || "Unknown Auctioneer")),
  );

  const filteredPrintedTransactions =
    selectedAuctioneerFilter === "All"
      ? transactions
      : transactions.filter(
          (tx: any) =>
            (tx.added_by || "Unknown Auctioneer") === selectedAuctioneerFilter,
        );

  const totalSalesVolume = transactions.reduce(
    (sum: number, tx: any) => sum + (tx.total_price || 0),
    0,
  );
  const totalWeightSold = transactions.reduce(
    (sum: number, tx: any) => sum + (tx.weight || 0),
    0,
  );
  const approvedCollections = collections.filter((c: any) => c.is_approved);
  const totalCollectionsReceived = approvedCollections.reduce(
    (sum: number, c: any) => sum + (c.amount_paid || 0),
    0,
  );
  const pendingCollections = collections.filter((c: any) => !c.is_approved);
  const totalCollectionsPending = pendingCollections.reduce(
    (sum: number, c: any) => sum + (c.amount_paid || 0),
    0,
  );
  const activeSourcesCount = sources.filter((s: any) => !s.is_completed).length;
  const totalCommissions = sourcePayments.reduce(
    (sum: number, p: any) => sum + (p.is_settled ? p.commission || 0 : 0),
    0,
  );
  const totalProfit = sourcePayments.reduce(
    (sum: number, p: any) =>
      sum +
      (p.is_settled ? (p.sale_total || 0) - (p.amount_paid_to_source || 0) : 0),
    0,
  );

  const buyerBalancesList = buyers.map((b: any) => {
    const bTxList = transactions.filter(
      (tx: any) => String(tx.buyer_id) === String(b.id),
    );
    const todayPurchases = bTxList.reduce(
      (sum: number, tx: any) => sum + (tx.total_price || 0),
      0,
    );
    const todayWeight = bTxList.reduce(
      (sum: number, tx: any) => sum + (tx.weight || 0),
      0,
    );

    const bColList = collections.filter(
      (col: any) => String(col.buyer_id) === String(b.id),
    );
    const todayPaid = bColList.reduce(
      (sum: number, col: any) => sum + (col.amount_paid || 0),
      0,
    );
    const approvedCash = bColList
      .filter((col: any) => col.is_approved)
      .reduce((sum: number, col: any) => sum + (col.amount_paid || 0), 0);
    const pendingCash = bColList
      .filter((col: any) => !col.is_approved)
      .reduce((sum: number, col: any) => sum + (col.amount_paid || 0), 0);

    // Previous balance before today's shift starts
    const prevRollover = Math.max(
      0,
      b.lifetime_debt - todayPurchases + todayPaid,
    );

    return {
      buyer: b,
      prevRollover,
      todayPurchases,
      todayWeight,
      todayPaid,
      approvedCash,
      pendingCash,
      currentBalance: b.lifetime_debt,
    };
  });

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-3 select-none backdrop-blur-sm print:static print:inset-auto print:bg-white print:p-0 print:block print:transform-none print:w-full print:h-auto print:overflow-visible">
      <style>{`
              @media print {
                @page {
                  size: A4 portrait;
                  margin: 15mm 15mm;
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
                }
                #print-sheet-canvas {
                  background-color: transparent !important;
                }
                .print-scale-wrapper {
                  position: relative !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: auto !important;
                  min-width: 100% !important;
                  max-width: 100% !important;
                  height: auto !important;
                  min-height: auto !important;
                  display: block !important;
                  padding: none !important;
                  margin: 0 !important;
                  overflow: visible !important;
                  transform: none !important;
                }
                /* Print specific SVG styles */
                #print-sheet-canvas svg {
                  stroke: black !important;
                }
                .print-page-wrapper {
                  break-after: page !important;
                  page-break-after: always !important;
                }
                .pdf-master-header {
                  display: none !important;
                }
                thead { display: table-header-group !important; }
                tfoot { display: table-footer-group !important; }
                tr { page-break-inside: avoid !important; break-inside: avoid !important; }
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
          className="flex-grow overflow-auto bg-zinc-200/80 p-4 md:p-8 flex justify-center items-start print:bg-transparent print:p-0 print:overflow-visible"
        >
          <div
            className="shrink-0 origin-top transition-transform duration-100 print-scale-wrapper"
            style={{
              width: scaleFactor < 1 ? `${794 * scaleFactor}px` : "794px",
              minHeight: scaleFactor < 1 ? `${1123 * scaleFactor}px` : "1123px",
              overflow: "visible",
            }}
          >
            <div
              id="print-sheet-canvas"
              className="text-zinc-900 font-sans select-text shrink-0 print:p-0 print:max-w-none print:w-full print:min-h-0 print:h-auto"
              style={{
                width: "794px",
                transform: `scale(${scaleFactor})`,
                transformOrigin: "top center",
                display: "flex",
                flexDirection: "column",
                gap: "24px",
              }}
            >
              <div className="pdf-master-header space-y-6">
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
                      {activePdfTab === "source_payment" &&
                        "Source Payment PDF"}
                      {activePdfTab === "collection" &&
                        "Collection Purpose PDF"}
                      {activePdfTab === "collection_slip" &&
                        slipCategory === "buyers" &&
                        "Buyer Invoice Slip PDF"}
                      {activePdfTab === "collection_slip" &&
                        slipCategory === "sources" &&
                        "Source Settlement PDF"}
                      {activePdfTab === "day_closing" &&
                        "Business Day Closing PDF"}
                    </div>
                    <div className="text-lg font-black text-zinc-950 mt-1.5 uppercase">
                      DATE: {appDate}
                    </div>
                    <div className="text-[9px] text-zinc-500 mt-1">
                      Printed: {new Date().toLocaleDateString()}{" "}
                      {new Date().toLocaleTimeString()}
                    </div>
                  </div>
                </div>

                {/* Sub-header stating the PDF's primary intent and device scope */}
                <div className="border-l-4 border-zinc-900 pl-3.5 py-1 text-xs">
                  <p className="font-bold text-zinc-950 uppercase tracking-wide">
                    {activePdfTab === "auction" &&
                      "Daily Auction Dispatch Journal (Auction Log)"}
                    {activePdfTab === "source_payment" &&
                      "Source Commission & Net Payout Settlement (Source Payout)"}
                    {activePdfTab === "collection" &&
                      "Daily Revenue Collections & Cashier Vault Logs (Collection Journal)"}
                    {activePdfTab === "collection_slip" &&
                      slipCategory === "buyers" &&
                      "Buyer Balance Collection Slips (Scissor Cut-Out Invoice Cards)"}
                    {activePdfTab === "collection_slip" &&
                      slipCategory === "sources" &&
                      "Source Net Settlement Slips (Scissor Cut-Out Cards)"}
                    {activePdfTab === "day_closing" &&
                      "Daily Market Business Analytics & End of Time Snapshot (Day Close)"}
                  </p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    License Scope:{" "}
                    {(data as any)?.activeUser?.role || "Manager"} Permission
                    {activePdfTab === "auction" &&
                      selectedAuctioneerFilter !== "All" && (
                        <span className="block mt-1 uppercase text-zinc-800 text-[11px] font-bold tracking-wider">
                          Individual Seller Generated:{" "}
                          <span className="text-zinc-950 font-black">
                            {selectedAuctioneerFilter}
                          </span>
                        </span>
                      )}
                  </p>
                </div>
              </div>

              {activePdfTab === "auction" && (
                <div className="space-y-4">
                  <div className="pdf-master-header space-y-4">
                    {/* Auctioneer selection options (print:hidden) */}
                    <div className="bg-zinc-50 border border-zinc-200 p-3 rounded-2xl space-y-2 print:hidden">
                      <div className="text-[10px] font-sans font-black uppercase text-zinc-500 tracking-wide flex items-center gap-1.5">
                        <span>
                          👥 Filter by Active Auctioneer Option (Select "What
                          they sold today"):
                        </span>
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
                          const count = transactions.filter(
                            (t) =>
                              (t.added_by || "Apon Das (Admin)") === auctioneer,
                          ).length;
                          return (
                            <button
                              type="button"
                              key={auctioneer}
                              onClick={() =>
                                setSelectedAuctioneerFilter(auctioneer)
                              }
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
                      const fSales = filteredPrintedTransactions.reduce(
                        (sum, tx) => sum + (tx.total_price || 0),
                        0,
                      );
                      const fWeight = filteredPrintedTransactions.reduce(
                        (sum, tx) => sum + (tx.weight || 0),
                        0,
                      );
                      return (
                        <div className="grid grid-cols-3 gap-2.5 text-center">
                          <div className="border border-zinc-300 p-2 rounded-2xl bg-zinc-50/50">
                            <span className="text-[8.5px] text-zinc-500 font-extrabold uppercase font-sans tracking-wide">
                              {selectedAuctioneerFilter === "All"
                                ? "Gross Auctions"
                                : `Sales by ${selectedAuctioneerFilter}`}
                            </span>
                            <div className="text-xs font-black text-zinc-950 font-mono">
                              ₹{Math.round(fSales).toLocaleString()}
                            </div>
                          </div>
                          <div className="border border-zinc-300 p-2 rounded-2xl bg-zinc-50/50">
                            <span className="text-[8.5px] text-zinc-500 font-extrabold uppercase font-sans tracking-wide">
                              Selected Weight
                            </span>
                            <div className="text-xs font-black text-zinc-950 font-mono">
                              {fWeight.toFixed(2)} kg
                            </div>
                          </div>
                          <div className="border border-zinc-300 p-2 rounded-2xl bg-zinc-50/50">
                            <span className="text-[8.5px] text-zinc-500 font-extrabold uppercase font-sans tracking-wide">
                              Selected Trades
                            </span>
                            <div className="text-xs font-black text-zinc-950 font-mono">
                              {filteredPrintedTransactions.length} sales
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Active filter stamp printed in the ledger header */}
                    <div className="flex justify-between items-center text-[9px] font-mono text-zinc-600 border-b border-dashed border-zinc-200 pb-1.5 pt-0.5 print:hidden">
                      <span className="font-bold uppercase tracking-wider">
                        Active Filter Scope:{" "}
                        {selectedAuctioneerFilter === "All"
                          ? "ALL COMMISSION AGENTS COMBINED"
                          : `INDIVIDUAL AUCTIONEER: ${selectedAuctioneerFilter.toUpperCase()}`}
                      </span>
                      <span>
                        {filteredPrintedTransactions.length} records found •{" "}
                        {appDate}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4 -mt-2">
                    {filteredPrintedTransactions.length === 0 ? (
                      <div className="py-6 text-center text-zinc-500 italic">
                        No active fish auctions found under this filter/user
                        today.
                      </div>
                    ) : (
                      (() => {
                        const activeSources = sources.filter((s) =>
                          filteredPrintedTransactions.some(
                            (t) => String(t.source_id) === String(s.id),
                          ),
                        );

                        const renderBox = (
                          src: any,
                          srcTxs: any[],
                          boxId?: string,
                        ) => (
                          <div
                            key={src.id}
                            data-box-id={boxId}
                            className="border border-zinc-200 rounded-xl overflow-hidden bg-white p-4"
                          >
                            <div className="border-b border-zinc-200 pb-2 mb-4">
                              <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wide">
                                SELLER:{" "}
                                {selectedAuctioneerFilter === "All"
                                  ? "ALL"
                                  : selectedAuctioneerFilter.toUpperCase()}{" "}
                                | DATE: {appDate}
                              </span>
                              <h3 className="uppercase tracking-wider text-zinc-950 font-black text-xs mt-1">
                                ⚓ Source: {src.name} • Total Crates:{" "}
                                {srcTxs.length}
                              </h3>
                            </div>

                            <table className="w-full text-left text-[10px] border-collapse bg-white">
                              <thead>
                                <tr className="border-b-2 border-zinc-900 text-zinc-900 font-black bg-zinc-100/60 uppercase font-mono text-[8.5px]">
                                  <th className="py-1.5 px-2">Crate / Fish</th>
                                  <th className="py-1.5 px-2">#</th>
                                  <th className="py-1.5 px-2">
                                    Assigned Buyer
                                  </th>
                                  <th className="py-1.5 px-2 text-center">
                                    Trade Wt
                                  </th>
                                  <th className="py-1.5 px-2 text-center">
                                    Rate/kg
                                  </th>
                                  <th className="py-1.5 px-2 text-right">
                                    Row Total
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {Object.entries(
                                  srcTxs.reduce(
                                    (acc, t) => {
                                      const k =
                                        t.fish_type || "Unspecified Crate";
                                      if (!acc[k]) acc[k] = [];
                                      acc[k].push(t);
                                      return acc;
                                    },
                                    {} as Record<string, any[]>,
                                  ),
                                ).map(([crateName, crateTxs]) => {
                                  const txsArr = crateTxs as any[];
                                  return (
                                    <React.Fragment key={crateName}>
                                      <tr className="border-b border-t border-zinc-200 bg-zinc-50 break-inside-avoid print:break-inside-avoid">
                                        <td
                                          colSpan={6}
                                          className="py-2 px-2 font-black text-teal-800 uppercase tracking-widest text-[9px]"
                                        >
                                          📦 {crateName} ({txsArr.length}{" "}
                                          trades)
                                        </td>
                                      </tr>
                                      {txsArr.map((tx: any, idx: number) => {
                                        const foundB = buyers.find(
                                          (b) =>
                                            String(b.id)
                                              .trim()
                                              .toLowerCase() ===
                                            String(tx.buyer_id)
                                              .trim()
                                              .toLowerCase(),
                                        );
                                        const buyerNick =
                                          foundB?.nickname ||
                                          (foundB as any)?.name ||
                                          (!String(tx.buyer_id).startsWith(
                                            "temp_",
                                          )
                                            ? tx.buyer_id
                                            : "Unknown Buyer");
                                        return (
                                          <tr
                                            key={tx.id || idx}
                                            className="border-b border-zinc-100 font-mono text-zinc-800 break-inside-avoid print:break-inside-avoid"
                                          >
                                            <td className="py-1 px-2 border-l border-zinc-100"></td>
                                            <td className="py-1 px-2 font-bold text-zinc-400 text-[8.5px]">
                                              #{idx + 1}
                                            </td>
                                            <td className="py-1 px-2 font-bold font-sans text-indigo-900 truncate max-w-[120px] text-[9.5px]">
                                              {buyerNick}
                                            </td>
                                            <td className="py-1 px-2 text-center font-bold text-[9.5px]">
                                              {tx.weight} kg
                                            </td>
                                            <td className="py-1 px-2 text-center text-[9.5px]">
                                              ₹{Math.round(tx.price_per_kg)}
                                            </td>
                                            <td className="py-1 px-2 text-right font-black text-zinc-950 text-[10px]">
                                              ₹
                                              {Math.round(
                                                tx.total_price,
                                              ).toLocaleString()}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </React.Fragment>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        );

                        const isMeasuring = activeSources.some(
                          (s) => !boxHeights[`auction-src-${s.id}`],
                        );

                        if (isMeasuring) {
                          return (
                            <div
                              className="absolute opacity-0 pointer-events-none bg-white box-border p-[48px]"
                              style={{ width: "794px", zIndex: -9999 }}
                            >
                              <div className="grid grid-cols-2 gap-4 mb-4">
                                {activeSources.map((src) => {
                                  const srcTxs =
                                    filteredPrintedTransactions.filter(
                                      (t) => t.source_id === src.id,
                                    );
                                  return renderBox(
                                    src,
                                    srcTxs,
                                    `auction-src-${src.id}`,
                                  );
                                })}
                              </div>
                            </div>
                          );
                        }

                        let pages: any[][] = [];
                        let currentPage: any[] = [];
                        let curHeight = 220; // First page master header overhead + top padding

                        for (let i = 0; i < activeSources.length; i += 2) {
                          const row = [activeSources[i]];
                          if (i + 1 < activeSources.length)
                            row.push(activeSources[i + 1]);

                          const rowH =
                            Math.max(
                              ...row.map(
                                (s) => boxHeights[`auction-src-${s.id}`],
                              ),
                            ) + 24; // 24px grid gap

                          if (
                            currentPage.length > 0 &&
                            curHeight + rowH > 1000
                          ) {
                            // Safe max height per page container
                            pages.push(currentPage);
                            currentPage = [...row];
                            curHeight = 220 + rowH; // Next page has master header too
                          } else {
                            currentPage.push(...row);
                            curHeight += rowH;
                          }
                        }
                        if (currentPage.length > 0) pages.push(currentPage);

                        return pages.map((chunk, chunkIdx) => (
                          <div
                            key={chunkIdx}
                            className="print-page-wrapper bg-white shadow-xl w-[794px] min-h-[1123px] box-border p-[48px] mx-auto rounded-lg"
                          >
                            <div className="grid grid-cols-2 gap-4 mb-4">
                              {chunk.map((src, srcIdx) => {
                                const srcTxs =
                                  filteredPrintedTransactions.filter(
                                    (t) => t.source_id === src.id,
                                  );
                                return renderBox(src, srcTxs);
                              })}
                            </div>
                          </div>
                        ));
                      })()
                    )}
                  </div>
                </div>
              )}

              {/* 2. SOURCE PAYMENT TAB CONTENT */}
              {activePdfTab === "source_payment" && (
                <div className="space-y-4">
                  <div className="pdf-master-header space-y-4">
                    {/* Summary micro KPIs */}
                    <div className="grid grid-cols-3 gap-2.5 text-center">
                      <div className="border border-zinc-300 p-2 rounded-2xl bg-zinc-50/50">
                        <span className="text-[8.5px] text-zinc-500 font-extrabold uppercase font-sans tracking-wide">
                          Gross Sold Today
                        </span>
                        <div className="text-xs font-black text-zinc-950 font-mono">
                          ₹{Math.round(totalSalesVolume).toLocaleString()}
                        </div>
                      </div>
                      <div className="border border-zinc-300 p-2 rounded-2xl bg-zinc-50/50">
                        <span className="text-[8.5px] text-zinc-500 font-extrabold uppercase font-sans tracking-wide">
                          Arat Fees (Settled)
                        </span>
                        <div className="text-xs font-black text-zinc-950 font-mono text-rose-700">
                          ₹
                          {sourcePayments
                            .filter((p) => p.is_settled)
                            .reduce((s, p) => s + (p.commission || 0), 0)
                            .toLocaleString()}
                        </div>
                      </div>
                      <div className="border border-zinc-300 p-2 rounded-2xl bg-zinc-50/50">
                        <span className="text-[8.5px] text-zinc-500 font-extrabold uppercase font-sans tracking-wide">
                          Total Payouts (Settled)
                        </span>
                        <div className="text-xs font-black text-zinc-950 font-mono font-bold text-teal-700">
                          ₹
                          {sourcePayments
                            .filter((p) => p.is_settled)
                            .reduce(
                              (s, p) => s + (p.amount_paid_to_source || 0),
                              0,
                            )
                            .toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <p className="text-[10px] text-zinc-500 text-zinc-500 italic">
                      Below lists exactly how much fish was auctioned per source
                      in each discrete trade weight landing, the respective
                      auction values gained per kg, and the net payout allocated
                      to the source after agency commission.
                    </p>
                  </div>

                  <div className="space-y-4 -mt-2">
                    {(() => {
                      const activeSources = sources.filter((s) =>
                        transactions.some((t) => String(t.source_id) === String(s.id)),
                      );
                      if (activeSources.length === 0) {
                        return (
                          <div className="border border-zinc-300 rounded-2xl p-3 space-y-2 bg-zinc-50/40">
                            <div className="flex justify-between items-center border-b border-zinc-200 pb-1 flex-wrap">
                              <span className="font-bold text-[11px] text-zinc-900 uppercase">
                                ⚓ Empty Source • Crates Sold: 0
                              </span>
                            </div>
                            <table className="w-full text-[10px] text-left border-collapse">
                              <thead>
                                <tr className="border-b border-zinc-300 text-zinc-500 font-bold font-mono uppercase text-[8.5px]">
                                  <th className="py-1">Fish Type / Purpose</th>
                                  <th className="py-1 text-center">
                                    Trade Weight
                                  </th>
                                  <th className="py-1 text-center">
                                    Auction Rate
                                  </th>
                                  <th className="py-1 text-right">
                                    Sale Value
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td
                                    colSpan={4}
                                    className="py-6 text-center text-zinc-500 italic"
                                  >
                                    No landings or source trades registered for
                                    payment today.
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        );
                      }

                      const renderBox = (
                        src: any,
                        txs: any[],
                        boxId?: string,
                      ) => {
                        const srcGross = txs.reduce(
                          (sum, t) => sum + (t.total_price || 0),
                          0,
                        );
                        const pmt = sourcePayments.find(
                          (p) => p.source_id === src.id,
                        );
                        const isSettled = pmt ? pmt.is_settled : false;
                        const srcComm =
                          isSettled && typeof pmt!.commission !== "undefined"
                            ? pmt!.commission
                            : 0;
                        const srcGrossCalculated =
                          isSettled && typeof pmt!.sale_total !== "undefined"
                            ? pmt!.sale_total
                            : srcGross;
                        const srcNet =
                          isSettled &&
                          typeof pmt!.amount_paid_to_source !== "undefined"
                            ? pmt!.amount_paid_to_source
                            : 0;

                        return (
                          <div
                            key={src.id}
                            data-box-id={boxId}
                            className="border border-zinc-300 rounded-2xl p-4 space-y-2 bg-zinc-50/40 print:break-inside-avoid"
                          >
                            <div className="flex justify-between items-center border-b border-zinc-200 pb-1 flex-wrap">
                              <span className="font-bold text-[11px] text-zinc-900 uppercase">
                                ⚓ {src.name} • Sold: {txs.length}
                              </span>
                              <div className="text-[10.5px] font-mono flex flex-col gap-0.5 text-right text-zinc-600 font-bold">
                                <span>
                                  Gross: ₹
                                  {Math.round(srcGross).toLocaleString()}
                                </span>
                                {isSettled ? (
                                  <>
                                    <span className="text-rose-700">
                                      Fee: ₹
                                      {Math.round(srcComm).toLocaleString()}
                                    </span>
                                    <span className="text-teal-700">
                                      Payout: ₹
                                      {Math.round(srcNet).toLocaleString()}
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-amber-600 tracking-wider">
                                    PAYMENT PENDING
                                  </span>
                                )}
                              </div>
                            </div>

                            <table className="w-full mt-2 border-collapse text-[9.5px]">
                              <thead>
                                <tr className="border-b border-zinc-200 text-zinc-500 font-bold bg-zinc-100 uppercase font-mono text-[8px]">
                                  <th className="py-1.5 px-2 text-left">
                                    Crate / Fish
                                  </th>
                                  <th className="py-1.5 px-2 text-center">
                                    Wt
                                  </th>
                                  <th className="py-1.5 px-2 text-center">
                                    Rate
                                  </th>
                                  <th className="py-1.5 px-2 text-right">
                                    Value
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {Object.entries(
                                  txs.reduce(
                                    (acc, t) => {
                                      const k =
                                        t.fish_type || "Unspecified Crate";
                                      if (!acc[k]) acc[k] = [];
                                      acc[k].push(t);
                                      return acc;
                                    },
                                    {} as Record<string, any[]>,
                                  ),
                                ).map(([crateName, crateTxs]) => {
                                  const txsArr = crateTxs as any[];
                                  const totalWt = txsArr.reduce(
                                    (sum: number, t: any) =>
                                      sum + (Number(t.weight) || 0),
                                    0,
                                  );
                                  const totalVal = txsArr.reduce(
                                    (sum: number, t: any) =>
                                      sum + (t.total_price || 0),
                                    0,
                                  );
                                  const meanRate =
                                    totalWt > 0 ? totalVal / totalWt : 0;
                                  return (
                                    <tr
                                      key={crateName}
                                      className="border-b border-zinc-100 font-mono text-zinc-800 break-inside-avoid"
                                    >
                                      <td className="py-1.5 px-2 font-bold text-teal-800 truncate max-w-[80px]">
                                        {crateName}
                                      </td>
                                      <td className="py-1.5 px-2 text-center font-bold">
                                        {totalWt.toFixed(2)}kg
                                      </td>
                                      <td className="py-1.5 px-2 text-center">
                                        ₹{Math.round(meanRate)}
                                      </td>
                                      <td className="py-1.5 px-2 text-right font-bold text-zinc-950">
                                        ₹{Math.round(totalVal).toLocaleString()}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        );
                      };

                      const isMeasuring = activeSources.some(
                        (s) => !boxHeights[`payment-src-${s.id}`],
                      );

                      if (isMeasuring) {
                        return (
                          <div
                            className="absolute opacity-0 pointer-events-none bg-white box-border p-[48px]"
                            style={{ width: "794px", zIndex: -9999 }}
                          >
                            <div className="grid grid-cols-2 gap-4 mb-4">
                              {activeSources.map((src) => {
                                const txs = transactions.filter(
                                  (t) => t.source_id === src.id,
                                );
                                return renderBox(
                                  src,
                                  txs,
                                  `payment-src-${src.id}`,
                                );
                              })}
                            </div>
                          </div>
                        );
                      }

                      let pages: any[][] = [];
                      let currentPage: any[] = [];
                      let curHeight = 200; // Master header overhead

                      for (let i = 0; i < activeSources.length; i += 2) {
                        const row = [activeSources[i]];
                        if (i + 1 < activeSources.length)
                          row.push(activeSources[i + 1]);

                        const rowH =
                          Math.max(
                            ...row.map(
                              (s) => boxHeights[`payment-src-${s.id}`],
                            ),
                          ) + 24;

                        if (currentPage.length > 0 && curHeight + rowH > 1000) {
                          pages.push(currentPage);
                          currentPage = [...row];
                          curHeight = 200 + rowH;
                        } else {
                          currentPage.push(...row);
                          curHeight += rowH;
                        }
                      }
                      if (currentPage.length > 0) pages.push(currentPage);

                      return pages.map((chunk, chunkIdx) => (
                        <div
                          key={chunkIdx}
                          className="print-page-wrapper bg-white shadow-xl w-[794px] min-h-[1123px] box-border p-[48px] mx-auto rounded-lg"
                        >
                          <div className="grid grid-cols-2 gap-4 mb-4">
                            {chunk.map((src, srcIdx) => {
                              const txs = transactions.filter(
                                (t) => t.source_id === src.id,
                              );
                              return renderBox(src, txs);
                            })}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}

              {/* 3. COLLECTION TAB CONTENT */}
              {activePdfTab === "collection" && (
                <div className="space-y-4">
                  <div className="pdf-master-header space-y-4">
                    {/* Summary micro KPIs */}
                    <div className="grid grid-cols-3 gap-2.5 text-center">
                      <div className="border border-zinc-300 p-2 rounded-2xl bg-zinc-50/50">
                        <span className="text-[8.5px] text-zinc-500 font-extrabold uppercase font-sans tracking-wide">
                          Approved Cash
                        </span>
                        <div className="text-xs font-black text-zinc-950 font-mono">
                          ₹
                          {Math.round(
                            totalCollectionsReceived,
                          ).toLocaleString()}
                        </div>
                      </div>
                      <div className="border border-zinc-300 p-2 rounded-2xl bg-zinc-50/50">
                        <span className="text-[8.5px] text-zinc-500 font-extrabold uppercase font-sans tracking-wide">
                          Pending verification
                        </span>
                        <div className="text-xs font-black text-zinc-950 font-mono text-amber-700">
                          ₹
                          {Math.round(totalCollectionsPending).toLocaleString()}
                        </div>
                      </div>
                      <div className="border border-zinc-300 p-2 rounded-2xl bg-zinc-50/50">
                        <span className="text-[8.5px] text-zinc-500 font-extrabold uppercase font-sans tracking-wide">
                          Total Cleared
                        </span>
                        <div className="text-xs font-black text-zinc-950 font-mono font-bold text-teal-700">
                          ₹
                          {Math.round(
                            totalCollectionsReceived + totalCollectionsPending,
                          ).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {(() => {
                    if (buyerBalancesList.length === 0) {
                      return (
                        <table className="w-full text-left text-[10.5px] border-collapse">
                          <thead>
                            <tr className="border-b border-zinc-400 text-zinc-600 font-bold bg-zinc-100/60 uppercase font-mono text-[9px]">
                              <th className="py-1 px-1">Buyer Nickname</th>
                              <th className="py-1 text-center font-mono">
                                Start Rollover
                              </th>
                              <th className="py-1 text-center font-mono">
                                Today's Purchases
                              </th>
                              <th className="py-1 text-center font-mono">
                                Today's Paid
                              </th>
                              <th className="py-1 text-center font-mono">
                                Current Outstanding
                              </th>
                              <th className="py-1 text-right">Ledger Trend</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td
                                colSpan={6}
                                className="py-6 text-center text-zinc-500 italic font-sans"
                              >
                                No active wholesale customer accounts in ledger
                                today.
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      );
                    }

                    const chunks = [];
                    let currentLimit = 15;
                    let i = 0;
                    while (i < buyerBalancesList.length) {
                      chunks.push(buyerBalancesList.slice(i, i + currentLimit));
                      i += currentLimit;
                      currentLimit = 35;
                    }

                    return chunks.map((chunk, chunkIdx) => (
                      <div
                        key={chunkIdx}
                        className="print-page-wrapper bg-white shadow-xl w-[794px] min-h-[1123px] box-border p-[48px] mx-auto rounded-lg mt-4"
                      >
                        <table className="w-full text-left text-[12px] border-collapse">
                          <thead>
                            <tr className="border-b border-zinc-400 text-zinc-600 font-bold bg-zinc-100/60 uppercase font-mono text-[10px]">
                              <th className="py-2 px-1">Buyer Nickname</th>
                              <th className="py-2 text-center font-mono">
                                Start Rollover
                              </th>
                              <th className="py-2 text-center font-mono">
                                Today's Purchases
                              </th>
                              <th className="py-2 text-center font-mono">
                                Today's Paid
                              </th>
                              <th className="py-2 text-center font-mono">
                                Current Outstanding
                              </th>
                              <th className="py-2 text-right">Ledger Trend</th>
                            </tr>
                          </thead>
                          <tbody>
                            {chunk.map(
                              (
                                {
                                  buyer,
                                  prevRollover,
                                  todayPurchases,
                                  todayPaid,
                                  currentBalance,
                                },
                                idx,
                              ) => {
                                const netDelta = todayPurchases - todayPaid;
                                return (
                                  <tr
                                    key={buyer.id || idx}
                                    className="border-b border-zinc-200"
                                  >
                                    <td className="py-2 px-1 font-black text-indigo-950 font-sans">
                                      {buyer.nickname}
                                    </td>
                                    <td className="py-2 text-center font-mono font-bold text-zinc-600">
                                      ₹
                                      {Math.round(
                                        prevRollover,
                                      ).toLocaleString()}
                                    </td>
                                    <td className="py-2 text-center font-mono font-bold text-rose-800">
                                      +₹
                                      {Math.round(
                                        todayPurchases,
                                      ).toLocaleString()}
                                    </td>
                                    <td className="py-2 text-center font-mono font-bold text-emerald-800">
                                      -₹{Math.round(todayPaid).toLocaleString()}
                                    </td>
                                    <td className="py-2 text-center font-mono font-black text-zinc-950 bg-amber-50">
                                      ₹
                                      {Math.round(
                                        currentBalance,
                                      ).toLocaleString()}
                                    </td>
                                    <td className="py-2 text-right font-mono text-[9px] uppercase">
                                      {netDelta > 0 && (
                                        <span className="text-rose-700 font-extrabold">
                                          📈 (+₹
                                          {Math.round(
                                            netDelta,
                                          ).toLocaleString()}
                                          )
                                        </span>
                                      )}
                                      {netDelta < 0 && (
                                        <span className="text-emerald-700 font-extrabold">
                                          📉 (-₹
                                          {Math.round(
                                            Math.abs(netDelta),
                                          ).toLocaleString()}
                                          )
                                        </span>
                                      )}
                                      {netDelta === 0 && (
                                        <span className="text-zinc-500 font-medium">
                                          Stable
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              },
                            )}
                          </tbody>
                        </table>
                      </div>
                    ));
                  })()}
                </div>
              )}

              {/* 4. COLLECTION SLIP TAB CONTENT */}
              {activePdfTab === "collection_slip" && (
                <div className="space-y-4">
                  {/* Toggle button row (print:hidden) */}
                  <div className="bg-zinc-50 border border-zinc-200 p-3 rounded-2xl space-y-2.5 print:hidden">
                    <div className="text-[10px] font-sans font-black uppercase text-zinc-500 tracking-wide">
                      Select Individual Slip Sub-section (Recorded as internal
                      business files):
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
                          <div className="flex justify-between items-center flex-wrap gap-2">
                            <div>
                              <h4 className="text-[10px] font-bold text-zinc-600 uppercase">
                                👥 Individual Buyer Outstanding Slips
                              </h4>
                              <p className="text-[8.5px] text-zinc-500 italic">
                                Showing buyers with lifetime outstanding
                                balances owed until today.
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap justify-end">
                              <input
                                type="search"
                                placeholder="Search Buyer A-Z..."
                                value={buyerSearchFilter}
                                onChange={(e) =>
                                  setBuyerSearchFilter(e.target.value)
                                }
                                className="text-[10px] border border-zinc-300 rounded-lg px-2 py-1 bg-white text-zinc-800 w-[125px] focus:outline-none focus:border-amber-500"
                              />
                              <select
                                value={selectedBuyerSlipFilter}
                                onChange={(e) =>
                                  setSelectedBuyerSlipFilter(e.target.value)
                                }
                                className="text-xs border border-zinc-300 rounded-lg px-2 py-1 bg-white font-bold text-zinc-800 focus:outline-none"
                              >
                                <option value="All">All Buyers</option>
                                {buyerBalancesList
                                  .filter((b) => b.currentBalance > 0 || b.todayPurchases > 0 || b.todayPaid > 0)
                                  .filter((b) =>
                                    b.buyer.nickname
                                      .toLowerCase()
                                      .includes(
                                        buyerSearchFilter.toLowerCase(),
                                      ),
                                  )
                                  .sort((a, b) =>
                                    a.buyer.nickname.localeCompare(
                                      b.buyer.nickname,
                                    ),
                                  )
                                  .map((b) => (
                                    <option key={b.buyer.id} value={b.buyer.id}>
                                      {b.buyer.nickname}
                                    </option>
                                  ))}
                              </select>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-2">
                          {(() => {
                            const list = buyerBalancesList.filter(
                              (b) =>
                                (b.currentBalance > 0 || b.todayPurchases > 0 || b.todayPaid > 0) &&
                                (selectedBuyerSlipFilter === "All" ||
                                  String(b.buyer.id) === selectedBuyerSlipFilter),
                            ).sort((a, b) => a.buyer.nickname.localeCompare(b.buyer.nickname));
                            if (list.length === 0) {
                              return (
                                <div
                                  className="border-2 border-dashed border-zinc-300 p-4 rounded-2xl bg-zinc-50/45 space-y-2 relative"
                                  style={{ pageBreakInside: "avoid" }}
                                >
                                  <div className="absolute top-1 right-2 text-zinc-400 text-[8.5px] uppercase font-mono select-none">
                                    Blank Buyer Copy
                                  </div>
                                  <div className="border-b border-zinc-300 pb-1.5 flex justify-between items-start">
                                    <div>
                                      <h4 className="font-extrabold text-[14px] text-zinc-950 uppercase tracking-tight">
                                        _______________
                                      </h4>
                                      <p className="text-[9px] text-zinc-600 font-mono">
                                        ID: _______ • Customer Ledger Dues
                                      </p>
                                    </div>
                                    <div className="text-[9px] text-zinc-600 font-mono text-right font-black">
                                      {appDate}
                                    </div>
                                  </div>
                                  <div className="py-1">
                                    <div className="text-[9.5px] text-zinc-600 font-sans font-bold uppercase tracking-wider">
                                      How much has buyer owed until today:
                                    </div>
                                    <div className="text-[18px] font-black text-rose-300 font-mono mt-0.5">
                                      ₹0
                                    </div>
                                  </div>
                                </div>
                              );
                            }

                            let pages: any[][] = [];
                            for (let i = 0; i < list.length; i += 6) {
                              pages.push(list.slice(i, i + 6));
                            }

                            return pages.map((chunk, chunkIdx) => (
                              <div
                                key={chunkIdx}
                                className="print-page-wrapper bg-white shadow-xl w-[794px] h-[1123px] max-h-[1123px] shrink-0 box-border p-[48px] rounded-lg flex flex-col mx-auto overflow-hidden"
                              >
                                <div className="grid grid-cols-2 grid-rows-3 gap-6 flex-1 min-h-0">
                                  {chunk.map(
                                    ({ buyer, currentBalance }: any) => {
                                      return (
                                        <div
                                          key={buyer.id}
                                          className="border-2 border-dashed border-zinc-300 p-4 rounded-2xl bg-zinc-50/45 flex flex-col gap-2 relative overflow-hidden"
                                          style={{ pageBreakInside: "avoid" }}
                                        >
                                          <div className="absolute top-1.5 right-2 text-zinc-400 text-[8.5px] uppercase font-mono select-none">
                                            Dual Invoice Statement
                                          </div>
                                          <div className="border-b border-zinc-300 pb-2 flex justify-between items-start shrink-0">
                                            <div>
                                              <h4 className="font-extrabold text-[14px] text-zinc-950 uppercase tracking-tight truncate max-w-[150px]">
                                                {buyer.nickname}
                                              </h4>
                                              <p className="text-[9px] text-zinc-600 font-mono">
                                                Customer ID: {buyer.id} • Dues
                                                Statement
                                              </p>
                                            </div>
                                            <div className="text-[9px] text-zinc-600 font-mono text-right font-black">
                                              Date: {appDate}
                                            </div>
                                          </div>

                                          {/* Dual Options Grid */}
                                          <div className="grid grid-cols-2 gap-3 divide-x divide-zinc-200 shrink-0">
                                            {/* Option A: Owed Today */}
                                            <div className="space-y-1 pr-1.5">
                                              <div className="bg-amber-100/50 border border-amber-500/30 p-2 rounded-xl">
                                                <span className="text-[8.5px] font-black text-amber-900 uppercase tracking-wider block">
                                                  Option A
                                                </span>
                                                <span className="text-[8px] text-zinc-700 font-bold block leading-tight">
                                                  Owed Today
                                                </span>
                                                <div className="text-[18px] font-black text-amber-950 font-mono mt-0.5 truncate">
                                                  ₹
                                                  {(() => {
                                                    const itemVal =
                                                      buyerBalancesList.find(
                                                        (x) =>
                                                          x.buyer.id ===
                                                          buyer.id,
                                                      );
                                                    return Math.round(
                                                      itemVal
                                                        ? itemVal.todayPurchases
                                                        : 0,
                                                    ).toLocaleString();
                                                  })()}
                                                </div>
                                              </div>
                                            </div>

                                            {/* Option B: Total Outstanding */}
                                            <div className="space-y-1 pl-3">
                                              <div className="bg-rose-100/50 border border-rose-500/30 p-2 rounded-xl">
                                                <span className="text-[8.5px] font-black text-rose-900 uppercase tracking-wider block">
                                                  Option B
                                                </span>
                                                <span className="text-[8px] text-zinc-700 font-bold block leading-tight">
                                                  Total Outstanding
                                                </span>
                                                <div className="text-[18px] font-black text-rose-950 font-mono mt-0.5 truncate">
                                                  ₹
                                                  {Math.round(
                                                    currentBalance,
                                                  ).toLocaleString()}
                                                </div>
                                              </div>
                                            </div>
                                          </div>

                                          {/* Mathematical representation and purchases */}
                                          <div className="bg-zinc-50 p-2 rounded-xl text-[9.5px] text-zinc-700 font-mono flex flex-col gap-1 flex-1 overflow-hidden">
                                            {(() => {
                                              const itemVal =
                                                buyerBalancesList.find(
                                                  (x) =>
                                                    x.buyer.id === buyer.id,
                                                ) || {
                                                  prevRollover: 0,
                                                  todayPurchases: 0,
                                                  todayPaid: 0,
                                                };
                                              const buyerTxs =
                                                transactions.filter(
                                                  (t) =>
                                                    String(t.buyer_id) ===
                                                    String(buyer.id),
                                                );
                                              return (
                                                <>
                                                  <div className="flex justify-between shrink-0">
                                                    <span>
                                                      Previous Balance:
                                                    </span>
                                                    <span>
                                                      ₹
                                                      {Math.round(
                                                        itemVal.prevRollover,
                                                      ).toLocaleString()}
                                                    </span>
                                                  </div>
                                                  <div className="flex justify-between text-amber-700 font-bold shrink-0">
                                                    <span>
                                                      Today's Purchases (+):
                                                    </span>
                                                    <span>
                                                      ₹
                                                      {Math.round(
                                                        itemVal.todayPurchases,
                                                      ).toLocaleString()}
                                                    </span>
                                                  </div>
                                                  {buyerTxs.length > 0 &&
                                                    (() => {
                                                      const MAX_ROWS = 5;
                                                      let displayTxs = buyerTxs;
                                                      if (
                                                        buyerTxs.length >
                                                        MAX_ROWS
                                                      ) {
                                                        displayTxs =
                                                          buyerTxs.slice(
                                                            0,
                                                            MAX_ROWS - 1,
                                                          );
                                                        const remaining =
                                                          buyerTxs.slice(
                                                            MAX_ROWS - 1,
                                                          );
                                                        const remainingWt =
                                                          remaining.reduce(
                                                            (s, tx) =>
                                                              s +
                                                              (Number(
                                                                tx.weight,
                                                              ) || 0),
                                                            0,
                                                          );
                                                        const remainingTotal =
                                                          remaining.reduce(
                                                            (s, tx) =>
                                                              s +
                                                              (tx.total_price ||
                                                                0),
                                                            0,
                                                          );
                                                        const avgPrice =
                                                          remainingWt > 0
                                                            ? remainingTotal /
                                                              remainingWt
                                                            : 0;
                                                        displayTxs.push({
                                                          fish_type: `Others (${remaining.length})`,
                                                          weight: remainingWt,
                                                          price_per_kg:
                                                            Math.round(
                                                              avgPrice,
                                                            ),
                                                          total_price:
                                                            remainingTotal,
                                                        } as any);
                                                      }

                                                      return (
                                                        <div className="pl-2 pr-1 py-1 my-1 border-l-2 border-amber-200 flex-1 overflow-hidden flex flex-col">
                                                          <div className="flex-1 overflow-hidden min-h-0">
                                                            <table className="w-full text-[8.5px] text-left">
                                                              <thead>
                                                                <tr className="border-b border-zinc-300 uppercase text-zinc-500 font-bold">
                                                                  <th className="py-0.5 px-1 truncate max-w-[80px]">
                                                                    Item
                                                                  </th>
                                                                  <th className="py-0.5 text-center">
                                                                    Wt
                                                                  </th>
                                                                  <th className="py-0.5 text-center">
                                                                    Rate
                                                                  </th>
                                                                  <th className="py-0.5 text-right">
                                                                    Total
                                                                  </th>
                                                                </tr>
                                                              </thead>
                                                              <tbody>
                                                                {displayTxs.map(
                                                                  (tx, i) => (
                                                                    <tr
                                                                      key={i}
                                                                      className="text-zinc-700"
                                                                    >
                                                                      <td className="py-0.5 w-[40%] truncate px-1 text-[8px] font-sans font-bold max-w-[80px]">
                                                                        {tx.fish_type ||
                                                                          "Unsorted"}
                                                                      </td>
                                                                      <td className="py-0.5 text-center">
                                                                        {Math.round(
                                                                          tx.weight *
                                                                            10,
                                                                        ) / 10}
                                                                      </td>
                                                                      <td className="py-0.5 text-center">
                                                                        {
                                                                          tx.price_per_kg
                                                                        }
                                                                      </td>
                                                                      <td className="py-0.5 text-right font-bold text-zinc-900">
                                                                        ₹
                                                                        {Math.round(
                                                                          tx.total_price,
                                                                        )}
                                                                      </td>
                                                                    </tr>
                                                                  ),
                                                                )}
                                                              </tbody>
                                                            </table>
                                                          </div>
                                                        </div>
                                                      );
                                                    })()}
                                                  <div className="flex justify-between text-emerald-700 font-bold border-b border-zinc-200 pb-0.5 shrink-0 mt-auto">
                                                    <span>
                                                      Today's Payments (-):
                                                    </span>
                                                    <span>
                                                      ₹
                                                      {Math.round(
                                                        itemVal.todayPaid,
                                                      ).toLocaleString()}
                                                    </span>
                                                  </div>
                                                  <div className="flex justify-between text-zinc-950 font-black pt-0.5 shrink-0">
                                                    <span>
                                                      Current Outstanding
                                                      Balance:
                                                    </span>
                                                    <span>
                                                      ₹
                                                      {Math.round(
                                                        currentBalance,
                                                      ).toLocaleString()}
                                                    </span>
                                                  </div>
                                                </>
                                              );
                                            })()}
                                          </div>

                                          <div className="border-t border-zinc-200 pt-1.5 text-[8px] text-zinc-400 font-mono flex justify-between shrink-0">
                                            <span>
                                              Generated via NFC Systems
                                            </span>
                                            <span>Authorized Signature</span>
                                          </div>
                                        </div>
                                      );
                                    },
                                  )}
                                </div>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="border-b border-zinc-200 pb-1 print:hidden">
                          <div className="flex justify-between items-center flex-wrap gap-2">
                            <div>
                              <h4 className="text-[10px] font-bold text-zinc-600 uppercase">
                                ⚓ Individual Source Vessel Settlement Slips
                              </h4>
                              <p className="text-[8.5px] text-zinc-500 italic">
                                Showing sources & landing sources net catch
                                payouts paid today and outstandings.
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap justify-end">
                              <input
                                type="search"
                                placeholder="Search Source A-Z..."
                                value={sourceSearchFilter}
                                onChange={(e) =>
                                  setSourceSearchFilter(e.target.value)
                                }
                                className="text-[10px] border border-zinc-300 rounded-lg px-2 py-1 bg-white text-zinc-800 w-[125px] focus:outline-none focus:border-indigo-500"
                              />
                              <select
                                value={selectedSourceSlipFilter}
                                onChange={(e) =>
                                  setSelectedSourceSlipFilter(e.target.value)
                                }
                                className="text-xs border border-zinc-300 rounded-lg px-2 py-1 bg-white font-bold text-zinc-800 focus:outline-none"
                              >
                                <option value="All">All Sources</option>
                                {sources
                                  .filter((s) =>
                                    s.name
                                      .toLowerCase()
                                      .includes(
                                        sourceSearchFilter.toLowerCase(),
                                      ),
                                  )
                                  .sort((a, b) => a.name.localeCompare(b.name))
                                  .map((s) => (
                                    <option key={s.id} value={s.id}>
                                      {s.name}
                                    </option>
                                  ))}
                              </select>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-2">
                          {(() => {
                            const list = sources.map((s) => {
                              const sTxList = transactions.filter(
                                (tx) => String(tx.source_id) === String(s.id),
                              );
                              const saleSum = sTxList.reduce(
                                (sum, tx) => sum + (tx.total_price || 0),
                                0,
                              );

                              const sPayList = sourcePayments.filter(
                                (p) => String(p.source_id) === String(s.id),
                              );
                              const paidToday = sPayList.reduce(
                                (sum, p) =>
                                  sum + (p.amount_paid_to_source || 0),
                                0,
                              );
                              const commDeducted = sPayList.reduce(
                                (sum, p) => sum + (p.commission || 0),
                                0,
                              );

                              const defaultComm = Math.round(saleSum * 0.05);
                              const netExpect = s.is_completed
                                ? saleSum - commDeducted
                                : saleSum - defaultComm;
                              const oweThemTotal = Math.max(
                                0,
                                netExpect - paidToday,
                              );

                              return {
                                source: s,
                                paidToday,
                                oweThemTotal,
                              };
                            });

                            const activeList = list.filter(
                              ({ source, paidToday, oweThemTotal }) =>
                                (paidToday > 0 || oweThemTotal > 0) &&
                                (selectedSourceSlipFilter === "All" ||
                                  String(source.id) ===
                                    selectedSourceSlipFilter),
                            ).sort((a, b) => a.source.name.localeCompare(b.source.name));

                            if (activeList.length === 0) {
                              return (
                                <div
                                  className="border-2 border-dashed border-indigo-300 p-4 rounded-2xl bg-indigo-50/20 space-y-2.5 relative"
                                  style={{ pageBreakInside: "avoid" }}
                                >
                                  <div className="absolute top-1 right-2 text-indigo-400 text-[8.5px] uppercase font-mono select-none">
                                    Blank Source Copy
                                  </div>
                                  <div className="border-b border-indigo-200 pb-1.5 flex justify-between items-start">
                                    <div>
                                      <h4 className="font-extrabold text-[14px] text-indigo-950 uppercase tracking-tight">
                                        _______________
                                      </h4>
                                      <p className="text-[9px] text-indigo-700 font-mono">
                                        ID: _______ • Vessel Catch Record
                                      </p>
                                    </div>
                                    <div className="text-[9px] text-indigo-600 font-mono text-right font-bold">
                                      {appDate}
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-3 py-1">
                                    <div>
                                      <div className="text-[8.5px] text-zinc-600 uppercase font-bold tracking-wide">
                                        Paid Out Today:
                                      </div>
                                      <div className="text-[18px] font-black font-mono text-emerald-300">
                                        ₹0
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-[8.5px] uppercase font-bold text-zinc-600 tracking-wide">
                                        We Owe Them (Until Today):
                                      </div>
                                      <div className="text-[18px] font-black font-mono text-indigo-300">
                                        ₹0
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            }

                            let pages: any[][] = [];
                            for (let i = 0; i < activeList.length; i += 6) {
                              pages.push(activeList.slice(i, i + 6));
                            }

                            return pages.map((chunk, chunkIdx) => (
                              <div
                                key={chunkIdx}
                                className="print-page-wrapper bg-white shadow-xl w-[794px] h-[1123px] max-h-[1123px] shrink-0 box-border p-[48px] rounded-lg flex flex-col mx-auto overflow-hidden"
                              >
                                <div className="grid grid-cols-2 grid-rows-3 gap-6 flex-1 min-h-0">
                                  {chunk.map(
                                    ({ source, paidToday, oweThemTotal }) => {
                                      return (
                                        <div
                                          key={source.id}
                                          className="border-2 border-dashed border-indigo-300 p-4 rounded-2xl bg-indigo-50/20 flex flex-col gap-2 relative overflow-hidden"
                                          style={{ pageBreakInside: "avoid" }}
                                        >
                                          <div className="absolute top-1 max-w-[100px] truncate right-2 text-indigo-400 text-[8.5px] uppercase font-mono select-none">
                                            Source Copy
                                          </div>
                                          <div className="border-b border-indigo-200 pb-1.5 flex justify-between items-start shrink-0">
                                            <div className="flex-1 min-w-0 pr-2">
                                              <h4 className="font-extrabold text-[14px] text-indigo-950 uppercase tracking-tight truncate w-full">
                                                {source.name}
                                              </h4>
                                              <p className="text-[9px] text-indigo-700 font-mono truncate">
                                                ID: {source.id} • Vessel Catch
                                                Record
                                              </p>
                                            </div>
                                            <div className="text-[9px] text-indigo-600 font-mono text-right font-bold shrink-0 pt-0.5">
                                              {appDate}
                                            </div>
                                          </div>

                                          <div className="grid grid-cols-2 gap-3 shrink-0">
                                            <div>
                                              <div className="text-[8.5px] text-zinc-600 uppercase font-bold tracking-wide">
                                                Paid Out Today:
                                              </div>
                                              <div className="text-[18px] font-black font-mono text-emerald-800 truncate">
                                                ₹
                                                {Math.round(
                                                  paidToday,
                                                ).toLocaleString()}
                                              </div>
                                            </div>
                                            <div>
                                              <div className="text-[8.5px] uppercase font-bold text-zinc-600 tracking-wide">
                                                We Owe Them (Until Today):
                                              </div>
                                              <div className="text-[18px] font-black font-mono text-indigo-950 truncate">
                                                ₹
                                                {Math.round(
                                                  oweThemTotal,
                                                ).toLocaleString()}
                                              </div>
                                            </div>
                                          </div>

                                          {(() => {
                                            const sTxList = transactions.filter(
                                              (tx) =>
                                                String(tx.source_id) === String(source.id),
                                            );
                                            if (sTxList.length === 0)
                                              return null;

                                            const crateGroups = sTxList.reduce(
                                              (acc, t) => {
                                                const k =
                                                  t.fish_type ||
                                                  "Unspecified Crate";
                                                if (!acc[k]) acc[k] = [];
                                                acc[k].push(t);
                                                return acc;
                                              },
                                              {} as Record<string, any[]>,
                                            );

                                            const MAX_ROWS = 7;
                                            let entries =
                                              Object.entries(crateGroups);

                                            let displayEntries = entries;
                                            if (entries.length > MAX_ROWS) {
                                              displayEntries = entries.slice(
                                                0,
                                                MAX_ROWS - 1,
                                              );
                                              const remaining = entries.slice(
                                                MAX_ROWS - 1,
                                              );

                                              // Flatten remaining transactions to calculate aggregates
                                              const remainingTxs =
                                                remaining.flatMap(
                                                  ([_, txs]) => txs,
                                                );
                                              const remWt = remainingTxs.reduce(
                                                (sum, t) =>
                                                  sum + (Number(t.weight) || 0),
                                                0,
                                              );
                                              const remVal =
                                                remainingTxs.reduce(
                                                  (sum, t) =>
                                                    sum + (t.total_price || 0),
                                                  0,
                                                );

                                              // Use a dummy group for the remaining
                                              displayEntries.push([
                                                `Other Items (${remaining.length})`,
                                                [
                                                  {
                                                    weight: remWt,
                                                    total_price: remVal,
                                                  },
                                                ] as any,
                                              ]);
                                            }

                                            return (
                                              <div className="pl-2 pr-1 py-1 my-1 border-l-2 border-indigo-200 flex flex-col flex-1 overflow-hidden">
                                                <div className="flex-1 overflow-hidden min-h-0">
                                                  <table className="w-full text-[8.5px] text-left">
                                                    <thead>
                                                      <tr className="border-b border-indigo-200 uppercase text-indigo-500 font-bold">
                                                        <th className="py-0.5 truncate max-w-[80px]">
                                                          Catch / Item
                                                        </th>
                                                        <th className="py-0.5 text-center">
                                                          Wt(kg)
                                                        </th>
                                                        <th className="py-0.5 text-center">
                                                          Mean Rate
                                                        </th>
                                                        <th className="py-0.5 text-right">
                                                          Value
                                                        </th>
                                                      </tr>
                                                    </thead>
                                                    <tbody>
                                                      {displayEntries.map(
                                                        ([
                                                          crateName,
                                                          crateTxs,
                                                        ]) => {
                                                          const totalWt =
                                                            crateTxs.reduce(
                                                              (sum, t) =>
                                                                sum +
                                                                (Number(
                                                                  t.weight,
                                                                ) || 0),
                                                              0,
                                                            );
                                                          const totalVal =
                                                            crateTxs.reduce(
                                                              (sum, t) =>
                                                                sum +
                                                                (t.total_price ||
                                                                  0),
                                                              0,
                                                            );
                                                          const meanRate =
                                                            totalWt > 0
                                                              ? totalVal /
                                                                totalWt
                                                              : 0;
                                                          return (
                                                            <tr
                                                              key={crateName}
                                                              className="text-zinc-700"
                                                            >
                                                              <td className="py-0.5 w-[40%] truncate pr-1 text-[8.5px] font-sans font-bold max-w-[80px]">
                                                                {crateName}
                                                              </td>
                                                              <td className="py-0.5 text-center">
                                                                {Math.round(
                                                                  totalWt * 10,
                                                                ) / 10}
                                                              </td>
                                                              <td className="py-0.5 text-center">
                                                                ₹
                                                                {Math.round(
                                                                  meanRate,
                                                                )}
                                                              </td>
                                                              <td className="py-0.5 text-right font-bold text-zinc-950">
                                                                ₹
                                                                {Math.round(
                                                                  totalVal,
                                                                )}
                                                              </td>
                                                            </tr>
                                                          );
                                                        },
                                                      )}
                                                    </tbody>
                                                  </table>
                                                </div>
                                              </div>
                                            );
                                          })()}

                                          <div className="border-t border-indigo-100 mt-auto pt-1.5 text-[8.5px] text-indigo-400 font-mono flex justify-between shrink-0">
                                            <span>
                                              Timestamp:{" "}
                                              {new Date().toLocaleDateString()}{" "}
                                              {new Date().toLocaleTimeString()}
                                            </span>
                                            <span>Private Settlement File</span>
                                          </div>
                                        </div>
                                      );
                                    },
                                  )}
                                </div>
                              </div>
                            ));
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
                    <h2 className="text-2xl font-black uppercase text-zinc-950 font-sans tracking-tight">
                      Daily Halt & Final Financial Summary
                    </h2>
                    <p className="text-[12px] font-mono text-zinc-600">
                      The total consolidated end-of-day market performance
                      snapshot for {appDate}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-zinc-50 border border-zinc-200 p-4 rounded-xl text-center space-y-1">
                      <div className="text-[9px] uppercase font-black text-zinc-500 tracking-widest font-mono">
                        Total Volume Handled
                      </div>
                      <div className="text-xl font-bold font-mono text-zinc-900">
                        {totalWeightSold.toFixed(2)} KG
                      </div>
                    </div>
                    <div className="bg-zinc-50 border border-zinc-200 p-4 rounded-xl text-center space-y-1">
                      <div className="text-[9px] uppercase font-black text-zinc-500 tracking-widest font-mono">
                        Gross Auctions
                      </div>
                      <div className="text-xl font-bold font-mono text-cyan-700 block">
                        ₹{totalSalesVolume.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-zinc-50 border border-zinc-200 p-4 rounded-xl text-center space-y-1">
                      <div className="text-[9px] uppercase font-black text-zinc-500 tracking-widest font-mono">
                        Net Full Profit
                      </div>
                      <div className="text-xl font-bold font-mono text-indigo-700 block">
                        ₹{totalProfit.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-zinc-50 border border-zinc-200 p-4 rounded-xl text-center space-y-1">
                      <div className="text-[9px] uppercase font-black text-zinc-500 tracking-widest font-mono">
                        Cash Realized Today
                      </div>
                      <div className="text-xl font-bold font-mono text-emerald-700 block">
                        ₹{totalCollectionsReceived.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left side: Source Summaries */}
                    <div className="border border-zinc-300 rounded-xl overflow-hidden shadow-sm">
                      <div className="bg-zinc-100 text-[10px] uppercase font-black tracking-wider text-zinc-500 p-2.5 text-center border-b border-zinc-300">
                        Source Ledger Debits
                      </div>
                      <div className="p-3 divide-y divide-zinc-100">
                        {sources.length === 0 && (
                          <div className="text-xs text-zinc-400 text-center py-4">
                            No sources active today.
                          </div>
                        )}
                        {sources.map((s) => {
                          const pDay = sourcePayments
                            .filter((p) => String(p.source_id) === String(s.id))
                            .reduce(
                              (sum, p) => sum + (p.amount_paid_to_source || 0),
                              0,
                            );
                          return (
                            <div
                              key={s.id}
                              className="py-2 flex justify-between items-center text-xs"
                            >
                              <span className="font-bold text-zinc-800">
                                {s.name}
                              </span>
                              <span className="font-mono text-zinc-600">
                                Paid: ₹{pDay.toLocaleString()}
                              </span>
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
                        {buyers
                          .slice()
                          .sort((a, b) => b.lifetime_debt - a.lifetime_debt)
                          .slice(0, 10)
                          .map((b) => (
                            <div
                              key={b.id}
                              className="py-2 flex justify-between items-center text-xs print:break-inside-avoid"
                            >
                              <span className="font-bold text-rose-900">
                                {b.nickname || (b as any).name || b.id}
                              </span>
                              <span className="font-mono text-rose-700 font-bold">
                                ₹{Math.round(b.lifetime_debt).toLocaleString()}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>

                  {/* Detailed Transaction Log - explicitly chunked to repeat headers cleanly */}
                  {(() => {
                    if (transactions.length === 0) {
                      return (
                        <div className="border border-zinc-300 rounded-xl overflow-hidden shadow-sm mt-6">
                          <div className="bg-zinc-100 text-[10px] uppercase font-black tracking-wider text-zinc-500 p-2.5 text-center border-b border-zinc-300">
                            Detailed Trade Ledger for {appDate}
                          </div>
                          <div className="p-4 text-center text-zinc-400 font-sans text-xs">
                            No transactions recorded today.
                          </div>
                        </div>
                      );
                    }

                    const chunks = [];
                    let currentLimit = 15; // 1st page fits fewer because of the large header and grid
                    let i = 0;
                    while (i < transactions.length) {
                      chunks.push(transactions.slice(i, i + currentLimit));
                      i += currentLimit;
                      currentLimit = 35; // subsequent pages fit more
                    }

                    return chunks.map((chunk, chunkIdx) => (
                      <div
                        key={chunkIdx}
                        className={`border border-zinc-300 rounded-xl overflow-hidden shadow-sm mt-6 ${chunkIdx > 0 ? "print-page-wrapper" : ""}`}
                      >
                        <div className="bg-zinc-100 text-[10px] uppercase font-black tracking-wider text-zinc-500 p-2.5 text-center border-b border-zinc-300">
                          Detailed Trade Ledger for {appDate}{" "}
                          {chunks.length > 1
                            ? `(Page ${chunkIdx + 1}/${chunks.length})`
                            : ""}
                        </div>
                        <div className="p-0">
                          <table className="w-full text-left text-[10.5px] sm:text-[11px] whitespace-nowrap font-mono">
                            <thead>
                              <tr className="text-zinc-500 border-b border-zinc-200 bg-zinc-50">
                                <th className="p-2 font-bold uppercase">
                                  Time
                                </th>
                                <th className="p-2 font-bold uppercase">
                                  Sold By
                                </th>
                                <th className="p-2 font-bold uppercase">
                                  Source
                                </th>
                                <th className="p-2 font-bold uppercase">
                                  Buyer
                                </th>
                                <th className="p-2 font-bold uppercase">
                                  Fish
                                </th>
                                <th className="p-2 font-bold text-right uppercase">
                                  Weight
                                </th>
                                <th className="p-2 font-bold text-right uppercase">
                                  Rate
                                </th>
                                <th className="p-2 font-bold text-right uppercase">
                                  Value
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                              {chunk.map((tx) => {
                                const src = sources.find(
                                  (s) => s.id === tx.source_id,
                                );
                                const buy = buyers.find(
                                  (b) => b.id === tx.buyer_id,
                                );
                                const timeStr = new Date(
                                  (tx as any).timestamp || Date.now(),
                                ).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                });
                                const authOp = tx.added_by || "System Staff";
                                return (
                                  <tr key={tx.id} className="hover:bg-zinc-50">
                                    <td className="p-2 text-zinc-400">
                                      {timeStr}
                                    </td>
                                    <td className="p-2 font-bold text-zinc-500">
                                      {authOp}
                                    </td>
                                    <td className="p-2 font-bold text-zinc-700 max-w-[100px] truncate">
                                      {src?.name || "Unknown"}
                                    </td>
                                    <td className="p-2 font-bold text-indigo-700 max-w-[100px] truncate">
                                      {buy?.nickname ||
                                        (buy as any)?.name ||
                                        (!String(tx.buyer_id).startsWith(
                                          "temp_",
                                        )
                                          ? tx.buyer_id
                                          : "Unknown")}
                                    </td>
                                    <td className="p-2 text-zinc-600 max-w-[80px] truncate">
                                      {tx.fish_type || "Unsorted"}
                                    </td>
                                    <td className="p-2 text-right font-bold text-zinc-800">
                                      {tx.weight} kg
                                    </td>
                                    <td className="p-2 text-right">
                                      ₹{tx.price_per_kg}
                                    </td>
                                    <td className="p-2 text-right font-black text-zinc-950">
                                      ₹{tx.total_price.toLocaleString()}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>
            {/* end of print-sheet-canvas */}
          </div>
          {/* end of scale wrapper */}
        </div>
        {/* end of dashboard-preview-parent container */}

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
                    await shareAsPDF(
                      "print-sheet-canvas",
                      filename,
                      title,
                      text,
                      "share",
                    );
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
                    await shareAsPDF(
                      "print-sheet-canvas",
                      filename,
                      title,
                      text,
                      "download",
                    );
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
