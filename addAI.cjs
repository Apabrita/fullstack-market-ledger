const fs = require('fs');
let file = fs.readFileSync('src/components/DashboardPanel.tsx', 'utf8');

const importStr = `import { DashboardAI } from "./DashboardAI";\nimport { Brain } from "lucide-react";\n`;
const firstImport = file.indexOf('import React from "react";');
file = file.slice(0, firstImport) + importStr + file.slice(firstImport);

const statePosition = file.indexOf('const [leaderboardTime, setLeaderboardTime] = React.useState<"daily" | "weekly" | "monthly">("daily");');
file = file.slice(0, statePosition) + 
`const [showAI, setShowAI] = React.useState(false);\n  ` + 
file.slice(statePosition);

const btnAnchor = '<span>Export PDF / Print Records</span>\n            </button>';
const buttonStr = `\n            <button
              onClick={() => setShowAI(true)}
              className="px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 font-extrabold rounded-2xl text-[11px] tracking-wider uppercase transition flex items-center gap-1.5 shrink-0"
            >
              <Brain className="w-3.5 h-3.5" />
              AI Insights
            </button>`;

const btnIdx = file.indexOf(btnAnchor);
if (btnIdx !== -1) {
  file = file.slice(0, btnIdx + btnAnchor.length) + buttonStr + file.slice(btnIdx + btnAnchor.length);
} else {
  console.error("btnAnchor not found");
  process.exit(1);
}

// Add closing AnimatePresence
const returnEnd = file.indexOf('</AnimatePresence>\n    </div>');
// Wait, sometimes it's </AnimatePresence> or }
const finalDiv = file.lastIndexOf('  );\n};\n');
if (finalDiv !== -1) {
  // Let's just put it before the last `</div>`
  const lastDiv = file.lastIndexOf('</div>', finalDiv);
  file = file.slice(0, lastDiv) + 
    `{showAI && <DashboardAI transactions={data?.transactions || []} onClose={() => setShowAI(false)} />}\n      ` + 
    file.slice(lastDiv);
} else {
  console.error("end not found");
  process.exit(1);
}

fs.writeFileSync('src/components/DashboardPanel.tsx', file);
console.log("Success");
