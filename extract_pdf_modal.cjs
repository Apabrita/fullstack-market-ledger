const fs = require('fs');

const file = fs.readFileSync('src/components/DashboardPanel.tsx', 'utf8');

const startStr = '{showPrintView && (';
const endStr = '</AnimatePresence>';

const sIdx = file.indexOf(startStr);
const endIdx = file.lastIndexOf(endStr);

if (sIdx !== -1 && endIdx !== -1) {
    const extracted = file.slice(sIdx, endIdx);
    fs.writeFileSync('extracted_pdf.txt', extracted);
    console.log("Extracted code to extracted_pdf.txt");
} else {
    console.log("Not found", sIdx, endIdx);
}
