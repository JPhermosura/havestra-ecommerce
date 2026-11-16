import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "./AuthContext";

export interface CartItem {
  id: string;
  title: string;
  price: number;
  image: string;
  quantity: number;
  category: string;
  weight?: number;
  sellerId?: string;
  farmerId?: string;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (item: CartItem) => Promise<void>;
  removeFromCart: (id: string) => Promise<void>;
  updateQuantity: (id: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

function mapBackendCartItem(item: any): CartItem {
  return {
    id: item.productId,
    title: item.productName,
    price: item.unitPrice,
    image: item.productImage,
    quantity: item.quantity,
    category: item.category || "",
    sellerId: item.sellerId || item.farmerId,
    farmerId: item.farmerId,
  };
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    if (user?.id) {
      const fetchCart = async () => {
        try {
          const response = await axios.get("/api/cart");
          const backendItems =
            response.data.items?.map(mapBackendCartItem) ?? [];
          setItems(backendItems);
        } catch (error) {
          console.error("Failed to load cart from server:", error);
        }
      };
      void fetchCart();
      return;
    }

    if (!isLoading) {
      const savedCart = localStorage.getItem("ecommerce_cart");
      if (savedCart) {
        try {
          setItems(JSON.parse(savedCart));
        } catch (error) {
          console.error("Failed to load cart from localStorage:", error);
        }
      }
    }
  }, [user?.id, isLoading]);

  useEffect(() => {
    localStorage.setItem("ecommerce_cart", JSON.stringify(items));
  }, [items]);

  const addToCart = async (item: CartItem) => {
    if (user?.id) {
      try {
        const response = await axios.post("/api/cart", {
          productId: item.id,
          quantity: item.quantity,
        });
        const backendItems = response.data.items?.map(mapBackendCartItem) ?? [];
        setItems(backendItems);
        return;
      } catch (error) {
        console.error("Failed to add item to server cart:", error);
        throw error;
      }
    }

    setItems(prevItems => {
      const existingItem = prevItems.find(
        i => i.id === item.id && i.weight === item.weight
      );
      if (existingItem) {
        return prevItems.map(i =>
          i.id === item.id && i.weight === item.weight
            ? { ...i, quantity: i.quantity + item.quantity }
            : i
        );
      }
      return [...prevItems, item];
    });
  };

  const removeFromCart = async (id: string) => {
    if (user?.id) {
      try {
        const response = await axios.delete(`/api/cart/${id}`);
        const backendItems = response.data.items?.map(mapBackendCartItem) ?? [];
        setItems(backendItems);
        return;
      } catch (error) {
        console.error("Failed to remove item from server cart:", error);
      }
    }
    setItems(prevItems => prevItems.filter(i => i.id !== id));
  };

  const updateQuantity = async (id: string, quantity: number) => {
    if (quantity <= 0) {
      await removeFromCart(id);
      return;
    }

    if (user?.id) {
      try {
        const response = await axios.put(`/api/cart/${id}`, { quantity });
        const backendItems = response.data.items?.map(mapBackendCartItem) ?? [];
        setItems(backendItems);
        return;
      } catch (error) {
        console.error("Failed to update server cart item:", error);
      }
    }

    setItems(prevItems =>
      prevItems.map(i => (i.id === id ? { ...i, quantity } : i))
    );
  };

  const clearCart = async () => {
    if (user?.id) {
      try {
        await axios.post("/api/cart/clear");
      } catch (error) {
        console.error("Failed to clear server cart:", error);
      }
    }
    setItems([]);
  };

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        totalItems,
        totalPrice,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within CartProvider");
  }
  return context;
}
