import React from "react";
import { Transaction } from "../db";

const fmt = (v: number) => "₹" + Math.round(v).toLocaleString();

interface AuctionTxnListProps {
  buyers: any[];
  activeTxns: Transaction[];
  deviceId: string;
  expandFishType: (code: string) => string;
  canEdit: boolean;
  onEdit: (tx: Transaction) => void;
}

export const AuctionTxnList: React.FC<AuctionTxnListProps> = ({
  buyers,
  activeTxns,
  deviceId,
  expandFishType,
  canEdit,
  onEdit
}) => {
  const localTxns = activeTxns;
  
  if (localTxns.length === 0) {
    return (
      <div className="text-center py-20 text-zinc-500 text-xs font-sans space-y-2 select-none">
        <div className="text-2xl animate-bounce">🎣</div>
        <div className="font-bold">No transactions logged by you in this source yet.</div>
        <p className="text-[10.5px] text-zinc-600 max-w-sm mx-auto">
          Select or register a source chip above, pick your buyer nickname at the bottom, and enter weights on the custom keypad.
        </p>
      </div>
    );
  }

  const grouped = localTxns.reduce((acc, t) => {
    const key = t.fish_type || "Unspecified Crate";
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {} as Record<string, typeof localTxns>);

  return (
    <div className="space-y-6 animate-fadeIn pb-4">
      {Object.entries(grouped).map(([crateName, txns]) => {
        const crateKg = txns.reduce((sum, t) => sum + (t.weight || 0), 0);
        const crateAmt = txns.reduce((sum, t) => sum + (t.total_price || 0), 0);
        const crateMean = crateKg > 0 ? crateAmt / crateKg : 0;

        return (
          <div key={crateName} className="space-y-2">
            {/* Crate Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-1 mb-2 px-1">
              <div className="font-extrabold text-xs text-sky-400 uppercase tracking-widest flex items-center gap-1.5 flex-wrap">
                📦 {crateName} <span className="text-[10px] text-zinc-500 lowercase tracking-normal">({expandFishType(crateName)})</span>
              </div>
              <div className="text-[10px] text-zinc-500 font-mono tracking-wider flex items-center gap-2">
                <span>Total: <strong className="text-zinc-300">{crateKg.toFixed(1)}kg</strong></span>
                <span className="opacity-40">|</span>
                <span>Sum: <strong className="text-zinc-300">{fmt(crateAmt)}</strong></span>
                <span className="opacity-40">|</span>
                <span>Avg: <strong className="text-zinc-300">{fmt(crateMean)}/kg</strong></span>
              </div>
            </div>

            {/* List */}
            {txns.map((t) => {
              const bgIntensity = Math.min(100, Math.floor((t.weight || 0) / 100 * 100));
              return (
                <div
                  key={t.id}
                  className="bg-zinc-950 border border-zinc-800 rounded-2xl p-2.5 flex items-center justify-between shadow-sm relative overflow-hidden group hover:border-zinc-700 transition"
                >
                  <div 
                    className="absolute inset-y-0 left-0 bg-sky-500/10 transition-all"
                    style={{ width: `${bgIntensity}%` }}
                  />
                  <div className="flex items-center gap-3 relative z-10 w-full max-w-[65%]">
                    <div className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 flex flex-col items-center justify-center shrink-0">
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-tighter leading-none mt-0.5">₹/kg</span>
                      <span className="text-xs font-black text-zinc-200 font-mono leading-tight">{t.price_per_kg}</span>
                    </div>
                    <div className="truncate">
                      <div className="text-xs font-extrabold text-zinc-200 capitalize font-mono text-amber-500">
                        {t.weight} kg
                      </div>
                      <div className="text-[10px] text-zinc-500 font-sans tracking-wide truncate">
                        👤 Buyer: {(() => {
                           // Try to resolve name from component if needed, but it was resolved locally in TransactionPanel!
                           // Wait, the original code had:
                           // const bObj = store.buyers.find(b => String(b.id) === String(t.buyer_id)); return bObj ? bObj.nickname : t.buyer_id;
                           const bObj = buyers.find((b: any) => String(b.id) === String(t.buyer_id)); return bObj ? bObj.nickname : t.buyer_id;
                        })()}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 relative z-10">
                    <div className="text-xs md:text-sm font-black font-mono text-emerald-400 text-right">
                      {fmt(t.total_price)}
                    </div>
                    {canEdit && (
                      <button
                        onClick={() => onEdit(t)}
                        className="p-1.5 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white rounded-2xl cursor-pointer transition text-[11px]"
                        title="Adjust Record"
                      >
                        ✏️
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};
