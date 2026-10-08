import { useEffect, useReducer, useState } from 'react';
import { ShopContext } from './useShop';
import { STORAGE_KEY, emptyShop, normalizeShop, shopReducer, cartTotals } from './shopModel';

function loadShop() {
  try { return normalizeShop(JSON.parse(localStorage.getItem(STORAGE_KEY))); }
  catch { return emptyShop(); }
}

export default function ShopProvider({ children }) {
  const [state, dispatch] = useReducer(shopReducer, undefined, loadShop);
  const [storageError, setStorageError] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      // This state reflects the result of synchronizing with browser storage.
      // oxlint-disable-next-line react/set-state-in-effect
      setStorageError(false);
    } catch { setStorageError(true); }
  }, [state]);

  const addItem = (product) => dispatch({ type: 'add', product });

  return <ShopContext.Provider value={{ ...state, ...cartTotals(state.cart), unreadCount: state.notifications.filter((item) => !item.read).length, storageError, addItem, completeOrder: (order) => dispatch({ type: 'completeOrder', order }), clearCart: () => dispatch({ type: 'clearCart' }), toggleFavorite: (id) => dispatch({ type: 'toggleFavorite', id }), dispatch }}>
    {children}
  </ShopContext.Provider>;
}
