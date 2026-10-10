import { createContext, useContext } from 'react';

export const ShopContext = createContext(null);

export function useShop() {
  const shop = useContext(ShopContext);
  if (!shop) throw new Error('useShop harus digunakan di dalam ShopProvider.');
  return shop;
}
