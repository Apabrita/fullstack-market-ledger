/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { useData } from "./DataContext";
import { PlusCircle, Search, User, CreditCard, ChevronRight, Check, X, ShieldAlert, CheckSquare, RefreshCcw, DollarSign, Award } from "lucide-react";
import { User as DbUser } from "../db";

interface BuyerPanelProps {
  activeUser: DbUser | null;
  isAuthenticated: boolean;
}

export const BuyerPanel: React.FC<BuyerPanelProps> = ({ activeUser, isAuthenticated }) => {
  const { data, write, appDate } = useData();
  const [showAddBuyerForm, setShowAddBuyerForm] = useState(false);
  const [showCollectionForm, setShowCollectionForm] = useState(false);

  // New Buyer Form States
  const [buyerNickname, setBuyerNickname] = useState("");
  const [creditLimit, setCreditLimit] = useState("");

  // Selected Buyer details and edit state
  const [selectedBuyerId, setSelectedBuyerId] = useState<string | number | null>(null);
  const [editNickname, setEditNickname] = useState("");
  const [editMobile, setEditMobile] = useState("");
  const [editCreditLimit, setEditCreditLimit] = useState("");

  // Daily Collection Form States
  const [collectBuyerId, setCollectBuyerId] = useState("");
  const [collectAmount, setCollectAmount] = useState("");
  const [collectDate, setCollectDate] = useState(appDate);

  // Sync collectDate with appDate when appDate changes
  React.useEffect(() => {
    setCollectDate(appDate);
  }, [appDate]);

  // Search/Filters
  const [searchQuery, setSearchQuery] = useState("");

  const buyers = data?.buyers || [];
  const dailyCollections = data?.daily_collections || [];

  const handleAddBuyer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buyerNickname || !creditLimit) return;

    const limitNum = parseFloat(creditLimit);
    const newBuyer = {
      id: `temp_b_${Date.now()}`,
      nickname: buyerNickname,
      lifetime_debt: 0,
      credit_limit: limitNum,
    };

    await write("buyers", "insert", newBuyer);

    setBuyerNickname("");
    setCreditLimit("");
    setShowAddBuyerForm(false);
  };

  const handleAddCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectBuyerId || !collectAmount) return;

    const amountNum = parseFloat(collectAmount);
    
    // Find outstanding transactions total to calculate owed total (or default to current debt)
    const selectedBuyer = buyers.find((b) => String(b.id) === String(collectBuyerId));
    if (!selectedBuyer) return;

    // Check if there is already a collection entry for this buyer on this date
    const existing = dailyCollections.find(
      (c) => String(c.buyer_id) === String(collectBuyerId) && c.date === collectDate
    );

    if (existing) {
      const updatedCollection = {
        ...existing,
        amount_paid: (existing.amount_paid || 0) + amountNum,
      };
      await write("daily_collections", "update", updatedCollection);
    } else {
      const newCollection = {
        id: `temp_col_${Date.now()}`,
        buyer_id: collectBuyerId,
        date: collectDate,
        total_owed_today: selectedBuyer.lifetime_debt,
        amount_paid: amountNum,
        is_rolled_over: false,
        is_approved: false, // Default is false, requires admin review
      };
      await write("daily_collections", "insert", newCollection);
    }

    setCollectBuyerId("");
    setCollectAmount("");
    setShowCollectionForm(false);
  };

  const handleApproveCollection = async (colId: string | number) => {
    if (!activeUser || isAuthenticated !== true || activeUser.role !== "admin") {
      alert("Only authenticated Administrators can approve daily payment receipts!");
      return;
    }

    const col = dailyCollections.find((c) => String(c.id) === String(colId));
    if (!col) return;

    // 1. Get associated buyer
    const buyer = buyers.find((b) => String(b.id) === String(col.buyer_id));
    if (buyer) {
      // 2. Reduce the buyer's outstanding lifetime debt
      const updatedBuyer = {
        ...buyer,
        lifetime_debt: Math.max(0, (buyer.lifetime_debt || 0) - (col.amount_paid || 0)),
      };
      await write("buyers", "update", updatedBuyer);
    }

    // 3. Mark the collection as approved
    const updatedCollection = {
      ...col,
      is_approved: true,
    };
    await write("daily_collections", "update", updatedCollection);
  };

  const handleRolloverCollection = async (colId: string | number) => {
    const col = dailyCollections.find((c) => c.id === colId);
    if (!col) return;

    // Mark as rolled over to next ledger session
    const updatedCollection = {
      ...col,
      is_rolled_over: !col.is_rolled_over,
    };
    await write("daily_collections", "update", updatedCollection);
  };

  const handleSelectBuyer = (b: any) => {
    setSelectedBuyerId(b.id === selectedBuyerId ? null : b.id);
    setEditNickname(b.nickname || "");
    setEditMobile(b.mobile || "");
    setEditCreditLimit(String(b.credit_limit || 100000));
  };

  const handleSaveBuyerDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBuyerId) return;
    const b = buyers.find((x) => x.id === selectedBuyerId);
    if (!b) return;

    const updated = {
      ...b,
      nickname: editNickname.trim(),
      mobile: editMobile.trim(),
      credit_limit: parseFloat(editCreditLimit) || 100000,
    };

    await write("buyers", "update", updated);
    alert("Buyer profile context saved successfully!");
  };

  // Filter, determine 'today' buyers, and sort
  const todayBuyerIds = new Set((data?.transactions || []).filter(t => t.date === appDate).map(t => String(t.buyer_id)));

  const filteredBuyers = buyers.filter((b) =>
    b.nickname.toLowerCase().includes(searchQuery.toLowerCase())
  ).sort((a, b) => {
    const aToday = todayBuyerIds.has(String(a.id));
    const bToday = todayBuyerIds.has(String(b.id));
    if (aToday && !bToday) return -1;
    if (!aToday && bToday) return 1;
    return a.nickname.localeCompare(b.nickname);
  });

  const scrollToLetter = (letter: string) => {
    const el = document.getElementById(`buyerlist-letter-${letter}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Derive active selected buyer variables
  const selectedBuyer = buyers.find(x => String(x.id) === String(selectedBuyerId));
  const buyerTxns = selectedBuyer 
    ? (data?.transactions || []).filter(t => String(t.buyer_id) === String(selectedBuyer.id))
    : [];
  const buyerCollections = selectedBuyer
    ? (data?.daily_collections || []).filter(c => String(c.buyer_id) === String(selectedBuyer.id))
    : [];

  const totalBoughtWeight = buyerTxns.reduce((sum, t) => sum + (t.weight || 0), 0);
  const totalBoughtValue = buyerTxns.reduce((sum, t) => sum + (t.total_price || t.weight * t.price_per_kg || 0), 0);
  const totalPaidApproved = buyerCollections
    .filter(c => c.is_approved)
    .reduce((sum, c) => sum + (c.amount_paid || 0), 0);

  const todayBoughtValue = buyerTxns.filter(t => t.date === appDate).reduce((sum, t) => sum + (t.total_price || t.weight * t.price_per_kg || 0), 0);
  const todayPaidApproved = buyerCollections.filter(c => c.date === appDate && c.is_approved).reduce((sum, c) => sum + (c.amount_paid || 0), 0);
  const todayOwed = Math.max(0, todayBoughtValue - todayPaidApproved);

  const isAdmin = activeUser?.role === "admin" && isAuthenticated;
  const isAuthorizedToCollect = isAuthenticated && (activeUser?.role === "admin" || activeUser?.role === "collector");

  return (
    <div className="space-y-6" id="buyers-collections-panel">
      {/* Dynamic stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white border border-zinc-200 p-5 rounded-2xl flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-teal-50 text-teal-600 rounded-2xl">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-zinc-500 font-medium font-sans">Total Outstanding Buyer Debts</div>
              <div className="text-lg font-bold font-mono text-zinc-800">
                ₹ {buyers.reduce((sum, b) => sum + (b.lifetime_debt || 0), 0).toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-zinc-200 p-5 rounded-2xl flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-zinc-500 font-medium font-sans">Pending Approvals</div>
              <div className="text-lg font-bold font-mono text-amber-700">
                {dailyCollections.filter((c) => !c.is_approved).length} Receipts
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Buyer actions block */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-zinc-50 border border-zinc-200 p-4 rounded-2xl">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search buyers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-2 w-full text-xs text-zinc-700 bg-white border border-zinc-200 rounded-2xl focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          {/* Collect Payment Button */}
          <button
            onClick={() => {
              if (!isAuthorizedToCollect) {
                alert("Your operator role does not have authorization to collection receipts! Swapping to Admin or Collector is required.");
                return;
              }
              setShowCollectionForm(!showCollectionForm);
              setShowAddBuyerForm(false);
            }}
            className={`flex-grow sm:flex-grow-0 px-4 py-2 text-xs font-semibold rounded-2xl shadow-sm flex items-center justify-center gap-1.5 transition duration-200 cursor-pointer ${
              isAuthorizedToCollect
                ? "bg-amber-600 hover:bg-amber-700 text-white"
                : "bg-zinc-200 text-zinc-400 border border-zinc-300 cursor-not-allowed"
            }`}
            id="btn-log-collection"
          >
            <PlusCircle className="w-4 h-4" />
            Log Client Collection
          </button>

          {/* Add Buyer Button */}
          <button
            onClick={() => {
              if (!isAdmin) {
                alert("Only authenticated Administrators can add system buyers!");
                return;
              }
              setShowAddBuyerForm(!showAddBuyerForm);
              setShowCollectionForm(false);
            }}
            className={`flex-grow sm:flex-grow-0 px-4 py-2 text-xs font-semibold rounded-2xl shadow-sm flex items-center justify-center gap-1.5 transition duration-200 cursor-pointer ${
              isAdmin
                ? "bg-teal-600 hover:bg-teal-700 text-white"
                : "bg-zinc-200 text-zinc-400 border border-zinc-300 cursor-not-allowed"
            }`}
            id="btn-add-buyer"
          >
            <PlusCircle className="w-4 h-4" />
            Add Buyer
          </button>
        </div>
      </div>

      {/* Forms Drawer: Add Buyer */}
      {showAddBuyerForm && (
        <form onSubmit={handleAddBuyer} className="bg-zinc-50 border border-zinc-200 p-5 rounded-2xl space-y-4 animate-slideDown shadow-inner">
          <div className="flex items-center gap-2 pb-2 border-b border-zinc-200">
            <PlusCircle className="w-4 h-4 text-teal-655" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-700 font-sans">
              Register New Wholesale buyer (Arat Client)
            </h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-sans font-bold text-zinc-600 block">
                Buyer Nickname <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={buyerNickname}
                onChange={(e) => setBuyerNickname(e.target.value)}
                placeholder="e.g. Moni Fish Co."
                required
                className="w-full text-xs text-zinc-700 bg-white border border-zinc-300 rounded-2xl p-2.5 outline-none focus:ring-1 focus:ring-teal-500"
                id="form-buyer-name"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-sans font-bold text-zinc-600 block">
                Allowed Credit Limit (INR) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={creditLimit}
                onChange={(e) => setCreditLimit(e.target.value)}
                placeholder="e.g. 150000"
                required
                className="w-full text-xs text-zinc-700 bg-white border border-zinc-300 rounded-2xl p-2.5 outline-none focus:ring-1 focus:ring-teal-500"
                id="form-buyer-credit"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-200">
            <button
              type="button"
              onClick={() => setShowAddBuyerForm(false)}
              className="px-4 py-2 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 text-xs font-semibold rounded-2xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-2xl shadow cursor-pointer"
              id="btn-save-buyer"
            >
              Create Buyer
            </button>
          </div>
        </form>
      )}

      {/* Forms Drawer: Log Daily Collection Payment */}
      {showCollectionForm && (
        <form onSubmit={handleAddCollection} className="bg-zinc-50 border border-zinc-200 p-5 rounded-2xl space-y-4 animate-slideDown shadow-inner">
          <div className="flex items-center gap-2 pb-2 border-b border-zinc-200">
            <PlusCircle className="w-4 h-4 text-amber-600" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-700 font-sans">
              Log Daily Cash Payment Received (Halkhata Draft)
            </h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-sans font-bold text-zinc-600 block">
                Select Arat Buyer <span className="text-red-500">*</span>
              </label>
              <select
                value={collectBuyerId}
                onChange={(e) => setCollectBuyerId(e.target.value)}
                required
                className="w-full text-xs text-zinc-700 bg-white border border-zinc-300 rounded-2xl p-2.5 outline-none focus:ring-1 focus:ring-amber-500"
                id="form-collect-buyer-select"
              >
                <option value="">-- CHOOSE BUYER --</option>
                {buyers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nickname} (Outstanding: ₹{b.lifetime_debt.toLocaleString()})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-sans font-bold text-zinc-600 block">
                Amount Collected (INR) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={collectAmount}
                onChange={(e) => setCollectAmount(e.target.value)}
                placeholder="e.g. 25000"
                required
                className="w-full text-xs text-zinc-700 bg-white border border-zinc-300 rounded-2xl p-2.5 outline-none focus:ring-1 focus:ring-amber-500"
                id="form-collect-amount"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-sans font-bold text-zinc-600 block">
                Collection Session Date
              </label>
              <input
                type="date"
                value={collectDate}
                onChange={(e) => setCollectDate(e.target.value)}
                className="w-full text-xs text-zinc-700 bg-white border border-zinc-300 rounded-2xl p-2.5 outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-200">
            <button
              type="button"
              onClick={() => setShowCollectionForm(false)}
              className="px-4 py-2 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 text-xs font-semibold rounded-2xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-2xl shadow cursor-pointer"
              id="btn-save-collection"
            >
              Log Collection & Review
            </button>
          </div>
        </form>
      )}

      {/* Main Content stacked */}
      <div className="flex flex-col gap-6 w-full">
        {/* Buyer List Panel - Full width */}
        <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm flex flex-col w-full">
          <div className="px-5 py-4 bg-zinc-50 border-b border-zinc-200">
            <h4 className="font-sans font-bold text-xs uppercase tracking-wider text-zinc-700">
              Arat Buyers Accounts
            </h4>
          </div>
          <div className="divide-y divide-zinc-100 flex-grow max-h-[500px] overflow-y-auto relative pr-6 custom-scrollbar">
            {filteredBuyers.length === 0 ? (
              <div className="p-8 text-center text-zinc-400 text-xs">
                No buyers found.
              </div>
            ) : (
              filteredBuyers.map((b, index, arr) => {
                const percentage = Math.min(100, Math.round(((b.lifetime_debt || 0) / (b.credit_limit || 1)) * 100));
                const limitWarning = percentage > 85;
                const isSelected = b.id === selectedBuyerId;
                const isToday = todayBuyerIds.has(String(b.id));
                const isFirstOfInitial = index === 0 || b.nickname[0].toUpperCase() !== arr[index - 1].nickname[0].toUpperCase();

                return (
                  <React.Fragment key={b.id}>
                    {isFirstOfInitial && !isToday && (
                       <div id={`buyerlist-letter-${b.nickname[0].toUpperCase()}`} className="px-5 py-1 text-zinc-500 font-bold text-[10px] bg-zinc-50 border-b border-zinc-200">
                         {b.nickname[0].toUpperCase()}
                       </div>
                    )}
                  <div
                    onClick={() => handleSelectBuyer(b)}
                    className={`p-4 transition duration-150 space-y-2 cursor-pointer border-l-4 ${
                      isSelected
                        ? "bg-teal-50/40 border-teal-600 font-semibold"
                        : isToday ? "bg-teal-900/5 hover:bg-teal-900/10 border-l-transparent" : "hover:bg-zinc-50 border-l-transparent"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center font-bold text-xs">
                          {b.nickname.charAt(0)}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-zinc-800 flex items-center gap-2">
                            {b.nickname}
                            {isToday && <span className="bg-teal-500 text-teal-950 text-[8px] px-1.5 font-bold rounded-sm uppercase tracking-wider">Today</span>}
                          </div>
                          <div className="text-[10px] text-zinc-500 font-mono">ID: {String(b.id).substring(0, 8)}</div>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-zinc-800 font-mono">
                        ₹ {b.lifetime_debt.toLocaleString()}
                      </span>
                    </div>

                    {/* Credit Gauge bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[9px] text-zinc-500 uppercase tracking-wider font-semibold">
                        <span>Debt Ratio: {percentage}%</span>
                        <span>Limit: ₹{b.credit_limit.toLocaleString()}</span>
                      </div>
                      <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${percentage}%` }}
                          className={`h-full rounded-full transition-all duration-300 ${
                            limitWarning ? "bg-rose-500 font-bold" : "bg-teal-500"
                          }`}
                        ></div>
                      </div>
                      {limitWarning && (
                        <div className="text-[9px] text-rose-500 font-semibold flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3 text-rose-500 shrink-0" />
                          <span>Close to credit ceiling limit! Lock sales.</span>
                        </div>
                      )}
                    </div>
                  </div>
                  </React.Fragment>
                );
              })
            )}

            {/* A-Z fast scroller */}
            {filteredBuyers.length > 0 && (
              <div className="absolute right-1 top-0 bottom-0 flex flex-col justify-center text-[9px] font-bold text-zinc-400 gap-0.5 z-10 p-1 bg-white/50 backdrop-blur-sm">
                {Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ").map(letter => (
                  <div 
                    key={letter} 
                    onClick={(e) => { e.stopPropagation(); scrollToLetter(letter); }}
                    className="cursor-pointer hover:text-teal-600 hover:scale-125 transition-transform text-center"
                  >
                    {letter}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Conditional stacked detail view vs selected buyer ledger */}
        {selectedBuyerId && selectedBuyer ? (
          <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm flex flex-col animate-scaleUp w-full">
            {/* Dossier Header */}
            <div className="px-5 py-4 bg-zinc-50 border-b border-zinc-200 flex justify-between items-center select-none">
              <div>
                <h4 className="font-sans font-bold text-xs uppercase tracking-wider text-zinc-700">
                  Client Profile: {selectedBuyer.nickname}
                </h4>
                <p className="text-[10px] text-zinc-400 font-mono">Member ID: {selectedBuyer.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBuyerId(null)}
                className="px-3 py-1.5 text-[10.5px] uppercase font-bold bg-zinc-200 hover:bg-zinc-300 text-zinc-700 rounded-2xl transition shrink-0 select-none cursor-pointer flex items-center gap-1"
              >
                ← Back to ledger
              </button>
            </div>

            <div className="p-5 space-y-6 overflow-y-auto max-h-[600px] custom-scrollbar">
              {/* Profile Fields form for Admin info */}
              <form onSubmit={handleSaveBuyerDetails} className="bg-zinc-50 border border-zinc-200 p-4.5 rounded-2xl space-y-4">
                <div className="border-b border-zinc-200 pb-2 flex justify-between items-center select-none">
                  <h5 className="text-[11px] font-extrabold uppercase tracking-widest text-teal-800 flex items-center gap-1">
                    <User className="w-3.5 h-3.5" /> Buyer Information (অতিরিক্ত তথ্য)
                  </h5>
                  <span className="text-[9px] font-mono text-zinc-400 bg-zinc-100 px-1 py-0.2 rounded border font-sans">Admin Config</span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-sans font-bold text-zinc-600 block select-none">
                      Buyer Name (ক্রেতার নাম)
                    </label>
                    <input
                      type="text"
                      value={editNickname}
                      onChange={(e) => setEditNickname(e.target.value)}
                      placeholder="e.g. Haji Mohammad Ali"
                      className="w-full text-xs text-zinc-700 bg-white border border-zinc-300 rounded-2xl p-2 outline-none focus:ring-1 focus:ring-teal-500 font-sans"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-sans font-bold text-zinc-600 block select-none">
                      Mobile Number (মোবাইল নম্বর)
                    </label>
                    <input
                      type="text"
                      value={editMobile}
                      onChange={(e) => setEditMobile(e.target.value)}
                      placeholder="e.g. +880 1888-999000"
                      className="w-full text-xs text-zinc-700 bg-white border border-zinc-300 rounded-2xl p-2 outline-none focus:ring-1 focus:ring-teal-500 font-sans"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end pt-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-sans font-bold text-zinc-600 block select-none">
                      Credit Ceiling Limit (ঋণ সীমা)
                    </label>
                    <input
                      type="number"
                      value={editCreditLimit}
                      onChange={(e) => setEditCreditLimit(e.target.value)}
                      className="w-full text-xs font-mono text-zinc-700 bg-white border border-zinc-300 rounded-2xl p-2 outline-none focus:ring-1 focus:ring-teal-500 font-sans"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl text-xs font-semibold cursor-pointer shadow-sm transition h-9.5 text-center flex items-center justify-center gap-1 select-none"
                  >
                    Save Changes
                  </button>
                </div>
              </form>

              {/* Statistics Grid */}
              <div className="grid grid-cols-2 gap-3 select-none">
                <div className="bg-rose-50/10 border border-rose-150 p-3 rounded-2xl flex flex-col justify-between">
                  <span className="text-[9px] text-rose-500 block font-semibold uppercase tracking-wider font-sans">Owe Us For Today</span>
                  <span className="text-sm font-bold font-mono text-rose-600 block mt-1">
                    ₹{Math.round(todayOwed).toLocaleString()}
                  </span>
                </div>
                <div className="bg-rose-50/10 border border-rose-150 p-3 rounded-2xl flex flex-col justify-between">
                  <span className="text-[9px] text-rose-500 block font-semibold uppercase tracking-wider font-sans">Outstanding Debt (Ledger)</span>
                  <span className="text-sm font-bold font-mono text-rose-600 block mt-1">
                    ₹{Math.round(selectedBuyer.lifetime_debt || 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Purchase History */}
              <div className="space-y-2">
                <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-700 border-b border-zinc-150 pb-1.5 flex justify-between items-center font-sans select-none">
                  <span>Recent Auction Records</span>
                  <span className="text-[9px] text-zinc-400 font-normal select-none">Total {buyerTxns.length} entries</span>
                </h5>
                <div className="max-h-[160px] overflow-y-auto border border-zinc-200 rounded-2xl divide-y divide-zinc-100 custom-scrollbar">
                  {buyerTxns.length === 0 ? (
                    <div className="p-6 text-center text-zinc-400 text-xs py-8 select-none">No fish purchased in recent auctions.</div>
                  ) : (
                    [...buyerTxns].reverse().map((t) => (
                      <div key={t.id} className="p-2.5 px-3 flex justify-between items-center text-xs font-sans hover:bg-zinc-50/50">
                        <div>
                          <div className="font-bold text-zinc-800 font-sans">{t.fish_type}</div>
                          <div className="text-[9.5px] text-zinc-500 font-mono">Date: {t.date}</div>
                        </div>
                        <div className="text-right font-mono">
                          <div className="font-mono font-bold text-zinc-800">₹{t.total_price.toLocaleString()}</div>
                          <div className="text-[9.5px] text-zinc-500 font-mono">{t.weight} kg @ ₹{t.price_per_kg}/kg</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Collections History HIDDEN AS REQUESTED */}
              {/*
              <div className="space-y-2">
                <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-700 border-b border-zinc-150 pb-1.5 flex justify-between items-center font-sans select-none">
                  <span>Receipts & Daily Collections Log</span>
                  <span className="text-[9px] text-zinc-400 font-normal select-none font-sans font-sans">Total {buyerCollections.length} pays</span>
                </h5>
                <div className="max-h-[160px] overflow-y-auto border border-zinc-200 rounded-2xl divide-y divide-zinc-100 custom-scrollbar font-sans">
                  {buyerCollections.length === 0 ? (
                    <div className="p-6 text-center text-zinc-400 text-xs py-8 font-sans select-none">No collections registered for this buyer.</div>
                  ) : (
                    [...buyerCollections].reverse().map((col) => (
                      <div key={col.id} className="p-2.5 px-3 flex justify-between items-center text-xs hover:bg-zinc-50/50 font-sans">
                        <div>
                          <span className="text-[9.5px] text-zinc-400 font-mono block select-none">{col.date}</span>
                          <span className={`text-[10px] font-bold block ${col.is_approved ? "text-teal-600" : col.is_rolled_over ? "text-amber-500" : "text-zinc-500"}`}>
                            {col.is_approved ? "✅ Approved by Admin" : col.is_rolled_over ? "🔁 Rolled Over in Session" : "⏳ Pending review"}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold font-mono text-zinc-800 text-emerald-800">₹{col.amount_paid.toLocaleString()}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              */}

            </div>
          </div>
        ) : (
          /* Collections Ledger - Full width stack aspect */
          <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm flex flex-col w-full">
            <div className="px-5 py-4 bg-zinc-50 border-b border-zinc-200 flex justify-between items-center">
              <h4 className="font-sans font-bold text-xs uppercase tracking-wider text-zinc-700">
                Daily collections Ledger (Halkhata Receipts)
              </h4>
              <span className="text-[10px] bg-amber-500/10 text-amber-700 border border-amber-500/20 px-2 py-0.5 rounded-full font-medium">
                Collector Active
              </span>
            </div>

            <div className="divide-y divide-zinc-100 flex-grow max-h-[500px] overflow-y-auto">
              {dailyCollections.length === 0 ? (
                <div className="p-12 text-center text-zinc-400 text-xs">
                  No collections logged. Write a collection payment above to review ledger entries.
                </div>
              ) : (
                dailyCollections.map((col) => {
                  const buyer = buyers.find((b) => String(b.id) === String(col.buyer_id));
                  const isTemp = String(col.id).startsWith("temp_");

                  return (
                    <div key={col.id} className={`p-4 transition duration-150 border-l-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 ${
                      col.is_approved 
                        ? "border-emerald-500 bg-emerald-50/5" 
                        : col.is_rolled_over 
                        ? "border-amber-500 bg-amber-50/5" 
                        : "border-zinc-300 bg-white"
                    }`}>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-zinc-800">
                            {buyer ? buyer.nickname : `Buyer (#${col.buyer_id})`}
                          </span>
                          <span className="text-[10px] text-zinc-400 font-mono">
                            {col.date}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 text-[11px] font-mono text-zinc-600">
                          <div>Owed today: ₹{col.total_owed_today.toLocaleString()}</div>
                          <div className="font-bold text-teal-800">Paid: ₹{(col.amount_paid || 0).toLocaleString()}</div>
                        </div>
                        {isTemp && (
                          <span className="text-[8px] bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.2 rounded font-sans uppercase font-bold tracking-wider">
                            Pending Sync
                          </span>
                        )}
                      </div>

                      {/* Action controls based on Operator Permissions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Rollover Toggle */}
                        <button
                          onClick={() => handleRolloverCollection(col.id)}
                          className={`p-2.5 rounded-2xl border text-xs font-semibold flex items-center gap-1 cursor-pointer transition ${
                            col.is_rolled_over
                              ? "bg-amber-950/15 border-amber-900/30 text-amber-700"
                              : "bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100"
                          }`}
                          title="Toggle Rollover (Transfer outstanding to next segment)"
                        >
                          <RefreshCcw className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">
                            {col.is_rolled_over ? "Rolled Over" : "Rollover"}
                          </span>
                        </button>

                        {/* Admin Approve badge or Action */}
                        {col.is_approved ? (
                          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl px-3 py-1.5 text-xs font-bold flex items-center gap-1">
                            <Check className="w-4 h-4 text-emerald-600" />
                            <span>Approved</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleApproveCollection(col.id)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-2xl cursor-pointer flex items-center gap-1 shadow-sm transition border ${
                              isAdmin
                                ? "bg-emerald-600 border-emerald-700 text-white hover:bg-emerald-700"
                                : "bg-zinc-50 border-zinc-200 text-zinc-405 hover:bg-zinc-100 cursor-help"
                            }`}
                            title={isAdmin ? "Approve & update buyers credit totals" : "Approved status requires Admin Operator authentication."}
                          >
                            <CheckSquare className="w-3.5 h-3.5" />
                            <span>Approve Receipt</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
