import React, { useState } from "react";
import { ChevronRight } from "lucide-react";
import { useData } from "./DataContext";

interface BuyerPickerProps {
  buyers: any[];
  onSelect: (b: any) => void;
  onClose: () => void;
  onAddAndSelect: (name: string) => Promise<void>;
}

export const BuyerPicker: React.FC<BuyerPickerProps> = ({ buyers, onSelect, onClose, onAddAndSelect }) => {
  const { write } = useData();
  const [search, setSearch] = useState("");
  const [newBuyerName, setNewBuyerName] = useState("");
  const [adding, setAdding] = useState(false);

  // Rename states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  // Filter buyers
  const filtered = buyers
    .filter((b) => b.nickname.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.nickname.localeCompare(b.nickname));

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBuyerName.trim()) return;
    setAdding(true);
    await onAddAndSelect(newBuyerName.trim());
    setNewBuyerName("");
    setAdding(false);
  };

  const handleSaveRename = async (b: any, nameVal: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!nameVal.trim()) return;
    await write("buyers", "update", {
      ...b,
      nickname: nameVal.trim()
    });
    setEditingId(null);
  };

  return (
    <div className="inset-0 absolute bg-zinc-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-scaleUp">
        
        {/* Header picker segment */}
        <div className="px-5 py-4 bg-gradient-to-b from-zinc-950 to-zinc-900 border-b border-zinc-800 flex justify-between items-center select-none">
          <h3 className="font-extrabold text-sm uppercase tracking-wider text-zinc-200">Wholesale Buyers Directory</h3>
          <button
            onClick={onClose}
            className="p-1 px-2 text-[10.5px] font-mono font-bold bg-zinc-950 border border-zinc-805 hover:bg-zinc-800 rounded-2xl text-zinc-400 hover:text-white cursor-pointer select-none"
          >
            ✕ CLOSE
          </button>
        </div>

        {/* Directory search filter box */}
        <div className="px-5 py-3 border-b border-zinc-900 select-none">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Narrow down by buyer name..."
            className="w-full text-xs font-semibold bg-zinc-950 text-zinc-300 p-2.5 rounded-2xl border border-zinc-800 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Scrollable list content */}
        <div className="flex-grow overflow-y-auto p-4 divide-y divide-zinc-800/60">
          {filtered.map((b) => {
            const hasOverLimit = (b.lifetime_debt || 0) >= (b.credit_limit || 100000);
            const isEditingThis = editingId === b.id;
            return (
              <div
                key={b.id}
                onClick={() => {
                  if (!isEditingThis) onSelect(b);
                }}
                className="py-3 px-2 flex justify-between items-center cursor-pointer hover:bg-zinc-800 rounded-2xl transition duration-150 group"
              >
                <div className="flex-grow mr-2">
                  {isEditingThis ? (
                    <div className="flex gap-1.5 items-center mt-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="bg-zinc-950 text-zinc-200 text-xs p-1.5 rounded border border-zinc-800 font-sans w-full"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={(e) => handleSaveRename(b, editingName, e)}
                        className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[9.5px] font-bold rounded"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(null);
                        }}
                        className="px-2 py-1 bg-zinc-800 text-zinc-400 text-[9.5px] rounded"
                      >
                        X
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="text-xs font-extrabold text-zinc-200 group-hover:text-amber-500 transition-colors uppercase flex items-center gap-1.5">
                        <span>{b.nickname}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(b.id);
                            setEditingName(b.nickname);
                          }}
                          className="p-1 text-zinc-500 hover:text-zinc-300 text-[9.5px] font-normal lowercase font-sans cursor-pointer"
                          title="Rename this buyer"
                        >
                          ✏️ rename
                        </button>
                      </div>
                      <div className="text-[10px] text-zinc-500 font-mono mt-1 flex items-center gap-2">
                        <span>Owed: <strong>₹{Math.round(b.lifetime_debt || 0).toLocaleString()}</strong></span>
                        <span className="opacity-45">|</span>
                        <span>Limit: ₹{Math.round(b.credit_limit || 100000).toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 select-none shrink-0" onClick={(e) => e.stopPropagation()}>
                  {hasOverLimit && (
                    <span className="text-[8px] bg-red-500/10 border border-red-500/30 text-rose-400 px-1.5 py-0.5 rounded font-mono font-bold tracking-tight uppercase">
                      Debt Limit Reached
                    </span>
                  )}
                  <div
                    onClick={() => {
                      if (!isEditingThis) onSelect(b);
                    }}
                    className="p-1.5 bg-zinc-950 border border-zinc-800 rounded-2xl text-zinc-400 group-hover:text-amber-500 group-hover:border-amber-500/30 transition shadow-inner"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="py-12 text-center text-zinc-500 text-xs font-semibold select-none space-y-4">
              <div>No registered buyer matches "{search}".</div>
              {search.trim().length > 0 && (
                <button
                  type="button"
                  onClick={async () => {
                    const cleanName = search.trim();
                    setAdding(true);
                    await onAddAndSelect(cleanName);
                    setSearch("");
                    setAdding(false);
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-zinc-950 text-xs font-black rounded-2xl transition duration-150 inline-flex items-center gap-1.5 shadow cursor-pointer select-none"
                >
                  ➕ Create & Select "{search.trim()}"
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
