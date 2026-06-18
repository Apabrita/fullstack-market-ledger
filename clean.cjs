const fs = require('fs');
const content = fs.readFileSync('src/components/TransactionPanel.tsx', 'utf8');

const importIdx = content.indexOf('import { BuyerPicker } from "./BuyerPicker";');
const newContent1 = content.slice(0, importIdx) + 'import { BuyerPicker } from "./BuyerPicker";\nimport { EditTxnModal } from "./EditTxnModal";\n' + content.slice(importIdx + 'import { BuyerPicker } from "./BuyerPicker";'.length);

const idx1 = newContent1.indexOf('// ─────────────────────────────────────────────────────────────────────────────\n// BUYER PICKER DRAWER COMPONENT');
if(idx1 === -1) {
    console.error("Could not find start of Buyer Picker");
    process.exit(1);
}

const finalContent = newContent1.slice(0, idx1);
fs.writeFileSync('src/components/TransactionPanel.tsx', finalContent);
console.log("Success");
