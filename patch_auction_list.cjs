const fs = require('fs');

let code = fs.readFileSync('src/components/AuctionTxnList.tsx', 'utf8');

code = code.replace(
  /return t\.buyer_id; \/\/ Will patch this!/,
  `const bObj = buyers.find((b: any) => String(b.id) === String(t.buyer_id)); return bObj ? bObj.nickname : t.buyer_id;`
);

code = code.replace(
  /interface AuctionTxnListProps \{/,
  `interface AuctionTxnListProps {\n  buyers: any[];`
);

code = code.replace(
  /export const AuctionTxnList: React.FC<AuctionTxnListProps> = \(\{/,
  `export const AuctionTxnList: React.FC<AuctionTxnListProps> = ({\n  buyers,`
);

fs.writeFileSync('src/components/AuctionTxnList.tsx', code);
console.log("Patched AuctionTxnList.tsx");
