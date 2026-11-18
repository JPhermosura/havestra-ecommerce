import { Bell, Home, ShoppingCart, User } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useCart } from "@/contexts/CartContext";
import { useNotifications } from "@/hooks/useNotifications";

const navigationItems = [
  { label: "Home", href: "/buyer", icon: Home },
  { label: "Notifications", href: "/buyer/notifications", icon: Bell },
  { label: "Cart", href: "/cart", icon: ShoppingCart },
  { label: "Profile", href: "/buyer/profile", icon: User },
];

export default function BuyerBottomNavigation() {
  const [location] = useLocation();
  const { totalItems } = useCart();
  const { unreadCount } = useNotifications();

  return (
    <nav
      aria-label="Buyer navigation"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-emerald-100 bg-white/95 px-2 pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto grid max-w-md grid-cols-4">
        {navigationItems.map(({ label, href, icon: Icon }) => {
          const isActive =
            href === "/buyer"
              ? location === "/buyer" || location.startsWith("/buyer/delivery")
              : href === "/buyer/notifications"
                ? location.startsWith("/buyer/notifications")
                : href === "/cart"
                  ? location.startsWith("/cart") ||
                    location.startsWith("/checkout")
                  : location.startsWith("/buyer/profile") ||
                    location === "/profile";

          return (
            <Link
              key={label}
              href={href}
              aria-label={
                label === "Notifications" && unreadCount > 0
                  ? `Notifications, ${unreadCount} unread`
                  : undefined
              }
              aria-current={isActive ? "page" : undefined}
              className={`relative flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium transition-colors ${
                isActive
                  ? "text-[#16834A]"
                  : "text-slate-500 hover:bg-emerald-50 hover:text-[#16834A]"
              }`}
            >
              <span className="relative">
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                {label === "Cart" && totalItems > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#16834A] px-1 text-[9px] font-bold text-white">
                    {totalItems > 99 ? "99+" : totalItems}
                  </span>
                )}
                {label === "Notifications" && unreadCount > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-bold text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </span>
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
