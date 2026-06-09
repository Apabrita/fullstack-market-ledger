/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState } from "react";
import { DataProvider, useData } from "./components/DataContext";
import { NetworkSimulator } from "./components/NetworkSimulator";
import { UserSimulator } from "./components/UserSimulator";
import { TransactionPanel } from "./components/TransactionPanel";
import { BuyerPanel } from "./components/BuyerPanel";
import { SourcePanel } from "./components/SourcePanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { DashboardPanel } from "./components/DashboardPanel";
import { CollectPanel } from "./components/CollectPanel";
import { HalkhataPanel } from "./components/HalkhataPanel";
import { ProfitPanel } from "./components/ProfitPanel";
import { HistoryPanel } from "./components/HistoryPanel";
import { PinGate } from "./components/PinGate";
import { User } from "./db";
import { checkAndParseOAuthHash } from "./utils/workspace";
import {
  Anchor,
  ShoppingBag,
  Users,
  Settings,
  Waves,
  HardDrive,
  Activity,
  History,
  TrendingDown,
  Landmark,
  BookOpen,
  LogOut,
  Lock,
  Unlock,
  Sliders,
  DollarSign,
  Bell
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const MarketDashboard: React.FC = () => {
  const { data, loading, queue, online, write, activeTheme } = useData();
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [deviceMode, setDeviceMode] = useState<"laptop" | "android">("android");
  const [activeTab, setActiveTab] = useState<
    | "dash"
    | "transactions"
    | "collections"
    | "buyers"
    | "halkhata"
    | "sources"
    | "profit"
    | "history"
    | "settings"
  >("dash");

  // Cinematic Startup Booting Video Simulation state variables
  const [startupBooting, setStartupBooting] = useState(true);
  const [startupLog, setStartupLog] = useState("⚓ Initializing sonar telemetry vectors...");
  const [startupProgress, setStartupProgress] = useState(10);

  // Check and process Google Workspace OAuth hash redirects on startup
  React.useEffect(() => {
    const parsed = checkAndParseOAuthHash();
    if (parsed) {
      console.log("Google Workspace OAuth authentication resolved successfully from URL parameters!");
    }
  }, []);

  React.useEffect(() => {
    const logTimeline = [
      { t: 400, log: "🗃️ Loading local database registers...", p: 35 },
      { t: 900, log: "👤 Caching (400) wholesale buyer licenses...", p: 65 },
      { t: 1500, log: "🛰️ Establishing harbor satellite handshake...", p: 90 },
      { t: 2000, log: "⚓ Port authority ledger secured!", p: 100 },
      { t: 2300, log: "Completed", p: 100 }
    ];

    logTimeline.forEach((step) => {
      setTimeout(() => {
        if (step.log === "Completed") {
          setStartupBooting(false);
        } else {
          setStartupLog(step.log);
          setStartupProgress(step.p);
        }
      }, step.t);
    });
  }, []);

  // State handles for auto-checking day status notifications
  const [showNotificationAlert, setShowNotificationAlert] = useState(false);
  const [hasDismissedAlert, setHasDismissedAlert] = useState(false);

  const settings = data?.settings || [];
  const targetDateStr = "2026-06-09";
  const isDayClosed = settings.find((s) => s.key === `day_closed_${targetDateStr}`)?.value === "true";

  // Check and trigger notification popup if day is not closed
  React.useEffect(() => {
    if (!loading && data && !isDayClosed && !hasDismissedAlert) {
      const timer = setTimeout(() => {
        setShowNotificationAlert(true);
      }, 3500); // Trigger beautifully, 3.5s after load
      return () => clearTimeout(timer);
    } else if (isDayClosed) {
      setShowNotificationAlert(false);
    }
  }, [loading, data, isDayClosed, hasDismissedAlert]);

  const handleNotificationCloseDay = async () => {
    await write("settings", "upsert", { key: `day_closed_${targetDateStr}`, value: "true" });
    setShowNotificationAlert(false);
  };

  const handleNotificationDismiss = () => {
    setHasDismissedAlert(true);
    setShowNotificationAlert(false);
  };

  // Automatically default to Android mode if window is physically mobile-sized
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.innerWidth < 768) {
        setDeviceMode("android");
      }
    }
  }, []);

  const handleStationLock = () => {
    setIsAuthenticated(false);
    setActiveTab("dash");
  };

  const pendingReceiptsCount = data?.daily_collections?.filter((c) => !c.is_approved).length || 0;

  // Let's implement the Laptop Mother Hub View
  const renderLaptopWorkspace = () => (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-200 ${
      activeTheme === "light" ? "bg-slate-50 text-slate-900" : "bg-[#030611] text-slate-100"
    }`}>
      {/* Laptop Header */}
      <header className={`border-b flex flex-col sm:flex-row items-center justify-between gap-4 py-3.5 px-6 md:px-12 sticky top-0 z-50 shadow-md backdrop-blur-md bg-opacity-95 transition-colors duration-200 ${
        activeTheme === "light" ? "bg-white border-slate-200 text-slate-900" : "bg-[#070c1e] border-slate-800 text-slate-100"
      }`}>
        <div className="flex items-center space-x-3 text-center sm:text-left select-none">
          <div className="bg-gradient-to-tr from-teal-500 to-indigo-600 p-2.5 rounded-xl shadow-lg ring-1 ring-white/10">
            <Waves className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className={`text-md md:text-lg font-black font-sans tracking-tight uppercase flex items-center justify-center sm:justify-start gap-1.5 ${
              activeTheme === "light" ? "text-slate-900" : "text-white"
            }`}>
              New Fish Center <span className="text-[10px] bg-teal-500/10 border border-teal-500 text-teal-500 px-2 py-0.5 rounded font-mono font-bold tracking-widest">Laptop Hub</span>
            </h1>
            <p className={`text-[10px] font-mono tracking-wider lowercase ${
              activeTheme === "light" ? "text-slate-600" : "text-slate-400"
            }`}>
              Premium Wholesale Arat Ledger & Offline-Sync Portal
            </p>
          </div>
        </div>

        {/* Viewport switch & sync status */}
        <div className="flex items-center gap-3 flex-wrap justify-end">
          {/* Mode Switch Panel */}
          <div className={`flex p-1 rounded-xl border ${
            activeTheme === "light" ? "bg-slate-200 border-slate-300" : "bg-slate-900 border-slate-800"
          }`}>
            <button
              onClick={() => setDeviceMode("laptop")}
              className={`px-3 py-1 text-[11px] font-bold rounded-lg cursor-pointer transition flex items-center gap-1 ${
                deviceMode === "laptop"
                  ? "bg-teal-600 text-white shadow-md font-black"
                  : activeTheme === "light"
                    ? "text-slate-700 hover:text-slate-900"
                    : "text-slate-400 hover:text-slate-250"
              }`}
            >
              💻 Laptop Hub
            </button>
            <button
              onClick={() => setDeviceMode("android")}
              className={`px-3 py-1 text-[11px] font-bold rounded-lg cursor-pointer transition flex items-center gap-1 ${
                deviceMode === "android"
                  ? "bg-amber-600 text-white shadow-md font-black"
                  : activeTheme === "light"
                    ? "text-slate-700 hover:text-slate-900"
                    : "text-slate-400 hover:text-slate-250"
              }`}
            >
              📱 Android View
            </button>
          </div>

          {queue.length > 0 ? (
            <span className="text-[9.5px] bg-amber-500/15 border border-amber-500/35 text-amber-400 font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow animate-pulse font-sans uppercase">
              <HardDrive className="w-3.5 h-3.5 shrink-0" /> {queue.length} Queued Writes
            </span>
          ) : (
            <span className="text-[9.5px] bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow font-sans uppercase">
              <CheckCircle /> Cloud Synced
            </span>
          )}

          {activeUser && isAuthenticated && (
            <div className="flex items-center gap-2">
              <span className="text-[9.5px] bg-indigo-500/15 border border-indigo-500/20 text-indigo-300 font-bold px-3 py-1.5 rounded-full uppercase tracking-wider">
                🧑‍✈️ {activeUser.name} ({activeUser.role})
              </span>
              <button
                onClick={handleStationLock}
                className="p-1 px-2.5 rounded-full bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 border border-rose-900/30 font-sans font-bold text-[9px] uppercase tracking-wider flex items-center gap-1 transition duration-150 cursor-pointer"
              >
                <Lock className="w-3 h-3" /> Lock
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Laptop Workspace */}
      <main className="flex-grow max-w-7xl w-full mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-6 w-full">
          <UserSimulator
            activeUser={activeUser}
            setActiveUser={setActiveUser}
            isAuthenticated={isAuthenticated}
            setIsAuthenticated={setIsAuthenticated}
          />
          <NetworkSimulator />
        </div>

        {/* Ledger Work Area */}
        <div className={`lg:col-span-8 border rounded-2xl p-5 md:p-6 shadow-xl space-y-6 min-h-[600px] flex flex-col justify-between transition-colors duration-200 ${
          activeTheme === "light"
            ? "bg-white border-slate-200 text-slate-900"
            : "bg-[#060a15] border-[#16223f] text-[#f8fafc]"
        }`}>
          <div className="space-y-6">
            {/* Tabs */}
            <div 
              onWheel={(e) => {
                if (e.deltaY !== 0) {
                  e.currentTarget.scrollLeft += e.deltaY;
                }
              }}
              className="flex border-b border-slate-850 custom-scrollbar overflow-x-auto gap-1"
            >
              {[
                { id: "dash", label: "Dash", icon: <Activity className="w-3.5 h-3.5 shrink-0" /> },
                { id: "transactions", label: "Auction", icon: <ShoppingBag className="w-3.5 h-3.5 shrink-0" /> },
                { id: "collections", label: "Collect", icon: <Landmark className="w-3.5 h-3.5 shrink-0" /> },
                { id: "buyers", label: "Buyers", icon: <Users className="w-3.5 h-3.5 shrink-0" /> },
                { id: "halkhata", label: "Halkhata", icon: <BookOpen className="w-3.5 h-3.5 shrink-0" /> },
                { id: "sources", label: "Sources", icon: <Anchor className="w-3.5 h-3.5 shrink-0" /> },
                { id: "profit", label: "Profit", icon: <DollarSign className="w-3.5 h-3.5 shrink-0" /> },
                { id: "history", label: "History", icon: <History className="w-3.5 h-3.5 shrink-0" /> },
                { id: "settings", label: "Settings", icon: <Sliders className="w-3.5 h-3.5 shrink-0" /> },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`pb-3 px-3 text-xs font-bold tracking-wider uppercase transition-all duration-150 cursor-pointer flex items-center gap-1.5 shrink-0 select-none ${
                    activeTab === tab.id
                      ? "border-b-2 border-teal-500 text-teal-400 font-black"
                      : "text-slate-400 hover:text-slate-100 border-b-2 border-transparent"
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Display active panel */}
            <div id="workspace-viewport">
              {loading && !data ? (
                <div className="py-24 text-center text-slate-400 space-y-3 font-mono">
                  <div className="w-8 h-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin mx-auto"></div>
                  <div className="text-xs">Accessing cloud storage registers...</div>
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  {activeTab === "dash" && (
                    <DashboardPanel
                      key="dash"
                      activeUser={activeUser}
                      isAuthenticated={isAuthenticated}
                      onNavigate={(tab) => setActiveTab(tab)}
                    />
                  )}
                  {activeTab === "transactions" && (
                    <TransactionPanel
                      key="transactions"
                      activeUser={activeUser}
                      isAuthenticated={isAuthenticated}
                      deviceMode="laptop"
                    />
                  )}
                  {activeTab === "collections" && (
                    <CollectPanel
                      key="collections"
                      activeUser={activeUser}
                      isAuthenticated={isAuthenticated}
                    />
                  )}
                  {activeTab === "buyers" && (
                    <BuyerPanel
                      key="buyers"
                      activeUser={activeUser}
                      isAuthenticated={isAuthenticated}
                    />
                  )}
                  {activeTab === "halkhata" && (
                    <HalkhataPanel
                      key="halkhata"
                      activeUser={activeUser}
                      isAuthenticated={isAuthenticated}
                    />
                  )}
                  {activeTab === "sources" && (
                    <SourcePanel
                      key="sources"
                      activeUser={activeUser}
                      isAuthenticated={isAuthenticated}
                    />
                  )}
                  {activeTab === "profit" && (
                    <ProfitPanel
                      key="profit"
                      activeUser={activeUser}
                      isAuthenticated={isAuthenticated}
                    />
                  )}
                  {activeTab === "history" && (
                    <HistoryPanel
                      key="history"
                      activeUser={activeUser}
                      isAuthenticated={isAuthenticated}
                    />
                  )}
                  {activeTab === "settings" && (
                    <SettingsPanel
                      key="settings"
                      activeUser={activeUser}
                      isAuthenticated={isAuthenticated}
                      onLogout={handleStationLock}
                    />
                  )}
                </AnimatePresence>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-850 text-slate-500 text-[10px] font-mono flex justify-between select-none">
            <span>● Sync: {online ? "Online Real-time" : "Cached Offline (Storage queue active)"}</span>
            <span>Vizag Market Central Hub</span>
          </div>
        </div>
      </main>
    </div>
  );

  // Let's implement the Android Specialized Terminal view
  // Designed for direct usage inside the Arat Floor on a mobile interface
  const renderAndroidWorkspace = () => (
    <div className="min-h-screen bg-slate-900 bg-radial flex flex-col items-center justify-center p-0 sm:p-6 font-sans">
      {/* Device Mode Selection Bar above Smartphone wrapper (visible only on desktop) */}
      <div className="hidden sm:flex bg-slate-950 border border-slate-850 p-1.5 rounded-2xl mb-4 gap-3 items-center shadow-lg">
        <span className="text-xs text-slate-400 font-bold uppercase pl-2 select-none">Preview Hardware:</span>
        <div className="flex bg-slate-900 p-0.5 rounded-xl border border-slate-800">
          <button
            onClick={() => setDeviceMode("laptop")}
            className="px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-white rounded-lg transition"
          >
            💻 Laptop Mode
          </button>
          <button
            onClick={() => setDeviceMode("android")}
            className="px-3 py-1.5 text-xs font-bold bg-amber-600 text-white rounded-lg shadow-md font-black"
          >
            📱 Android Mode
          </button>
        </div>
      </div>

      {/* Styled smartphone container with correct aesthetic */}
      <div className="w-full max-w-[460px] min-h-[100vh] sm:min-h-[820px] sm:max-h-[860px] sm:rounded-[40px] sm:ring-[14px] sm:ring-slate-950 sm:border-[4px] sm:border-slate-800 bg-slate-50 flex flex-col justify-between shadow-2xl relative overflow-hidden text-slate-900">
        
        {/* Smartphone top camera ear notch on desktop screens */}
        <div className="hidden sm:block absolute top-0 left-1/2 -translate-x-1/2 w-40 h-6 bg-slate-950 rounded-b-2xl z-[100] shadow-inner" />

        {/* 1. Android Top Orange Status Bar - Safe spacing from the notification panel / notch */}
        <div className="bg-[#f27429] text-white px-4 pt-8 pb-2 sm:pt-9 sm:pb-2.5 flex justify-between items-center text-[10px] font-black tracking-widest uppercase select-none z-50 shrink-0 shadow-sm font-sans animate-fadeIn">
          {queue.length > 0 ? (
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping"></span>
              <span>● SYNCING DATA TO CLOUD...</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-300"></span>
              <span>● CLOUD DECENTRALIZED SYNCED</span>
            </div>
          )}
          <span className="font-mono bg-white/20 px-2 py-0.5 rounded-full">
            {queue.length} items queued
          </span>
        </div>

        {/* 2. Mobile App Header */}
        <header className="bg-white border-b border-slate-200 px-4 py-3 flex justify-between items-center z-45 shrink-0 select-none">
          <div className="flex items-center gap-2">
            <div className="bg-sky-100 text-sky-700 p-1.5 rounded-xl">
              <Waves className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-xs font-extrabold uppercase font-sans tracking-tight text-sky-900 leading-none">
                NEW FISH CENTER
              </h2>
              {isAuthenticated && activeUser ? (
                <span className="text-[8.5px] font-bold text-emerald-600 flex items-center gap-1.5 mt-0.5 font-mono uppercase tracking-tight">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shrink-0"></span>
                  Active: {activeUser.name}
                </span>
              ) : (
                <span className="text-[8.5px] font-bold text-rose-500 flex items-center gap-1.5 mt-0.5 font-mono uppercase tracking-tight">
                  <span className="w-1.5 h-1.5 bg-rose-500 rounded-full shrink-0"></span>
                  Terminal Locked
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[9px] bg-sky-200/50 text-sky-800 font-black px-2 py-1 rounded-lg">
              {activeUser?.role?.toUpperCase() || "VISITOR"}
            </span>
            <span className="text-[9px] font-semibold text-slate-600 font-mono">
              2026-06-09
            </span>
          </div>
        </header>

        {/* 3. Horizontal Navigation Tabs */}
        <nav 
          onWheel={(e) => {
            if (e.deltaY !== 0) {
              e.currentTarget.scrollLeft += e.deltaY;
            }
          }}
          className="bg-slate-100 border-b border-slate-200 flex overflow-x-auto whitespace-nowrap custom-scrollbar py-2 px-3.5 z-40 shrink-0 select-none gap-4"
        >
          {[
            { id: "dash", label: "DASH", icon: <Activity className="w-4 h-4 mx-auto" />, badge: false },
            { id: "transactions", label: "AUCTION", icon: <ShoppingBag className="w-4 h-4 mx-auto" />, badge: false },
            { id: "collections", label: "COLLECT", icon: <Landmark className="w-4 h-4 mx-auto" />, badge: pendingReceiptsCount > 0 },
            { id: "buyers", label: "BUYERS", icon: <Users className="w-4 h-4 mx-auto" />, badge: false },
            { id: "halkhata", label: "HALKHATA", icon: <BookOpen className="w-4 h-4 mx-auto" />, badge: false },
            { id: "sources", label: "SOURCES", icon: <Anchor className="w-4 h-4 mx-auto" />, badge: false },
            { id: "profit", label: "PROFIT", icon: <DollarSign className="w-4 h-4 mx-auto" />, badge: false },
            { id: "history", label: "HISTORY", icon: <History className="w-4 h-4 mx-auto" />, badge: false },
            { id: "settings", label: "SETTINGS", icon: <Sliders className="w-4 h-4 mx-auto" />, badge: false },
          ].map((item) => {
            const isSelected = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`py-1 px-1.5 relative cursor-pointer font-sans transition-all duration-150 select-none shrink-0 min-w-[64px] ${
                  isSelected ? "text-sky-600 scale-105 font-black" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {item.icon}
                <div className="text-[8.5px] tracking-wider mt-0.5 font-bold uppercase select-none">{item.label}</div>
                {item.badge && (
                  <span className="absolute -top-0.5 right-1 bg-rose-500 text-white font-black font-mono px-1 rounded-full text-[8px] animate-bounce shadow">
                    {pendingReceiptsCount}
                  </span>
                )}
                {isSelected && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-600 rounded-full" />
                )}
              </button>
            );
          })}
        </nav>

        {/* 4. Active Module Screen Content (Scrollable Viewport) */}
        <div className={`flex-grow bg-slate-50 min-h-0 relative ${
          activeTab === "transactions" ? "overflow-hidden p-3" : "overflow-y-auto p-4 space-y-4"
        }`}>
          
          {/* Subpanel Container */}
          <div className={`text-slate-900 ${activeTab === "transactions" ? "h-full pb-0" : "pb-10 space-y-4"}`} id="android-viewport-content">
            {activeTab === "dash" && (
              <DashboardPanel
                activeUser={activeUser}
                isAuthenticated={isAuthenticated}
                onNavigate={(tab) => setActiveTab(tab)}
              />
            )}
            {activeTab === "transactions" && (
              <TransactionPanel
                activeUser={activeUser}
                isAuthenticated={isAuthenticated}
                deviceMode="android"
              />
            )}
            {activeTab === "collections" && (
              <CollectPanel
                activeUser={activeUser}
                isAuthenticated={isAuthenticated}
              />
            )}
            {activeTab === "buyers" && (
              <BuyerPanel
                activeUser={activeUser}
                isAuthenticated={isAuthenticated}
              />
            )}
            {activeTab === "halkhata" && (
              <HalkhataPanel
                activeUser={activeUser}
                isAuthenticated={isAuthenticated}
              />
            )}
            {activeTab === "sources" && (
              <SourcePanel
                activeUser={activeUser}
                isAuthenticated={isAuthenticated}
              />
            )}
            {activeTab === "profit" && (
              <ProfitPanel
                activeUser={activeUser}
                isAuthenticated={isAuthenticated}
              />
            )}
            {activeTab === "history" && (
              <HistoryPanel
                activeUser={activeUser}
                isAuthenticated={isAuthenticated}
              />
            )}
            {activeTab === "settings" && (
              <SettingsPanel
                activeUser={activeUser}
                isAuthenticated={isAuthenticated}
                onLogout={handleStationLock}
              />
            )}
          </div>
        </div>

        {/* 5. Android Bottom Safe Chin Navigation Spacer - clears lower physical phone chin */}
        <div className="flex bg-white h-8 sm:h-12 w-full border-t border-slate-200 items-center justify-center z-50 shrink-0 select-none pb-1.5 sm:pb-0">
          <div className="w-24 sm:w-32 h-1 bg-slate-300 rounded-full" />
        </div>
      </div>
    </div>
  );

  return (
    <>
      {deviceMode === "laptop" ? renderLaptopWorkspace() : renderAndroidWorkspace()}

      {/* 🚢 Cinematic Marine Startup Loader Video Simulation Overlay */}
      <AnimatePresence>
        {startupBooting && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.6, ease: "easeInOut" } }}
            className="fixed inset-0 z-[10000] bg-[#030610] flex flex-col items-center justify-center overflow-hidden select-none"
          >
            {/* Ambient Marine Glow backdrops */}
            <div className="absolute top-1/4 left-1/4 w-[350px] h-[350px] bg-cyan-700/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-indigo-800/10 blur-[130px] rounded-full pointer-events-none" />

            {/* Generated Floating Bubbles Particles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-50">
              <div className="bubble w-1.5 h-1.5 left-[15%] bottom-0" style={{ animationDelay: "0s", animationDuration: "5s" }} />
              <div className="bubble w-2 h-2 left-[30%] bottom-0" style={{ animationDelay: "1.5s", animationDuration: "6s" }} />
              <div className="bubble w-1 h-1 left-[55%] bottom-0" style={{ animationDelay: "0.5s", animationDuration: "4s" }} />
              <div className="bubble w-2.5 h-2.5 left-[75%] bottom-0" style={{ animationDelay: "2s", animationDuration: "7s" }} />
              <div className="bubble w-1.5 h-1.5 left-[88%] bottom-0" style={{ animationDelay: "1s", animationDuration: "5.5s" }} />
            </div>

            <div className="max-w-md w-full px-8 text-center space-y-8 z-10 flex flex-col items-center">
              {/* Rocking fishing boat vector container */}
              <div className="relative w-32 h-32 flex items-center justify-center animate-wave-boat">
                <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/20 to-indigo-600/20 rounded-full blur-xl scale-75 animate-pulse" />
                
                {/* SVG Boat Rocking */}
                <svg className="w-20 h-20 text-cyan-400 drop-shadow-[0_0_15px_rgba(6,182,212,0.5)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 17h20" />
                  <path d="M5 17c0-2.5 1.5-4 4-4h6c2.5 0 4 1.5 4 4" />
                  <path d="M12 13V3" />
                  <path d="M12 6h7l-7-3" />
                  <path d="M5 17h14a2 2 0 0 1 2 2H3a2 2 0 0 1 2-2Z" />
                </svg>
              </div>

              {/* Brand Title with elegant tracking */}
              <div className="space-y-2">
                <h2 className="text-2xl font-black tracking-[0.2em] text-white uppercase font-sans">
                  NEW FISH CENTER
                </h2>
                <p className="text-[10px] text-cyan-500 font-bold uppercase tracking-widest font-mono">
                  SATELLITE PORT TERMINAL • ARAT LOGISTICS
                </p>
              </div>

              {/* Progress and status indicators */}
              <div className="w-full space-y-3">
                {/* Slim neat progress bar */}
                <div className="h-1 w-full bg-slate-900 border border-slate-850 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: "0%" }}
                    animate={{ width: `${startupProgress}%` }}
                    transition={{ ease: "easeInOut", duration: 0.3 }}
                    className="h-full bg-gradient-to-r from-cyan-400 via-teal-400 to-indigo-500"
                  />
                </div>

                {/* Rotating Terminal Logs */}
                <div className="h-6 flex items-center justify-center">
                  <motion.div
                    key={startupLog}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="text-[10.5px] font-mono text-slate-400 font-medium tracking-wide flex items-center gap-1.5"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping shrink-0" />
                    <span>{startupLog}</span>
                  </motion.div>
                </div>
              </div>
            </div>

            {/* Bottom Brand Stamp */}
            <div className="absolute bottom-8 text-center text-[9px] text-slate-600 font-mono tracking-widest uppercase">
              NEW ARAT SYSTEM VERSION 4.2 • OFFLINE ASSURED
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🔔 Floating Push Style Notification Pop-up */}
      <AnimatePresence>
        {showNotificationAlert && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.95 }}
            className="fixed top-4 right-4 left-4 sm:left-auto sm:max-w-md z-[9999] bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-2xl shadow-2xl p-5 border border-amber-400 font-sans"
          >
            <div className="flex items-start gap-3">
              <div className="bg-white/20 p-2.5 rounded-xl text-white shrink-0 shadow-inner">
                <Bell className="w-5.5 h-5.5 animate-bounce" />
              </div>
              <div className="flex-grow space-y-1.5">
                <div className="text-[10px] font-black tracking-widest uppercase text-amber-205 text-amber-100 flex items-center justify-between">
                  <span>⚠️ PUSH NOTIFICATION</span>
                  <span className="bg-white/15 px-2 py-0.5 rounded-full text-[8.5px] font-mono">2026-06-09</span>
                </div>
                <h5 className="text-sm font-extrabold leading-tight text-white font-sans">
                  হিসাব সমাপ্তি বাকি আছে! (Day Ledger Open)
                </h5>
                <p className="text-[11.5px] text-white/90 font-sans leading-relaxed">
                  The wholesale Arat accounting records for <strong>2026-06-09</strong> remain unclosed and open for entries. Would you like to commit daily reports and lock the day now?
                </p>
                
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleNotificationCloseDay}
                    className="flex-grow py-2.5 px-3 bg-white text-orange-650 hover:bg-orange-50 active:scale-[0.98] transition font-black text-xs rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-1.5 text-orange-605"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>হ্যাঁ, বন্ধ করুন (Lock Day)</span>
                  </button>
                  <button
                    onClick={handleNotificationDismiss}
                    className="py-2.5 px-3 bg-transparent hover:bg-white/10 text-white transition font-bold text-xs rounded-xl cursor-pointer"
                  >
                    না, পরে (Skip)
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

const CheckCircle: React.FC = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
  </svg>
);

export default function App() {
  return (
    <DataProvider>
      <MarketDashboard />
    </DataProvider>
  );
}
