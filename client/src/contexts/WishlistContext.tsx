import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "./AuthContext";

export interface WishlistItem {
  id: string;
  title: string;
  price: number;
  image: string;
  category: string;
  sellerId?: string;
  farmerId?: string;
  sellerName?: string;
  rating?: number;
  stock?: number;
}

interface WishlistContextType {
  items: WishlistItem[];
  wishlistItems: string[];
  addToWishlist: (productId: string) => Promise<void>;
  removeFromWishlist: (productId: string) => Promise<void>;
  isInWishlist: (productId: string) => boolean;
  totalItems: number;
  clearWishlist: () => Promise<void>;
}

const WishlistContext = createContext<WishlistContextType | undefined>(
  undefined
);

function mapBackendWishlistItem(item: any): WishlistItem {
  return {
    id: item._id || item.id,
    title: item.name || item.title,
    price: item.price,
    image: item.image,
    category: item.category,
    sellerId: item.seller || item.sellerId,
    farmerId: item.farmerId,
    sellerName: item.sellerName || item.farmerName,
    rating: item.rating,
    stock: item.stock,
  };
}

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);

  // Fetch wishlist from server or localStorage
  useEffect(() => {
    if (user?.id) {
      const fetchWishlist = async () => {
        try {
          const response = await axios.get("/api/wishlist");
          const backendItems = response.data.wishlist || response.data || [];
          if (Array.isArray(backendItems)) {
            const mappedItems = backendItems.map(mapBackendWishlistItem);
            setItems(mappedItems);
            setWishlistIds(mappedItems.map(item => item.id));
          }
        } catch (error) {
          console.error("Failed to load wishlist from server:", error);
          // Fallback to localStorage
          const savedWishlist = localStorage.getItem("ecommerce_wishlist");
          if (savedWishlist) {
            try {
              setWishlistIds(JSON.parse(savedWishlist));
            } catch (e) {
              console.error("Failed to load wishlist from localStorage:", e);
            }
          }
        }
      };
      void fetchWishlist();
      return;
    }

    if (!isLoading) {
      const savedWishlist = localStorage.getItem("ecommerce_wishlist");
      if (savedWishlist) {
        try {
          setWishlistIds(JSON.parse(savedWishlist));
        } catch (error) {
          console.error("Failed to load wishlist from localStorage:", error);
        }
      }
    }
  }, [user?.id, isLoading]);

  // Save to localStorage whenever items change
  useEffect(() => {
    localStorage.setItem("ecommerce_wishlist", JSON.stringify(wishlistIds));
  }, [wishlistIds]);

  const addToWishlist = async (productId: string) => {
    if (user?.id) {
      try {
        const response = await axios.post("/api/wishlist", { productId });
        const newItem = mapBackendWishlistItem(
          response.data.product || response.data
        );
        setItems(prev => {
          if (prev.some(item => item.id === newItem.id)) {
            return prev;
          }
          return [...prev, newItem];
        });
        setWishlistIds(prev => {
          if (!prev.includes(productId)) {
            return [...prev, productId];
          }
          return prev;
        });
      } catch (error) {
        console.error("Failed to add to wishlist:", error);
        throw error;
      }
    } else {
      // For guests, just use localStorage
      try {
        const productResponse = await axios.get(`/api/products/${productId}`);
        const product = productResponse.data;
        const newItem: WishlistItem = {
          id: product._id || productId,
          title: product.name || product.title,
          price: product.price,
          image: product.image,
          category: product.category,
          sellerId: product.seller,
          farmerId: product.farmerId,
          sellerName: product.sellerName,
          rating: product.rating,
          stock: product.stock,
        };
        setItems(prev => {
          if (prev.some(item => item.id === newItem.id)) {
            return prev;
          }
          return [...prev, newItem];
        });
        setWishlistIds(prev => {
          if (!prev.includes(newItem.id)) {
            return [...prev, newItem.id];
          }
          return prev;
        });
      } catch (error) {
        console.error("Failed to add to wishlist:", error);
        throw error;
      }
    }
  };

  const removeFromWishlist = async (productId: string) => {
    if (user?.id) {
      try {
        await axios.delete(`/api/wishlist/${productId}`);
        setItems(prev => prev.filter(item => item.id !== productId));
        setWishlistIds(prev => prev.filter(id => id !== productId));
      } catch (error) {
        console.error("Failed to remove from wishlist:", error);
        throw error;
      }
    } else {
      setItems(prev => prev.filter(item => item.id !== productId));
      setWishlistIds(prev => prev.filter(id => id !== productId));
    }
  };

  const isInWishlist = (productId: string): boolean => {
    return (
      wishlistIds.includes(productId) ||
      items.some(item => item.id === productId)
    );
  };

  const clearWishlist = async () => {
    if (user?.id) {
      try {
        await axios.delete("/api/wishlist");
        setItems([]);
        setWishlistIds([]);
      } catch (error) {
        console.error("Failed to clear wishlist:", error);
        throw error;
      }
    } else {
      setItems([]);
      setWishlistIds([]);
    }
  };

  return (
    <WishlistContext.Provider
      value={{
        items,
        wishlistItems: wishlistIds,
        addToWishlist,
        removeFromWishlist,
        isInWishlist,
        totalItems: items.length || wishlistIds.length,
        clearWishlist,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist(): WishlistContextType {
  const context = useContext(WishlistContext);
  if (context === undefined) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }
  return context;
}
