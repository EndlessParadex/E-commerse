import { nextStoreDelivery } from './b2bDeliverySchedule.js';
export const wibToday = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (type) => parts.find((entry) => entry.type === type)?.value;
  return part('year') + '-' + part('month') + '-' + part('day');
};
export function storeCartTarget(store, previousDate) {
  const date = nextStoreDelivery(store.deliverySchedule, wibToday());
  return { storeId: store.id, date: date || previousDate || wibToday() };
}
