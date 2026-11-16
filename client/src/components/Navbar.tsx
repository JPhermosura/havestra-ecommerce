import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Menu, User, X } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [, navigate] = useLocation();
  const { isAuthenticated, user, logout } = useAuth();

  const logoHref = isAuthenticated
    ? user?.role === "seller"
      ? "/seller/dashboard"
      : user?.role === "admin"
        ? "/admin"
        : "/buyer"
    : "/";

  const closeMenu = () => setIsMenuOpen(false);

  const handleNavigate = (href: string) => {
    closeMenu();
    navigate(href);
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-emerald-950/5 bg-white/90 shadow-sm backdrop-blur-xl">
      <div className="container">
        <div className="flex h-16 items-center justify-between gap-3">
          {/* Logo */}
          <Link
            href={logoHref}
            className="flex shrink-0 items-center gap-2 font-bold text-xl text-emerald-800 transition-colors hover:text-emerald-600 sm:text-2xl"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-700 text-lg text-white shadow-md shadow-emerald-900/15">
              🌾
            </span>
            <span>Havestra</span>
          </Link>

          {/* Right Icons */}
          <div className="flex items-center gap-2 sm:gap-3">
            {isAuthenticated && <NotificationBell />}

            {/* Admin profile dropdown */}
            {isAuthenticated && user?.role === "admin" && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white flex items-center justify-center shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 duration-200 ease-out"
                  >
                    <User className="h-5 w-5" />
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  className="w-56 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden p-2"
                  align="end"
                  side="bottom"
                  sideOffset={8}
                >
                  <DropdownMenuLabel className="px-3 py-2">
                    <div className="flex flex-col">
                      <span className="font-medium">{user?.name}</span>
                      <span className="text-xs text-slate-500 truncate">
                        {user?.phone || "Not set"}
                      </span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => navigate("/admin/settings")}
                    className="px-3 py-2 hover:bg-emerald-50 rounded-md transition-colors"
                  >
                    My Profile
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      logout();
                      navigate("/login");
                    }}
                    className="px-3 py-2 hover:bg-emerald-50 rounded-md transition-colors"
                  >
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Seller profile dropdown */}
            {isAuthenticated && user?.role === "seller" && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow hover:shadow-lg transition-shadow">
                    <Avatar className="h-8 w-8">
                      <AvatarImage
                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || "Seller")}&background=10b981&color=ffffff`}
                      />
                      <AvatarFallback className="bg-emerald-600">
                        {(user?.name || "S").charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  side="bottom"
                  align="end"
                  sideOffset={8}
                  className="w-56 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden p-2"
                >
                  <DropdownMenuLabel className="px-3 py-2">
                    <div className="text-sm font-semibold text-slate-900">
                      {user?.name}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {user?.phone || "Not set"}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => navigate("/seller/profile")}
                    className="px-3 py-2 hover:bg-emerald-50 rounded-md transition-colors flex items-center gap-2"
                  >
                    <span className="text-lg">👤</span>
                    <span className="text-sm">My Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      logout();
                      navigate("/login", { replace: true });
                    }}
                    className="px-3 py-2 hover:bg-emerald-50 rounded-md transition-colors flex items-center gap-2 text-sm text-slate-700"
                  >
                    <span className="text-lg">🚪</span>
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <div className="hidden items-center gap-2 md:flex">
              {isAuthenticated ? (
                <>
                  {user?.role === "buyer" && (
                    <Link
                      href="/products"
                      className="rounded-full px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-emerald-50 hover:text-emerald-800"
                    >
                      Shop
                    </Link>
                  )}
                  <Link
                    href={logoHref}
                    className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 hover:shadow-md"
                  >
                    Dashboard
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="rounded-full px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-emerald-50 hover:text-emerald-800"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/register"
                    className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 hover:shadow-md"
                  >
                    Create account
                  </Link>
                </>
              )}
            </div>

            {/* Mobile Menu Toggle */}
            <button
              type="button"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-emerald-900 transition-colors hover:bg-emerald-50 focus-visible:outline-emerald-600 md:hidden"
              aria-label={isMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={isMenuOpen}
              aria-controls="mobile-primary-navigation"
            >
              {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {isMenuOpen && (
        <div
          id="mobile-primary-navigation"
          className="nav-mobile-panel border-t border-emerald-100 bg-white/95 shadow-lg shadow-emerald-950/5 backdrop-blur-xl md:hidden"
        >
          <div className="container px-4 py-4 space-y-2">
            <button
              type="button"
              onClick={() => handleNavigate("/")}
              className="w-full rounded-lg px-4 py-3 text-left text-emerald-900 transition-colors hover:bg-emerald-50"
            >
              Home
            </button>
            <button
              type="button"
              onClick={() => handleNavigate("/products")}
              className="w-full rounded-lg px-4 py-3 text-left text-emerald-900 transition-colors hover:bg-emerald-50"
            >
              Shop
            </button>
            {isAuthenticated ? (
              <>
                <button
                  type="button"
                  onClick={() => handleNavigate("/cart")}
                  className="w-full rounded-lg px-4 py-3 text-left text-emerald-900 transition-colors hover:bg-emerald-50"
                >
                  Cart
                </button>
                <button
                  type="button"
                  onClick={() => handleNavigate("/wishlist")}
                  className="w-full rounded-lg px-4 py-3 text-left text-emerald-900 transition-colors hover:bg-emerald-50"
                >
                  Wishlist
                </button>
                <button
                  type="button"
                  onClick={() => handleNavigate("/profile")}
                  className="w-full rounded-lg px-4 py-3 text-left text-emerald-900 transition-colors hover:bg-emerald-50"
                >
                  Profile
                </button>
                {user?.role === "seller" && (
                  <button
                    type="button"
                    onClick={() => handleNavigate("/seller/dashboard")}
                    className="w-full rounded-lg px-4 py-3 text-left text-emerald-900 transition-colors hover:bg-emerald-50"
                  >
                    Seller Dashboard
                  </button>
                )}
                {user?.role === "admin" && (
                  <button
                    type="button"
                    onClick={() => handleNavigate("/admin")}
                    className="w-full rounded-lg px-4 py-3 text-left text-emerald-900 transition-colors hover:bg-emerald-50"
                  >
                    Admin Dashboard
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    closeMenu();
                    navigate("/login");
                  }}
                  className="w-full text-left px-4 py-3 rounded-lg text-red-600 hover:bg-red-50"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleNavigate("/login")}
                  className="w-full rounded-lg px-4 py-3 text-left text-emerald-900 transition-colors hover:bg-emerald-50"
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => handleNavigate("/register")}
                  className="w-full rounded-lg px-4 py-3 text-left text-emerald-900 transition-colors hover:bg-emerald-50"
                >
                  Register
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
