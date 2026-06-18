const fs = require('fs');

let file = fs.readFileSync('src/components/DashboardPanel.tsx', 'utf8');

const calcPos = file.indexOf('const totalCommissions = sourcePayments.reduce((sum, p) => sum + (p.commission || 0), 0);');

file = file.slice(0, calcPos) + 
`const totalCommissions = sourcePayments.reduce((sum, p) => sum + (p.commission || 0), 0);\n  const totalProfit = sourcePayments.reduce((sum, p) => sum + ((p.sale_total || 0) - (p.amount_paid_to_source || 0)), 0);` + 
file.slice(calcPos + 'const totalCommissions = sourcePayments.reduce((sum, p) => sum + (p.commission || 0), 0);'.length);

file = file.replace(/Commissions Profit/g, 'Net Realized Profit');
file = file.replace(/₹ \{totalCommissions\.toLocaleString\(\)\}/g, '₹ {totalProfit.toLocaleString()}');

file = file.replace(/From settled sources \(5% arat rate\)/g, 'Trade margins & collected commission');

file = file.replace(/Net Commissions \(Profit\)/g, 'Net Full Profit');

file = file.replace(/<div className="text-xl font-bold font-mono text-indigo-700 block">₹\{totalCommissions\.toLocaleString\(\)\}<\/div>/g, '<div className="text-xl font-bold font-mono text-indigo-700 block">₹{totalProfit.toLocaleString()}</div>');

fs.writeFileSync('src/components/DashboardPanel.tsx', file);
console.log("Success fix profit");
