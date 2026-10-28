/** Configurable B2B cut-off policy; no implicit operational deadline. */
export function b2bCutoffFromEnv(env = process.env) {
  const days = env.BAM_B2B_CUTOFF_DAYS_BEFORE;
  const time = env.BAM_B2B_CUTOFF_TIME;
  if (!days && !time) return null;
  if (
    !/^(0|[1-9][0-9]?)$/.test(days || '') ||
    Number(days) > 14 ||
    !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(time || '')
  )
    throw new Error(
      'Set BAM_B2B_CUTOFF_DAYS_BEFORE (0–14) and BAM_B2B_CUTOFF_TIME (HH:mm WIB) together.',
    );
  return { daysBefore: Number(days), time };
}
const day = 86400000;
const localMidnight = (date) => Date.parse(date + 'T00:00:00+07:00');
export function cutoffTime(date, policy) {
  if (!policy) return null;
  const [hour, minute] = policy.time.split(':').map(Number);
  return localMidnight(date) - policy.daysBefore * day + (hour * 60 + minute) * 60000;
}
export function isPastCutoff(date, policy, now) {
  const deadline = cutoffTime(date, policy);
  return deadline !== null && now >= deadline;
}
export function isPastDeliveryDate(date, now) {
  return now >= localMidnight(date) + day;
}
