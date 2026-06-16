/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, Suspense, lazy } from "react";
import { DataProvider, useData } from "./components/DataContext";
import { User } from "./db";
import { initAuth } from "./utils/workspace";
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
  Bell,
  Download,
  AlertCircle
} from "lucide-react";
import { App as CapacitorApp } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Camera } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { triggerHaptic } from './utils/haptics';
import { motion, AnimatePresence } from "motion/react";

// Lazy load heavy components for better Android/Web scale
const NetworkSimulator = lazy(() => import("./components/NetworkSimulator").then(m => ({ default: m.NetworkSimulator })));
const UserSimulator = lazy(() => import("./components/UserSimulator").then(m => ({ default: m.UserSimulator })));
const TransactionPanel = lazy(() => import("./components/TransactionPanel").then(m => ({ default: m.TransactionPanel })));
const BuyerPanel = lazy(() => import("./components/BuyerPanel").then(m => ({ default: m.BuyerPanel })));
const SourcePanel = lazy(() => import("./components/SourcePanel").then(m => ({ default: m.SourcePanel })));
const SettingsPanel = lazy(() => import("./components/SettingsPanel").then(m => ({ default: m.SettingsPanel })));
const DashboardPanel = lazy(() => import("./components/DashboardPanel").then(m => ({ default: m.DashboardPanel })));
const CollectPanel = lazy(() => import("./components/CollectPanel").then(m => ({ default: m.CollectPanel })));
const HalkhataPanel = lazy(() => import("./components/HalkhataPanel").then(m => ({ default: m.HalkhataPanel })));
const HistoryPanel = lazy(() => import("./components/HistoryPanel").then(m => ({ default: m.HistoryPanel })));
const PinGate = lazy(() => import("./components/PinGate").then(m => ({ default: m.PinGate })));

const FallbackLoader = () => (
  <div className="flex items-center justify-center p-8 w-full h-full text-teal-500 font-mono text-xs">
    <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
  </div>
);

