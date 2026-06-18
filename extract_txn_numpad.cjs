const fs = require('fs');
let code = fs.readFileSync('src/components/TransactionPanel.tsx', 'utf8');

const importStr = "import { TransactionNumpad } from './TransactionNumpad';\n";
const firstImport = code.indexOf('import React');
code = code.slice(0, firstImport) + importStr + code.slice(firstImport);

const sIdx = code.indexOf('{/* Highly tactile specialized mobile numpad layout */}');
if (sIdx !== -1) {
  const pStart = code.indexOf('{!isNumpadDown', sIdx);
  const pEnd = code.indexOf(')}', code.indexOf('</motion.button>', pStart)) + 2; 

  const replacement = `
            <TransactionNumpad 
              isNumpadDown={isNumpadDown}
              field={field}
              isSuccessAnimated={isSuccessAnimated}
              onKeyTap={handleKeyTap}
            />`;
  
  code = code.slice(0, pStart) + replacement + code.slice(pEnd);
  fs.writeFileSync('src/components/TransactionPanel.tsx', code);
  console.log("Success");
} else {
  console.log("Could not find numpad marker");
}
