const fs = require('fs');
let code = fs.readFileSync('src/components/TransactionPanel.tsx', 'utf8');
code = code.replace(/canEdit=\{canEdit\}/, 'canEdit={canWrite}');
fs.writeFileSync('src/components/TransactionPanel.tsx', code);
