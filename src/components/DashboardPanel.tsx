/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DashboardAI } from "./DashboardAI";
import { Brain } from "lucide-react";
import { PdfExportView } from "./PdfExportView";
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
  const [activePdfTab, setActivePdfTab] = React.useState<"auction" | "source_payment" | "collection" | "collection_slip" | "day_closing">("auction");
  const [selectedAuctioneerFilter, setSelectedAuctioneerFilter] = React.useState<string>('All');
  const [showAI, setShowAI] = React.useState(false);
  const [leaderboardTime, setLeaderboardTime] = React.useState<"daily" | "weekly" | "monthly">("daily");

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

  const handleDirectPrint = (pdfType: "auction" | "source_payment" | "collection" | "collection_slip" | "day_closing") => {
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
  const totalProfit = sourcePayments.reduce((sum, p) => sum + ((p.sale_total || 0) - (p.amount_paid_to_source || 0)), 0);

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

  // Leaderboard logic
  const filteredLeaderboardTxs = data?.transactions?.filter((tx: any) => {
     if (leaderboardTime === "daily") return tx.date === appDate;
     if (leaderboardTime === "weekly") {
        const txTime = new Date(tx.date).getTime();
        const nowTime = new Date(appDate).getTime();
        return (nowTime - txTime) <= 7 * 24 * 60 * 60 * 1000 && txTime <= nowTime;
     }
     if (leaderboardTime === "monthly") {
        return tx.date.substring(0, 7) === appDate.substring(0, 7);
     }
     return false;
  }) || [];
  
  const filteredLeaderboardCols = data?.daily_collections?.filter((c: any) => {
     if (leaderboardTime === "daily") return c.date === appDate;
     if (leaderboardTime === "weekly") {
        const cTime = new Date(c.date).getTime();
        const nowTime = new Date(appDate).getTime();
        return (nowTime - cTime) <= 7 * 24 * 60 * 60 * 1000 && cTime <= nowTime;
     }
     if (leaderboardTime === "monthly") {
        return c.date.substring(0, 7) === appDate.substring(0, 7);
     }
     return false;
  }) || [];

  const buyerVolumes = filteredLeaderboardTxs.reduce((acc, tx) => {
     acc[String(tx.buyer_id)] = (acc[String(tx.buyer_id)] || 0) + (tx.total_price || 0);
     return acc;
  }, {} as Record<string, number>);
  const topBuyersByVolume = Object.entries(buyerVolumes).sort((a,b) => b[1] - a[1]).slice(0, 3);

  const buyerPayments = filteredLeaderboardCols.filter((c: any) => c.is_approved).reduce((acc, c) => {
     acc[String(c.buyer_id)] = (acc[String(c.buyer_id)] || 0) + (c.amount_paid || 0);
     return acc;
  }, {} as Record<string, number>);
  const topPayers = Object.entries(buyerPayments).sort((a,b) => b[1] - a[1]).slice(0, 3);

  const sourceVolumes = filteredLeaderboardTxs.reduce((acc, tx) => {
     acc[String(tx.source_id)] = (acc[String(tx.source_id)] || 0) + (tx.total_price || 0);
     return acc;
  }, {} as Record<string, number>);
  const topSellers = Object.entries(sourceVolumes).sort((a,b) => b[1] - a[1]).slice(0, 3);

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
          <div className="pt-1.5 flex flex-col items-center md:items-start gap-2">
            <button
              onClick={() => setShowPrintView(true)}
              className="px-4 py-2 w-full md:w-auto text-center justify-center bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-605 hover:to-indigo-605 text-white text-[11px] font-black tracking-wider rounded-2xl shadow-lg cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] duration-150 flex items-center gap-1.5 shrink-0 select-none border border-white/10"
              id="btn-trigger-print-summary"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Export PDF / Print Records</span>
            </button>
          </div>
        </div>

        {activeUser && (
          <div className="flex flex-col items-end gap-2 z-10 shrink-0">
            <div className="bg-zinc-950/60 border border-indigo-900/40 rounded-2xl px-4 py-3 text-center md:text-right font-sans w-full max-w-[180px]">
              <div className="text-[10px] text-indigo-400 uppercase tracking-widest font-mono font-bold">
                Authenticated Session
              </div>
              <div className="text-xs font-black text-rose-100 flex items-center justify-center md:justify-end gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                {activeUser.name}
              </div>
              <div className="text-[9.5px] uppercase font-mono text-zinc-500 tracking-wider mt-1">
                Role: {activeUser.role}
              </div>
            </div>
            
            <button
              onClick={() => setShowAI(true)}
              className="w-full max-w-[180px] py-1.5 rounded-xl border border-indigo-500/20 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Brain className="w-3 h-3" />
              <span>AI Target Assist</span>
            </button>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
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
              Source Commission & Net Payout Settlement. Prints final payouts made to landings sources after fee deductions.
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
              3. Collections
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
              4. Indiv. Slips
            </span>
            <span className="text-[10px] text-zinc-500 text-zinc-400 mt-1 pb-1">
              Buyer Balance Collection Slips. Dynamic individual customer receipt tiles with scissor cut lines, starting debts, and cash received.
            </span>
            <span className="text-[9.5px] text-amber-400 font-bold font-mono tracking-wider mt-auto pt-2.5 uppercase">
              Generate PDF →
            </span>
          </button>

          {/* Button 5: Day Closing Snapshot */}
          <button
            onClick={() => handleDirectPrint("day_closing")}
            className="flex flex-col items-start p-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-rose-500/35 rounded-2xl cursor-pointer transition text-left h-full select-none"
          >
            <div className="p-2 bg-rose-500/10 text-rose-400 rounded-2xl mb-2 flex items-center justify-center">
              <HardDrive className="w-4 h-4" />
            </div>
            <span className="text-[11.5px] font-bold text-zinc-100 uppercase tracking-wide">
              Day Closing Snapshot
            </span>
            <span className="text-[10px] text-zinc-500 text-zinc-400 mt-1 pb-1">
              A comprehensive daily summary compiling all key metrics, active debts, commissions, and total revenues in a single unified PDF.
            </span>
            <span className="text-[9.5px] text-rose-400 font-bold font-mono tracking-wider mt-auto pt-2.5 uppercase">
              Generate PDF →
            </span>
          </button>
        </div>
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
            Net Realized Profit
          </p>
          <h3 className="text-base md:text-lg font-black font-mono text-indigo-300 mt-2">
            ₹ {totalProfit.toLocaleString()}
          </h3>
          <p className="text-[9px] text-zinc-500 font-mono mt-1">
            Trade margins & collected commission
          </p>
        </motion.div>

      </div>

      {/* 🏆 Leaderboard Section */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl shadow-xl overflow-hidden p-4 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
          <div className="flex flex-col">
            <h3 className="text-sm font-black text-zinc-100 uppercase tracking-widest flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-500" />
              Market Leaderboards
            </h3>
            <span className="text-[10px] text-zinc-500 font-mono">Real-time ranking of top participants</span>
          </div>
          <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden shrink-0">
            {["daily", "weekly", "monthly"].map((t) => (
              <button
                key={t}
                onClick={() => setLeaderboardTime(t as any)}
                className={`text-[10px] uppercase font-bold tracking-wider px-3 py-1.5 transition ${
                  leaderboardTime === t ? "bg-emerald-500/20 text-emerald-400" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800/50">
            <h4 className="text-[10px] font-bold text-teal-400 uppercase tracking-widest border-b border-zinc-800 pb-2 mb-2">Largest Volume Buyers</h4>
            <div className="space-y-2">
              {topBuyersByVolume.length === 0 ? <div className="text-[10px] text-zinc-600 italic">No activity</div> : null}
              {topBuyersByVolume.map(([bId, amt], i) => (
                <div key={bId} className="flex justify-between items-center text-xs">
                  <span className="text-zinc-300 font-bold truncate max-w-[120px] flex gap-1.5 items-center">
                    <span className="text-zinc-600 text-[9px] w-3">{i + 1}.</span> 
                    {buyers.find(b => String(b.id) === bId)?.nickname || bId}
                  </span>
                  <span className="font-mono text-teal-500 font-bold">₹{Math.round(amt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800/50">
            <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest border-b border-zinc-800 pb-2 mb-2">Most Consistent Payers</h4>
            <div className="space-y-2">
              {topPayers.length === 0 ? <div className="text-[10px] text-zinc-600 italic">No activity</div> : null}
              {topPayers.map(([bId, amt], i) => (
                <div key={bId} className="flex justify-between items-center text-xs">
                  <span className="text-zinc-300 font-bold truncate max-w-[120px] flex gap-1.5 items-center">
                    <span className="text-zinc-600 text-[9px] w-3">{i + 1}.</span> 
                    {buyers.find(b => String(b.id) === bId)?.nickname || bId}
                  </span>
                  <span className="font-mono text-indigo-500 font-bold">₹{Math.round(amt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800/50">
            <h4 className="text-[10px] font-bold text-rose-400 uppercase tracking-widest border-b border-zinc-800 pb-2 mb-2">Top Grossing Sellers</h4>
            <div className="space-y-2">
              {topSellers.length === 0 ? <div className="text-[10px] text-zinc-600 italic">No activity</div> : null}
              {topSellers.map(([sId, amt], i) => (
                <div key={sId} className="flex justify-between items-center text-xs">
                  <span className="text-zinc-300 font-bold truncate max-w-[120px] flex gap-1.5 items-center">
                    <span className="text-zinc-600 text-[9px] w-3">{i + 1}.</span> 
                    {sources.find(s => String(s.id) === sId)?.name || sId}
                  </span>
                  <span className="font-mono text-rose-500 font-bold">₹{Math.round(amt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recommended features block: Indian note calculator and helper tips */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Quick arat helper details */}
        <div className="p-4 bg-zinc-950 text-zinc-500 rounded-2xl border border-zinc-800 text-[10.5px] leading-relaxed space-y-1.5 shadow-sm">
          <div className="font-sans font-bold text-zinc-350 text-[11px] uppercase tracking-wider text-zinc-400">
            📊 Operational Arat Guidelines
          </div>
          <p>
            Wholesale transactions operate offline-optimistically under severe weather. Always finalize Source settlements under <strong>Sources Harbor</strong> page to calculate commissions and custom trade margins.
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
      {showPrintView && <PdfExportView onClose={() => setShowPrintView(false)} defaultTab={activePdfTab} />}

    {showAI && <DashboardAI transactions={data?.transactions || []} onClose={() => setShowAI(false)} />}
      </motion.div>
  );
};
