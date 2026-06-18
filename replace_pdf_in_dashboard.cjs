const fs = require('fs');
let file = fs.readFileSync('src/components/DashboardPanel.tsx', 'utf8');

// Add import
const importStr = `import { PdfExportView } from "./PdfExportView";\n`;
const firstImport = file.indexOf('import React from "react";');
file = file.slice(0, firstImport) + importStr + file.slice(firstImport);

// Replace the huge `{showPrintView && (` block with `<PdfExportView onClose={() => setShowPrintView(false)} defaultTab={activePdfTab} />`
const startStr = '{showPrintView && (';
const endStr = '</AnimatePresence>';

const sIdx = file.indexOf(startStr);
const endIdx = file.lastIndexOf(endStr);

if (sIdx !== -1 && endIdx !== -1) {
    const p1 = file.slice(0, sIdx);
    const p2 = file.slice(endIdx + endStr.length);
    file = p1 + '{showPrintView && <PdfExportView onClose={() => setShowPrintView(false)} defaultTab={activePdfTab} />}\n' + p2;
    fs.writeFileSync('src/components/DashboardPanel.tsx', file);
    console.log("Successfully extracted and replaced Pdf export view");
} else {
    console.log("Could not find boundaries", sIdx, endIdx);
}