const MarketDashboard: React.FC = () => {
  const { data, loading, queue, online, write, activeTheme, appDate, setAppDate } = useData();
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [deviceMode, setDeviceMode] = useState<"laptop" | "android">(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth < 768 ? "android" : "laptop";
    }
    return "laptop";
  });
  const [activeTab, setActiveTab] = useState<
    | "dash"
    | "transactions"
    | "collections"
    | "buyers"
    | "halkhata"
    | "sources"
    | "history"
    | "settings"
  >("dash");
  
  // PWA Install state
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  React.useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

  // Check and process Google Workspace OAuth sign in state
  React.useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        console.log("Firebase Google OAuth authentication resolved successfully!", user.email);
      },
      () => {
        console.log("Google disconnected or sign in failed");
      }
    );
    return () => unsubscribe();
  }, []);

  const settings = data?.settings || [];
  const isDayClosed = settings.find((s) => s.key === `day_closed_${appDate}`)?.value === "true";

  // Automatically default to Android mode if window is physically mobile-sized
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.innerWidth < 768) {
        setDeviceMode("android");
      }
    }
  }, []);
  
  // Device Sync & Cloud Database states
  React.useEffect(() => {
    const initDeviceFeatures = async () => {
      if (typeof window !== "undefined" && (window as any).Capacitor?.isNativePlatform()) {
        try {
          // Request permissions one by one, ignore fails since different endpoints support different things
          try { await LocalNotifications.requestPermissions(); } catch(e){}
          try { await Camera.requestPermissions(); } catch(e){}
          try { await Filesystem.requestPermissions(); } catch(e){}
        } catch (e) {
          console.warn("Failed to request native device permissions:", e);
        }
      }
    };
    initDeviceFeatures();
  }, []);

  // Handle app state changes for notifications when Auction is Live
  React.useEffect(() => {
    let listenerPromise: Promise<any> | null = null;
    
    if (typeof window !== "undefined" && (window as any).Capacitor?.isNativePlatform()) {
      listenerPromise = CapacitorApp.addListener('appStateChange', async ({ isActive }) => {
        if (!isActive) {
          // App went to background (Home button pressed)
          const activeSessionEnded = data?.settings?.find((s) => s.key === `auction_session_ended_${appDate}`)?.value === "true";
          const _isAuthenticated = window.localStorage.getItem("nfc_active_user");
          
          if (!activeSessionEnded && _isAuthenticated) {
            // Live stats calculation
            const todayTxns = data?.transactions?.filter(t => t.date === appDate) || [];
            const activeBuyersCount = new Set(todayTxns.map(t => t.buyer_id)).size;
            const liveTotal = Math.round(todayTxns.reduce((sum, t) => sum + (t.total_price || (t.weight * t.price_per_kg) || 0), 0));
            
            // Auction is live, send "ongoing" notification to behave like Dynamic Island alert
            await LocalNotifications.schedule({
              notifications: [
                {
                  title: "Auction is Live 🔴",
                  body: `${activeBuyersCount} Active Buyers • Total: ₹${liveTotal.toLocaleString('en-IN')}`,
                  id: 1,
                  schedule: { at: new Date(Date.now() + 500) }, // Trigger quickly
                  ongoing: true, // Crucial for Dynamic Island / status bar pills
                  autoCancel: false,
                  sound: 'default',
                  smallIcon: 'ic_stat_icon_config_sample', 
                  iconColor: '#f27429',
                }
              ]
            });
          }
        } else {
          // App returned to foreground, clear notification
          await LocalNotifications.cancel({ notifications: [{ id: 1 }] });
        }
      });
    }

    return () => {
      if (listenerPromise) listenerPromise.then(l => l?.remove());
    };
  }, [data?.settings, appDate]);

  const [showExitToast, setShowExitToast] = useState(false);

  React.useEffect(() => {
    let lastBackPress = 0;
    
    const setupListener = async () => {
      if (typeof window !== "undefined" && (window as any).Capacitor?.isNativePlatform()) {
        const listener = await CapacitorApp.addListener('backButton', () => {
          setActiveTab((currentTab) => {
            if (currentTab !== 'dash') {
              return 'dash'; // Single back button moves to previous page (dashboard)
            } else {
              // We are on the Dash
              const now = Date.now();
              // If double typed (within 2 seconds)
              if (now - lastBackPress < 2000) {
                if (window.confirm("Are you sure you want to exit from this app?")) {
                   CapacitorApp.exitApp();
                }
              } else {
                lastBackPress = now;
                triggerHaptic('warning');
                setShowExitToast(true);
                setTimeout(() => setShowExitToast(false), 2000);
              }
              return 'dash';
            }
          });
        });
        return listener;
      }
      return null;
    };
    
    let listenerPromise = setupListener();
    return () => {
       listenerPromise.then(l => l?.remove());
    };
  }, []);

  const handleStationLock = () => {
    setIsAuthenticated(false);
    setActiveTab("dash");
  };

  const pendingReceiptsCount = data?.daily_collections?.filter((c) => !c.is_approved).length || 0;

  // Let's implement the Laptop Mother Hub View
  const renderLaptopWorkspace = () => (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-200 ${
      activeTheme === "light" ? "bg-zinc-50 text-zinc-900" : "bg-zinc-950 text-zinc-100"
    }`}>
      {/* Laptop Header */}
      <header className={`border-b flex flex-col sm:flex-row items-center justify-between gap-4 py-2 px-6 md:px-12 sticky top-0 z-50 shadow-sm backdrop-blur-md bg-opacity-95 transition-all duration-200 ${
        activeTheme === "light" ? "bg-zinc-50 border-zinc-200 text-zinc-900" : "bg-[#090f1d] border-[#1d2d52]/50 text-zinc-100"
      }`}>
        <div className="flex items-center space-x-3 text-center sm:text-left select-none">
          <div className={`rounded-xl px-3 py-1 border font-sans select-none ${
            activeTheme === "light"
              ? "bg-white border-zinc-200 text-zinc-800 shadow-sm"
              : "bg-[#02050e] border-[#1d2d52]/60 text-white shadow"
          }`}>
            <h1 className="text-sm font-black tracking-wider uppercase font-sans leading-none flex items-center gap-1.5">
              NEW FISH CENTER 
              <span className={`text-[8px] tracking-widest uppercase px-1.5 py-0.5 rounded-full font-mono font-bold ${
                activeTheme === "light" ? "bg-zinc-100 text-zinc-600" : "bg-zinc-800 text-teal-400 border border-teal-500/10"
              }`}>
                Laptop Hub
              </span>
            </h1>
          </div>
        </div>

        {/* Viewport switch & sync status */}
        <div className="flex items-center gap-3 flex-wrap justify-end">
          {isInstallable && (
            <button
              onClick={handleInstallClick}
              className="px-3 py-1.5 text-[11px] font-bold bg-indigo-600 text-white rounded-2xl shadow-md flex items-center gap-1.5 animate-pulse cursor-pointer hover:bg-indigo-500 transition"
            >
              <Download className="w-3.5 h-3.5" />
              Install App (Desktop/Android)
            </button>
          )}
          {/* Mode Switch Panel */}
          <div className={`flex p-1 rounded-2xl border ${
            activeTheme === "light" ? "bg-zinc-200 border-zinc-300" : "bg-zinc-900 border-zinc-800"
          }`}>
            <button
              onClick={() => setDeviceMode("laptop")}
              className={`px-3 py-1 text-[11px] font-bold rounded-2xl cursor-pointer transition flex items-center gap-1 ${
                deviceMode === "laptop"
                  ? "bg-teal-600 text-white shadow-md font-black"
                  : activeTheme === "light"
                    ? "text-zinc-700 hover:text-zinc-900"
                    : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              💻 Laptop Hub
            </button>
            <button
              onClick={() => setDeviceMode("android")}
              className={`px-3 py-1 text-[11px] font-bold rounded-2xl cursor-pointer transition flex items-center gap-1 ${
                deviceMode === "android"
                  ? "bg-amber-600 text-white shadow-md font-black"
                  : activeTheme === "light"
                    ? "text-zinc-700 hover:text-zinc-900"
                    : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              📱 Android View
            </button>
          </div>

          {!online ? (
            <span className="text-[9.5px] bg-rose-500/15 border border-rose-500/35 text-rose-500 font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow animate-pulse font-sans uppercase">
              <HardDrive className="w-3.5 h-3.5 shrink-0" /> OFFLINE - QUEUING
            </span>
          ) : queue.length > 0 ? (
            <span className="text-[9.5px] bg-amber-500/15 border border-amber-500/35 text-amber-500 font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow animate-pulse font-sans uppercase">
              <HardDrive className="w-3.5 h-3.5 shrink-0" /> {queue.length} Queued Writes
            </span>
          ) : (
            <span className="text-[9.5px] bg-emerald-500/15 border border-emerald-500/20 text-emerald-500 font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow font-sans uppercase">
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
          <Suspense fallback={<FallbackLoader />}>
            <UserSimulator
              activeUser={activeUser}
              setActiveUser={setActiveUser}
              isAuthenticated={isAuthenticated}
              setIsAuthenticated={setIsAuthenticated}
            />
            <NetworkSimulator />
          </Suspense>
        </div>

        {/* Ledger Work Area */}
        <div className={`lg:col-span-8 border rounded-2xl p-5 md:p-6 shadow-2xl shadow-black/10 space-y-6 min-h-[600px] flex flex-col justify-between transition-colors duration-200 ${
          activeTheme === "light"
            ? "bg-white border-zinc-200 text-zinc-900"
            : "bg-zinc-950 border-zinc-800 text-zinc-50"
        }`}>
          <div className="space-y-6">
            {/* Tabs */}
            <div 
              onWheel={(e) => {
                if (e.deltaY !== 0) {
                  e.currentTarget.scrollLeft += e.deltaY;
                }
              }}
              className="flex border-b border-zinc-800 custom-scrollbar overflow-x-auto gap-1"
            >
              {[
                { id: "dash", label: "Dash", icon: <Activity className="w-3.5 h-3.5 shrink-0" /> },
                { id: "transactions", label: "Auction", icon: <ShoppingBag className="w-3.5 h-3.5 shrink-0" /> },
                { id: "collections", label: "Collect", icon: <Landmark className="w-3.5 h-3.5 shrink-0" /> },
                { id: "buyers", label: "Buyers", icon: <Users className="w-3.5 h-3.5 shrink-0" /> },
                { id: "halkhata", label: "Halkhata", icon: <BookOpen className="w-3.5 h-3.5 shrink-0" /> },
                { id: "sources", label: "Sources", icon: <Anchor className="w-3.5 h-3.5 shrink-0" /> },
                { id: "history", label: "History", icon: <History className="w-3.5 h-3.5 shrink-0" /> },
                { id: "settings", label: "Settings", icon: <Sliders className="w-3.5 h-3.5 shrink-0" /> },
              ].filter(tab => {
                if (!activeUser) return false;
                if (activeUser.role === "admin") return true;
                if (activeUser.role === "auctioneer") return ["dash", "transactions", "buyers", "history", "settings"].includes(tab.id);
                if (activeUser.role === "collector") return ["dash", "collections", "buyers", "sources", "halkhata", "history", "settings"].includes(tab.id);
                return false;
              }).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`pb-3 px-3 text-xs font-bold tracking-wider uppercase transition-all duration-150 cursor-pointer flex items-center gap-1.5 shrink-0 select-none ${
                    activeTab === tab.id
                      ? "border-b-2 border-teal-500 text-teal-400 font-black"
                      : "text-zinc-400 hover:text-zinc-100 border-b-2 border-transparent"
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
                <div className="py-24 text-center text-zinc-400 space-y-3 font-mono">
                  <div className="w-8 h-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin mx-auto"></div>
                  <div className="text-xs">Accessing cloud storage registers...</div>
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  {activeTab === "dash" && (
                    <Suspense fallback={<FallbackLoader />}>
                      <DashboardPanel
                        key="dash"
                        activeUser={activeUser}
                        isAuthenticated={isAuthenticated}
                        onNavigate={(tab) => setActiveTab(tab)}
                      />
                    </Suspense>
                  )}
                  {activeTab === "transactions" && (
                    <Suspense fallback={<FallbackLoader />}>
                      <TransactionPanel
                        key="transactions"
                        activeUser={activeUser}
                        isAuthenticated={isAuthenticated}
                        deviceMode="laptop"
                      />
                    </Suspense>
                  )}
                  {activeTab === "collections" && (
                    <Suspense fallback={<FallbackLoader />}>
                      <CollectPanel
                        key="collections"
                        activeUser={activeUser}
                        isAuthenticated={isAuthenticated}
                      />
                    </Suspense>
                  )}
                  {activeTab === "buyers" && (
                    <Suspense fallback={<FallbackLoader />}>
                      <BuyerPanel
                        key="buyers"
                        activeUser={activeUser}
                        isAuthenticated={isAuthenticated}
                      />
                    </Suspense>
                  )}
                  {activeTab === "halkhata" && (
                    <Suspense fallback={<FallbackLoader />}>
                      <HalkhataPanel
                        key="halkhata"
                        activeUser={activeUser}
                        isAuthenticated={isAuthenticated}
                      />
                    </Suspense>
                  )}
                  {activeTab === "sources" && (
                    <Suspense fallback={<FallbackLoader />}>
                      <SourcePanel
                        key="sources"
                        activeUser={activeUser}
                        isAuthenticated={isAuthenticated}
                      />
                    </Suspense>
                  )}
                  {activeTab === "history" && (
                    <Suspense fallback={<FallbackLoader />}>
                      <HistoryPanel
                        key="history"
                        activeUser={activeUser}
                        isAuthenticated={isAuthenticated}
                      />
                    </Suspense>
                  )}
                  {activeTab === "settings" && (
                    <Suspense fallback={<FallbackLoader />}>
                      <SettingsPanel
                        key="settings"
                        activeUser={activeUser}
                        isAuthenticated={isAuthenticated}
                        onLogout={handleStationLock}
                      />
                    </Suspense>
                  )}
                </AnimatePresence>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-800 text-zinc-500 text-[10px] font-mono flex justify-between select-none">
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
    <div className="h-[100dvh] w-full overflow-hidden bg-zinc-900 bg-radial flex flex-col items-center justify-center p-0 sm:p-6 font-sans">
      {/* Device Mode Selection Bar above Smartphone wrapper (visible only on desktop) */}
      <div className="hidden sm:flex bg-zinc-950 border border-zinc-800 p-1.5 rounded-2xl mb-4 gap-3 items-center shadow-lg">
        {isInstallable && (
          <button
            onClick={handleInstallClick}
            className="px-3 py-1.5 text-xs font-bold bg-indigo-600 text-white rounded-2xl shadow-md font-black flex items-center gap-1.5 animate-pulse mr-2 cursor-pointer transition hover:bg-indigo-500"
          >
            <Download className="w-4 h-4" /> Install App (Mac/PC/Android)
          </button>
        )}
        <span className="text-xs text-zinc-400 font-bold uppercase pl-2 select-none">Preview Hardware:</span>
        <div className="flex bg-zinc-900 p-0.5 rounded-2xl border border-zinc-800">
          <button
            onClick={() => setDeviceMode("laptop")}
            className="px-3 py-1.5 text-xs font-bold text-zinc-400 hover:text-white rounded-2xl transition"
          >
            💻 Laptop Mode
          </button>
          <button
            onClick={() => setDeviceMode("android")}
            className="px-3 py-1.5 text-xs font-bold bg-amber-600 text-white rounded-2xl shadow-md font-black"
          >
            📱 Android Mode
          </button>
        </div>
      </div>

      {/* Styled smartphone container with correct aesthetic */}
      <div className={`w-full max-w-[460px] h-[100dvh] sm:h-[820px] sm:min-h-0 sm:max-h-[860px] sm:rounded-[40px] sm:ring-[14px] sm:ring-slate-950 sm:border-[4px] sm:border-zinc-800 flex flex-col justify-between shadow-2xl relative overflow-hidden print:max-w-none print:h-auto print:max-h-none print:min-h-0 print:ring-0 print:border-none print:rounded-none print:shadow-none print:overflow-visible transition-colors duration-200 ${
        activeTheme === "light" ? "bg-white text-zinc-900" : "bg-zinc-950 text-zinc-50"
      }`}>
        
        {/* Smartphone top camera ear notch on desktop screens */}
        <div className="hidden sm:block absolute top-0 left-1/2 -translate-x-1/2 w-40 h-6 bg-zinc-950 rounded-b-2xl z-[100] shadow-inner print:hidden" />

        {/* 1. Android Top Orange Status Bar - Safe spacing from the notification panel / notch */}
        <div className={`text-white px-4 py-1 flex justify-between items-center text-[10px] font-black tracking-widest uppercase select-none z-50 shrink-0 shadow-sm font-sans animate-fadeIn print:hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] transition-colors ${!online ? "bg-rose-600" : queue.length > 0 ? "bg-amber-600" : "bg-[#f27429]"}`}>
          {!online ? (
            <div className="flex items-center gap-1.5 animate-pulse">
              <span className="w-2.5 h-2.5 rounded-full bg-white opacity-80"></span>
              <span>● OFFLINE - QUEUING</span>
            </div>
          ) : queue.length > 0 ? (
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping"></span>
              <span>● SYNCING DATA...</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-300"></span>
              <span>● CLOUD SYNCED</span>
            </div>
          )}
          <span className="font-mono bg-white/20 px-2 py-0.5 rounded-full">
            {queue.length} queued
          </span>
        </div>

        {/* 2. Mobile App Header */}
        <header className={`border-b px-3.5 py-1.5 flex justify-between items-center z-45 shrink-0 select-none transition-colors duration-150 ${
          activeTheme === "light" 
            ? "bg-[#fafafa] border-zinc-200" 
            : "bg-[#090f1d] border-[#1d2d52]/50"
        }`}>
          {/* New Fish Center in a beautiful small panel */}
          <div className={`rounded-xl px-2.5 py-1 shadow-sm border font-sans select-none ${
            activeTheme === "light"
              ? "bg-white border-zinc-200 text-zinc-800"
              : "bg-[#02050e] border-[#1d2d52]/60 text-white"
          }`}>
            <h2 className="text-[10px] font-black uppercase tracking-wider font-sans leading-none">
              NEW FISH CENTER
            </h2>
          </div>

          {/* Right side group with role type, user name, and date section */}
          <div className="flex items-center gap-2.5">
            {/* Account role and username container */}
            <div className="text-right flex flex-col justify-center">
              <span className={`text-[8px] font-black uppercase tracking-wider leading-none inline-block px-1.5 py-0.5 rounded-full select-none ${
                isAuthenticated && activeUser
                  ? activeUser.role === "admin"
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : activeUser.role === "collector"
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    : "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                  : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
              }`}>
                {isAuthenticated && activeUser 
                  ? activeUser.role.toUpperCase() 
                  : "LOCKED"}
              </span>
              <span className={`text-[9px] font-bold mt-0.5 font-sans leading-none select-none tracking-tight ${
                activeTheme === "light" ? "text-zinc-600" : "text-zinc-300"
              }`}>
                {isAuthenticated && activeUser ? activeUser.name : "System Gate"}
              </span>
            </div>

            {/* Selectable Date Picker Panel */}
            <div className={`flex items-center pl-2.5 border-l ${
              activeTheme === "light" ? "border-zinc-200" : "border-zinc-800"
            }`}>
              <input 
                type="date"
                value={appDate}
                onChange={(e) => setAppDate(e.target.value)}
                className={`text-[9.5px] font-bold font-mono bg-transparent outline-none cursor-pointer focus:ring-0 ${
                  activeTheme === "light" ? "text-zinc-700 hover:text-zinc-900" : "text-[#f27429] hover:text-[#ff8a43]"
                }`}
              />
            </div>
          </div>
        </header>

        {/* 3. Horizontal Navigation Tabs */}
        <nav 
          onWheel={(e) => {
            if (e.deltaY !== 0) {
              e.currentTarget.scrollLeft += e.deltaY;
            }
          }}
          className="bg-zinc-100 border-b border-zinc-200 flex overflow-x-auto whitespace-nowrap custom-scrollbar py-2 px-3.5 z-40 shrink-0 select-none gap-4"
        >
          {[
            { id: "dash", label: "DASH", icon: <Activity className="w-4 h-4 mx-auto" />, badge: false },
            { id: "transactions", label: "AUCTION", icon: <ShoppingBag className="w-4 h-4 mx-auto" />, badge: false },
            { id: "collections", label: "COLLECT", icon: <Landmark className="w-4 h-4 mx-auto" />, badge: pendingReceiptsCount > 0 },
            { id: "buyers", label: "BUYERS", icon: <Users className="w-4 h-4 mx-auto" />, badge: false },
            { id: "halkhata", label: "HALKHATA", icon: <BookOpen className="w-4 h-4 mx-auto" />, badge: false },
            { id: "sources", label: "SOURCES", icon: <Anchor className="w-4 h-4 mx-auto" />, badge: false },
            { id: "history", label: "HISTORY", icon: <History className="w-4 h-4 mx-auto" />, badge: false },
            { id: "settings", label: "SETTINGS", icon: <Sliders className="w-4 h-4 mx-auto" />, badge: false },
          ].filter(item => {
            if (!activeUser) return false;
            if (activeUser.role === "admin") return true;
            if (activeUser.role === "auctioneer") return ["dash", "transactions", "buyers", "history", "settings"].includes(item.id);
            if (activeUser.role === "collector") return ["dash", "collections", "buyers", "sources", "halkhata", "history", "settings"].includes(item.id);
            return false;
          }).map((item) => {
            const isSelected = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`py-1 px-1.5 relative cursor-pointer font-sans transition-all duration-150 select-none shrink-0 min-w-[64px] ${
                  isSelected ? "text-sky-600 scale-105 font-black" : "text-zinc-500 hover:text-zinc-700"
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
        {/* Subpanel Container */}
        <div className={`flex-grow bg-zinc-50 min-h-0 relative print:h-auto print:min-h-0 print:overflow-visible ${
          activeTab === "transactions" ? "overflow-hidden p-3" : "overflow-y-auto p-4 space-y-4"
        }`}>
          
          {/* Subpanel Container */}
          <div className={`text-zinc-900 print:h-auto print:overflow-visible print:p-0 ${activeTab === "transactions" ? "h-full pb-0" : "pb-10 space-y-4"}`} id="android-viewport-content">
            <Suspense fallback={<FallbackLoader />}>
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
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
    <Suspense fallback={<FallbackLoader />}>
      <PinGate 
        activeUser={activeUser}
        setActiveUser={setActiveUser}
        isAuthenticated={isAuthenticated}
        setIsAuthenticated={setIsAuthenticated}
      />
    </Suspense>
      
      <AnimatePresence>
        {showExitToast && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 50 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[9999] bg-zinc-900/95 text-white px-5 py-2.5 rounded-full shadow-2xl text-xs font-bold font-sans flex items-center gap-2 backdrop-blur-md border border-zinc-700 pointer-events-none whitespace-nowrap"
          >
            <AlertCircle className="w-4 h-4 text-amber-500" />
            Press back again to exit
          </motion.div>
        )}
      </AnimatePresence>

      {deviceMode === "laptop" ? renderLaptopWorkspace() : renderAndroidWorkspace()}
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
