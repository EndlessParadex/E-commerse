export const ORDER_STAGES = [
  { id: 'processing', label: 'Diproses', description: 'Pesanan sedang disiapkan oleh toko.' },
  { id: 'shipped', label: 'Dikirim', description: 'Pesanan dalam perjalanan menuju alamat penerima.' },
  { id: 'completed', label: 'Selesai', description: 'Pesanan telah diterima oleh pembeli.' },
];

export function trackingSteps(status = 'processing') {
  const index = Math.max(0, ORDER_STAGES.findIndex((stage) => stage.id === status));
  return ORDER_STAGES.map((stage, position) => ({
    ...stage,
    state: position < index ? 'done' : position === index ? 'current' : 'pending',
  }));
}
