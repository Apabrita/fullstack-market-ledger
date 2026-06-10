/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { useData } from "./DataContext";
import { User as UserIcon, Shield, Lock, Unlock, KeyRound } from "lucide-react";
import { User, authenticateUserWithPIN } from "../db";

interface UserSimulatorProps {
  activeUser: User | null;
  setActiveUser: (user: User) => void;
  isAuthenticated: boolean;
  setIsAuthenticated: (val: boolean) => void;
}

export const UserSimulator: React.FC<UserSimulatorProps> = ({
  activeUser,
  setActiveUser,
  isAuthenticated,
  setIsAuthenticated,
}) => {
  const { data } = useData();
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const [isChanging, setIsChanging] = useState(false);

  const users = data?.users || [];

  // Default login on mount
  useEffect(() => {
    if (users.length > 0 && !activeUser) {
      // Find Admin as default for testing convenience
      const adminUser = users.find((u) => u.role === "admin") || users[0];
      setActiveUser(adminUser);
      setIsAuthenticated(false);
      setIsChanging(true);
    }
  }, [users, activeUser, setActiveUser, setIsAuthenticated]);

  const handleUserSelect = (u: User) => {
    setActiveUser(u);
    setPinInput("");
    setPinError(false);
    setIsAuthenticated(false);
    setIsChanging(true);
  };

  const handleVerifyPin = async () => {
    if (!activeUser) return;
    const { success, user: validatedUser } = await authenticateUserWithPIN(activeUser.id, pinInput);
    if (success && validatedUser) {
      setActiveUser(validatedUser);
      setIsAuthenticated(true);
      setPinError(false);
      setIsChanging(false);
      setPinInput("");
    } else {
      setPinError(true);
      setIsAuthenticated(false);
    }
  };

  if (users.length === 0) return null;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg space-y-4 text-zinc-100" id="user-simulator-panel">
      {/* Active User Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div className="flex items-center space-x-2">
          <Shield className="w-4 h-4 text-zinc-400" />
          <h3 className="font-sans font-semibold text-sm tracking-wide uppercase text-zinc-300">
            Active Security Role
          </h3>
        </div>
        {isAuthenticated ? (
          <span className="flex items-center gap-1 text-[10px] bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-900/50">
            <Unlock className="w-2.5 h-2.5" /> Authenticated
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[10px] bg-rose-950 text-rose-400 px-2 py-0.5 rounded-full border border-rose-900/50">
            <Lock className="w-2.5 h-2.5" /> Locked
          </span>
        )}
      </div>

      {/* User Dropdown Selector */}
      <div className="space-y-1.5 text-xs">
        <label className="text-zinc-400 block font-medium">Select Operator:</label>
        <div className="grid grid-cols-1 gap-1.5">
          {users.map((u) => {
            const isSelected = activeUser?.id === u.id;
            return (
              <button
                key={u.id}
                onClick={() => handleUserSelect(u)}
                className={`w-full text-left p-2.5 rounded-2xl border transition duration-150 flex items-center justify-between cursor-pointer ${
                  isSelected
                    ? "bg-zinc-800 border-zinc-700 text-white font-semibold"
                    : "bg-zinc-950/40 border-zinc-900 text-zinc-400 hover:bg-zinc-950 hover:text-zinc-200"
                }`}
              >
                <div className="flex items-center gap-2">
                  <UserIcon className={`w-3.5 h-3.5 ${isSelected ? "text-zinc-300" : "text-zinc-500"}`} />
                  <span>{u.name}</span>
                </div>
                <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-mono tracking-wider ${
                  u.role === "admin" ? "bg-purple-950/40 text-purple-400 border border-purple-900/30" :
                  u.role === "auctioneer" ? "bg-blue-950/40 text-blue-400 border border-blue-900/30" :
                  "bg-orange-950/40 text-orange-400 border border-orange-900/30"
                }`}>
                  {u.role}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* PIN entry wrapper if locked or changing users */}
      {(isChanging || !isAuthenticated) && activeUser && (
        <div className="bg-zinc-950 p-3 rounded-2xl border border-zinc-800 space-y-2.5 animate-fadeIn">
          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <KeyRound className="w-3.5 h-3.5 text-teal-500" />
            <span>Enter PIN for <strong>{activeUser.name}</strong>:</span>
          </div>
          <div className="flex gap-2">
            <input
              type="password"
              maxLength={6}
              value={pinInput}
              onChange={(e) => {
                setPinInput(e.target.value.replace(/\D/g, ""));
                setPinError(false);
              }}
              placeholder={`Default pin: ${activeUser.pin}`}
              className={`bg-zinc-900 border text-zinc-100 text-xs text-center tracking-widest font-mono rounded-2xl px-2 py-2 flex-grow focus:outline-none focus:ring-1 focus:ring-teal-500 ${
                pinError ? "border-rose-500" : "border-zinc-800"
              }`}
            />
            <button
              onClick={handleVerifyPin}
              className="bg-teal-600 hover:bg-teal-700 text-white font-medium text-xs px-4 rounded-2xl transition duration-200 cursor-pointer"
            >
              Verify
            </button>
          </div>
          {pinError && (
            <div className="text-[10px] text-rose-400 font-semibold text-center">
              Incorrect PIN! Please look at the suggested hint.
            </div>
          )}
        </div>
      )}

      {/* Current User permissions sheet in small details */}
      {activeUser && isAuthenticated && (
        <div className="p-3 bg-zinc-950/50 rounded-2xl border border-zinc-800/60 text-[11px] text-zinc-400 space-y-1">
          <div className="text-zinc-300 font-semibold mb-1">Session Permissions:</div>
          <div>• Record transactions stamped with <em>"{activeUser.name}"</em>.</div>
          {activeUser.role === "admin" && (
            <>
              <div>• Settle sources & record outgoing payments.</div>
              <div>• Approve buyer collection transactions and rollover records.</div>
              <div>• Edit system users & access Halkhata Configuration.</div>
            </>
          )}
          {activeUser.role === "auctioneer" && (
            <>
              <div>• Create and update transactions (active uncompleted sources).</div>
              <div>• Register new incoming fish sources/sources.</div>
            </>
          )}
          {activeUser.role === "collector" && (
            <>
              <div>• View buyer general credit details.</div>
              <div>• Book client collection amounts (requires Admin Approval status).</div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
