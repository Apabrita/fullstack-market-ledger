export const formatCurrency = (amount: number): string => "₹" + Math.round(amount || 0).toLocaleString('en-IN');
export const formatKg = (weight: number): string => (weight || 0).toFixed(1) + " kg";
export const parseCleanNumber = (val: string | number): number => {
    if (typeof val === 'number') return val;
    return parseFloat(val.replace(/[^\d.]/g, '')) || 0;
};
