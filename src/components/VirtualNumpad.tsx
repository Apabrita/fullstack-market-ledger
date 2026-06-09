/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { motion } from "motion/react";
import { Delete, DeleteIcon, Trash, Reply } from "lucide-react";

interface VirtualNumpadProps {
  value: string;
  onChange: (val: string) => void;
  onEnter?: () => void;
  onClose?: () => void;
  placeholder?: string;
}

export const VirtualNumpad: React.FC<VirtualNumpadProps> = ({
  value,
  onChange,
  onEnter,
  onClose,
  placeholder = "0.00",
}) => {
  const handlePress = (char: string) => {
    if (char === "C") {
      onChange("");
    } else if (char === "⌫") {
      onChange(value.slice(0, -1));
    } else if (char === ".") {
      if (!value.includes(".")) {
        onChange(value + ".");
      }
    } else {
      // Prevent leading zeros unless it represents tenths/hundredths
      if (value === "0" && char !== ".") {
        onChange(char);
      } else {
        onChange(value + char);
      }
    }
  };

  const keys = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    [".", "0", "⌫"],
  ];

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-2xl max-w-xs mx-auto animate-fadeIn select-none">
      {/* Display line */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 mb-4 text-right relative flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-mono font-bold">Numpad Ledger</span>
        <div className="flex flex-col items-end">
          <span className={`text-xl font-mono font-bold tracking-widest ${value ? "text-teal-400" : "text-slate-600"}`}>
            {value || placeholder}
          </span>
        </div>
      </div>

      {/* Button Grid */}
      <div className="grid grid-cols-3 gap-2">
        {keys.map((row, rIdx) =>
          row.map((key) => {
            const isControl = key === "⌫" || key === "C";
            return (
              <motion.button
                key={key}
                type="button"
                whileTap={{ scale: 0.92, backgroundColor: "#111827" }}
                whileHover={{ scale: 1.02 }}
                onClick={() => handlePress(key)}
                className={`py-3.5 rounded-xl text-center font-mono text-sm font-bold transition-all duration-100 flex items-center justify-center cursor-pointer ${
                  key === "⌫"
                    ? "bg-slate-900 text-rose-450 text-rose-400 hover:bg-slate-850/60 hover:text-rose-300 border border-slate-800/65"
                    : isControl
                    ? "bg-slate-900 text-amber-450 text-amber-400 hover:bg-slate-850 border border-slate-800/65"
                    : "bg-slate-900 text-slate-100 hover:bg-slate-800 hover:text-white border border-slate-850"
                }`}
              >
                {key === "⌫" ? <Delete className="w-4 h-4" /> : key}
              </motion.button>
            );
          })
        )}
      </div>

      {/* Numpad Action Buttons */}
      <div className="grid grid-cols-2 gap-2 mt-3">
        <motion.button
          type="button"
          whileTap={{ scale: 0.95 }}
          onClick={() => handlePress("C")}
          className="py-2.5 rounded-xl text-center text-xs font-sans font-bold bg-slate-900/40 hover:bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-850 cursor-pointer"
        >
          Clear (C)
        </motion.button>
        {onEnter ? (
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={onEnter}
            className="py-2.5 rounded-xl text-center text-xs font-sans font-black bg-teal-600 hover:bg-teal-700 text-white shadow-md shadow-teal-900/20 cursor-pointer"
          >
            Apply PIN/Val
          </motion.button>
        ) : onClose ? (
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            className="py-2.5 rounded-xl text-center text-xs font-sans font-bold bg-slate-800 hover:bg-slate-700 text-slate-100 cursor-pointer"
          >
            Close Pad
          </motion.button>
        ) : null}
      </div>
    </div>
  );
};
