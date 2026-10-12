import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CartContext } from './CartContextInstance';
import { useAuth } from './useAuth';
import {
  getCart,
  addToCart as apiAddToCart,
  updateCartItem as apiUpdateCartItem,
  removeCartItem as apiRemoveCartItem,
  clearCart as apiClearCart,
} from '../api/cart';

const INITIAL_CART = {
  id: null,
  items: [],
  item_count: 0,
  subtotal: '0.00',
};

/**
 * Format error message from API response
 */
const formatCartError = (err, fallback = 'Cart operation failed.') => {
  if (err.response?.data) {
    const data = err.response.data;
    if (typeof data === 'string') return data;
    if (data.detail) return data.detail;
    if (data.quantity) return Array.isArray(data.quantity) ? data.quantity[0] : data.quantity;
    if (data.book_id) return Array.isArray(data.book_id) ? data.book_id[0] : data.book_id;
    if (data.non_field_errors) {
      return Array.isArray(data.non_field_errors)
        ? data.non_field_errors[0]
        : data.non_field_errors;
    }
  }
  return err.message || fallback;
};

export function CartProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [cart, setCart] = useState(INITIAL_CART);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeItemAction, setActiveItemAction] = useState(null); // id currently mutating
  
  // Track sequence number to discard stale async cart responses
  const updateSeqRef = useRef(0);

  // Sync cart when authentication state changes
  useEffect(() => {
    if (authLoading) return;

    let ignore = false;
    const controller = new AbortController();
    const seq = ++updateSeqRef.current;

    const loadInitialCart = async () => {
      if (!user) {
        if (!ignore && seq === updateSeqRef.current) {
          setCart(INITIAL_CART);
          setError(null);
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const data = await getCart(controller.signal);
        if (!ignore && seq === updateSeqRef.current) {
          setCart(data);
        }
      } catch (err) {
        if (!ignore && err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
          console.error('Failed to load cart:', err);
          setError(formatCartError(err, 'Unable to load your shopping bag.'));
        }
      } finally {
        if (!ignore && seq === updateSeqRef.current) {
          setLoading(false);
        }
      }
    };

    loadInitialCart();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [user, authLoading]);

  // Fetch cart manually (refresh)
  const refreshCart = useCallback(async () => {
    if (!user) return INITIAL_CART;

    const seq = ++updateSeqRef.current;
    setLoading(true);
    setError(null);
    try {
      const data = await getCart();
      if (seq === updateSeqRef.current) {
        setCart(data);
      }
      return data;
    } catch (err) {
      if (seq === updateSeqRef.current) {
        const msg = formatCartError(err, 'Failed to refresh shopping bag.');
        setError(msg);
      }
      throw err;
    } finally {
      if (seq === updateSeqRef.current) {
        setLoading(false);
      }
    }
  }, [user]);

  // Add book to cart
  const addItem = useCallback(
    async (bookId, quantity = 1) => {
      if (!user) {
        throw new Error('Please sign in to add items to your shopping bag.');
      }

      setError(null);
      const seq = ++updateSeqRef.current;
      try {
        const updatedCart = await apiAddToCart(bookId, quantity);
        if (seq === updateSeqRef.current) {
          setCart(updatedCart);
        }
        return { success: true, cart: updatedCart };
      } catch (err) {
        const msg = formatCartError(err, 'Could not add book to bag.');
        setError(msg);
        return { success: false, error: msg };
      }
    },
    [user]
  );

  // Update item quantity
  const updateItem = useCallback(
    async (itemId, quantity) => {
      if (!user) return { success: false, error: 'Authentication required' };

      setError(null);
      setActiveItemAction(itemId);
      const seq = ++updateSeqRef.current;
      try {
        const updatedCart = await apiUpdateCartItem(itemId, quantity);
        if (seq === updateSeqRef.current) {
          setCart(updatedCart);
        }
        return { success: true, cart: updatedCart };
      } catch (err) {
        const msg = formatCartError(err, 'Could not update item quantity.');
        setError(msg);
        return { success: false, error: msg };
      } finally {
        setActiveItemAction(null);
      }
    },
    [user]
  );

  // Remove single item
  const removeItem = useCallback(
    async (itemId) => {
      if (!user) return { success: false, error: 'Authentication required' };

      setError(null);
      setActiveItemAction(itemId);
      const seq = ++updateSeqRef.current;
      try {
        const updatedCart = await apiRemoveCartItem(itemId);
        if (seq === updateSeqRef.current) {
          setCart(updatedCart);
        }
        return { success: true, cart: updatedCart };
      } catch (err) {
        const msg = formatCartError(err, 'Could not remove item from bag.');
        setError(msg);
        return { success: false, error: msg };
      } finally {
        setActiveItemAction(null);
      }
    },
    [user]
  );

  // Clear entire cart
  const clearAllItems = useCallback(async () => {
    if (!user) return { success: false, error: 'Authentication required' };

    setError(null);
    setLoading(true);
    const seq = ++updateSeqRef.current;
    try {
      const clearedCart = await apiClearCart();
      if (seq === updateSeqRef.current) {
        setCart(clearedCart);
      }
      return { success: true, cart: clearedCart };
    } catch (err) {
      const msg = formatCartError(err, 'Could not clear shopping bag.');
      setError(msg);
      return { success: false, error: msg };
    } finally {
      if (seq === updateSeqRef.current) {
        setLoading(false);
      }
    }
  }, [user]);

  const value = {
    cart,
    itemCount: cart?.item_count || 0,
    loading,
    error,
    activeItemAction,
    refreshCart,
    addItem,
    updateItem,
    removeItem,
    clearAllItems,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export default CartProvider;
