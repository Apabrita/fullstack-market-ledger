const fs = require('fs');

let file = fs.readFileSync('src/components/PdfExportView.tsx', 'utf8');

const oldList = `const buyerBalancesList = buyers.map((b: any) => {
    const bTxns = transactions.filter((t: any) => t.buyer_id === b.id);
    const bCols = collections.filter((c: any) => c.buyer_id === b.id && c.is_approved);
    
    const freshPurchases = bTxns.reduce((sum: number, tx: any) => sum + (tx.total_price || 0), 0);
    const freshPayments = bCols.reduce((sum: number, c: any) => sum + (c.amount_paid || 0), 0);
    const initialDebt = b.lifetime_debt - freshPurchases + freshPayments;

    return {
      name: b.nickname,
      initialDebt,
      newPurchases: freshPurchases,
      newPayments: freshPayments,
      closingDebt: b.lifetime_debt
    };
  }).filter((x: any) => x.newPurchases > 0 || x.newPayments > 0 || x.closingDebt > 0);

  if (activePdfTab === "collection_slip" && slipCategory === "buyers") {
      buyerBalancesList.sort((a,b) => b.closingDebt - a.closingDebt);
  }`;

const newList = `const buyerBalancesList = buyers.map((b: any) => {
    const bTxList = transactions.filter((tx: any) => String(tx.buyer_id) === String(b.id));
    const todayPurchases = bTxList.reduce((sum: number, tx: any) => sum + (tx.total_price || 0), 0);
    const todayWeight = bTxList.reduce((sum: number, tx: any) => sum + (tx.weight || 0), 0);
    
    const bColList = collections.filter((col: any) => String(col.buyer_id) === String(b.id));
    const todayPaid = bColList.reduce((sum: number, col: any) => sum + (col.amount_paid || 0), 0);
    const approvedCash = bColList.filter((col: any) => col.is_approved).reduce((sum: number, col: any) => sum + (col.amount_paid || 0), 0);
    const pendingCash = bColList.filter((col: any) => !col.is_approved).reduce((sum: number, col: any) => sum + (col.amount_paid || 0), 0);
    
    // Previous balance before today's shift starts
    const prevRollover = Math.max(0, b.lifetime_debt - todayPurchases + todayPaid);
    
    return {
      buyer: b,
      prevRollover,
      todayPurchases,
      todayWeight,
      todayPaid,
      approvedCash,
      pendingCash,
      currentBalance: b.lifetime_debt
    };
  });`;

file = file.replace(oldList, newList);

// Fix imports: Add X, Share2, Printer
const importReactRegex = /import \{ Share, Download, LogOut, CheckCircle, FileText, ArrowRight \} from 'lucide-react';/;
file = file.replace(importReactRegex, `import { Share, Download, LogOut, CheckCircle, FileText, ArrowRight, X, Share2, Printer } from 'lucide-react';`);

// Fix state
const stateBlockRegex = /const \[selectedAuctioneerFilter, setSelectedAuctioneerFilter\] = React.useState<string>\("All"\);/;
file = file.replace(stateBlockRegex, `const [selectedAuctioneerFilter, setSelectedAuctioneerFilter] = React.useState<string>("All");\n  const [scaleFactor, setScaleFactor] = React.useState(1);`);

// Fix setShowPrintView to onClose
file = file.replace(/setShowPrintView\(false\)/g, "onClose()");

// Fix activeUser
file = file.replace(/activeUser/g, "(data as any)?.activeUser");

fs.writeFileSync('src/components/PdfExportView.tsx', file);
console.log("Fixed PdfExportView.tsx");
