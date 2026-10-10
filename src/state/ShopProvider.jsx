import { useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import { ShopContext } from './useShop';
import { STORAGE_KEY, emptyShop, normalizeShop, shopReducer, cartTotals } from './shopModel';
import { reviewCart, updateCartPrices } from '../data/cartValidation';
import { availableStock, cartStockLimit, reviewStock } from './frontendWorkflow';
import useWorkflow from './useWorkflow';
import { notifyWorkflow } from './workflowEvents';

function loadShop() {
  try { return normalizeShop(JSON.parse(localStorage.getItem(STORAGE_KEY))); }
  catch { return emptyShop(); }
}

export default function ShopProvider({ children }) {
  const [state, rawDispatch] = useReducer(shopReducer, undefined, loadShop);
  const stateRef = useRef(state);
  useLayoutEffect(() => { stateRef.current = state; }, [state]);
  const workflow = useWorkflow();
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    if (workflow.failed) return;
    const action = { type: 'syncOrderNotifications', orders: workflow.orders };
    const next = shopReducer(stateRef.current, action);
    if (next !== stateRef.current) { stateRef.current = next; rawDispatch(action); }
  }, [workflow.orders, workflow.failed]);
  useEffect(() => {
    const timer = window.setInterval(notifyWorkflow, 15000);
    const refresh = () => notifyWorkflow();
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('storage', refresh); };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      // This state reflects the result of synchronizing with browser storage.
      // oxlint-disable-next-line react/set-state-in-effect
      setStorageError(false);
    } catch { setStorageError(true); }
  }, [state]);

  const dispatch = (action) => {
    const previous = stateRef.current;
    const next = shopReducer(previous, action);
    if (action.type === 'add' || (action.type === 'quantity' && action.quantity > (previous.cart.find((item) => item.id === action.id)?.quantity || 0))) {
      if (workflow.failed) return false;
      try { if (reviewStock(next.cart, window.sessionStorage, workflow.orders).length) return false; }
      catch { return false; }
    }
    if (next === previous) return false;
    stateRef.current = next; rawDispatch(action); return true;
  };
  const addItem = (product, quantity = 1) => dispatch({ type: 'add', product, quantity });
  const stockFor = (product) => {
    try { return { available: availableStock(product, window.sessionStorage, workflow.orders), maximum: cartStockLimit(product, state.cart, window.sessionStorage, workflow.orders), failed: workflow.failed }; }
    catch { return { available: 0, maximum: 0, failed: true }; }
  };
  const review = reviewCart(state.cart);
  try { review.issues.push(...reviewStock(state.cart, window.sessionStorage, workflow.orders)); }
  catch { review.issues.push({ id: 'stock-storage', type: 'stock_error' }); }
  if (workflow.failed && !review.issues.some((issue) => issue.type === 'stock_error')) review.issues.push({ id: 'stock-storage', type: 'stock_error' });
  review.ready = state.cart.length > 0 && review.issues.length === 0;

  return <ShopContext.Provider value={{ ...state, ...cartTotals(state.cart), cartReview: review, stockFor, orderLinkStatus: (id) => workflow.failed ? 'unavailable' : workflow.orders.some((order) => order.id === id) ? 'available' : 'missing', updateCart: () => dispatch({ type: 'updateCart', cart: updateCartPrices(state.cart) }), unreadCount: state.notifications.filter((item) => !item.read).length, storageError, addItem, completeOrder: (order) => dispatch({ type: 'completeOrder', order }), clearCart: () => dispatch({ type: 'clearCart' }), toggleFavorite: (id) => dispatch({ type: 'toggleFavorite', id }), dispatch }}>
    {children}
  </ShopContext.Provider>;
}
