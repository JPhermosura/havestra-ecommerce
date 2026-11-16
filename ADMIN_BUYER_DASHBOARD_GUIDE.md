# E-commerce Platform - Admin & Buyer Dashboard Implementation Guide

## 🎯 Project Overview

This is a fully functional agriculture e-commerce platform with complete admin and buyer dashboards. Users can browse products, manage carts, create orders, and admins can manage the entire system.

---

## 🏗️ ARCHITECTURE

### Frontend (React)

- **Admin Dashboard**: Full system management interface
- **Buyer Dashboard**: Personal order/account management
- **Products Page**: Browse & filter agricultural products
- **Checkout**: Create orders with Cash-On-Delivery
- **Cart**: Local/backend persistent cart system

### Backend (Node.js + Express)

- **Admin APIs**: User, Product, Order, Stats management
- **Auth**: JWT-based authentication
- **Database**: MongoDB with full data population
- **Middleware**: Role-based authorization

---

## 🔐 USER ROLES

### Admin

- **Full system control** over users, products, orders
- Can change user roles (buyer → seller → admin)
- Can delete users (except other admins)
- Can delete any product
- Can update order statuses
- Receives system alerts

### Seller

- Can create/manage products
- Can view their own orders
- Can manage inventory

### Buyer

- Can browse products (Fruits/Vegetables only)
- Can add to cart and checkout
- Can view order history
- Can write reviews

---

## 📁 KEY FILES

### Frontend

```
client/src/pages/
├── admin/
│   └── AdminDashboard.tsx        # Admin management interface
├── buyer/
│   └── BuyerDashboard.tsx        # Buyer account dashboard
├── Products.tsx                   # Product browsing/filtering
├── Checkout.tsx                   # Order creation
└── Cart.tsx                       # Cart management

client/src/contexts/
├── AuthContext.tsx               # User authentication
└── CartContext.tsx               # Cart state management
```

### Backend

```
server/
├── index.ts                       # Main server file
├── models/
│   ├── User.ts                   # User schema
│   ├── Product.ts                # Product schema
│   ├── Order.ts                  # Order schema
│   └── ...
└── [Admin APIs embedded in index.ts]
```

---

## 🚀 QUICK START

### 1. Setup Environment

```bash
cd ecommerce-plat
npm install
# or
pnpm install
```

### 2. Start Backend

```bash
npm run server
# Runs on http://localhost:5000
```

### 3. Start Frontend

```bash
npm run dev
# Runs on http://localhost:3000
```

### 4. Create Admin User

```bash
# POST /api/register
{
  "email": "admin@example.com",
  "password": "admin123",
  "name": "Admin User",
  "role": "admin"
}
```

### 5. Login & Navigate

- Login at `/login`
- Go to `/admin` for admin dashboard
- Or `/products` to browse as buyer

---

## 📊 ADMIN DASHBOARD FEATURES

### Dashboard Tab

Shows **4 stat cards**:

- Total Users (with seller count)
- Total Products
- Total Orders
- Total Revenue

Plus **2 charts**:

- Weekly Sales (bar chart)
- System Alerts (pending verifications)

### Users Tab

**Features**:

- Search by name/email
- Filter by role (buyer/seller/admin)
- Change user role (click Edit icon)
- Delete non-admin users (click Trash icon)
- View join date

**API Used**: `GET /api/admin/users`, `PUT /api/admin/users/:id/role`, `DELETE /api/admin/users/:id`

### Products Tab

**Features**:

- Search by product name
- View all products with details
- See seller name
- View stock levels
- Filter listings by pending, approved, or rejected review status
- Approve listings or reject with a reason; sellers receive an in-app notice
- Delete any product

**API Used**: `GET /api/admin/products`, `DELETE /api/admin/products/:id`

### Seller inventory and listing review

- New seller listings are hidden from buyers until an admin approves them.
- Sellers can update stock from their product list; stock must be a non-negative whole number.
- Products at five or fewer units show a low-stock indicator, and sellers receive an in-app alert when stock crosses into that range.
- Editing an approved listing sends it back for review. Updating inventory alone does not.

### Orders Tab

**Features**:

- Filter by status (pending/confirmed/shipped/delivered/etc)
- Update order status from dropdown
- View buyer name, items, total
- See order date

**API Used**: `GET /api/admin/orders`, `PUT /api/admin/orders/:id/status`

### Analytics Tab

- Placeholder for future expansion
- Can add: revenue trends, top products, seller performance

---

## 🛍️ BUYER DASHBOARD FEATURES

### Dashboard Tab

Shows **4 stat cards**:

