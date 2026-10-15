export function logUnexpectedError(logger, error, context) {
  const name = /^[A-Za-z]+Error$/.test(error?.name || '') ? error.name : 'Error';
  const code =
    typeof error?.code === 'number' || /^ERR_[A-Z_]+$|^SQLITE_[A-Z_]+$/.test(error?.code || '')
      ? error.code
      : undefined;
  // The exception message can contain submitted values. Only include stack frames.
  const stack = String(error?.stack || '')
    .split('\n')
    .slice(1)
    .filter((line) => /^\s+at /.test(line))
    .slice(0, 12)
    .join('\n');
  try {
    logger({ ...context, error: { name, ...(code !== undefined ? { code } : {}), stack } });
  } catch {
    /* Logging must not prevent the generic error response. */
  }
}
