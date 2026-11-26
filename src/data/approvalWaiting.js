// "Menunggu 3 jam": how long a pending registration has waited; late after one day.
export function waitingLabel(createdAt, now = Date.now()) {
  const start = new Date(createdAt).getTime();
  if (!Number.isFinite(start)) return null;
  const minutes = Math.max(0, Math.floor((now - start) / 60000));
  const text =
    minutes < 1
      ? 'baru saja'
      : minutes < 60
        ? minutes + ' menit'
        : minutes < 1440
          ? Math.floor(minutes / 60) + ' jam'
          : Math.floor(minutes / 1440) + ' hari';
  return { text: minutes < 1 ? 'Baru saja daftar' : 'Menunggu ' + text, late: minutes >= 1440 };
}
