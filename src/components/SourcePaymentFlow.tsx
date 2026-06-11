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
  const [previewScale, setPreviewScale] = useState(1);

  useEffect(() => {
    const parent = document.getElementById("payout-preview-parent");
    if (!parent) return;
    const updateScale = () => {
      const width = parent.clientWidth;
      if (width < 850) {
        const newScale = (width - 32) / 794;
        setPreviewScale(Math.max(0.35, Math.min(1, newScale)));
      } else {
        setPreviewScale(1);
      }
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    const timer = setTimeout(updateScale, 150);
    return () => {
      window.removeEventListener("resize", updateScale);
      clearTimeout(timer);
    };
  }, [source]);

  useEffect(() => {
    const types = Array.from(new Set(transactions.map((t: any) => t.fish_type || "Unsorted"))) as string[];
    const items = types.map((ft, idx) => {
      const fTx = transactions.filter(t => (t.fish_type || "Unsorted") === ft);
      const wt = fTx.reduce((sum, t) => sum + (t.weight || 0), 0);
      const rev = fTx.reduce((sum, t) => sum + (t.total_price || 0), 0);
      const mean = wt > 0 ? rev / wt : 0;
      return {
        id: `actual_${idx}_${Date.now()}`,
        fishType: ft,
        actualWeight: wt,
        actualRevenue: rev,
        meanPrice: mean,
        // editable printable fields
        payoutWeight: wt.toString(),
        payoutRatePerKg: source.rate_per_kg.toString()
      };
    });
    if (items.length === 0) {
      items.push({
        id: "unsorted_0",
        fishType: "Unsorted Catch",
        actualWeight: 0,
        actualRevenue: 0,
        meanPrice: 0,
        payoutWeight: "0",
        payoutRatePerKg: source.rate_per_kg.toString()
      });
    }
    setFishItems(items);
    
    // Default manual commission suggested at 5% but completely adjustable
    const grossSum = items.reduce((sum, it) => sum + (parseFloat(it.payoutWeight) || 0) * (parseFloat(it.payoutRatePerKg) || 0), 0);
    setManualCommission(Math.round(grossSum * 0.05).toString());
  }, [source, transactions]);

  const updateItem = (index: number, field: string, value: string) => {
    const newItems = [...fishItems];
    newItems[index] = {
      ...newItems[index],
      [field]: value
    };
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
        payoutRatePerKg: source.rate_per_kg.toString()
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

  const handleSettle = async () => {
    const isConfirmed = window.confirm("Are you confirm it?");
    if (!isConfirmed) return;

    if (existingPayment) {
      const updatedPayment = {
        ...existingPayment,
        date: source.date || appDate,
        total_kg: totalPayoutWeight,
        rate_per_kg: source.rate_per_kg,
        sale_total: totalActualRevenue,
        amount_paid_to_source: netPaidToSource,
        commission: parsedCommission,
        is_settled: true,
      };
      await write("source_payments", "update", updatedPayment);
    } else {
      const newPayment = {
        id: `temp_p_${Date.now()}`,
        source_id: source.id,
        date: source.date || appDate,
        total_kg: totalPayoutWeight,
        rate_per_kg: source.rate_per_kg,
        sale_total: totalActualRevenue,
        amount_paid_to_source: netPaidToSource,
        commission: parsedCommission,
        is_settled: true,
      };
      await write("source_payments", "insert", newPayment);
      await write("sources", "update", { ...source, is_completed: true });
    }
  };

  const handlePrint = async () => {
    setIsGeneratingPdf(true);
    // Reset scale to 1 for accurate PDF rendering
    const prevScale = previewScale;
    setPreviewScale(1);
    
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
        setPreviewScale(prevScale);
        setIsGeneratingPdf(false);
      }
    }, 800);
  };

  return (
    <div className="bg-white border rounded-2xl p-5 mt-2 space-y-5 shadow-md border-zinc-200 animate-slideDown">
      <div className="flex justify-between items-center pb-3 border-b border-zinc-200">
        <div>
          <h3 className="font-bold text-zinc-950 text-xs flex items-center gap-1.5 uppercase">
            <Anchor className="w-4 h-4 text-indigo-600" />
            Payout Calculator for {source.name}
          </h3>
          <p className="text-[10px] text-zinc-500 mt-0.5">Adjust weights, fish names, and rates below. Discrepancies reduce net pay privately.</p>
        </div>
        <button
          type="button"
          onClick={handleAddCustomRow}
          className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold py-1.5 px-3 rounded-2xl flex items-center gap-1 text-[10px] border border-indigo-200 transition"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          Add Item line
        </button>
      </div>

      {/* Internal Reference and Editable fields of fishItems */}
      <div className="space-y-4">
        {fishItems.map((item, idx) => {
          const mWeight = parseFloat(item.payoutWeight) || 0;
          const mRate = parseFloat(item.payoutRatePerKg) || 0;
          const mValue = mWeight * mRate;

          return (
            <div key={item.id || idx} className="bg-zinc-50/70 border border-zinc-200 rounded-2xl p-3 text-xs relative space-y-2">
              <div className="flex justify-between items-center pb-2 border-b border-zinc-200/60 font-sans">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase">Fish details:</span>
                  <input
                    type="text"
                    value={item.fishType}
                    onChange={(e) => updateItem(idx, 'fishType', e.target.value)}
                    className="border border-zinc-300 bg-white rounded-2xl px-2.5 py-1 text-xs font-bold text-zinc-900 w-48 outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="e.g. Rohu Small"
                  />
                </div>
                {fishItems.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveRow(idx)}
                    className="text-rose-500 hover:text-rose-700 p-1 rounded-full hover:bg-rose-50 transition"
                    title="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Internal reference section (NOT printed) */}
                <div className="bg-zinc-100/50 p-2.5 rounded-xl border border-zinc-200 text-[10.5px] space-y-1">
                  <div className="text-[8.5px] font-black text-zinc-500 uppercase tracking-widest">
                    📊 Internal Trade Reference (Will NOT Print)
                  </div>
                  <div className="font-mono text-zinc-600 flex justify-between">
                    <span>Main trade weight:</span>
                    <span className="font-bold text-zinc-900">{item.actualWeight.toLocaleString()} kg</span>
                  </div>
                  <div className="font-mono text-zinc-600 flex justify-between">
                    <span>Mean auction rate:</span>
                    <span className="font-bold text-zinc-900">₹{item.meanPrice.toFixed(2)}/kg</span>
                  </div>
                  <div className="font-mono text-zinc-600 flex justify-between pt-0.5 border-t border-zinc-200/45">
                    <span>Actual sales value:</span>
                    <span className="font-bold text-teal-750">₹{item.actualRevenue.toLocaleString()}</span>
                  </div>
                </div>

                {/* 2. Custom Printable Section (User enters details manually) */}
                <div className="bg-white p-2.5 rounded-xl border border-zinc-200 space-y-2">
                  <div className="text-[8.5px] font-black text-indigo-700 uppercase tracking-widest">
                    ✏️ Print Settings (What gets printed)
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-[10.5px]">
                    <div className="flex flex-col gap-0.5">
                      <label className="text-zinc-500 font-medium">Weight (Kg):</label>
                      <input
                        type="number"
                        value={item.payoutWeight}
                        onChange={(e) => updateItem(idx, 'payoutWeight', e.target.value)}
                        className="border border-zinc-300 rounded-xl px-2 py-1 w-full text-right font-mono font-bold text-zinc-850"
                      />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <label className="text-zinc-500 font-medium font-sans">Price per KG (₹):</label>
                      <input
                        type="number"
                        value={item.payoutRatePerKg}
                        onChange={(e) => updateItem(idx, 'payoutRatePerKg', e.target.value)}
                        className="border border-zinc-300 rounded-xl px-2 py-1 w-full text-right font-mono font-bold text-zinc-850"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[11px] font-black text-zinc-900 border-t border-dashed border-zinc-200 pt-1.5">
                    <span>Calculated Value:</span>
                    <span className="font-mono text-indigo-950">₹{mValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Manual Settlement and Payout adjustment (100% and reduction) */}
      <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-2xl text-[11.5px] space-y-2.5">
        <div className="text-[9px] font-black text-indigo-805 uppercase tracking-wider border-b border-indigo-100 pb-1">
          Settlement Balance Dues
        </div>
        
        <div className="flex justify-between text-zinc-700">
          <span>Gross sales revenue (Total actual value):</span>
          <span className="font-mono font-medium">₹{totalActualRevenue.toLocaleString()}</span>
        </div>
        
        <div className="flex justify-between text-zinc-900 font-bold">
          <span>Total manual payout value (100% calculations):</span>
          <span className="font-mono">₹{totalPayoutGross.toLocaleString()}</span>
        </div>

        {/* Manual Commission Adjustment */}
        <div className="flex items-center justify-between border-t border-dashed border-indigo-150 pt-2 mt-1">
          <div className="flex flex-col">
            <span className="font-sans font-extrabold text-indigo-900">Manual Commission Deductions (₹):</span>
            <span className="text-[9px] text-zinc-500">Reduce this privately. It will not be printed on the invoice copy.</span>
          </div>
          <input
            type="number"
            value={manualCommission}
            onChange={(e) => setManualCommission(e.target.value)}
            className="border border-indigo-200 bg-white rounded-xl px-2.5 py-1 w-28 text-right font-mono font-extrabold text-zinc-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex justify-between text-emerald-800 text-[13px] font-black font-sans border-t border-indigo-100 pt-2.5 mt-2">
          <span>Final Net Paid to Source:</span>
          <span className="font-mono">₹{netPaidToSource.toLocaleString()}</span>
        </div>
      </div>

      {/* A4 Document Preview Section */}
      {source.is_completed && (
        <div className="mt-8 border-t border-zinc-200 pt-6 font-sans animate-fadeIn">
           <h4 className="font-bold text-zinc-700 text-sm mb-4 flex justify-between items-center">
              <span>📄 Print Preview (A4 Invoice Copy)</span>
           </h4>
           
           <div 
             id="payout-preview-parent"
             className="bg-zinc-200 p-4 rounded-2xl flex justify-center shadow-inner overflow-hidden items-start"
           >
             {/* A4 Aspect Ratio container (~210x297mm) */}
             <div 
               className="shrink-0 origin-top transition-transform duration-100"
               style={{
                 width: previewScale < 1 ? `${794 * previewScale}px` : '794px',
                 height: previewScale < 1 ? `${1123 * previewScale}px` : '1123px',
                 overflow: 'hidden'
               }}
             >
               <div 
                 id="print-sheet-canvas"
                 className="bg-white text-zinc-900 space-y-6 shrink-0 relative"
                 style={{ 
                   width: '794px', 
                   height: '1123px', 
                   padding: '48px',
                   boxSizing: 'border-box',
                   transform: `scale(${previewScale})`,
                   transformOrigin: 'top left'
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
           </div>
        </div>
      )}

          <div className="flex gap-2 justify-end pt-4">
        {!source.is_completed ? (
           <button 
             onClick={handleSettle}
             className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-2xl flex items-center justify-center gap-2 shadow-sm w-full sm:w-auto cursor-pointer"
           >
             <CheckCircle2 className="w-5 h-5" />
             Pay the sources
           </button>
         ) : (
           <div className="flex flex-col sm:flex-row gap-2 w-full justify-end">
             <button
               onClick={handleSettle}
               className="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold py-3 px-4 rounded-2xl flex items-center justify-center gap-2 shadow-sm cursor-pointer border border-emerald-300"
             >
               <CheckCircle2 className="w-5 h-5" />
               Update Payment
             </button>
             <button 
               onClick={handlePrint}
               className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-2xl flex items-center justify-center gap-2 shadow-sm cursor-pointer"
               disabled={isGeneratingPdf}
             >
               <FileText className="w-5 h-5" />
               {isGeneratingPdf ? "Building PDF..." : "Download or share the PDF"}
             </button>
           </div>
         )}
      </div>
    </div>
  );
};
