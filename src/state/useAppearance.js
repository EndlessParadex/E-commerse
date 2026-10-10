import { createContext, useContext } from 'react';

export const AppearanceContext = createContext(null);
export function useAppearance() {
  const appearance = useContext(AppearanceContext);
  if (!appearance) throw new Error('useAppearance harus digunakan di dalam AppearanceProvider.');
  return appearance;
}
