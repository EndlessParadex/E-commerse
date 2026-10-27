import { useEffect, useState } from 'react';
import { accountApi } from './accountApi';
import { useDelivery } from '../../state/useDelivery';
import useCompany from '../../state/useCompany';
export default function DeliveryPlan() {
  const { user } = useDelivery();
  const userId = user?.id;
  const company = useCompany();
  const [result, setResult] = useState({});
  useEffect(() => {
    if (!userId || !company.available) return;
    let active = true;
    accountApi('/api/delivery/personal')
      .then((value) => {
        if (active) setResult(value);
      })
      .catch((error) => {
        if (active) setResult({ error: error.message });
      });
    return () => {
      active = false;
    };
  }, [userId, company.available]);
  if (result.error)
    return (
      <p className="shop-warning" role="status">
        Jadwal wilayah: {result.error}
      </p>
    );
  if (!result.delivery) return null;
  return (
    <p className="shop-warning">
      Wilayah {result.delivery.regionName} · rencana pengiriman{' '}
      {new Date(result.delivery.plannedDate + 'T00:00:00Z').toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      })}
      . Jadwal diperiksa ulang oleh server saat pesanan dibuat.
    </p>
  );
}