- Total Orders
- Total Spent
- Wishlist Items
- Reviews Given

Plus **Recent Orders** list

### Orders Tab

- **Search** orders by ID/product name
- **Filter** by status (pending/processing/shipped/delivered)
- **View details** of each order
- **Leave review** for delivered orders
- **Cancel order** for pending/processing

### Wishlist Tab

- View saved items
- See farmer info
- Check stock status
- Add to cart quickly

### Reviews Tab

- View all written reviews
- See rating & comment
- Review date

### Profile Tab

- Update personal information
- Manage shipping address
- Change password

---

## 🛒 BUYER SHOPPING FLOW

### 1. Browse Products (`/products`)

```
Search by name → Select category → Set price range →
Filter by farm location → Sort by price/rating
```

**Filters Available**:

- Category: Fruits / Vegetables
- Farm Location: Dynamic list
- Availability: Available / Pre-order / Out of season
- Price Range: Min and Max
- Sort: Price (Low/High) / Rating / Newest

### 2. Add to Cart

- Click "Add to Cart" on product card
- Toast notification: "Added to cart"
- Item added to local storage + backend (if logged in)

### 3. View Cart

- Click cart icon in navigation
- See all items with quantities
- Adjust quantities with +/- buttons
- See total price

### 4. Checkout (`/checkout`)

```
Step 1: Shipping Info
  ↓ Enter name, email, phone, address, city
Step 2: Payment Method
  ↓ Select COD (Cash On Delivery only)
Step 3: Order Confirmation
  ↓ Review order summary
  ↓ Confirm payment
```

**Order Created**:

- Order saved to database with `status: "pending"`
- Items linked with seller IDs
- COD payment recorded
- Cart cleared
- Confirmation displayed

### 5. Track Order

- Go to `/buyer/dashboard` → Orders tab
- See all orders with status
- Can update status from admin

### Marketplace updates

- Product search treats entered text literally; sorting, price, location, and availability filters work together.
- Buyers can review a product once after a delivered order that contains it. Product ratings update from submitted reviews.
- Buyer and seller dashboards show in-app order, delivery, and review notifications. The notification list refreshes periodically while the dashboard is open.
- Order details show tracking history, courier, tracking number, and estimated delivery when available.
- Notifications are in-app only; email, SMS, and push delivery are not configured.

---

## 🔌 API ENDPOINTS

### Admin Endpoints (Protected - Admin Only)

#### Stats

```
GET /api/admin/stats
Response: {
  totalUsers, totalSellers, totalProducts,
  totalOrders, totalRevenue, pendingVerifications, activeDisputes
}
```

#### Users

```
GET /api/admin/users?page=1&limit=20&role=all
POST /api/admin/users (would be for bulk operations)
PUT /api/admin/users/:id/role { role: "seller" | "buyer" | "admin" }
DELETE /api/admin/users/:id
```

#### Products

```
GET /api/admin/products?page=1&limit=20&category=all
DELETE /api/admin/products/:id
```

#### Orders

```
GET /api/admin/orders?page=1&limit=20&status=all
PUT /api/admin/orders/:id/status { status: "pending" | "confirmed" | ... }
```

### Buyer Endpoints

#### Products

```
GET /api/products?category=Fruits&search=tomato&sortBy=newest
GET /api/products/:id
```

#### Cart

```
GET /api/cart
POST /api/cart { productId, name, price, quantity, sellerId }
PUT /api/cart/:productId { quantity }
DELETE /api/cart/:productId
```

#### Orders

```
POST /api/orders { shippingAddress, paymentMethod: "cod" }
GET /api/orders/buyer/:buyerId
GET /api/orders/:orderId
```

---

## 🔒 SECURITY IMPLEMENTATION

### Authentication

- JWT tokens stored in localStorage
- `Authorization: Bearer <token>` header required
- Token expires in 7 days

### Authorization

- All admin routes check `user.role === 'admin'`
- Cannot delete admin users
- Admin can only modify their own products (in seller context)

### Validation

```javascript
// Only Fruits & Vegetables allowed
const validCategories = ["Fruits", "Vegetables"];

// Order statuses validated
const validStatuses = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];

// All products must have sellerId
```

### Protected Routes

```javascript
// Frontend route protection
if (!user || user.role !== "admin") {
  return <AccessDenied />;
}

// Backend middleware
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Token required" });
  jwt.verify(token, SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user;
    next();
  });
};

const authorizeRoles =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
```

---

## 🧪 TESTING SCENARIOS

### Scenario 1: Admin User Management

