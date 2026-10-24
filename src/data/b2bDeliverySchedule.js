/** Pure ISO date arithmetic for BAM's fixed weekly / biweekly store routes. */
export const nextStoreDelivery = (schedule, fromDate) => {
  if (!schedule) return null;
  const { anchorDate, intervalWeeks } = schedule;
  const start = Date.parse(fromDate + 'T00:00:00Z');
  const anchor = Date.parse(anchorDate + 'T00:00:00Z');
  if (!Number.isFinite(start) || !Number.isFinite(anchor) || ![1, 2].includes(intervalWeeks))
    return null;
  const cycle = intervalWeeks * 7;
  const days = Math.ceil((start - anchor) / 86400000);
  const times = Math.max(0, Math.ceil(days / cycle));
  return new Date(anchor + times * cycle * 86400000).toISOString().slice(0, 10);
};

/** A store's fixed day is immutable from the cart; unscheduled stores can use any valid date. */
export const isStoreDeliveryDate = (schedule, date) => {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date + 'T00:00:00Z')) ||
      new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) !== date)
    return false;
  return !schedule || nextStoreDelivery(schedule, date) === date;
};
