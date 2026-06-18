import React, { useState } from "react";
import { Sparkles, Loader, X, Brain, RefreshCcw } from "lucide-react";

interface DashboardAIProps {
  transactions: any[];
  onClose: () => void;
}

export const DashboardAI: React.FC<DashboardAIProps> = ({ transactions, onClose }) => {
  const [analyzing, setAnalyzing] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      const summary = transactions.map(t => `${t.fish_type} | ${t.weight}kg | ₹${t.price_per_kg}/kg`).join('\n').slice(0, 3000);
      
      const res = await fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: `Analyze these recent wholesale fish sales from today and predict future demand/pricing trends for tomorrow:\n${summary}` })
      });
      
      const data = await res.json();
      if (res.ok) {
        setInsight(data.text);
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError("Failed to connect to AI Analytics server.");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="inset-0 absolute bg-zinc-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-scaleUp text-left">
        <div className="px-5 py-4 bg-gradient-to-b from-indigo-950 to-zinc-900 border-b border-zinc-800 flex justify-between items-center select-none">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-500/20 rounded-lg">
              <Brain className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm uppercase text-zinc-200 tracking-wider">Deep Learning Engine</h3>
              <p className="text-[10px] text-indigo-300/70">Predictive Market Insights via Gemini AI</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[11px] font-mono font-bold bg-zinc-950 border border-zinc-800 px-2 py-1 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-2xl cursor-pointer"
          >
            ✕ CLOSE
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {!insight && !analyzing && !error && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-indigo-500/10 border border-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-indigo-400" />
              </div>
              <h4 className="text-sm font-bold text-zinc-200 mb-2">Ready to Analyze Market Data</h4>
              <p className="text-xs text-zinc-500 mb-6 max-w-xs mx-auto">
                Generate predictions for tomorrow's optimal fish variants and expected rate trends based on today's auction performance.
              </p>
              <button
                onClick={fetchInsights}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-2xl text-xs uppercase tracking-wider flex items-center gap-2 mx-auto transition-colors shadow-lg shadow-indigo-500/20"
              >
                <Brain className="w-4 h-4" />
                Run Analysis Model
              </button>
            </div>
          )}

          {analyzing && (
            <div className="text-center py-12 flex flex-col items-center justify-center space-y-4">
              <Loader className="w-8 h-8 text-indigo-400 animate-spin" />
              <div className="text-xs font-bold text-indigo-300 animate-pulse tracking-widest uppercase">Processing Neural Network...</div>
            </div>
          )}

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 p-4 rounded-2xl text-rose-400 text-xs text-center font-medium">
              {error}
            </div>
          )}

          {insight && !analyzing && (
            <div className="bg-zinc-950/50 border border-zinc-800 rounded-2xl p-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 opacity-10">
                <Brain className="w-24 h-24 text-indigo-400" />
              </div>
              <div className="relative z-10 prose prose-invert prose-sm max-w-none">
                <div className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed">{insight}</div>
              </div>
              
              <div className="mt-6 flex justify-center">
                <button
                  onClick={fetchInsights}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-full text-[10px] font-bold tracking-wider uppercase transition flex items-center gap-1.5"
                >
                  <RefreshCcw className="w-3 h-3" />
                  Rerun Model
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
