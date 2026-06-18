const fs = require('fs');
let file = fs.readFileSync('src/components/DashboardPanel.tsx', 'utf8');

const regex = /<AnimatePresence>\s*\{\s*showPrintView && <PdfExportView onClose=\{\(\) => setShowPrintView\(false\)\} defaultTab=\{activePdfTab\} \/>\s*\}/;
file = file.replace(regex, `{showPrintView && <PdfExportView onClose={() => setShowPrintView(false)} defaultTab={activePdfTab} />}`);

file = file.replace(/<\/div>\n  \);\n\};\n$/m, "{showAI && <DashboardAI transactions={data?.transactions || []} onClose={() => setShowAI(false)} />}\n      </div>\n  );\n};\n");

// Is there a <motion.div> replacing the </div>?
file = file.replace(/<\/motion\.div>\n  \);\n\};\n$/, "{showAI && <DashboardAI transactions={data?.transactions || []} onClose={() => setShowAI(false)} />}\n      </motion.div>\n  );\n};\n");

fs.writeFileSync('src/components/DashboardPanel.tsx', file);
console.log("Fixed Dashboard");
