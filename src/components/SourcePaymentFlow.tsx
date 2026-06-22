import React, { useState, useEffect } from "react";
import { Calculator, CheckCircle2, ChevronRight, Anchor, Percent, FileText, PlusCircle, Trash2 } from "lucide-react";
import { shareAsPDF } from "../utils/pdf";
import { useData } from "./DataContext";

interface SourcePaymentFlowProps {
  source: any;
  transactions: any[];
  appDate: string;
  onClose: () => void;
  existingPayment?: any;
}

export const SourcePaymentFlow: React.FC<SourcePaymentFlowProps> = ({ source, transactions, appDate, onClose, existingPayment }) => {
  const { write } = useData();
  const [fishItems, setFishItems] = useState<any[]>([]);
  const [manualCommission, setManualCommission] = useState<string>("0");
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (existingPayment?.items_json) {
      try {
        const savedItems = JSON.parse(existingPayment.items_json);
        setFishItems(savedItems);
        setManualCommission(existingPayment.commission.toString());
        return;
      } catch (e) {
        console.error("Failed to parse items_json", e);
      }
    }

    const grouped = transactions.reduce((acc, t) => {
      const ft = t.fish_type || "Unsorted Catch";
      if (!acc[ft]) {
        acc[ft] = { weight: 0, revenue: 0 };
      }
      acc[ft].weight += (Number(t.weight) || 0);
      acc[ft].revenue += (t.total_price || 0);
      return acc;
    }, {} as Record<string, { weight: number, revenue: number }>);

    const items = Object.entries(grouped).map((entry, idx) => {
      const ft = entry[0];
      const val = entry[1] as { weight: number, revenue: number };
      const mean = val.weight > 0 ? val.revenue / val.weight : 0;
      return {
        id: `actual_${idx}_${Date.now()}`,
        fishType: ft,
        transactionId: `grouped_${idx}`,
        actualWeight: val.weight,
        actualRevenue: val.revenue,
        meanPrice: mean,
        // editable printable fields
        payoutWeight: val.weight.toString(),
        payoutRatePerKg: Math.round(mean).toString()
      };
    });
    if (items.length === 0) {
      items.push({
        id: "unsorted_0",
        fishType: "Unsorted Catch",
        transactionId: "none",
        actualWeight: 0,
        actualRevenue: 0,
        meanPrice: 0,
        payoutWeight: "0",
        payoutRatePerKg: "0"
      });
    }
    setFishItems(items);
    
    // Default manual commission suggested at 5% but completely adjustable
    const grossSum = items.reduce((sum, it) => sum + (parseFloat(it.payoutWeight) || 0) * (parseFloat(it.payoutRatePerKg) || 0), 0);
    setManualCommission(Math.round(grossSum * 0.05).toString());
  }, [source, transactions, existingPayment]);

  const updateItem = (index: number, field: string, value: string) => {
    const newItems = [...fishItems];
    // If user starts typing and the initial is "0", overwrite it smoothly
    if ((field === "payoutWeight" || field === "payoutRatePerKg") && newItems[index][field] === "0" && value !== "0" && value !== "") {
      newItems[index][field] = value.replace(/^0+/, '');
    } else {
      newItems[index][field] = value;
    }
    setFishItems(newItems);
  };

  const handleAddCustomRow = () => {
    setFishItems([
      ...fishItems,
      {
        id: `custom_${Date.now()}_${Math.random()}`,
        fishType: "Custom Fish Item",
        actualWeight: 0,
        actualRevenue: 0,
        meanPrice: 0,
        payoutWeight: "0",
        payoutRatePerKg: "0"
      }
    ]);
  };

  const handleRemoveRow = (index: number) => {
    const newItems = fishItems.filter((_, i) => i !== index);
    setFishItems(newItems);
  };

  // Calculations based on the manual settings
  const totalActualWeight = fishItems.reduce((sum, it) => sum + (it.actualWeight || 0), 0);
  const totalActualRevenue = fishItems.reduce((sum, it) => sum + (it.actualRevenue || 0), 0);
  
  const totalPayoutWeight = fishItems.reduce((sum, it) => sum + (parseFloat(it.payoutWeight) || 0), 0);
  
  // 100% gross total value calculated using manual Settings (weight * rate)
  const totalPayoutGross = fishItems.reduce((sum, it) => {
    const w = parseFloat(it.payoutWeight) || 0;
    const r = parseFloat(it.payoutRatePerKg) || 0;
    return sum + (w * r);
  }, 0);

  const parsedCommission = parseFloat(manualCommission) || 0;
  const netPaidToSource = Math.max(0, totalPayoutGross - parsedCommission);
  const totalAratProfit = (totalActualRevenue - totalPayoutGross) + parsedCommission;

  const handleSettle = () => {
    setShowConfirmModal(true);
  };

  const confirmSettle = async () => {
    try {
      if (existingPayment) {
        const updatedPayment = {
          ...existingPayment,
          date: source.date || appDate,
          total_kg: totalPayoutWeight,
          sale_total: totalActualRevenue,
          amount_paid_to_source: netPaidToSource,
          commission: parsedCommission,
          is_settled: true,
          items_json: JSON.stringify(fishItems)
        };
        await write("source_payments", "update", updatedPayment);
      } else {
        const newPayment = {
          id: `temp_p_${Date.now()}`,
          source_id: source.id,
          date: source.date || appDate,
          total_kg: totalPayoutWeight,
          sale_total: totalActualRevenue,
          amount_paid_to_source: netPaidToSource,
          commission: parsedCommission,
          is_settled: true,
          items_json: JSON.stringify(fishItems)
        };
        await write("source_payments", "insert", newPayment);
        await write("sources", "update", { ...source, is_completed: true });
      }
      setShowConfirmModal(false);
    } catch (err) {
      console.error("Error saving payment:", err);
      setErrorMsg("There was an error saving the payment.");
    }
  };

  const handlePrint = async () => {
    setIsGeneratingPdf(true);
    
    setTimeout(async () => {
      try {
        await shareAsPDF(
          `print-sheet-canvas`,
          `Payout_Bill_${source.name.replace(/\s+/g, '_')}_${appDate}.pdf`,
          `Source Payout Invoice: ${source.name}`,
          `Generated electronic payout invoice for ${source.name} on ${appDate}.`,
          'download'
        );
      } catch (err) {
        console.error("PDF generation failed", err);
        window.print();
      } finally {
        setIsGeneratingPdf(false);
      }
    }, 800);
  };

  return (
    <div className="bg-white border rounded-2xl p-5 mt-2 space-y-5 shadow-sm border-zinc-200 animate-slideDown">
      <div className="flex justify-between items-center pb-3 border-b border-zinc-200">
        <div>
          <h3 className="font-bold text-zinc-800 text-sm flex items-center gap-1.5">
            <Anchor className="w-4 h-4 text-indigo-600" />
            Payout for {source.name}
          </h3>
          <p className="text-xs text-zinc-500 mt-1">Review actual auction data, then enter custom payout parameters.</p>
        </div>
      </div>

      <div className="bg-zinc-50/50 border border-zinc-200 rounded-xl p-4 space-y-2">
        <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block font-sans">Original Auction Data (Read-Only) • Crates: {transactions.length}</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead>
              <tr className="text-zinc-500 border-b border-zinc-200">
                <th className="pb-2 font-medium">Fish Name</th>
                <th className="pb-2 font-medium text-right">Total Weight</th>
                <th className="pb-2 font-medium text-right">Mean Rate</th>
                <th className="pb-2 font-medium text-right">Total Acquired Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {fishItems.map((item, idx) => (
                <tr key={`orig_${idx}`} className="text-zinc-800">
                  <td className="py-2">{item.fishType}</td>
                  <td className="py-2 text-right font-mono">{item.actualWeight?.toLocaleString() || 0} kg</td>
                  <td className="py-2 text-right font-mono">₹{item.meanPrice?.toFixed(2) || '0.00'}</td>
                  <td className="py-2 text-right font-mono text-emerald-700 font-medium">₹{item.actualRevenue?.toLocaleString() || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-between items-center pt-2">
        <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block font-sans">Editable Payout Settings</h4>
        <button
          type="button"
          onClick={handleAddCustomRow}
          className="bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-semibold py-1.5 px-3 rounded-xl flex items-center gap-1 text-xs transition"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          Add Item
        </button>
      </div>

      <div className="space-y-3">
        {fishItems.map((item, idx) => {
          const mWeight = parseFloat(item.payoutWeight) || 0;
          const mRate = parseFloat(item.payoutRatePerKg) || 0;
          const mValue = mWeight * mRate;

          return (
            <div key={item.id || idx} className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="flex-1 w-full">
                 <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Fish Details</label>
                 <input
                    type="text"
                    value={item.fishType}
                    onChange={(e) => updateItem(idx, 'fishType', e.target.value)}
                    className="border border-zinc-300 bg-white rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-900 w-full outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="Fish name"
                 />
              </div>
              <div className="flex gap-3 w-full sm:w-auto">
                 <div className="w-1/2 sm:w-24">
                   <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Weight (kg)</label>
                   <input
                     type="text"
                     value={item.payoutWeight === "0" ? "" : item.payoutWeight}
                     onChange={(e) => updateItem(idx, 'payoutWeight', e.target.value.replace(/[^0-9.]/g, '') || "0")}
                     placeholder="0"
                     className="border border-zinc-300 bg-white rounded-lg px-3 py-1.5 text-sm font-mono text-zinc-900 w-full outline-none focus:ring-1 focus:ring-indigo-500"
                   />
                 </div>
                 <div className="w-1/2 sm:w-28">
                   <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Rate (₹/kg)</label>
                   <input
                     type="text"
                     value={item.payoutRatePerKg === "0" ? "" : item.payoutRatePerKg}
                     onChange={(e) => updateItem(idx, 'payoutRatePerKg', e.target.value.replace(/[^0-9.]/g, '') || "0")}
                     placeholder="0"
                     className="border border-zinc-300 bg-white rounded-lg px-3 py-1.5 text-sm font-mono text-zinc-900 w-full outline-none focus:ring-1 focus:ring-indigo-500"
                   />
                 </div>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <div className="text-right sm:w-24">
                   <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Total (₹)</label>
                   <div className="font-mono font-bold text-zinc-800 text-sm py-1.5">
                     ₹{mValue.toLocaleString()}
                   </div>
                </div>
                <div className="text-right sm:w-24 border-l border-zinc-200 pl-3">
                   <label className="text-[10px] font-bold text-indigo-500 uppercase block mb-1">Trade Margin</label>
                   <div className="font-mono font-bold text-indigo-600 text-sm py-1.5">
                     ₹{(item.actualRevenue - mValue).toLocaleString()}
                   </div>
                </div>
                {fishItems.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveRow(idx)}
                    className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg transition self-end mb-0.5"
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-zinc-50 border border-zinc-200 p-4 rounded-xl space-y-3 mt-4">
        <div className="flex justify-between items-center text-sm font-medium text-zinc-700">
          <span>Gross Value:</span>
          <span className="font-mono">₹{totalPayoutGross.toLocaleString()}</span>
        </div>
        
        <div className="flex justify-between items-center text-sm font-medium text-zinc-700">
          <span>Commission / Deductions (₹):</span>
          <input
            type="text"
            value={manualCommission === "0" ? "" : manualCommission}
            onChange={(e) => setManualCommission(e.target.value.replace(/[^0-9.]/g, '') || "0")}
            placeholder="0"
            className="border border-zinc-300 bg-white rounded-lg px-3 py-1 w-28 text-right font-mono outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="pt-3 border-t border-zinc-200 flex justify-between items-center text-lg font-bold text-emerald-700">
          <span>Net Final Payment:</span>
          <span className="font-mono">₹{netPaidToSource.toLocaleString()}</span>
        </div>

        <div className="pt-3 border-t border-zinc-200 flex justify-between items-center text-xs font-bold text-indigo-700 bg-indigo-50/50 p-2 rounded-lg">
          <span className="uppercase tracking-widest font-sans">Total Arat Profit from Source</span>
          <span className="font-mono text-sm">₹{totalAratProfit.toLocaleString()}</span>
        </div>
      </div>

      {/* Hidden Print Canvas Area */}
      {source.is_completed && (
        <div className="fixed -left-[4000px] top-0 opacity-0 pointer-events-none">
           <div 
             id="print-sheet-canvas"
             className="bg-white text-zinc-900 space-y-6 shrink-0 relative"
             style={{ 
               width: '794px', 
               height: '1123px', 
               padding: '48px',
               boxSizing: 'border-box'
             }}
           >
              <div className="border-b-2 border-zinc-900 pb-4 flex justify-between items-start">
                <div>
                  <h3 className="text-3xl font-black tracking-tight text-zinc-950 uppercase">NEW FISH CENTER</h3>
                  <p className="text-[12px] text-zinc-805 font-extrabold tracking-wider font-mono uppercase">Commission Agent and Wholesaler</p>
                  <p className="text-[12px] text-zinc-600 mt-1 uppercase font-sans">BALIA, Chakdaha, Nadia</p>
                </div>
                <div className="text-right">
                  <div className="text-xl font-black text-zinc-950 font-mono tracking-wider">PAYOUT BILL</div>
                  <div className="text-xs font-bold text-zinc-700 mt-2 uppercase">Source: {source.name}</div>
                  <div className="text-xs text-zinc-500 font-mono mt-1">Date: {source.date || appDate}</div>
                  <div className="text-[11px] font-bold text-zinc-600 font-sans mt-0.5 uppercase tracking-wide">Total Crates Sold: {transactions.length}</div>
                </div>
              </div>

              <div className="mt-8">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-zinc-100 text-zinc-700 uppercase tracking-wider text-[11px] font-bold">
                      <th className="py-3 px-4 border border-zinc-300">Fish Type / Details</th>
                      <th className="py-3 px-4 border border-zinc-300 text-right">Weight (Kg)</th>
                      <th className="py-3 px-4 border border-zinc-305 text-right font-bold text-zinc-600">Mean Bidding Rate (₹ / kg)</th>
                      <th className="py-3 px-4 border border-zinc-300 text-right">Settled Payout Rate (₹ / KG)</th>
                      <th className="py-3 px-4 border border-zinc-300 text-right bg-zinc-205 text-zinc-900">Total Value (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fishItems.map((itm, i) => {
                      const w = parseFloat(itm.payoutWeight) || 0;
                      const r = parseFloat(itm.payoutRatePerKg) || 0;
                      const valVal = w * r;
                      return (
                        <tr key={itm.id || i} className="text-zinc-805 font-bold border-b border-zinc-200">
                          <td className="py-3.5 px-4 border border-zinc-300 font-sans uppercase">{itm.fishType}</td>
                          <td className="py-3.5 px-4 border border-zinc-300 text-right font-mono">{w.toLocaleString()} kg</td>
                          <td className="py-3.5 px-4 border border-zinc-305 text-right font-mono text-zinc-500 font-bold">₹{itm.meanPrice.toFixed(2)}</td>
                          <td className="py-3.5 px-4 border border-zinc-300 text-right font-mono">₹{r.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="py-3.5 px-4 border border-zinc-300 text-right font-mono text-zinc-955 bg-indigo-50/15">₹{Math.round(valVal).toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} className="py-3 px-4 border border-zinc-305 text-right font-black uppercase text-zinc-900">Net Amount Paid:</td>
                      <td className="py-3 px-4 border border-zinc-305 text-right font-mono font-black text-xl text-zinc-950 bg-indigo-50/30">₹{Math.round(netPaidToSource).toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              
              <div className="absolute bottom-12 left-12 right-12 flex justify-between items-end">
                <div className="text-center">
                   <div className="w-40 border-b border-zinc-400 mb-2"></div>
                   <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Receiver Signature</div>
                </div>
                <div className="text-center">
                   <div className="w-40 border-b border-zinc-400 mb-2"></div>
                   <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-sans">Authorized Signatory</div>
                </div>
              </div>
           </div>
        </div>
      )}

      <div className="flex gap-2 justify-end pt-4">
        {!existingPayment?.is_settled ? (
           <button 
             type="button"
             onClick={handleSettle}
             className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-2xl flex items-center justify-center gap-2 shadow-sm w-full sm:w-auto cursor-pointer"
           >
             <CheckCircle2 className="w-5 h-5" />
             Confirm source payment
           </button>
         ) : (
           <div className="flex flex-col sm:flex-row gap-3 w-full justify-end">
             <button
               type="button"
               onClick={handleSettle}
               className="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm cursor-pointer border border-emerald-300"
             >
               <CheckCircle2 className="w-4 h-4" />
               Update Payment
             </button>
             <button 
               type="button"
               onClick={handlePrint}
               className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 shadow-sm cursor-pointer"
               disabled={isGeneratingPdf}
             >
               <FileText className="w-4 h-4" />
               {isGeneratingPdf ? "Building PDF..." : "Download or share the PDF"}
             </button>
           </div>
         )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl p-6 shadow-xl w-full max-w-sm">
            <h3 className="text-lg font-bold text-zinc-800 mb-2">Confirm Payment</h3>
            <p className="text-sm text-zinc-600 mb-6">Are you confirming it?</p>
            {errorMsg && (
              <div className="bg-red-50 text-red-600 text-xs p-2 rounded mb-4">
                {errorMsg}
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold py-2 px-4 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmSettle}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-6 rounded-xl transition"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
