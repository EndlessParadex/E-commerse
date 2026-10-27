import { nextStoreDelivery, isStoreDeliveryDate } from './b2bDeliverySchedule.js';

export const deliveryWeekdays = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
export const todayWIB = (time = Date.now()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(time));
export function validDeliverySchedule(value) {
  if (
    !value ||
    !Number.isInteger(value.weekday) ||
    value.weekday < 0 ||
    value.weekday > 6 ||
    ![1, 2].includes(value.intervalWeeks) ||
    !isStoreDeliveryDate(null, value.anchorDate || '') ||
    new Date(value.anchorDate + 'T00:00:00Z').getUTCDay() !== value.weekday
  )
    return null;
  return {
    weekday: value.weekday,
    intervalWeeks: value.intervalWeeks,
    anchorDate: value.anchorDate,
  };
}
export function upcomingDeliveries(schedule, fromDate, count = 6) {
  if (
    !validDeliverySchedule(schedule) ||
    !isStoreDeliveryDate(null, fromDate) ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > 60
  )
    return [];
  const first = nextStoreDelivery(schedule, fromDate);
  const start = Date.parse(first + 'T00:00:00Z');
  return Array.from({ length: count }, (_, index) =>
    new Date(start + index * schedule.intervalWeeks * 7 * 86400000).toISOString().slice(0, 10),
  );
}