```
1. Login as admin
2. Go to /admin/users
3. Search for a user
4. Click Edit → Change role to "seller" → Save
5. Verify role changed in table
6. Click Delete on non-admin user
7. Confirm deletion → Verify removed from table
```

### Scenario 2: Admin Product Management

```
1. Go to /admin/products
2. Search for product "tomato"
3. See seller name in table
4. Click Delete → Confirm
5. Verify product removed
6. Go back to /products as buyer
7. Search "tomato" → Product gone
```

### Scenario 3: Admin Order Management

```
1. Create order as buyer:
   - Go to /products
   - Add item to cart
   - Checkout with COD
   - Confirm order
2. Login as admin at /admin/orders
3. See new order with status "pending"
4. Change status dropdown to "shipped"
5. Verify status updated immediately
6. Status persists in database
```

### Scenario 4: Buyer Shopping

```
1. Register as buyer
2. Go to /products
3. Filter: Category=Vegetables, Price 100-500
4. Add tomatoes to cart
5. Cart shows 1 item
6. Add carrots
7. Cart shows 2 items, total updated
8. Go to checkout
9. Fill shipping info
10. Select COD payment
11. Confirm order
12. See confirmation page
13. Go to /buyer/dashboard → Orders
14. See new order with "pending" status
```

---

## 🐛 COMMON ISSUES & FIXES

### Issue: Admin can't see users

```
❌ Make sure user logged in with role: "admin"
✅ Check localStorage for token: localStorage.getItem('token')
✅ Verify in browser DevTools → Network → check auth header
```

### Issue: Orders not showing in admin

```
❌ Orders might not be created yet
✅ Create order as buyer first
✅ Check backend logs for errors
✅ Verify /api/admin/orders endpoint returns data
```

### Issue: Delete operation fails

```
❌ Trying to delete admin user → Not allowed
✅ Can only delete non-admin users
❌ Product/user might already be deleted
✅ Refresh page to sync
```

### Issue: Order status not updating

```
❌ Check token is still valid (refresh page if expired)
✅ Status must be valid (from predefined list)
✅ Verify order exists in database
```

---

## 📈 DATA MODELS

### User

```typescript
{
  _id: ObjectId,
  name: string,
  email: string,
  password: string (hashed),
  role: "buyer" | "seller" | "admin",
  phone?: string,
  address?: string,
  city?: string,
  country?: string,
  zipCode?: string,
  createdAt: Date,
  updatedAt: Date
}
```

### Product

```typescript
{
  _id: ObjectId,
  name: string,
  description: string,
  price: number,
  category: "Fruits" | "Vegetables",
  seller: ObjectId (ref to User),
  stock: number,
  images: string[],
  createdAt: Date,
  updatedAt: Date
}
```

### Order

```typescript
{
  _id: ObjectId,
  id: string, // ORD-123456
  buyerId: ObjectId (ref to User),
  items: [
    {
      productId: ObjectId,
      name: string,
      quantity: number,
      price: number,
      sellerId: ObjectId
    }
  ],
  total: number,
  status: "pending" | "confirmed" | "processing" | "shipped" | "delivered",
  paymentMethod: "cod",
  shippingAddress: {
    street: string,
    city: string,
    province: string,
    zipCode: string
  },
  createdAt: Date,
  updatedAt: Date
}
```

---

## 🚀 PRODUCTION DEPLOYMENT

### Environment Variables

```
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/db
JWT_SECRET=your-secret-key-here
NODE_ENV=production
PORT=5000
```

### Build

```bash
npm run build
npm run preview
```

### Database Backup

```bash
mongodump --uri "mongodb://..." --out ./backup
```

### Security Checklist

- [ ] Change JWT_SECRET in production
- [ ] Enable HTTPS
- [ ] Set CORS properly
- [ ] Enable MongoDB authentication
- [ ] Add rate limiting
- [ ] Enable request validation
- [ ] Log all admin actions
- [ ] Setup monitoring

---

## 📚 ADDITIONAL RESOURCES

- [Wouter Docs](https://github.com/molefrog/wouter) - Routing
- [React Hooks](https://react.dev/reference/react) - State Management
- [Express API](https://expressjs.com/) - Backend Framework
- [MongoDB Docs](https://docs.mongodb.com/) - Database
- [JWT](https://jwt.io/) - Authentication

---

## 👥 SUPPORT

For issues or questions:

1. Check the testing scenarios above
2. Review error messages in browser console
3. Check backend logs: `npm run server`
4. Verify API responses in Network tab
5. Check database connection in terminal

---

**Last Updated**: May 5, 2026
**Version**: 1.0 - Production Ready
