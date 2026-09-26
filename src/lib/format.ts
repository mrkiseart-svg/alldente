export const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
export const pct=(n:number)=>Math.min(100,Math.max(0,n));
