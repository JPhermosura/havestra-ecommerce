# Havestra ERD

This ERD documents the main entities and relationships in the platform's MongoDB schema.

```mermaid
erDiagram
  USERS {
    ObjectId _id PK
    String phone
    String email
    String name
    String role
    String address
    String city
    String country
    String zipCode
    Boolean isFarmer
    Boolean isSellerApproved
    Boolean isSuspended
    Date createdAt
    Date updatedAt
  }

  PRODUCTS {
    ObjectId _id PK
    String name
    String title
    String description
    Number price
    Number stock
    String category
    Boolean weightBased
    ObjectId farmerId FK
    ObjectId sellerId FK
    String farmerName
    String sellerName
    Date createdAt
    Date updatedAt
  }

  ORDERS {
    ObjectId _id PK
    String orderId
    ObjectId buyerId FK
    String buyerName
    String buyerPhone
    String buyerEmail
    Number totalAmount
    String status
    String paymentMethod
    String paymentStatus
    Date estimatedDelivery
    Date shippedAt
    Date deliveredAt
    Date createdAt
    Date updatedAt
  }

  ORDER_ITEMS {
    ObjectId productId FK
    Number unitPrice
    Number quantity
    Number totalPrice
    ObjectId sellerId FK
    ObjectId farmerId FK
  }

  REVIEWS {
    ObjectId _id PK
    ObjectId productId FK
    ObjectId userId FK
    Number rating
    String comment
    Date createdAt
    Date updatedAt
  }

  // Relationships
  USERS ||--o{ ORDERS : "places"
  USERS ||--o{ PRODUCTS : "lists/sells"
  USERS ||--o{ REVIEWS : "writes"

  PRODUCTS ||--o{ REVIEWS : "has"
  PRODUCTS ||--o{ ORDER_ITEMS : "included_in"

  ORDERS ||--o{ ORDER_ITEMS : "contains"

  // Wishlist (many-to-many simplified)
  USERS }o--o{ PRODUCTS : "wishlist"

  // Cart is embedded in USERS as CartItems referencing PRODUCTS (1-to-many)
  USERS ||--o{ ORDER_ITEMS : "cartItems (embedded)"
```

Notes:
- MongoDB is schema-flexible; many arrays are embedded subdocuments (cart items, order items, trackingHistory).
- Foreign keys are represented with ObjectId references to other collections (`ref`).
- `ORDER_ITEMS` shown separately for clarity even though order items are stored embedded inside `orders` in the codebase.

If you'd like, I can:
- Export this diagram as a PNG/SVG and add it to `server/diagrams/`.
- Generate a PDF or include this diagram in a README.
