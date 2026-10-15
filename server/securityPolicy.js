export const DEFAULT_RESERVATION_POLICY = Object.freeze({
  maxOpenOrders: 5,
  reviewWindowMs: 7 * 86400000,
  quoteHoldWindowMs: 86400000,
  paymentHoldWindowMs: 30 * 60 * 1000,
  maxReservedUnits: 1000,
  maxUnitsPerStock: 200,
  codConfirmationWindowMs: 24 * 60 * 60 * 1000,
});

export function reservationPolicyFromEnv(env = process.env) {
  return Object.fromEntries(
    Object.entries({
      maxOpenOrders: env.BAM_MAX_OPEN_ORDERS,
      reviewWindowMs:
        env.BAM_REVIEW_HOURS === undefined ? undefined : Number(env.BAM_REVIEW_HOURS) * 3600000,
      quoteHoldWindowMs:
        env.BAM_QUOTE_HOLD_HOURS === undefined
          ? undefined
          : Number(env.BAM_QUOTE_HOLD_HOURS) * 3600000,
      paymentHoldWindowMs:
        env.BAM_PAYMENT_HOLD_MINUTES === undefined
          ? undefined
          : Number(env.BAM_PAYMENT_HOLD_MINUTES) * 60000,
      maxReservedUnits: env.BAM_MAX_RESERVED_UNITS,
      maxUnitsPerStock: env.BAM_MAX_RESERVED_UNITS_PER_PRODUCT,
      codConfirmationWindowMs:
        env.BAM_COD_CONFIRMATION_HOURS === undefined
          ? undefined
          : Number(env.BAM_COD_CONFIRMATION_HOURS) * 3600000,
    })
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, Number(value)]),
  );
}

export function normalizeReservationPolicy(overrides = {}) {
  const policy = { ...DEFAULT_RESERVATION_POLICY, ...overrides };
  for (const [key, value] of Object.entries(policy)) {
    if (
      !Object.hasOwn(DEFAULT_RESERVATION_POLICY, key) ||
      !Number.isSafeInteger(value) ||
      value < 1 ||
      value >
        ([
          'codConfirmationWindowMs',
          'paymentHoldWindowMs',
          'reviewWindowMs',
          'quoteHoldWindowMs',
        ].includes(key)
          ? 30 * 86400000
          : key === 'maxOpenOrders'
            ? 1000
            : 1_000_000_000)
    )
      throw new Error(`Invalid reservation policy: ${key}`);
  }
  return Object.freeze(policy);
}
