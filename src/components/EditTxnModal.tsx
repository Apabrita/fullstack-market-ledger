import React, { useState } from "react";
import { Trash2 } from "lucide-react";

const fmt = (v: number) => "₹" + Math.round(v).toLocaleString();

interface EditTxnModalProps {
  txn: any;
  buyers: any[];
  onSave: (changes: any) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
  onAddBuyer: (name: string) => Promise<any>;
}

export const EditTxnModal: React.FC<EditTxnModalProps> = ({ txn, buyers, onSave, onDelete, onClose, onAddBuyer }) => {
  const [buyerId, setBuyerId] = useState(txn.buyer_id || "");
  const [fishType, setFishType] = useState(txn.fish_type || "");
  const [weight, setWeight] = useState(String(txn.weight || ""));
  const [pricePerKg, setPricePerKg] = useState(String(txn.price_per_kg || ""));
  const [isEditFishInputFocused, setIsEditFishInputFocused] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const wNum = parseFloat(weight);
    const pNum = parseFloat(pricePerKg);
    if (!buyerId || isNaN(wNum) || isNaN(pNum) || wNum <= 0 || pNum <= 0) {
      alert("Invalid numeric entries found. Please correct values.");
      return;
    }

    await onSave({
      buyer_id: buyerId,
      fish_type: fishType.trim(),
      weight: wNum,
      price_per_kg: pNum,
      total_price: wNum * pNum,
    });
  };

  return (
    <div className="inset-0 absolute bg-zinc-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col animate-scaleUp text-left"
      >
        <div className="px-5 py-4 bg-gradient-to-b from-zinc-950 to-zinc-900 border-b border-zinc-800 flex justify-between items-center select-none">
          <div>
            <h3 className="font-extrabold text-sm uppercase text-zinc-200">Adjust Recorded Sale</h3>
            <p className="text-[10px] text-zinc-500">Edit or delete recorded auction entries</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] font-mono font-bold bg-zinc-950 border border-zinc-805 px-2 py-1 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-2xl cursor-pointer"
          >
            ✕ CANCEL
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10.5px] font-extrabold text-zinc-500 uppercase font-sans tracking-wider block">Buyer Nickname</label>
            <select
              value={buyerId}
              onChange={(e) => setBuyerId(e.target.value)}
              required
              className="w-full text-xs text-zinc-200 bg-zinc-950 border border-zinc-800 rounded-2xl p-3 outline-none focus:ring-1 focus:ring-amber-500"
            >
              {buyers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nickname}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5 relative">
            <label className="text-[10.5px] font-extrabold text-zinc-500 uppercase font-sans tracking-wider block">Crate Name / No.</label>
            <div className="relative">
              <input
                type="text"
                value={fishType}
                onChange={(e) => setFishType(e.target.value)}
                className="w-full text-xs text-zinc-200 bg-zinc-950 border border-zinc-800 rounded-2xl p-3 pr-10 outline-none focus:ring-2 focus:ring-sky-500/50 uppercase font-sans font-semibold"
                placeholder="Enter Crate No. & Type (e.g. 1234RE)"
              />
              {fishType && (
                <button
                  type="button"
                  onClick={() => setFishType("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 p-1 hover:text-rose-500 hover:bg-rose-500/10 rounded-full cursor-pointer transition-colors"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="text-[10.5px] font-extrabold text-zinc-500 uppercase font-sans tracking-wider block">Weight (kg)</label>
              <input
                type="text"
                value={weight}
                onChange={(e) => setWeight(e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="0.0"
                required
                className="w-full text-xs text-zinc-200 bg-zinc-950 border border-zinc-800 rounded-2xl p-3 outline-none focus:ring-1 focus:ring-amber-500 font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10.5px] font-extrabold text-zinc-500 uppercase font-sans tracking-wider block">Rate per kg (₹)</label>
              <input
                type="text"
                value={pricePerKg}
                onChange={(e) => setPricePerKg(e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="0"
                required
                className="w-full text-xs text-zinc-200 bg-zinc-950 border border-zinc-800 rounded-2xl p-3 outline-none focus:ring-1 focus:ring-amber-500 font-mono"
              />
            </div>
          </div>

          <div className="bg-zinc-950/60 border border-zinc-800 p-3 rounded-2xl flex justify-between items-center text-xs font-mono select-none">
            <span className="text-zinc-500">Recalculated Aggregate:</span>
            <span className="font-extrabold text-emerald-500 text-emerald-400">
              {fmt((parseFloat(weight) || 0) * (parseFloat(pricePerKg) || 0))}
            </span>
          </div>
        </div>

        <div className="px-5 py-4 bg-zinc-950 border-t border-zinc-800 flex flex-col sm:flex-row gap-2 select-none justify-between items-center">
          {!confirmDel ? (
            <button
              type="button"
              onClick={() => setConfirmDel(true)}
              className="w-full sm:w-auto px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500 hover:text-white border border-rose-900/30 text-rose-400 rounded-2xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1 shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Record</span>
            </button>
          ) : (
            <div className="flex gap-1.5 items-center w-full sm:w-auto">
              <span className="text-[9.5px] text-rose-400 animate-pulse font-bold tracking-tight uppercase">Confirm deletion?</span>
              <button
                type="button"
                onClick={onDelete}
                className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-[10.5px] font-extrabold cursor-pointer transition"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmDel(false)}
                className="px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-2xl text-[10.5px] font-bold cursor-pointer transition"
              >
                Cancel
              </button>
            </div>
          )}

          <button
            type="submit"
            className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl text-xs tracking-wider cursor-pointer font-sans"
          >
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
};
