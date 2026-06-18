const fs = require('fs');

let file = fs.readFileSync('src/components/DashboardPanel.tsx', 'utf8');

file = file.replace(
  /<span className="text-\[8\.5px\] text-zinc-500 font-extrabold uppercase font-sans tracking-wide">Arat Agency Fee \(5\%\)<\/span>\s*<div className="text-xs font-black text-zinc-950 font-mono">₹\{Math.round\(totalSalesVolume \* 0\.05\)\.toLocaleString\(\)\}<\/div>\s*<\/div>\s*<div className="border border-zinc-300 p-2 rounded-2xl bg-zinc-50\/50">\s*<span className="text-\[8\.5px\] text-zinc-500 font-extrabold uppercase font-sans tracking-wide">Net Payout Scheduled<\/span>\s*<div className="text-xs font-black text-zinc-950 font-mono font-bold text-indigo-700">₹\{Math.round\(totalSalesVolume \* 0\.95\)\.toLocaleString\(\)\}<\/div>\s*<\/div>/g,
  `<span className="text-[8.5px] text-zinc-500 font-extrabold uppercase font-sans tracking-wide">Arat Agency Fee</span>
                        <div className="text-xs font-black text-zinc-950 font-mono">₹{totalCommissions.toLocaleString()}</div>
                      </div>
                      <div className="border border-zinc-300 p-2 rounded-2xl bg-zinc-50/50">
                        <span className="text-[8.5px] text-zinc-500 font-extrabold uppercase font-sans tracking-wide">Net Payout Scheduled</span>
                        <div className="text-xs font-black text-zinc-950 font-mono font-bold text-indigo-700">₹{(totalSalesVolume - totalCommissions).toLocaleString()}</div>
                      </div>`
);

// Also fix the text in the description
file = file.replace(
  /and the net payout allocated to the source after the standard 5% agency commission/g,
  "and the net payout allocated to the source after agency commission"
);


let newSrcLogic = `const pmt = sourcePayments.find(p => p.source_id === src.id);\n                        const srcComm = pmt ? pmt.commission : 0;\n                        const srcGrossCalculated = pmt && typeof pmt.sale_total !== 'undefined' ? pmt.sale_total : srcGross;\n                        const srcNet = pmt && typeof pmt.amount_paid_to_source !== 'undefined' ? pmt.amount_paid_to_source : srcGross;`;

file = file.replace(
  /const srcComm = srcGross \* 0\.05;\s*const srcNet = srcGross - srcComm;/g,
  newSrcLogic
);

const theadOld = `<tr className="border-b border-zinc-300 text-zinc-500 font-bold font-mono uppercase text-[8.5px]">
                                  <th className="py-1">Trade Weight</th>
                                  <th className="py-1 text-center">Auction Rate</th>
                                  <th className="py-1 text-center">Sale Value</th>
                                  <th className="py-1 text-right">Payout Given</th>
                                </tr>`;

const theadNew = `<tr className="border-b border-zinc-300 text-zinc-500 font-bold font-mono uppercase text-[8.5px]">
                                  <th className="py-1">Trade Weight</th>
                                  <th className="py-1 text-center">Auction Rate</th>
                                  <th className="py-1 text-right">Sale Value</th>
                                </tr>`;

file = file.replace(theadOld, theadNew);

file = file.replace(
  /const commVal = t\.total_price \* 0\.05;\s*const netVal = t\.total_price - commVal;/g,
  `// no individual netval`
);

file = file.replace(
  /<td className="py-1.5 text-right font-bold text-zinc-950">₹\{Math\.round\(netVal\)\.toLocaleString\(\)\}<\/td>/g,
  ''
);

file = file.replace(
  /<td className="py-1.5 text-right font-bold text-zinc-600">₹\{Math\.round\(crateTxs\.reduce\(\(sum, t\) => sum \+ \(t\.total_price \* 0\.95\), 0\)\)\.toLocaleString\(\)\}<\/td>/g,
  ''
);

const emptySourceTheadOld = `<tr className="border-b border-zinc-300 text-zinc-500 font-bold font-mono uppercase text-[8.5px]">
                                <th className="py-1">Fish Type / Purpose</th>
                                <th className="py-1 text-center">Trade Weight</th>
                                <th className="py-1 text-center">Auction Rate</th>
                                <th className="py-1 text-center">Sale Value</th>
                                <th className="py-1 text-right">Payout Given</th>
                              </tr>`;
const emptySourceTheadNew = `<tr className="border-b border-zinc-300 text-zinc-500 font-bold font-mono uppercase text-[8.5px]">
                                <th className="py-1">Fish Type / Purpose</th>
                                <th className="py-1 text-center">Trade Weight</th>
                                <th className="py-1 text-center">Auction Rate</th>
                                <th className="py-1 text-right">Sale Value</th>
                              </tr>`;
file = file.replace(emptySourceTheadOld, emptySourceTheadNew);

file = file.replace(/<td className="py-1.5 text-center">₹\{Math.round\(t.total_price\).toLocaleString\(\)\}<\/td>/g, '<td className="py-1.5 text-right">₹{Math.round(t.total_price).toLocaleString()}</td>');

file = file.replace(/<td className="py-1.5 text-center font-bold text-zinc-600">₹\{Math.round\(crateTxs/g, '<td className="py-1.5 text-right font-bold text-zinc-600">₹{Math.round(crateTxs');

fs.writeFileSync('src/components/DashboardPanel.tsx', file);
console.log("Success fix PDF");
