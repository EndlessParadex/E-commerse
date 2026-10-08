import { useEffect } from 'react';

export default function useUnsavedChanges(dirty, onNavigate, busy = false) {
  useEffect(() => {
    const beforeUnload = (event) => { if (dirty || busy) { event.preventDefault(); event.returnValue = ''; } };
    const click = (event) => {
      const link = event.target.closest('a[href]');
      if (!link || event.defaultPrevented || event.button > 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || link.target === '_blank' || link.hasAttribute('download')) return;
      if (busy) { event.preventDefault(); event.stopPropagation(); return; }
      if (dirty && !window.confirm('Perubahan belum disimpan. Tinggalkan form?')) { event.preventDefault(); event.stopPropagation(); return; }
      onNavigate?.();
    };
    window.addEventListener('beforeunload', beforeUnload); document.addEventListener('click', click, true);
    return () => { window.removeEventListener('beforeunload', beforeUnload); document.removeEventListener('click', click, true); };
  }, [dirty, onNavigate, busy]);
}
