import { companyStorageKey } from '../data/companyStore.js';
import { useContext, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import { ShopContext } from './useShop';
import { STORAGE_KEY, emptyShop, normalizeShop, shopReducer, cartTotals } from './shopModel';
import { reviewCart, updateCartPrices } from '../data/cartValidation';
import { packagingValues } from '../data/productPackaging';
import { availableStock, cartStockLimit, reviewStock } from './frontendWorkflow';
import useWorkflow from './useWorkflow';
import { notifyWorkflow } from './workflowEvents';
import { workflowUsesServer } from '../data/adminStore';
import { DeliveryContext } from './useDelivery';
import { clearCompletedCheckoutRequest, serverStock } from './serverWorkflow';
import useSharedCart from './useSharedCart';

function readCartMode(userId) {
  if (!userId) return 'personal';
  try {
    return localStorage.getItem(companyStorageKey('bam.b2b.cart-mode.' + userId)) === 'personal'
      ? 'personal' : 'store';
  } catch {
    return 'store';
  }
}

function loadShop(key) {
  try {
    const stored = localStorage.getItem(key);
    if (stored !== null || !workflowUsesServer) return normalizeShop(JSON.parse(stored));
    const guest = JSON.parse(
      localStorage.getItem(companyStorageKey(STORAGE_KEY + '.account.guest')) ||
        localStorage.getItem(companyStorageKey(STORAGE_KEY)),
    );
    return normalizeShop({ cart: guest?.cart, favoriteIds: guest?.favoriteIds });
  } catch {
    return emptyShop();
  }
}

export default function ShopProvider({ children }) {
  const delivery = useContext(DeliveryContext);
  const shared = useSharedCart(delivery?.user, delivery?.authLoading);
  const storageKey = companyStorageKey(
    STORAGE_KEY + (workflowUsesServer ? '.account.' + (delivery?.user?.id || 'guest') : ''),
  );
  return (
    <AccountScopedShop key={storageKey} delivery={delivery} shared={shared} storageKey={storageKey}>
      {children}
    </AccountScopedShop>
  );
}

// Remount the reducer whenever the signed-in account changes. Without a keyed
// boundary, the previous user's private cart could be written under another ID.
function AccountScopedShop({ children, delivery, shared, storageKey }) {
  const [state, rawDispatch] = useReducer(shopReducer, storageKey, loadShop);
  const userId = delivery?.user?.id || '';
  const [modeSelection, setModeSelection] = useState({ userId: '', mode: 'store' });
  const cartMode = shared.enabled
    ? (modeSelection.userId === userId ? modeSelection.mode : readCartMode(userId))
    : 'personal';
  const storeCartActive = shared.enabled && cartMode === 'store';
  const setCartMode = (mode) => {
    if (!shared.enabled || !['store', 'personal'].includes(mode)) return;
    try {
      localStorage.setItem(companyStorageKey('bam.b2b.cart-mode.' + userId), mode);
    } catch {
      // Mode still works until refresh when local storage is unavailable.
    }
    setModeSelection({ userId, mode });
  };
  const cart = storeCartActive ? shared.cart?.items || [] : state.cart;
  const stateRef = useRef(state);
  useLayoutEffect(() => {
    stateRef.current = state;
  }, [state]);
  const workflow = useWorkflow();
  const stockWorkflow = useWorkflow('inventory');
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    if (workflow.failed) return;
    const action = { type: 'syncOrderNotifications', orders: workflow.orders };
    const next = shopReducer(stateRef.current, action);
    if (next !== stateRef.current) {
      stateRef.current = next;
      rawDispatch(action);
    }
  }, [workflow.orders, workflow.failed]);
  useEffect(() => {
    const timer = window.setInterval(notifyWorkflow, 15000);
    const refresh = () => notifyWorkflow();
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
      // This state reflects the result of synchronizing with browser storage.
      // oxlint-disable-next-line react/set-state-in-effect
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [state, storageKey]);

  const dispatch = (action) => {
    if (
      storeCartActive &&
      ['add', 'quantity', 'remove', 'clearCart', 'updateCart', 'completeOrder'].includes(
        action.type,
      )
    ) {
      if (!shared.canEdit) return Promise.resolve(false);
      const types = {
        add: 'add',
        quantity: 'set',
        remove: 'remove',
        clearCart: 'clear',
        updateCart: 'refresh',
      };
      return types[action.type]
        ? shared.mutate(types[action.type], action.product?.id || action.id, action.quantity)
        : Promise.resolve(false);
    }
    const previous = stateRef.current;
    const next = shopReducer(previous, action);
    if (
      action.type === 'add' ||
      (action.type === 'quantity' &&
        action.quantity > (previous.cart.find((item) => item.id === action.id)?.quantity || 0))
    ) {
      if (stockWorkflow.failed || stockWorkflow.loading) return false;
      try {
        if (reviewStock(next.cart, window.sessionStorage, workflow.orders).length) return false;
      } catch {
        return false;
      }
    }
    if (next === previous) return false;
    if (workflowUsesServer && ['add', 'quantity', 'remove', 'clearCart'].includes(action.type))
      clearCompletedCheckoutRequest();
    stateRef.current = next;
    rawDispatch(action);
    return true;
  };
  const addItem = (product, quantity = 1) => dispatch({ type: 'add', product, quantity });
  const stockFor = (product) => {
    try {
      const statistics = workflowUsesServer ? serverStock(product) : {};
      return {
        available: availableStock(product, window.sessionStorage, workflow.orders),
        maximum: storeCartActive
          ? shared.canEdit
            ? 99
            : 0
          : cartStockLimit(product, cart, window.sessionStorage, workflow.orders),
        soldUnits: statistics.soldUnits ?? null,
        inStock: workflowUsesServer
          ? statistics.inStock
          : availableStock(product, window.sessionStorage, workflow.orders) >=
            packagingValues(product).unitsPerPackage,
        publishedSoldMinimum: statistics.publishedSoldMinimum ?? null,
        reservedUnits: statistics.reservedUnits ?? null,
        failed: stockWorkflow.failed || stockWorkflow.loading,
      };
    } catch {
      return { available: 0, maximum: 0, soldUnits: null, reservedUnits: null, failed: true };
    }
  };
  const review = reviewCart(cart);
  try {
    if (!storeCartActive)
      review.issues.push(...reviewStock(cart, window.sessionStorage, workflow.orders));
  } catch {
    review.issues.push({ id: 'stock-storage', type: 'stock_error' });
  }
  if (
    !storeCartActive &&
    stockWorkflow.failed &&
    !review.issues.some((issue) => issue.type === 'stock_error')
  )
    review.issues.push({ id: 'stock-storage', type: 'stock_error' });
  review.ready = cart.length > 0 && review.issues.length === 0;

  return (
    <ShopContext.Provider
      value={{
        ...state,
        cart,
        shared,
        cartMode,
        setCartMode,
        ...cartTotals(cart),
        cartReview: review,
        stockFor,
        orderLinkStatus: (id) =>
          workflow.failed
            ? 'unavailable'
            : workflow.server || workflow.orders.some((order) => order.id === id)
              ? 'available'
              : 'missing',
        updateCart: () => dispatch({ type: 'updateCart', cart: updateCartPrices(cart) }),
        unreadCount: state.notifications.filter((item) => !item.read).length,
        storageError,
        addItem,
        completeOrder: (order) => dispatch({ type: 'completeOrder', order }),
        clearCart: () => dispatch({ type: 'clearCart' }),
        toggleFavorite: (id) => dispatch({ type: 'toggleFavorite', id }),
        dispatch,
      }}
    >
      {children}
    </ShopContext.Provider>
  );
}
