const fs = require('fs');
let code = fs.readFileSync('src/components/AuctionTxnList.tsx', 'utf8');
const original = "width: \\`\\${bgIntensity}%\\`";
const fixed = "width: `${bgIntensity}%`";
code = code.replace("width: \\`\\${bgIntensity}%\\`", fixed);
fs.writeFileSync('src/components/AuctionTxnList.tsx', code);
