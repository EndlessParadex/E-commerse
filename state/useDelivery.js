import { createContext, useContext } from 'react';

export const DeliveryContext = createContext(null);

export function useDelivery() {
  const context = useContext(DeliveryContext);
  if (!context) throw new Error('useDelivery harus digunakan di dalam DeliveryProvider.');
  return context;
}
