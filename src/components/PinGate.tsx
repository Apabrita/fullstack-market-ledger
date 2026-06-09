/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Shield, Lock, Unlock, KeyRound, Waves, User, Landmark, HelpCircle } from "lucide-react";
import { User as DbUser, authenticateUserWithPIN } from "../db";
import { useData } from "./DataContext";
import { VirtualNumpad } from "./VirtualNumpad";

interface PinGateProps {
  activeUser: DbUser | null;
  setActiveUser: (user: DbUser | null) => void;
  isAuthenticated: boolean;
  setIsAuthenticated: (val: boolean) => void;
}

export const PinGate: React.FC<PinGateProps> = ({
  activeUser,
  setActiveUser,
  isAuthenticated,
  setIsAuthenticated,
}) => {
  const { data } = useData();
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const [selectedUser, setSelectedUser] = useState<DbUser | null>(null);

  const users = data?.users || [];

  // Automatically pre-select default user if none selected
  useEffect(() => {
    if (users.length > 0 && !selectedUser) {
      if (activeUser) {
        setSelectedUser(activeUser);
      } else {
        const adminUser = users.find((u) => u.role === "admin") || users[0];
        setSelectedUser(adminUser);
      }
    }
  }, [users, selectedUser, activeUser]);

  const handleUserSelect = (u: DbUser) => {
    setSelectedUser(u);
    setPinInput("");
    setPinError(false);
  };

  const handleVerify = async () => {
    if (!selectedUser) return;
    const { success, user: validatedUser } = await authenticateUserWithPIN(selectedUser.id, pinInput);
    if (success && validatedUser) {
      setActiveUser(validatedUser);
      setIsAuthenticated(true);
      setPinError(false);
      setPinInput("");
    } else {
      setPinError(true);
      setPinInput("");
      // Simple error animation re-triggering via state flash
      setTimeout(() => setPinError(false), 800);
    }
  };

  if (isAuthenticated && activeUser) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950 p-4 md:p-8 overflow-y-auto">
      {/* Background Ambience Lines */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(13,148,136,0.08),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,rgba(79,70,229,0.08),transparent_50%)]" />

      <div className="relative max-w-4xl w-full grid grid-cols-1 md:grid-cols-12 gap-8 bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-10 shadow-2xl overflow-hidden">
        
        {/* Glow Element */}
        <div className="absolute -top-12 -left-12 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl" />

        {/* LEFT Column - Info & Brand */}
        <div className="md:col-span-5 flex flex-col justify-between space-y-8 z-10">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-tr from-teal-500 to-indigo-600 p-3 rounded-2xl shadow-xl">
                <Waves className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="text-[10px] tracking-widest font-mono font-bold text-teal-400 uppercase">
                  ENTERPRISE ARAT LEDGER
                </span>
                <h1 className="text-xl md:text-2xl font-black text-white tracking-tight uppercase">
                  New Fish Center
                </h1>
              </div>
            </div>
            
            <p className="text-xs text-slate-400 leading-relaxed font-sans pt-2">
              Welcome to the high-velocity wholesale fish market ledger portal. Please authorize your operational role to access transaction books.
            </p>
          </div>

          {/* User selector list */}
          <div className="space-y-3">
            <div className="text-[11px] font-sans font-bold text-slate-400 tracking-wider uppercase flex items-center gap-1.5 pb-1">
              <Shield className="w-3.5 h-3.5 text-indigo-400" /> Choose Your Station Operator
            </div>

            <div className="space-y-2">
              {users.map((u) => {
                const isSelected = selectedUser?.id === u.id;
                return (
                  <motion.button
                    key={u.id}
                    type="button"
                    whileHover={{ x: isSelected ? 0 : 4 }}
                    onClick={() => handleUserSelect(u)}
                    className={`w-full text-left p-3 rounded-xl border transition-all duration-150 flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? "bg-slate-850 border-teal-500 text-white shadow-lg ring-1 ring-teal-500/30"
                        : "bg-slate-950/40 border-slate-850/70 text-slate-400 hover:bg-slate-950 hover:text-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isSelected ? "bg-teal-500/10 text-teal-400" : "bg-slate-900 text-slate-600"}`}>
                        <User className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold font-sans">{u.name}</div>
                        <div className="text-[10px] font-mono text-slate-500 uppercase lowercase">
                          Code Tip: {u.pin}
                        </div>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-md text-[8px] uppercase font-mono tracking-wider font-extrabold ${
                      u.role === "admin" ? "bg-purple-950/50 text-purple-400 border border-purple-900/50" :
                      u.role === "auctioneer" ? "bg-blue-950/50 text-blue-400 border border-blue-900/50" :
                      "bg-orange-950/50 text-orange-400 border border-orange-900/50"
                    }`}>
                      {u.role}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </div>

          <div className="text-[10px] text-slate-500 font-mono leading-tight flex items-center gap-1.5 bg-slate-950/40 p-3 rounded-xl border border-slate-850">
            <Lock className="w-4 h-4 text-slate-400 shrink-0" />
            <span>Station requires role-secure PinGate clearance. Optimistic Offline caching active.</span>
          </div>
        </div>

        {/* RIGHT Column - PIN Numpad Access */}
        <div className="md:col-span-7 flex flex-col justify-center items-center bg-slate-950/60 rounded-2xl border border-slate-850 p-6 z-10 space-y-4">
          {selectedUser && (
            <div className="text-center w-full max-w-xs space-y-1">
              <span className="text-[10px] uppercase font-mono tracking-widest text-indigo-400">Security Clearance</span>
              <h2 className="text-sm font-bold text-slate-100 font-sans">
                Authenticating: <span className="text-teal-400 font-extrabold">{selectedUser.name}</span>
              </h2>
              <p className="text-[10.5px] text-slate-400 lowercase uppercase">
                Authorize using {selectedUser.name}'s ({selectedUser.role}) private login code
              </p>
            </div>
          )}

          <motion.div
            animate={pinError ? { x: [-8, 8, -6, 6, -3, 3, 0] } : {}}
            transition={{ duration: 0.4 }}
            className="w-full max-w-xs"
          >
            <VirtualNumpad
              value={pinInput}
              onChange={(val) => {
                if (val.length <= 6) {
                  setPinInput(val.replace(/\D/g, ""));
                  setPinError(false);
                }
              }}
              onEnter={handleVerify}
              placeholder="••••"
            />
          </motion.div>

          {pinError ? (
            <span className="text-xs text-rose-450 font-bold text-rose-400 bg-rose-950/30 px-4 py-1.5 rounded-lg border border-rose-900/40 animate-pulse">
              Invalid passcode entered. Please retry! (Use standard Hint)
            </span>
          ) : (
            <span className="text-[10px] text-slate-500 font-mono italic">
              Tap verification key after inputting 4 digits.
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
