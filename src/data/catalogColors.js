export const catalogColors = [
  { id: 'sky', name: 'Biru', tint: '#f0f9ff', ink: '#075985', border: '#bae6fd', from: '#bae6fd', to: '#38bdf8' },
  { id: 'violet', name: 'Ungu', tint: '#f5f3ff', ink: '#5b21b6', border: '#ddd6fe', from: '#ddd6fe', to: '#a78bfa' },
  { id: 'lilac', name: 'Ungu muda', tint: '#faf5ff', ink: '#6b21a8', border: '#e9d5ff', from: '#e9d5ff', to: '#c084fc' },
  { id: 'amber', name: 'Kuning', tint: '#fffbeb', ink: '#92400e', border: '#fde68a', from: '#fde68a', to: '#f59e0b' },
  { id: 'mint', name: 'Hijau', tint: '#f0fdfa', ink: '#115e59', border: '#99f6e4', from: '#a7f3d0', to: '#2dd4bf' },
  { id: 'rose', name: 'Merah muda', tint: '#fdf2f8', ink: '#9d174d', border: '#fbcfe8', from: '#fbcfe8', to: '#f472b6' },
  { id: 'coral', name: 'Koral', tint: '#fff1f2', ink: '#9f1239', border: '#fecdd3', from: '#fecdd3', to: '#fb7185' },
  { id: 'red', name: 'Merah', tint: '#fef2f2', ink: '#991b1b', border: '#fecaca', from: '#fecaca', to: '#ef4444' },
  { id: 'sand', name: 'Oranye', tint: '#fff7ed', ink: '#9a3412', border: '#fed7aa', from: '#fed7aa', to: '#fb923c' },
  { id: 'brown', name: 'Cokelat', tint: '#faf4ed', ink: '#704321', border: '#e2c9af', from: '#d6b38a', to: '#8b5e34' },
];
export const validCatalogColor = (id) => catalogColors.some((color) => color.id === id);
export const catalogColor = (id) => catalogColors.find((color) => color.id === id) || catalogColors[0];
export const productColorStyle = (id) => { const color = catalogColor(id); return { background: `linear-gradient(145deg, ${color.from}, ${color.to})` }; };
export const supplierColorStyle = (id) => {
  const color = catalogColor(id);
  return {
    background: `var(--catalog-tint-${color.id}, ${color.tint})`,
    borderColor: `var(--catalog-border-${color.id}, ${color.border})`,
    '--color-text-muted': 'var(--color-text-secondary)',
  };
};
export const avatarColorStyle = (id) => { const color = catalogColor(id); return { background: color.border, color: color.ink }; };
