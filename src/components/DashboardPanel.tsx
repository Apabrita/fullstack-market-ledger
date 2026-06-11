/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { useData } from "./DataContext";
import { User as DbUser } from "../db";
import {
  TrendingUp,
  Scale,
  Landmark,
  Anchor,
  AlertTriangle,
  BadgeAlert,
  ArrowRight,
  HardDrive,
  Activity,
  Award,
  DollarSign,
  Printer,
  X,
  FileText,
  Share2,
  Download,
  Cloud,
  Check,
  Loader,
  FileSpreadsheet,
  Calendar,
  AlertCircle,
  RefreshCcw
} from "lucide-react";
import {
  isWorkspaceConnected,
  getWorkspaceToken,
  clearWorkspaceToken,
  initiateGoogleOAuth,
  syncDataToGoogleSheets,
  uploadFileToGoogleDrive,
  constructPlainReportText,
  syncReportToGoogleDocs,
  syncSourcesToGoogleCalendar
} from "../utils/workspace";
import { bidirectionalSync } from "../utils/sheets_sync";
import { performDayClosingBackup } from "../utils/BackupService";
import { shareAsPDF } from "../utils/pdf";

interface DashboardPanelProps {
  activeUser: DbUser | null;
  isAuthenticated: boolean;
  onNavigate: (tab: any) => void;
}

