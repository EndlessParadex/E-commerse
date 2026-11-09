// Paper sizes for printed invoices and packing lists. Each print view renders one small
// <style> with its @page rule, because CSS cannot switch @page by class. The server allows
// exactly these styles in its Content-Security-Policy by hashing printPageCss() for every
// format below, so a format added or changed here stays allowed without editing the policy.

export const INVOICE_PAPER = {
  a4: { size: '210mm 297mm', margin: '16mm' },
  dotMatrix: { size: '241.3mm 279.4mm', margin: '8mm 12.7mm' },
};

export const PACKING_PAPER = {
  a4: { label: 'A4', size: '210mm 297mm', margin: '10mm' },
  continuousHalf: {
    label: 'Dot matrix · 9,5 × 5,5 inci',
    size: '241.3mm 139.7mm',
    margin: '8mm 12.7mm',
  },
  continuousFull: {
    label: 'Dot matrix · 9,5 × 11 inci',
    size: '241.3mm 279.4mm',
    margin: '8mm 12.7mm',
  },
};

export const printPageCss = (paper) =>
  `@media print { @page { size: ${paper.size}; margin: ${paper.margin}; } }`;

/** Every print style the site can render, for the CSP hash list. */
export const allPrintPageCss = () => [
  ...new Set([...Object.values(INVOICE_PAPER), ...Object.values(PACKING_PAPER)].map(printPageCss)),
];
