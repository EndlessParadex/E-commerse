import { useSyncExternalStore } from 'react';
import { subscribeCompany, companySnapshot } from '../data/companyStore';
export default function useCompany() {
  return useSyncExternalStore(subscribeCompany, companySnapshot, companySnapshot);
}
