import { lazy, Suspense } from "react";
import { Toaster } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { CartProvider } from "./contexts/CartContext";
import { WishlistProvider } from "./contexts/WishlistContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ProtectedRoute from "./components/ProtectedRoute";
import BuyerLayout from "@/components/BuyerLayout";

const NotFound = lazy(() => import("@/pages/NotFound"));
const Home = lazy(() => import("@/pages/Home"));
const Products = lazy(() => import("@/pages/Products"));
const ProductDetail = lazy(() => import("@/pages/ProductDetail"));
const Cart = lazy(() => import("@/pages/Cart"));
const Checkout = lazy(() => import("@/pages/Checkout"));
const Wishlist = lazy(() => import("@/pages/Wishlist"));
const Login = lazy(() => import("@/pages/Login"));
const Register = lazy(() => import("@/pages/Register"));
const Profile = lazy(() => import("@/pages/Profile"));
const IdVerificationStatus = lazy(() => import("@/pages/IdVerificationStatus"));
const Orders = lazy(() => import("@/pages/Orders"));
const OrderDetails = lazy(() => import("@/pages/OrderDetails"));
const Unauthorized = lazy(() => import("@/pages/Unauthorized"));
const ModernSellerDashboard = lazy(
  () => import("@/pages/seller/ModernSellerDashboard")
);
const BuyerDashboard = lazy(() => import("@/pages/buyer/BuyerDashboard"));
const DeliveryTracking = lazy(() => import("@/pages/buyer/DeliveryTracking"));
const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));
const AdminSection = lazy(() => import("@/pages/admin/AdminSection"));

function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [location] = useLocation();

  // Modern dashboards have their own layouts
  if (location.startsWith("/buyer")) {
    return <>{children}</>;
  }
  if (location.startsWith("/seller")) {
    return <>{children}</>;
  }
  if (location.startsWith("/admin")) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-dvh w-full flex-col">
      <Navbar />
      <main className="min-w-0 flex-1">{children}</main>
      <Footer />
    </div>
  );
}

