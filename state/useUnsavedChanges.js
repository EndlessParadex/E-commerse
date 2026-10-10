import { useEffect } from 'react';
import { registerRouteGuard, approveNextRoute } from './routeGuards';

export default function useUnsavedChanges(dirty, onNavigate, busy = false) {
  useEffect(() => {
    const leave = () => {
      if (busy) return false;
      if (dirty && !window.confirm('Perubahan belum disimpan. Tinggalkan form?')) return false;
      onNavigate?.(); return true;
    };
    const unregister = registerRouteGuard(leave);
    const beforeUnload = (event) => { if (dirty || busy) { event.preventDefault(); event.returnValue = ''; } };
    const click = (event) => {
      const link = event.target.closest('a[href]');
      if (!link || event.defaultPrevented || event.button > 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || link.target === '_blank' || link.hasAttribute('download')) return;
      if (link.getAttribute('href') === '#main-content') return;
      if (!leave()) { event.preventDefault(); event.stopPropagation(); return; }
      if (link.hash?.startsWith('#/')) approveNextRoute(link.hash.slice(1));
    };
    window.addEventListener('beforeunload', beforeUnload); document.addEventListener('click', click, true);
    return () => { unregister(); window.removeEventListener('beforeunload', beforeUnload); document.removeEventListener('click', click, true); };
  }, [dirty, onNavigate, busy]);
}
