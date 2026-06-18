const fs = require('fs');
let code = fs.readFileSync('src/components/CollectPanel.tsx', 'utf8');

const importStr = "import { CashDenominator } from './CashDenominator';\n";
const firstImport = code.indexOf('import React');
code = code.slice(0, firstImport) + importStr + code.slice(firstImport);

const p1 = code.indexOf('Cash Register Denominators');
if (p1 !== -1) {
  const motionStart = code.lastIndexOf('<motion.div', p1);
  const motionEnd = code.indexOf('</motion.div>', p1) + '</motion.div>'.length;
  
  const replacement = "<CashDenominator notes500={notes500} setNotes500={setNotes500} notes200={notes200} setNotes200={setNotes200} notes100={notes100} setNotes100={setNotes100} notes50={notes50} setNotes50={setNotes50} notes20={notes20} setNotes20={setNotes20} notes10={notes10} setNotes10={setNotes10} calculatedCashTotal={calculatedCashTotal} handleApplyCashTotal={handleApplyCashTotal} onClose={() => setShowCashCalc(false)} />";

  code = code.slice(0, motionStart) + replacement + code.slice(motionEnd);
  fs.writeFileSync('src/components/CollectPanel.tsx', code);
  console.log("Success");
}