function Router() {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  return (
    <LayoutWrapper>
      {/* Categories removed for buyers */}
      <Suspense
        fallback={
          <div
            role="status"
            className="flex min-h-[50dvh] items-center justify-center px-4 text-sm text-slate-600"
          >
            Loading page...
          </div>
        }
      >
        <div key={location} className="route-enter">
          <Switch>
            {/* Public Routes - Auth Pages */}
            <Route path={"/login"} component={Login} />
            <Route path={"/register"} component={Register} />

            {/* Home Page */}
            <Route
              path={"/"}
              component={() => {
                if (isLoading) {
                  return (
                    <div className="flex min-h-full items-center justify-center">
                      <div className="text-center">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
                        <p className="mt-4 text-gray-600">Loading...</p>
                      </div>
                    </div>
                  );
                }
                // Show home page for everyone (logged in or not)
                return <Home />;
              }}
            />

            {/* Protected User Routes */}
            <Route
              path={"/products"}
              component={() => (
                <ProtectedRoute>
                  <Products />
                </ProtectedRoute>
              )}
            />
            <Route
              path={"/product/:id"}
              component={() => (
                <ProtectedRoute>
                  <ProductDetail />
                </ProtectedRoute>
              )}
            />
            <Route
              path={"/cart"}
              component={() => (
                <ProtectedRoute>
                  <Cart />
                </ProtectedRoute>
              )}
            />
            <Route
              path={"/checkout"}
              component={() => (
                <ProtectedRoute>
                  <Checkout />
                </ProtectedRoute>
              )}
            />
            <Route
              path={"/wishlist"}
              component={() => (
                <ProtectedRoute>
                  <Wishlist />
                </ProtectedRoute>
              )}
            />
            <Route
              path={"/profile"}
              component={() => (
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              )}
            />
            <Route
              path={"/verification"}
              component={() => (
                <ProtectedRoute>
                  <IdVerificationStatus />
                </ProtectedRoute>
              )}
            />

            {/* Buyer Routes */}
            <Route
              path={"/buyer"}
              component={() => (
                <ProtectedRoute requiredRole="buyer">
                  <BuyerContainer />
                </ProtectedRoute>
              )}
            />
            <Route
              path={"/buyer/:rest*"}
              component={() => (
                <ProtectedRoute requiredRole="buyer">
                  <BuyerContainer />
                </ProtectedRoute>
              )}
            />
            <Route
              path={"/orders"}
              component={() => (
                <ProtectedRoute>
                  <Orders />
                </ProtectedRoute>
              )}
            />
            <Route
              path={"/orders/:id"}
              component={() => (
                <ProtectedRoute>
                  <OrderDetails />
                </ProtectedRoute>
              )}
            />

            {/* Seller Routes */}
            <Route
              path={"/seller"}
              component={() => (
                <ProtectedRoute requiredRole="seller">
                  <ModernSellerDashboard />
                </ProtectedRoute>
              )}
            />
            <Route
              path={"/seller/dashboard"}
              component={() => (
                <ProtectedRoute requiredRole="seller">
                  <ModernSellerDashboard />
                </ProtectedRoute>
              )}
            />
            <Route
              path={"/seller/products"}
              component={() => (
                <ProtectedRoute requiredRole="seller">
                  <ModernSellerDashboard />
                </ProtectedRoute>
              )}
            />
            <Route
              path={"/seller/add-product"}
              component={() => (
                <ProtectedRoute requiredRole="seller">
                  <ModernSellerDashboard />
                </ProtectedRoute>
              )}
            />
            <Route
              path={"/seller/reviews"}
              component={() => (
                <ProtectedRoute requiredRole="seller">
                  <ModernSellerDashboard />
                </ProtectedRoute>
              )}
            />
            <Route
              path={"/seller/orders"}
              component={() => (
                <ProtectedRoute requiredRole="seller">
                  <ModernSellerDashboard />
                </ProtectedRoute>
              )}
            />
            <Route
              path={"/seller/profile"}
              component={() => (
                <ProtectedRoute requiredRole="seller">
                  <ModernSellerDashboard />
                </ProtectedRoute>
              )}
            />
            <Route
              path={"/seller/analytics"}
              component={() => (
                <ProtectedRoute requiredRole="seller">
                  <ModernSellerDashboard />
                </ProtectedRoute>
              )}
            />
            <Route
              path={"/seller/wallet"}
              component={() => (
                <ProtectedRoute requiredRole="seller">
                  <ModernSellerDashboard />
                </ProtectedRoute>
              )}
            />
            <Route
              path={"/seller/deliveries"}
              component={() => (
                <ProtectedRoute requiredRole="seller">
                  <ModernSellerDashboard />
                </ProtectedRoute>
              )}
            />
            <Route
              path={"/seller/settings"}
              component={() => (
                <ProtectedRoute requiredRole="seller">
                  <ModernSellerDashboard />
                </ProtectedRoute>
              )}
            />

            {/* Admin Routes */}
            <Route
              path={"/admin"}
              component={() => (
                <ProtectedRoute requiredRole="admin">
                  <AdminDashboard />
                </ProtectedRoute>
              )}
            />
            <Route
              path={"/admin/:rest*"}
              component={() => (
                <ProtectedRoute requiredRole="admin">
                  <AdminSection />
                </ProtectedRoute>
              )}
            />

            {/* Unauthorized Route */}
            <Route path={"/unauthorized"} component={Unauthorized} />

            {/* 404 Route */}
            <Route path={"/404"} component={NotFound} />
            <Route component={NotFound} />
          </Switch>
        </div>
      </Suspense>
    </LayoutWrapper>
  );
}

function BuyerContainer() {
  const [location] = useLocation();

  return (
    <BuyerLayout>
      <Switch>
        <Route path="/buyer" component={BuyerDashboard} />
        <Route path="/buyer/delivery-tracking" component={DeliveryTracking} />
        <Route path="/buyer/profile" component={Profile} />
        <Route component={BuyerDashboard} />
      </Switch>
    </BuyerLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <AuthProvider>
          <CartProvider>
            <WishlistProvider>
              <TooltipProvider>
                <Toaster />
                <Router />
              </TooltipProvider>
            </WishlistProvider>
          </CartProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
