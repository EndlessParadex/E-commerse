import { useEffect, useState } from 'react';
import { useDelivery } from '../../state/useDelivery';
import { catalogUsesServer, initializeCatalog, pricesHidden } from '../../data/adminStore';

/**
 * The server sends prices only to signed-in accounts. When someone signs in (or out) after the
 * catalog was loaded, reload it; until prices arrive, show nothing that would read as "no price"
 * (an admin form would otherwise open with empty prices). One reload per sign-in: if the server
 * still withholds prices (an expired session), the page shows the price-less catalog instead of
 * waiting forever.
 */
export default function CatalogAccess({ children }) {
  const { user, authLoading } = useDelivery();
  const signedIn = Boolean(user);
  const attempt = signedIn ? 'in:' + user.id : 'out';
  const [tried, setTried] = useState('');
  const stale = catalogUsesServer && !authLoading && pricesHidden() === signedIn;
  useEffect(() => {
    if (!stale || tried === attempt) return undefined;
    let active = true;
    initializeCatalog()
      .catch(() => {})
      .finally(() => active && setTried(attempt));
    return () => {
      active = false;
    };
  }, [stale, attempt, tried]);
  if (stale && signedIn && tried !== attempt)
    return (
      <div className="shop-page" role="status">
        Memuat harga…
      </div>
    );
  return children;
}
