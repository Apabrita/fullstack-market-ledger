/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion } from "motion/react";
import { useData } from "./DataContext";
import { User as DbUser } from "../db";
import {
  TrendingUp,
  Percent,
  Calculator,
  Calendar,
  Layers,
  Award,
  Landmark,
  ShieldCheck,
  PercentCircle,
  HelpCircle
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip
} from "recharts";

interface ProfitPanelProps {
  activeUser: DbUser | null;
  isAuthenticated: boolean;
}

export const ProfitPanel: React.FC<ProfitPanelProps> = ({
  activeUser,
  isAuthenticated,
}) => {
  const { data } = useData();

  // Sliding Profit Simulator States
  const [markupPercent, setMarkupPercent] = useState(5); // default standard 5% arat rate
  const [estimatedDailySales, setEstimatedDailySales] = useState(200000); // default monthly projected scale

  const buyers = data?.buyers || [];
  const sourcePayments = data?.source_payments || [];
  const transactions = data?.transactions || [];

  // Cumulative numbers
  const earnedCommission = sourcePayments.reduce((sum, p) => sum + (p.commission || 0), 0);
  const totalOutflowSettled = sourcePayments.reduce((sum, p) => sum + (p.amount_paid_to_source || 0), 0);
  const totalAratTurnover = sourcePayments.reduce((sum, p) => sum + (p.sale_total || 0), 0);

  // Simulated Projections calculations
  const dailyPro = (estimatedDailySales * markupPercent) / 100;
  const weeklyPro = dailyPro * 7;
  const monthlyPro = dailyPro * 30;

  // Species commission breakdown calculation
  const speciesMetrics = React.useMemo(() => {
    const map: { [key: string]: { weight: number, totalSale: number } } = {};
    transactions.forEach((t) => {
      const sp = t.fish_type || "Unsorted Lot";
      if (!map[sp]) map[sp] = { weight: 0, totalSale: 0 };
      map[sp].weight += t.weight || 0;
      map[sp].totalSale += t.total_price || 0;
    });
    return Object.entries(map).map(([name, val]) => ({
      name,
      weight: val.weight,
      totalSale: val.totalSale,
      estimatedCommission: Math.round(val.totalSale * 0.05) // Standard 5% commission rate
    })).sort((a, b) => b.totalSale - a.totalSale);
  }, [transactions]);

  // Pie chart data
  const pieData = [
    { name: "Outbound Settled (Trawlers)", value: totalOutflowSettled || 180000 },
    { name: "Arat Commissions Kept", value: earnedCommission || 9000 },
  ];
  const COLORS = ["#4f46e5", "#0d9488"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="space-y-6"
    >
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        <div className="bg-slate-950 border border-slate-850 p-4.5 rounded-2xl flex items-center justify-between">
          <div className="flex items-center space-x-3.5 font-sans">
            <div className="p-3 bg-teal-500/10 text-teal-400 rounded-xl">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
                আমাদের কমিশন • Net Commission Earnings
              </div>
              <div className="text-lg font-black font-mono text-teal-400 mt-0.5">
                ₹ {earnedCommission.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-850 p-4.5 rounded-2xl flex items-center justify-between">
          <div className="flex items-center space-x-3.5 font-sans">
            <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
                মোট মাছ বিক্রি • Total Fish Sold
              </div>
              <div className="text-lg font-black font-mono text-indigo-300 mt-0.5">
                ₹ {totalAratTurnover.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-850 p-4.5 rounded-2xl flex items-center justify-between">
          <div className="flex items-center space-x-3.5 font-sans">
            <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
                ক্রেতার কাছে বাকি • Amount Buyers Owe Us
              </div>
              <div className="text-lg font-black font-mono text-purple-400 mt-0.5">
                ₹ {buyers.reduce((sum, b) => sum + (b.lifetime_debt || 0), 0).toLocaleString()}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Analytics chart and Realized Splits */}
      <div className="bg-slate-950 border border-slate-850 rounded-2xl p-5 shadow-xl space-y-4 max-w-3xl mx-auto">
        <div className="border-b border-slate-850 pb-3">
          <h3 className="text-xs font-sans font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <PercentCircle className="w-4.5 h-4.5 text-teal-400" /> পয়সা বণ্টন • Money Division Split
          </h3>
          <p className="text-[10px] text-slate-505 text-slate-500">Your commissions versus trawler payments ratio</p>
        </div>

        {totalAratTurnover === 0 ? (
          <div className="h-52 flex flex-col items-center justify-center text-slate-600 text-xs text-center border border-dashed border-slate-850 rounded-xl">
            No closed payments registered for harbor trawlers yet.
          </div>
        ) : (
          <div className="h-56 mt-2 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#020617",
                    borderColor: "#1e293b",
                    borderRadius: "10px",
                    color: "#f8fafc",
                    fontSize: "11px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Distribution legend */}
        <div className="pt-4 border-t border-slate-850 grid grid-cols-2 gap-4 text-xs font-sans">
          <div className="flex items-center gap-2 bg-indigo-950/20 border border-indigo-900/10 p-2.5 rounded-xl">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 shrink-0"></span>
            <div>
              <span className="text-[10px] text-slate-500 block">Paid to Trawlers</span>
              <span className="text-slate-200 font-bold font-mono">₹{totalOutflowSettled.toLocaleString()}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-teal-950/20 border border-teal-900/10 p-2.5 rounded-xl">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-500 shrink-0"></span>
            <div>
              <span className="text-[10px] text-slate-500 block">Our Commission</span>
              <span className="text-teal-400 font-bold font-mono">₹{earnedCommission.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Sliding Commission Projections Simulator */}
      <div className="bg-slate-950 border border-slate-850 rounded-2xl p-5 shadow-xl space-y-4 max-w-3xl mx-auto">
        <div className="border-b border-slate-850 pb-3">
          <h3 className="text-xs font-sans font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <Calculator className="w-4.5 h-4.5 text-teal-400" /> কমিশন এবং মুনাফা পরিমাপক • Markup Simulator Projections
          </h3>
          <p className="text-[10px] text-slate-505 text-slate-500">Simulate earnings based on customizable commission rate and daily sales volume</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* Sliders Input */}
          <div className="space-y-4 font-sans">
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold text-slate-300">
                <span>Standard Commission Rate</span>
                <span className="text-teal-405 text-teal-400 font-mono">{markupPercent}%</span>
              </div>
              <input
                type="range"
                min="1"
                max="15"
                step="0.5"
                value={markupPercent}
                onChange={(e) => setMarkupPercent(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-teal-500"
              />
              <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                <span>1% Mini</span>
                <span>5% Standard</span>
                <span>15% Max</span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold text-slate-300">
                <span>Projected Daily Sales Volume</span>
                <span className="text-indigo-405 text-indigo-400 font-mono">₹{estimatedDailySales.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min="10000"
                max="1000000"
                step="10000"
                value={estimatedDailySales}
                onChange={(e) => setEstimatedDailySales(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-indigo-505 accent-indigo-500"
              />
              <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                <span>₹10,000</span>
                <span>₹2,00,000 Avg</span>
                <span>₹10,00,000 High</span>
              </div>
            </div>
          </div>

          {/* Results Indicators */}
          <div className="grid grid-cols-3 gap-2.5 font-mono text-center">
            <div className="bg-slate-900/60 border border-slate-800 p-2.5 rounded-xl flex flex-col justify-between">
              <span className="text-[8.5px] uppercase font-sans font-extrabold text-slate-500">Daily Pro</span>
              <span className="text-xs font-black text-teal-400 block mt-1.5">₹{dailyPro.toLocaleString()}</span>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 p-2.5 rounded-xl flex flex-col justify-between">
              <span className="text-[8.5px] uppercase font-sans font-extrabold text-slate-500">Weekly Pro</span>
              <span className="text-xs font-black text-teal-400 block mt-1.5 font-mono">₹{weeklyPro.toLocaleString()}</span>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 p-2.5 rounded-xl flex flex-col justify-between font-bold">
              <span className="text-[8.5px] uppercase font-sans font-extrabold text-slate-500">Monthly Pro</span>
              <span className="text-xs font-black text-teal-400 block mt-1.5 font-mono">₹{monthlyPro.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Species Commission Analytics Breakdown */}
      <div className="bg-slate-950 border border-slate-850 rounded-2xl p-5 shadow-xl space-y-4 max-w-3xl mx-auto">
        <div className="border-b border-slate-850 pb-3 flex justify-between items-center">
          <div>
            <h3 className="text-xs font-sans font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Layers className="w-4.5 h-4.5 text-teal-400" /> মাছের জাত ভিত্তিক পরিসংখ্যান • Species Commission Ledger
            </h3>
            <p className="text-[10px] text-slate-505 text-slate-500">Total sale volume and relative commissions generated grouped by fish type</p>
          </div>
          <span className="text-[9px] font-mono bg-slate-950/20 text-slate-400 border border-slate-850 px-2 py-0.5 rounded font-sans">
            {speciesMetrics.length} Categories
          </span>
        </div>

        {speciesMetrics.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs font-sans font-mono border border-dashed border-slate-800 rounded-xl">
            Register transaction auctions to populate group analytics.
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-none">
            <table className="w-full text-xs text-left text-slate-300 font-sans">
              <thead className="text-[9px] text-slate-500 uppercase tracking-wider border-b border-slate-850">
                <tr>
                  <th scope="col" className="pb-2 font-black">Species Type</th>
                  <th scope="col" className="pb-2 text-center font-black">Sold Weight (kg)</th>
                  <th scope="col" className="pb-2 text-right font-black">Gross Sales (₹)</th>
                  <th scope="col" className="pb-2 text-right font-black">Commission Cut (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 font-mono">
                {speciesMetrics.map((sm) => (
                  <tr key={sm.name} className="hover:bg-slate-900/50">
                    <td className="py-2.5 font-sans font-bold text-slate-200 capitalize">{sm.name}</td>
                    <td className="py-2.5 text-center font-bold text-slate-400">{sm.weight.toLocaleString()} kg</td>
                    <td className="py-2.5 text-right font-bold text-slate-200 font-mono">₹{sm.totalSale.toLocaleString()}</td>
                    <td className="py-2.5 text-right font-black text-teal-400 font-mono">₹{sm.estimatedCommission.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="p-4.5 bg-slate-950 rounded-2xl border border-slate-850 text-[10.5px] leading-relaxed text-slate-505 text-slate-500">
        💡 <strong>Arat Ledger Rules</strong>: Under the standard Fish Arat (Halkhata Ledger) legal parameters in India, commissions are derived as an administrative fee deducted directly from the gross sale payout due back to the sea-faring Trawler before final settlement dispatch. Real-time logging enforces correct deductions in our durable cloud system.
      </div>

    </motion.div>
  );
};