export const DashboardPanel: React.FC<DashboardPanelProps> = ({
  activeUser,
  isAuthenticated,
  onNavigate,
}) => {
  const { data, queue, appDate } = useData();
  const [showPrintView, setShowPrintView] = React.useState(false);
  const [activePdfTab, setActivePdfTab] = React.useState<"auction" | "source_payment" | "collection" | "collection_slip">("auction");
  const [scaleFactor, setScaleFactor] = React.useState(1);

  React.useEffect(() => {
    if (!showPrintView) return;
    const parent = document.getElementById("dashboard-preview-parent");
    if (!parent) return;
    const updateScale = () => {
      const width = parent.clientWidth;
      if (width < 850) {
        const newScale = (width - 32) / 794;
        setScaleFactor(Math.max(0.35, Math.min(1, newScale)));
      } else {
        setScaleFactor(1);
      }
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    const timer = setTimeout(updateScale, 150);
    return () => {
      window.removeEventListener("resize", updateScale);
      clearTimeout(timer);
    };
  }, [showPrintView, activePdfTab]);

  const [selectedAuctioneerFilter, setSelectedAuctioneerFilter] = React.useState<string>("All");
  const [slipCategory, setSlipCategory] = React.useState<"buyers" | "sources">("buyers");

  // Google Workspace Integration states
  const [googleConnected, setGoogleConnected] = React.useState(isWorkspaceConnected());
  const [googleToken, setGoogleToken] = React.useState<string | null>(getWorkspaceToken());
  const [showConfigCliId, setShowConfigCliId] = React.useState(false);
  const [selectedWcReport, setSelectedWcReport] = React.useState<"auction" | "source_payment" | "collection" | "collection_slip">("auction");
  const [masterSpreadsheetId, setMasterSpreadsheetId] = React.useState("");
  
  const [isSyncingSheets, setIsSyncingSheets] = React.useState(false);
  const [isUploadingDrive, setIsUploadingDrive] = React.useState(false);
  const [isCreatingDocs, setIsCreatingDocs] = React.useState(false);
  const [isLoggingCalendar, setIsLoggingCalendar] = React.useState(false);
  const [isMasterSyncing, setIsMasterSyncing] = React.useState(false);
  const [isDayClosing, setIsDayClosing] = React.useState(false);
  const [wcErrorMessage, setWcErrorMessage] = React.useState<string | null>(null);
  const [wcSuccessMessage, setWcSuccessMessage] = React.useState<string | null>(null);

  // Periodically check if Google account becomes connected or refreshed
  React.useEffect(() => {
    const checkTimer = setInterval(() => {
      const activeCon = isWorkspaceConnected();
      if (activeCon !== googleConnected) {
        setGoogleConnected(activeCon);
        setGoogleToken(getWorkspaceToken());
      }
    }, 1000);
    return () => clearInterval(checkTimer);
  }, [googleConnected]);

  const handleConnectGoogle = async () => {
    try {
      const success = await initiateGoogleOAuth();
      if (success) {
        setGoogleConnected(true);
        setGoogleToken(getWorkspaceToken());
      }
    } catch (err: any) {
      if (err.code === 'auth/cancelled-popup-request' || err.code === 'auth/popup-closed-by-user') {
        return;
      }
      setWcErrorMessage("OAuth connection setup failed: " + err.message);
    }
  };

  const handleDisconnectGoogle = async () => {
    await clearWorkspaceToken();
    setGoogleConnected(false);
    setGoogleToken(null);
    setWcSuccessMessage("Google account disconnected successfully.");
    setTimeout(() => setWcSuccessMessage(null), 3500);
  };

  const handleSyncSheets = async () => {
    if (!data) return;
    setIsSyncingSheets(true);
    setWcErrorMessage(null);
    setWcSuccessMessage(null);
    try {
      const res = await syncDataToGoogleSheets(data, selectedWcReport, appDate);
      setWcSuccessMessage(`📋 Successfully compiled & synced to Google Sheets! Rows updated: ${res.rowsAdded}. Spreadsheet link: ${res.spreadsheetUrl}`);
    } catch (err: any) {
      console.error(err);
      setWcErrorMessage(`Google Sheets Sync failed: ${err.message}. Please verify your custom Client ID & re-auth connection.`);
    } finally {
      setIsSyncingSheets(false);
    }
  };

  const handleSaveDrive = async () => {
    if (!data) return;
    setIsUploadingDrive(true);
    setWcErrorMessage(null);
    setWcSuccessMessage(null);
    try {
      const reportContent = constructPlainReportText(data, selectedWcReport, appDate);
      const filename = `New_Fish_Center_${selectedWcReport.toUpperCase()}_JOURNAL_${appDate}.txt`;
      const res = await uploadFileToGoogleDrive(filename, reportContent, "text/plain");
      setWcSuccessMessage(`💾 Document parsed as digital format and loaded to Google Drive! File ID: ${res.fileId}. File Link: ${res.webViewLink}`);
    } catch (err: any) {
      console.error(err);
      setWcErrorMessage(`Google Drive Upload failed: ${err.message}. Check your scopes/credentials.`);
    } finally {
      setIsUploadingDrive(false);
    }
  };

  const handleDraftDocs = async () => {
    if (!data) return;
    setIsCreatingDocs(true);
    setWcErrorMessage(null);
    setWcSuccessMessage(null);
    try {
      const res = await syncReportToGoogleDocs(data, selectedWcReport, appDate);
      setWcSuccessMessage(`📝 Google Document draft created successfully! Doc ID: ${res.documentId}. Document Link: ${res.documentUrl}`);
    } catch (err: any) {
      console.error(err);
      setWcErrorMessage(`Google Docs creation failed: ${err.message}. Please re-auth.`);
    } finally {
      setIsCreatingDocs(false);
    }
  };

  const handleLogCalendar = async () => {
    if (!data) return;
    setIsLoggingCalendar(true);
    setWcErrorMessage(null);
    setWcSuccessMessage(null);
    try {
      const res = await syncSourcesToGoogleCalendar(data, appDate);
      setWcSuccessMessage(`📅 Logged ${res.eventsCreated} Active Vessel Landing slots on your Google Calendar!`);
    } catch (err: any) {
      console.error(err);
      setWcErrorMessage(`Google Calendar sync failed: ${err.message}. Ensure permissions are enabled.`);
    } finally {
      setIsLoggingCalendar(false);
    }
  };

  const handleMasterSync = async () => {
    if (!data || !masterSpreadsheetId) {
      setWcErrorMessage("Please enter a valid Spreadsheet ID to perform Master Sync.");
      return;
    }
    setIsMasterSyncing(true);
    setWcErrorMessage(null);
    setWcSuccessMessage(null);
    try {
      const stats = await bidirectionalSync(masterSpreadsheetId, data);
      setWcSuccessMessage(`🔄 BI-DIRECTIONAL MASTER SYNC COMPLETE! Exported: ${stats.rowsExported} rows. Imported/Merged: ${stats.rowsImported} rows.`);
    } catch (err: any) {
      console.error(err);
      setWcErrorMessage(`Master sync failed: ${err.message}. (Ensure the sheet has 'Buyers' and 'Sources' tabs)`);
    } finally {
      setIsMasterSyncing(false);
    }
  };

  const handleDayClosingBackup = async () => {
    setIsDayClosing(true);
    setWcErrorMessage(null);
    setWcSuccessMessage(null);
    try {
      const res = await performDayClosingBackup();
      setWcSuccessMessage(`💾 DAY CLOSED! Snapshot backup saved to Drive. File ID: ${res.fileId}. Size: ${(res.bytes / 1024).toFixed(2)} KB.`);
    } catch (err: any) {
      console.error(err);
      setWcErrorMessage(`Day closing failed: ${err.message}.`);
    } finally {
      setIsDayClosing(false);
    }
  };

  const handleDirectPrint = (pdfType: "auction" | "source_payment" | "collection" | "collection_slip") => {
    setActivePdfTab(pdfType);
    setShowPrintView(true);
  };

  const buyers = data?.buyers || [];
  const sources = data?.sources || [];
  const transactions = (data?.transactions || []).filter((tx: any) => tx.date === appDate);
  const collections = (data?.daily_collections || []).filter((c: any) => c.date === appDate);
  const sourcePayments = (data?.source_payments || []).filter((p: any) => p.date === appDate);

  // Distinct list of auctioneers who sold today
  const uniqueAuctioneers = Array.from(
    new Set(
      transactions.map((tx) => tx.added_by || "Apon Das (Admin)")
    )
  );

  // Filtered transactions for the printable sheet based on selected filter
  const filteredPrintedTransactions = selectedAuctioneerFilter === "All"
    ? transactions
    : transactions.filter((tx) => (tx.added_by || "Apon Das (Admin)") === selectedAuctioneerFilter);

  // Metrics calculations
  const totalSalesVolume = transactions.reduce((sum, tx) => sum + (tx.total_price || 0), 0);
  const totalWeightSold = transactions.reduce((sum, tx) => sum + (tx.weight || 0), 0);
  
  // Total Approved cash collections received
  const approvedCollections = collections.filter((c) => c.is_approved);
  const totalCollectionsReceived = approvedCollections.reduce((sum, c) => sum + (c.amount_paid || 0), 0);

  // Pending Collections for approval
  const pendingCollections = collections.filter((c) => !c.is_approved);
  const totalCollectionsPending = pendingCollections.reduce((sum, c) => sum + (c.amount_paid || 0), 0);

  // Active uncompleted sources in harbor
  const activeSourcesCount = sources.filter((s) => !s.is_completed).length;

  // Commissions cumulative earnings
  const totalCommissions = sourcePayments.reduce((sum, p) => sum + (p.commission || 0), 0);

  // Dynamic Ledger calculations for each buyer to show accurate rollover balances
  const buyerBalancesList = buyers.map((b) => {
    const bTxList = transactions.filter((tx) => String(tx.buyer_id) === String(b.id));
    const todayPurchases = bTxList.reduce((sum, tx) => sum + (tx.total_price || 0), 0);
    const todayWeight = bTxList.reduce((sum, tx) => sum + (tx.weight || 0), 0);
    
    const bColList = collections.filter((col) => String(col.buyer_id) === String(b.id));
    const todayPaid = bColList.reduce((sum, col) => sum + (col.amount_paid || 0), 0);
    const approvedCash = bColList.filter(col => col.is_approved).reduce((sum, col) => sum + (col.amount_paid || 0), 0);
    const pendingCash = bColList.filter(col => !col.is_approved).reduce((sum, col) => sum + (col.amount_paid || 0), 0);
    
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
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-6"
    >
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-zinc-950 via-zinc-900 to-indigo-950 border border-zinc-800 rounded-2xl p-5 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-2xl shadow-black/10 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_120%,rgba(6,182,212,0.15),transparent_40%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_-20%,rgba(99,102,241,0.1),transparent_40%)]" />
        
        <div className="space-y-2 text-center md:text-left z-10">
          <div className="text-[10px] text-teal-400 font-bold uppercase tracking-widest font-mono">
            LIVE ARAT LEDGER
          </div>
          <h2 className="text-xl font-extrabold text-white font-sans uppercase">
            Market Dashboard
          </h2>
          <p className="text-xs text-zinc-400">
            Real-time visual monitoring of fish sources, buyer debts, and cash collection vaults.
          </p>
          <div className="pt-1.5 flex justify-center md:justify-start">
            <button
              onClick={() => setShowPrintView(true)}
              className="px-4 py-2 bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-605 hover:to-indigo-605 text-white text-[11px] font-black uppercase tracking-wider rounded-2xl shadow-lg cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] duration-150 flex items-center gap-1.5 shrink-0 select-none border border-white/10"
              id="btn-trigger-print-summary"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Export PDF / Print Records</span>
            </button>
          </div>
        </div>

        {activeUser && (
          <div className="bg-zinc-950/60 border border-indigo-900/40 rounded-2xl px-4 py-3 text-center md:text-right font-sans z-10 shrink-0">
            <div className="text-[10px] text-indigo-400 uppercase tracking-widest font-mono font-bold">
              Authenticated Session
            </div>
            <div className="text-xs font-black text-rose-100 flex items-center justify-center md:justify-end gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              {activeUser.name}
            </div>
            <div className="text-[9.5px] uppercase font-mono text-zinc-500 tracking-wider">
              System permission: {activeUser.role}
            </div>
          </div>
        )}
      </div>

      {/* 🖨️ Direct Journal PDF Prints Control Section */}
      <div className="bg-zinc-950 border border-zinc-800 p-5 rounded-2xl shadow-2xl shadow-black/10 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div>
            <h3 className="text-xs font-sans font-extrabold uppercase tracking-widest text-[#0d9488]">
              🖨️ Authorized Harbor PDF Generation Portal (A4 FORMAT)
            </h3>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Click any purpose button to construct the dynamic data cache, compile the paper ledger, and trigger the system A4 Print PDF pipeline.
            </p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 font-mono text-[9px] font-bold px-2.5 py-1 rounded tracking-wide uppercase text-teal-400">
            Apon Das (Primary Operator)
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Button 1: Auction Journal */}
          <button
            onClick={() => handleDirectPrint("auction")}
            className="flex flex-col items-start p-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-teal-500/35 rounded-2xl cursor-pointer transition text-left h-full select-none"
          >
            <div className="p-2 bg-teal-500/10 text-teal-400 rounded-2xl mb-2 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <span className="text-[11.5px] font-bold text-zinc-100 uppercase tracking-wide">
              1. Auction Log
            </span>
            <span className="text-[10px] text-zinc-500 text-zinc-400 mt-1 pb-1">
              Daily Auction Dispatch Journal. Lists each fish crate logged, weights, custom rates, unloads, and trade handlers.
            </span>
            <span className="text-[9.5px] text-teal-400 font-bold font-mono tracking-wider mt-auto pt-2.5 uppercase">
              Generate PDF →
            </span>
          </button>

          {/* Button 2: Source Commission & Payout Journal */}
          <button
            onClick={() => handleDirectPrint("source_payment")}
            className="flex flex-col items-start p-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-indigo-500/35 rounded-2xl cursor-pointer transition text-left h-full select-none"
          >
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-2xl mb-2 flex items-center justify-center">
              <Anchor className="w-4 h-4" />
            </div>
            <span className="text-[11.5px] font-bold text-zinc-100 uppercase tracking-wide">
              2. Source Payouts
            </span>
            <span className="text-[10px] text-zinc-500 text-zinc-400 mt-1 pb-1">
              Source Commission & Net Payout Settlement. Prints final payouts made to landings sources after standard 5% fee deductions.
            </span>
            <span className="text-[9.5px] text-indigo-400 font-bold font-mono tracking-wider mt-auto pt-2.5 uppercase">
              Generate PDF →
            </span>
          </button>

          {/* Button 3: Collection Journal */}
          <button
            onClick={() => handleDirectPrint("collection")}
            className="flex flex-col items-start p-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-emerald-500/35 rounded-2xl cursor-pointer transition text-left h-full select-none"
          >
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-2xl mb-2 flex items-center justify-center">
              <Landmark className="w-4 h-4" />
            </div>
            <span className="text-[11.5px] font-bold text-zinc-100 uppercase tracking-wide">
              3. Collections Ledger
            </span>
            <span className="text-[10px] text-zinc-455 text-zinc-400 mt-1 pb-1">
              Daily Revenue Collection Journal. Vault cash balances, approved drafts, and detailed previous rollover debt breakdown.
            </span>
            <span className="text-[9.5px] text-emerald-400 font-bold font-mono tracking-wider mt-auto pt-2.5 uppercase">
              Generate PDF →
            </span>
          </button>

          {/* Button 4: Individual Customer Slips */}
          <button
            onClick={() => handleDirectPrint("collection_slip")}
            className="flex flex-col items-start p-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-amber-500/35 rounded-2xl cursor-pointer transition text-left h-full select-none"
          >
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-2xl mb-2 flex items-center justify-center">
              <Printer className="w-4 h-4" />
            </div>
            <span className="text-[11.5px] font-bold text-zinc-100 uppercase tracking-wide">
              4. Individual Slips
            </span>
            <span className="text-[10px] text-zinc-500 text-zinc-400 mt-1 pb-1">
              Buyer Balance Collection Slips. Dynamic individual customer receipt tiles with scissor cut lines, starting debts, and cash received.
            </span>
            <span className="text-[9.5px] text-amber-400 font-bold font-mono tracking-wider mt-auto pt-2.5 uppercase">
              Generate PDF →
            </span>
          </button>
        </div>
      </div>

      {/* 🌌 Smart Google Workspace Cloud Portal */}
      <div className="bg-zinc-950 border border-zinc-800 p-5 rounded-2xl shadow-2xl shadow-black/10 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-zinc-800 gap-2">
          <div>
            <h3 className="text-xs font-sans font-extrabold uppercase tracking-widest text-sky-500 text-sky-400 flex items-center gap-1.5 animate-pulse">
              <Cloud className="w-4 h-4" /> 🌌 Smart Google Workspace Cloud Portal
            </h3>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Securely synchronize wholesale ledger data into Live Google Sheets, save formatted logs to Google Drive, draft meeting sessions in Google Docs, and schedule landings in Google Calendar.
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {googleConnected ? (
              <div className="flex items-center gap-2">
                <span className="text-[9.5px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono font-bold px-2.5 py-1 rounded-2xl uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Authenticated
                </span>
                <button
                  onClick={handleDisconnectGoogle}
                  className="px-2.5 py-1 text-[9.5px] font-sans font-bold uppercase tracking-wider bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-900/35 rounded-2xl cursor-pointer transition select-none"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-[9.5px] bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono font-bold px-2.5 py-1 rounded-2xl uppercase tracking-wider">
                  Not Connected
                </span>
                <button
                  onClick={handleConnectGoogle}
                  className="px-3.5 py-1 text-[9.5px] font-sans font-black uppercase tracking-wider bg-sky-500 hover:bg-sky-600 text-white shadow-lg shadow-sky-500/10 rounded-2xl cursor-pointer transition flex items-center gap-1 select-none"
                >
                  Connect Google
                </button>
              </div>
            )}
            
            <button
              onClick={() => setShowConfigCliId(!showConfigCliId)}
              className="px-2 py-1 text-[9.5px] font-mono text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-2xl cursor-pointer transition select-none"
            >
              Credentials ⚙️
            </button>
          </div>
        </div>

        {/* Client ID Configuration Panel */}
        {showConfigCliId && (
          <div className="bg-zinc-910 bg-zinc-900/40 p-3.5 border border-zinc-800 rounded-2xl space-y-2.5 text-[11px]">
            <div className="flex items-start gap-2 text-amber-400 bg-amber-500/5 p-2 rounded-2xl border border-amber-500/10">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <strong>Auth Configured Automatically:</strong> The Google Workspace authentication is securely managed by Firebase Auth in the background. Popups are required.
              </div>
            </div>
          </div>
        )}

        {/* Master Bidirectional Sync Section */}
        <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-2xl">
          <div className="mb-2">
             <h4 className="text-[11px] font-sans font-bold uppercase tracking-wide text-fuchsia-400 flex items-center gap-1.5">
               <RefreshCcw className="w-4 h-4" /> BI-DIRECTIONAL MASTER SYNC
             </h4>
             <p className="text-[10.5px] text-zinc-400 mt-1">
               Connect a designated Master Google Sheet to pull real-time database updates and export local Firebase states simultaneously. Useful for accounting departments modifying credit limits or source metrics directly from Google Sheets.
             </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 items-stretch">
            <input
              type="text"
              value={masterSpreadsheetId}
              onChange={(e) => setMasterSpreadsheetId(e.target.value)}
              placeholder="Paste Google Sheet ID (e.g. 1BxiMVs0XRYFa...)"
              className="flex-grow bg-zinc-950 border border-zinc-800 text-zinc-200 px-3 py-1.5 rounded-2xl focus:outline-none focus:border-fuchsia-500 font-mono text-xs"
              disabled={!googleConnected}
            />
            <button
              onClick={handleMasterSync}
              disabled={!googleConnected || isMasterSyncing || !masterSpreadsheetId.trim()}
              className={`px-4 py-2 text-[10.5px] font-bold uppercase tracking-wider rounded-2xl transition shrink-0 ${
                !googleConnected || isMasterSyncing || !masterSpreadsheetId.trim()
                  ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                  : "bg-fuchsia-600 hover:bg-fuchsia-500 text-white shadow-lg shadow-fuchsia-500/20 cursor-pointer"
              }`}
            >
              {isMasterSyncing ? (
                <span className="flex items-center gap-1.5"><Loader className="w-3.5 h-3.5 animate-spin" /> SYNCING...</span>
              ) : (
                "EXECUTE SYNC ⚡"
              )}
            </button>
          </div>
        </div>

        {/* Day Closing Backup Section */}
        <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-2xl">
          <div className="mb-2">
             <h4 className="text-[11px] font-sans font-bold uppercase tracking-wide text-rose-400 flex items-center gap-1.5">
               <HardDrive className="w-4 h-4" /> DAY CLOSING SNAPSHOT
             </h4>
             <p className="text-[10.5px] text-zinc-400 mt-1">
               Generate a complete database snapshot (.json) and archive it securely on Google Drive. This acts as a reliable rollback point to finish operations for the day.
             </p>
          </div>
          <div className="flex justify-start pt-1">
            <button
              onClick={handleDayClosingBackup}
              disabled={!googleConnected || isDayClosing}
              className={`px-4 py-2 text-[10.5px] font-bold uppercase tracking-wider rounded-2xl transition ${
                !googleConnected || isDayClosing
                  ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                  : "bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-500/20 cursor-pointer"
              }`}
            >
              {isDayClosing ? (
                <span className="flex items-center gap-1.5"><Loader className="w-3.5 h-3.5 animate-spin" /> BACKING UP...</span>
              ) : (
                "TRIGGER DAY CLOSING BACKUP 💾"
              )}
            </button>
          </div>
        </div>

        {/* Sync Controls Section */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
          
          {/* Left Column: Data Source Picker */}
          <div className="md:col-span-4 bg-zinc-900 border border-zinc-800 p-3.5 rounded-2xl flex flex-col justify-between">
            <div className="space-y-2">
              <h4 className="text-[10.5px] font-sans font-black uppercase tracking-wider text-zinc-400 font-mono flex items-center gap-1.5">
                🎯 Choose Source Ledger
              </h4>
              <p className="text-[10px] text-zinc-400 leading-relaxed font-sans">
                Determine which specific harbor document or print cache ledger data point you want to synchronize.
              </p>
              
              <div className="space-y-1.5 pt-1.5 font-sans">
                {[
                  { id: "auction", label: "1. Daily Auction Journal" },
                  { id: "source_payment", label: "2. Source Net payout Settlement" },
                  { id: "collection", label: "3. Cash Collections Journal" },
                  { id: "collection_slip", label: "4. Buyer Balance Invoice Slips" }
                ].map((r) => (
                  <label
                    key={r.id}
                    onClick={() => setSelectedWcReport(r.id as any)}
                    className={`flex items-center gap-2.5 p-2 rounded-2xl border text-[11px] cursor-pointer select-none transition ${
                      selectedWcReport === r.id
                        ? "bg-sky-500/10 border-sky-500/50 text-sky-400 font-bold"
                        : "bg-zinc-950 border-zinc-800 hover:bg-zinc-800 text-zinc-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="wc_report_type"
                      checked={selectedWcReport === r.id}
                      onChange={() => {}}
                      className="hidden"
                    />
                    <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${
                      selectedWcReport === r.id ? "border-sky-400" : "border-zinc-700"
                    }`}>
                      {selectedWcReport === r.id && <div className="w-1.5 h-1.5 rounded-full bg-sky-400" />}
                    </div>
                    {r.label}
                  </label>
                ))}
              </div>
            </div>
            
            <div className="text-[9.5px] text-zinc-500 mt-4 leading-relaxed font-mono pt-3 pb-1.5 border-t border-zinc-800 text-center">
              Active Date: {appDate}
            </div>
          </div>

          {/* Right Column: Google Workspace Actions */}
          <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
            
            {/* Sheet Card */}
            <button
              disabled={!googleConnected || isSyncingSheets}
              onClick={handleSyncSheets}
              className={`flex flex-col items-start p-3 border rounded-2xl text-left transition select-none h-full relative ${
                googleConnected
                  ? "bg-zinc-900 border-zinc-800 hover:border-emerald-500/40 hover:bg-zinc-800 cursor-pointer text-zinc-100"
                  : "bg-zinc-900/60 border-zinc-800 text-zinc-400 cursor-not-allowed"
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <div className={`p-1.5 rounded-2xl ${googleConnected ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-800 text-zinc-500"}`}>
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                {isSyncingSheets && <Loader className="w-3.5 h-3.5 animate-spin text-emerald-400" />}
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wide">
                Sync Google Sheets
              </span>
              <span className="text-[9.5px] text-zinc-400 mt-1 font-sans">
                Compiles the chosen dataset and creates a synchronized, editable tabular sheet within your Google Sheets.
              </span>
              <span className={`text-[9.5px] font-bold font-mono tracking-wide mt-auto pt-2.5 uppercase ${
                googleConnected ? "text-emerald-400" : "text-zinc-500"
              }`}>
                {isSyncingSheets ? "Syncing..." : "Export Sheets →"}
              </span>
            </button>

            {/* Drive Card */}
            <button
              disabled={!googleConnected || isUploadingDrive}
              onClick={handleSaveDrive}
              className={`flex flex-col items-start p-3 border rounded-2xl text-left transition select-none h-full relative ${
                googleConnected
                  ? "bg-zinc-900 border-zinc-800 hover:border-blue-500/40 hover:bg-zinc-800 cursor-pointer text-zinc-100"
                  : "bg-zinc-900/60 border-zinc-800 text-zinc-400 cursor-not-allowed"
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <div className={`p-1.5 rounded-2xl ${googleConnected ? "bg-blue-500/10 text-blue-400" : "bg-zinc-800 text-zinc-500"}`}>
                  <HardDrive className="w-4 h-4" />
                </div>
                {isUploadingDrive && <Loader className="w-3.5 h-3.5 animate-spin text-blue-400" />}
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wide">
                Archive to Drive
              </span>
              <span className="text-[9.5px] text-zinc-400 mt-1 font-sans">
                Safely uploads a raw print-journal compatible text document version of the ledger directly to Google Drive storage.
              </span>
              <span className={`text-[9.5px] font-bold font-mono tracking-wide mt-auto pt-2.5 uppercase ${
                googleConnected ? "text-blue-400" : "text-zinc-500"
              }`}>
                {isUploadingDrive ? "Uploading..." : "Save Log File →"}
              </span>
            </button>

            {/* Docs Card */}
            <button
              disabled={!googleConnected || isCreatingDocs}
              onClick={handleDraftDocs}
              className={`flex flex-col items-start p-3 border rounded-2xl text-left transition select-none h-full relative ${
                googleConnected
                  ? "bg-zinc-900 border-zinc-800 hover:border-sky-500/40 hover:bg-zinc-800 cursor-pointer text-zinc-100"
                  : "bg-zinc-900/60 border-zinc-800 text-zinc-400 cursor-not-allowed"
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <div className={`p-1.5 rounded-2xl ${googleConnected ? "bg-sky-500/10 text-sky-400" : "bg-zinc-800 text-zinc-500"}`}>
                  <FileText className="w-4 h-4" />
                </div>
                {isCreatingDocs && <Loader className="w-3.5 h-3.5 animate-spin text-sky-400" />}
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wide">
                Draft Google Docs
              </span>
              <span className="text-[9.5px] text-zinc-400 mt-1 font-sans">
                Constructs a beautifully sectioned, rich text summary meeting file ready to print/share inside Google Docs.
              </span>
              <span className={`text-[9.5px] font-bold font-mono tracking-wide mt-auto pt-2.5 uppercase ${
                googleConnected ? "text-sky-400" : "text-zinc-500"
              }`}>
                {isCreatingDocs ? "Drafting..." : "Write Draft →"}
              </span>
            </button>

            {/* Calendar Card */}
            <button
              disabled={!googleConnected || isLoggingCalendar}
              onClick={handleLogCalendar}
              className={`flex flex-col items-start p-3 border rounded-2xl text-left transition select-none h-full relative ${
                googleConnected
                  ? "bg-zinc-900 border-zinc-800 hover:border-indigo-500/40 hover:bg-zinc-800 cursor-pointer text-zinc-100"
                  : "bg-zinc-900/60 border-zinc-800 text-zinc-400 cursor-not-allowed"
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <div className={`p-1.5 rounded-2xl ${googleConnected ? "bg-indigo-500/10 text-indigo-400" : "bg-zinc-800 text-zinc-500"}`}>
                  <Calendar className="w-4 h-4" />
                </div>
                {isLoggingCalendar && <Loader className="w-3.5 h-3.5 animate-spin text-indigo-400" />}
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wide">
                Sync Calendar Landings
              </span>
              <span className="text-[9.5px] text-zinc-400 mt-1 font-sans">
                Schedules arrivals and land bidding shifts for each landing vessel directly onto your Google Calendar.
              </span>
              <span className={`text-[9.5px] font-bold font-mono tracking-wide mt-auto pt-2.5 uppercase ${
                googleConnected ? "text-indigo-400" : "text-zinc-500"
              }`}>
                {isLoggingCalendar ? "Scheduling..." : "Schedule Landings →"}
              </span>
            </button>
          </div>
        </div>

        {/* Messaging Feedback Console */}
        {(wcSuccessMessage || wcErrorMessage) && (
          <div className="pt-2 font-sans">
            {wcSuccessMessage && (
              <div className="bg-emerald-500/5 text-emerald-400 border border-emerald-500/15 p-3 rounded-2xl text-xs break-all selection:bg-emerald-900 selection:text-white leading-relaxed">
                🎉 <strong>Operations Complete:</strong> {wcSuccessMessage}
              </div>
            )}
            {wcErrorMessage && (
              <div className="bg-rose-500/5 text-rose-400 border border-rose-500/15 p-3 rounded-2xl text-xs break-all selection:bg-rose-900 selection:text-white leading-relaxed">
                ⚠️ <strong>Connection Error:</strong> {wcErrorMessage}
              </div>
            )}
          </div>
        )}
      </div>

      {/* KPI Stats Modules Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        {/* KPI 1: Gross Sales */}
        <motion.div
          whileHover={{ y: -3 }}
          className="bg-zinc-950 border border-zinc-800 p-4.5 rounded-2xl shadow-lg relative overflow-hidden group"
        >
          <div className="absolute top-2 right-2 p-1.5 bg-teal-500/10 text-teal-400 rounded-2xl group-hover:scale-110 transition duration-150">
            <TrendingUp className="w-4 h-4" />
          </div>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-sans">
            Gross Auctions
          </p>
          <h3 className="text-base md:text-lg font-black font-mono text-zinc-100 mt-2">
            ₹ {totalSalesVolume.toLocaleString()}
          </h3>
          <p className="text-[9px] text-zinc-500 font-mono mt-1">
            {totalWeightSold.toLocaleString()} KGs Registered
          </p>
        </motion.div>

        {/* KPI 2: Collections Approved */}
        <motion.div
          whileHover={{ y: -3 }}
          className="bg-zinc-950 border border-zinc-800 p-4.5 rounded-2xl shadow-lg relative overflow-hidden group"
        >
          <div className="absolute top-2 right-2 p-1.5 bg-indigo-500/10 text-indigo-400 rounded-2xl group-hover:scale-110 transition duration-150">
            <Landmark className="w-4 h-4" />
          </div>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-sans">
            Collections Received
          </p>
          <h3 className="text-base md:text-lg font-black font-mono text-emerald-400 mt-2">
            ₹ {totalCollectionsReceived.toLocaleString()}
          </h3>
          <p className="text-[9px] text-amber-500 font-mono mt-1 flex items-center gap-1">
            ₹ {totalCollectionsPending.toLocaleString()} Pending Admin Appr
          </p>
        </motion.div>

        {/* KPI 3: Harbor Sources */}
        <motion.div
          whileHover={{ y: -3 }}
          className="bg-zinc-950 border border-zinc-800 p-4.5 rounded-2xl shadow-lg relative overflow-hidden group"
        >
          <div className="absolute top-2 right-2 p-1.5 bg-cyan-500/10 text-cyan-400 rounded-2xl group-hover:scale-110 transition duration-150">
            <Anchor className="w-4 h-4" />
          </div>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-sans">
            Active Sources
          </p>
          <h3 className="text-base md:text-lg font-black font-sans text-zinc-100 mt-2">
            {activeSourcesCount} in Harbor
          </h3>
          <p className="text-[9px] text-zinc-500 font-mono mt-1">
            {sources.length} Total Registered Ships
          </p>
        </motion.div>

        {/* KPI 4: Arat Comm Profits */}
        <motion.div
          whileHover={{ y: -3 }}
          className="bg-zinc-950 border border-zinc-800 p-4.5 rounded-2xl shadow-lg relative overflow-hidden group"
        >
          <div className="absolute top-2 right-2 p-1.5 bg-orange-500/10 text-orange-400 rounded-2xl group-hover:scale-110 transition duration-150">
            <Award className="w-4 h-4" />
          </div>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-sans">
            Commissions Profit
          </p>
          <h3 className="text-base md:text-lg font-black font-mono text-indigo-300 mt-2">
            ₹ {totalCommissions.toLocaleString()}
          </h3>
          <p className="text-[9px] text-zinc-500 font-mono mt-1">
            From settled sources (5% arat rate)
          </p>
        </motion.div>

      </div>

      {/* Recommended features block: Indian note calculator and helper tips */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Quick arat helper details */}
        <div className="p-4 bg-zinc-950 text-zinc-500 rounded-2xl border border-zinc-800 text-[10.5px] leading-relaxed space-y-1.5 shadow-sm">
          <div className="font-sans font-bold text-zinc-350 text-[11px] uppercase tracking-wider text-zinc-400">
            📊 Operational Arat Guidelines
          </div>
          <p>
            Wholesale transactions operate offline-optimistically under severe weather. Always finalize Source settlements under <strong>Sources Harbor</strong> page to automatically calculate the standard 5% commission cut.
          </p>
          <div className="text-[10px] text-indigo-400 font-mono">
            * Automatic real-time backend resync is fully protected against voltage brownouts.
          </div>
        </div>

        {/* Live offline queue monitor alert */}
        <div className="p-4 bg-zinc-950 text-zinc-500 rounded-2xl border border-zinc-800 text-[10.5px] leading-relaxed space-y-1.5 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <span className="font-sans font-bold text-zinc-500 text-[11px] uppercase tracking-wider text-zinc-500">
              🛠️ Local Cache Buffering
            </span>
            <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-teal-400">
              Active Storage
            </span>
          </div>
          <p>
            Your current hardware holds {queue.length} uncommitted entries. Transactions are guaranteed local data integrity. Force manual cloud syncing once internet connectivity is fully restored, or let the app sync automatically on reconnect!
          </p>
        </div>

      </div>

      {/* 🧾 Elegant Print-Friendly Daily Sheet Modal Overlay */}
      <AnimatePresence>
        {showPrintView && (
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
                  onClick={() => setShowPrintView(false)}
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
                <div className="flex gap-1.5">
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
                    height: scaleFactor < 1 ? `${1123 * scaleFactor}px` : '1123px',
                    overflow: 'hidden'
                  }}
                >
                  <div
                    id="print-sheet-canvas"
                    className="bg-white text-zinc-900 space-y-6 font-sans select-text shadow-sm ring-1 ring-black/5 shrink-0 print:shadow-none print:ring-0 print:p-0 print:max-w-none print:w-full print:min-h-0 print:h-auto"
                    style={{
                      width: '794px',
                      height: '1123px',
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
                  </p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    Authorized Terminal User: <strong className="text-zinc-900">{activeUser?.name || "Apon Das (Admin)"}</strong> | License Scope: {activeUser?.role || "Manager"} Permission
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

                    <div className="space-y-1.5">
                      <table className="w-full text-left text-[10.5px] border-collapse">
                        <thead>
                          <tr className="border-b border-zinc-400 text-zinc-600 font-bold bg-zinc-100/60 text-[9.5px] uppercase font-mono">
                            <th className="py-1 px-1">#</th>
                            <th className="py-1">Auctioneer Agent</th>
                            <th className="py-1">Fish Type</th>
                            <th className="py-1">Source / Source</th>
                            <th className="py-1 text-center">Weight</th>
                            <th className="py-1 text-center">Rate/KG</th>
                            <th className="py-1 text-center">To Buyer</th>
                            <th className="py-1 text-right">Auction Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredPrintedTransactions.map((tx, idx) => {
                            const sourceName = sources.find((s) => String(s.id) === String(tx.source_id))?.name || "Unknown Source";
                            const buyerNick = buyers.find((b) => String(b.id) === String(tx.buyer_id))?.nickname || tx.buyer_id;
                            const clerkName = tx.added_by || activeUser?.name || "Apon Das (Admin)";
                            return (
                              <tr key={tx.id || idx} className="border-b border-zinc-200">
                                <td className="py-1.5 px-1 font-mono font-bold text-zinc-500">#{idx + 1}</td>
                                <td className="py-1.5 font-bold text-zinc-950">{clerkName}</td>
                                <td className="py-1.5 font-semibold text-teal-800">{tx.fish_type}</td>
                                <td className="py-1.5 text-zinc-700">{sourceName}</td>
                                <td className="py-1.5 text-center font-mono font-bold">{tx.weight} kg</td>
                                <td className="py-1.5 text-center font-mono">₹{tx.price_per_kg}</td>
                                <td className="py-1.5 text-center font-semibold text-indigo-900">{buyerNick}</td>
                                <td className="py-1.5 text-right font-bold text-zinc-950 font-mono">₹{Math.round(tx.total_price).toLocaleString()}</td>
                              </tr>
                            );
                          })}
                          {filteredPrintedTransactions.length === 0 && (
                            <tr>
                              <td colSpan={8} className="py-6 text-center text-zinc-500 italic">
                                No active fish auctions found under this filter/user today.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
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
                        <span className="text-[8.5px] text-zinc-500 font-extrabold uppercase font-sans tracking-wide">Arat Agency Fee (5%)</span>
                        <div className="text-xs font-black text-zinc-950 font-mono">₹{Math.round(totalSalesVolume * 0.05).toLocaleString()}</div>
                      </div>
                      <div className="border border-zinc-300 p-2 rounded-2xl bg-zinc-50/50">
                        <span className="text-[8.5px] text-zinc-500 font-extrabold uppercase font-sans tracking-wide">Net Payout Scheduled</span>
                        <div className="text-xs font-black text-zinc-950 font-mono font-bold text-indigo-700">₹{Math.round(totalSalesVolume * 0.95).toLocaleString()}</div>
                      </div>
                    </div>

                    <p className="text-[10px] text-zinc-500 text-zinc-500 italic">
                      Below lists exactly how much fish was auctioned per source in each discrete trade weight landing, the respective auction values gained per kg, and the net payout allocated to the source after the standard 5% agency commission.
                    </p>

                    <div className="space-y-4">
                      {sources.map((src) => {
                        const txs = transactions.filter((t) => t.source_id === src.id);
                        if (txs.length === 0) return null;
                        
                        const srcGross = txs.reduce((sum, t) => sum + (t.total_price || 0), 0);
                        const srcComm = srcGross * 0.05;
                        const srcNet = srcGross - srcComm;

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
                                  <th className="py-1">Fish Type / Purpose</th>
                                  <th className="py-1 text-center">Trade Weight</th>
                                  <th className="py-1 text-center">Auction Rate</th>
                                  <th className="py-1 text-center">Sale Value</th>
                                  <th className="py-1 text-right">Payout Given</th>
                                </tr>
                              </thead>
                              <tbody>
                                {txs.map((t, tIdx) => {
                                  const commVal = t.total_price * 0.05;
                                  const netVal = t.total_price - commVal;
                                  return (
                                    <tr key={t.id || tIdx} className="border-b border-zinc-100 font-mono text-zinc-800">
                                      <td className="py-1.5 font-sans font-semibold text-zinc-900">{t.fish_type}</td>
                                      <td className="py-1.5 text-center font-bold">{t.weight} kg</td>
                                      <td className="py-1.5 text-center">₹{t.price_per_kg}/kg</td>
                                      <td className="py-1.5 text-center">₹{Math.round(t.total_price).toLocaleString()}</td>
                                      <td className="py-1.5 text-right font-bold text-zinc-950">₹{Math.round(netVal).toLocaleString()}</td>
                                    </tr>
                                  );
                                })}
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
                                <th className="py-1 text-center">Sale Value</th>
                                <th className="py-1 text-right">Payout Given</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td colSpan={5} className="py-6 text-center text-zinc-500 italic">
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
        )}
      </AnimatePresence>
    </motion.div>
  );
};
