import React from 'react';
import { motion } from 'motion/react';
import { Calculator } from 'lucide-react';
import { triggerHaptic } from '../utils/haptics';

interface CashDenominatorProps {
  notes500: string; setNotes500: (v: string) => void;
  notes200: string; setNotes200: (v: string) => void;
  notes100: string; setNotes100: (v: string) => void;
  notes50: string;  setNotes50:  (v: string) => void;
  notes20: string;  setNotes20:  (v: string) => void;
  notes10: string;  setNotes10:  (v: string) => void;
  calculatedCashTotal: number;
  handleApplyCashTotal: () => void;
  onClose: () => void;
}

export const CashDenominator: React.FC<CashDenominatorProps> = ({
  notes500, setNotes500, notes200, setNotes200,
  notes100, setNotes100, notes50, setNotes50,
  notes20, setNotes20, notes10, setNotes10,
  calculatedCashTotal, handleApplyCashTotal, onClose
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="bg-zinc-900 border-2 border-dashed border-zinc-800 rounded-2xl p-4 mb-4 select-none"
    >
      <div className="flex items-center justify-between mb-4 border-b border-zinc-800 pb-2">
        <h4 className="text-[10px] font-black uppercase text-zinc-400 flex items-center gap-1.5 tracking-widest">
          <Calculator className="w-3.5 h-3.5 text-sky-500" />
          Cash Register Denominators
        </h4>
        <button type="button" onClick={onClose} className="text-[10px] font-bold text-red-400 uppercase tracking-widest">
          ✕ Cancel
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        {[
          { label: "₹500x", val: notes500, set: setNotes500 },
          { label: "₹200x", val: notes200, set: setNotes200 },
          { label: "₹100x", val: notes100, set: setNotes100 },
          { label: "₹50x",  val: notes50,  set: setNotes50 },
          { label: "₹20x",  val: notes20,  set: setNotes20 },
          { label: "₹10x",  val: notes10,  set: setNotes10 }
        ].map((item, i) => (
          <div key={i} className="flex relative">
            <span className="absolute left-3 top-1/2 mt-[1px] -translate-y-1/2 text-xs font-black font-mono text-zinc-600 select-none">
              {item.label}
            </span>
            <input
              type="number"
              min="0"
              value={item.val}
              onChange={(e) => item.set(e.target.value)}
              placeholder="0"
              className="w-full bg-zinc-950 border border-zinc-800 text-sm font-black font-mono text-white p-3 pr-4 pl-12 rounded-xl focus:border-sky-500/50 outline-none transition placeholder-zinc-800"
            />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between pt-2">
        <div className="text-[10px] text-zinc-500 font-sans uppercase font-bold tracking-widest">
          Total Vault Value:
          <span className="block text-xl font-black font-mono text-sky-400 leading-tight">
            ₹{calculatedCashTotal.toLocaleString()}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            triggerHaptic('success');
            handleApplyCashTotal();
          }}
          className="bg-sky-600 hover:bg-sky-500 text-white font-extrabold uppercase px-6 py-2.5 rounded-xl text-xs tracking-wider transition shadow-lg shadow-sky-900/50"
        >
          Confirm ₹
        </button>
      </div>
    </motion.div>
  );
};
