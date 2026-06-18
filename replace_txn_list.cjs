const fs = require('fs');
let file = fs.readFileSync('src/components/TransactionPanel.tsx', 'utf8');

// Add import
const importStr = `import { AuctionTxnList } from "./AuctionTxnList";\n`;
const firstImport = file.indexOf('import React, { useState, useEffect } from "react";');
file = file.slice(0, firstImport) + importStr + file.slice(firstImport);

// The block to replace:
// It starts with `{/* Empty placeholder if no recorded logs */}` or `{activeTxns.filter(t => !t.device_id || t.device_id === getDeviceId()).length === 0 && (`
// And ends with `</div>` before `{/* 3. Static Tactile POS Entry Drawer */}`

const startStr = '{/* Empty placeholder if no recorded logs */}';
const endStr = '{/* 3. Static Tactile POS Entry Drawer */}';

const sIdx = file.indexOf(startStr);
const endIdx = file.indexOf(endStr);

if (sIdx !== -1 && endIdx !== -1) {
    // We have to walk back to the parent div or just replace everything inside the parent div
    // Let's replace the whole parent div content:
    // It is `          <div className="flex-grow overflow-y-auto p-4 space-y-4">`
    const parentDivStr = '<div className="flex-grow overflow-y-auto p-4 space-y-4">';
    const parentIdx = file.lastIndexOf(parentDivStr, sIdx);
    
    // now we need to replace from `parentIdx + parentDivStr.length` up to `</div>\n\n          {/* 3. Static Tactile POS Entry Drawer */}`
    const p1 = file.slice(0, parentIdx + parentDivStr.length);
    
    // Find the closing div of the parent
    const lastClosingDiv = file.lastIndexOf('</div>', endIdx);
    
    const p2 = file.slice(lastClosingDiv);
    
    const replacement = `
            <AuctionTxnList 
              activeTxns={activeTxns} 
              deviceId={getDeviceId()} 
              expandFishType={expandFishType} 
              canEdit={canEdit} 
              onEdit={setEditTxn} 
              buyers={store.buyers}
            />
    `;
    
    file = p1 + replacement + p2;
    fs.writeFileSync('src/components/TransactionPanel.tsx', file);
    console.log("Successfully extracted transaction list");
} else {
    console.log("Could not find boundaries", sIdx, endIdx);
}
