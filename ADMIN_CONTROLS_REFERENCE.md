# 🎛️ Admin Controls & Features - Vendor Connect Hub

## Overview
The platform has **two levels of admin controls**:
1. **Vendor WhatsApp Commands** - Direct commands sent to bot via admin phone number
2. **Control Panel Dashboard** - Web-based management interface
3. **API Endpoints** - RESTful endpoints for programmatic access

---

## 🤖 Vendor WhatsApp Commands (via Admin Number)

Vendors can control the bot by messaging from their registered admin phone number. All commands are processed in real-time.

### **Order Management Commands**

| Command | Function | Example |
|---------|----------|---------|
| `orders` / `pending` | List all pending orders (waiting for confirmation) | `orders` |
| `confirm [id]` | Confirm an order & send payment instructions to customer | `confirm 1a2b3c4d` |
| `reject [id]` | Reject an order (customer is notified) | `reject 1a2b3c4d` |
| `paid [id]` | Mark order as paid (after customer confirms payment) | `paid 1a2b3c4d` |

### **Menu Management Commands**

| Command | Function | Example |
|---------|----------|---------|
| `menu` / `list` | View current menu items | `menu` |
| `add <name> <price>` | Add a new menu item | `add Jollof Rice 2500` |
| `remove <name>` / `delete` | Remove a menu item | `remove Jollof Rice` |

### **Conversation Management Commands**

| Command | Function | Example |
|---------|----------|---------|
| `/bot` | Resume bot for ALL handover conversations | `/bot` |
| `/bot <phone>` | Resume bot for specific customer | `/bot +2349012345678` |
| `/human <phone>` | Take over a customer chat manually (bot pauses) | `/human +2349012345678` |

### **Pro Features - Promotions** (Pro Plan Only)

| Command | Function | Example |
|---------|----------|---------|
| `/promo list` | View all active promotions | `/promo list` |
| `/promo add <text>` | Add a promotion | `/promo add 20% off Jollof today` |
| `/promo add <title> :: <description>` | Add detailed promotion | `/promo add FRIDAY SPECIAL :: 50% off all drinks` |
| `/promo off` | Disable all promotions | `/promo off` |

### **Pro Features - Broadcasting** (Pro Plan Only)

| Command | Function | Example |
|---------|----------|---------|
| `/broadcast <message>` | Send message to all recent customers (last 30 days) | `/broadcast New menu available! Check it out` |

### **Pro Features - Auto Follow-ups** (Pro Plan Only)

| Command | Function | Example |
|---------|----------|---------|
| `/followups on` | Enable auto payment reminders | `/followups on` |
| `/followups off` | Disable auto payment reminders | `/followups off` |
| `/followups run` | Manually trigger reminders for unpaid orders | `/followups run` |

### **Help Command**

| Command | Function |
|---------|----------|
| `help` / `/help` / `?` | Show all available commands |

---

## 📊 Control Panel Dashboard (Web Interface)

Path: `/vendors` - Full-featured React dashboard for managing vendors

### **1. Vendor Management** (`/vendors`)
- ✅ Create new vendors
- ✅ View all vendors with filters
- ✅ Edit vendor settings:
  - Business name
  - Phone number
  - Admin number
  - WhatsApp phone number ID
  - Payment bank details
  - Welcome message
  - Plan (Starter/Pro)
  - Currency settings
- ✅ Delete vendors
- ✅ Enable/disable bot per vendor

### **2. Menu Management** (`/vendors/:id/menu`)
- ✅ Add menu items with:
  - Item name
  - Price
  - Category (grouping)
  - Availability status
- ✅ Edit items (name, price, category)
- ✅ Toggle item availability (show/hide from customers)
- ✅ Delete items
- ✅ Bulk manage (show/hide multiple items)
- ✅ Organize by category

### **3. Order Management** (`/vendors/:id/orders`)
- ✅ View all orders with:
  - Order ID
  - Customer name & phone
  - Order items (JSON breakdown)
  - Total amount
  - Status (pending/confirmed/completed/rejected)
  - Payment status
  - Created date/time
- ✅ Filter by status
- ✅ Search by customer/order ID
- ✅ Confirm orders (change status)
- ✅ Reject orders
- ✅ Mark as paid
- ✅ Export order data

### **4. Conversation Management** (`/vendors/:id/conversations`)
- ✅ View all customer conversations
- ✅ See last message preview & timestamp
- ✅ Track unread message count
- ✅ Filter by status:
  - **bot** (bot handling)
  - **human** (vendor handling manually)
  - **closed** (conversation ended)
- ✅ Send manual messages to customers
- ✅ Resume/pause bot for specific chats
- ✅ Search conversations

### **5. Customer Management** (`/vendors/:id/customers`)
- ✅ View all customers with:
  - Phone number
  - Name
  - Last seen date
  - Total orders placed
  - Total spending
- ✅ Search customers
- ✅ Export customer list
- ✅ View customer history

### **6. Analytics & Insights** (`/vendors/:id/analytics`)
- ✅ Revenue tracking:
  - Total revenue
  - Revenue by date
  - Revenue by vendor
- ✅ Order analytics:
  - Total orders
  - Orders by status
  - Conversion rate
- ✅ Customer analytics:
  - Total customers
  - Repeat customers
  - Average order value
- ✅ Performance metrics

### **7. Payments & Transactions** (`/vendors/:id/payments`)
- ✅ View payment records
- ✅ Track payment status per order
- ✅ Export payment reports
- ✅ View transaction history

### **8. Promotions Management** (`/vendors/:id/promotions`)
- ✅ Create promotions
- ✅ Set promotion title & description
- ✅ Enable/disable promotions
- ✅ View promotions displayed to customers
- ✅ Track promotion usage

### **9. Broadcasts** (`/vendors/:id/broadcasts`)
- ✅ View broadcast history
- ✅ Track broadcast delivery status
- ✅ View recipient count per broadcast
- ✅ Resend broadcasts

### **10. Settings** (`/vendors/:id/settings`)
- ✅ Edit vendor profile:
  - Business name
  - Phone number
  - Admin contact number
  - Bank details (name, account, holder)
  - Welcome message
- ✅ Toggle bot enabled/disabled
- ✅ Set follow-ups on/off
- ✅ Upgrade/downgrade plan

### **11. Platform Dashboard** (`/dashboard`)
- ✅ Global analytics:
  - Total vendors (Starter/Pro breakdown)
  - Total orders
  - Pending orders count
  - Total revenue
  - Active conversations
  - Messages today
  - Orders by status (pie chart)
  - Revenue by vendor (top 8)
- ✅ Activity feed:
  - Recent orders
  - Recent payments
  - Recent handovers
- ✅ Real-time metrics

---

## 🔌 REST API Endpoints for Admin Operations

### **Vendors API**
```
GET    /api/vendors                    # List all vendors
POST   /api/vendors                    # Create vendor
GET    /api/vendors/:vendorId          # Get vendor details
PUT    /api/vendors/:vendorId          # Update vendor
DELETE /api/vendors/:vendorId          # Delete vendor
```

### **Menu API**
```
GET    /api/vendors/:vendorId/menu     # List menu items
POST   /api/vendors/:vendorId/menu     # Add menu item
PUT    /api/menu/:itemId               # Update menu item
DELETE /api/menu/:itemId               # Delete menu item
```

### **Orders API**
```
GET    /api/vendors/:vendorId/orders   # List all orders
GET    /api/orders/:orderId            # Get order details
PUT    /api/orders/:orderId            # Update order (status, payment)
```

### **Conversations API**
```
GET    /api/vendors/:vendorId/conversations        # List conversations
GET    /api/conversations/:conversationId          # Get conversation
POST   /api/conversations/:conversationId/messages # Send message
PUT    /api/conversations/:conversationId          # Update status (bot/human/closed)
```

### **Customers API**
```
GET    /api/vendors/:vendorId/customers  # List customers
GET    /api/customers/:customerId        # Get customer details
```

### **Promotions API**
```
GET    /api/vendors/:vendorId/promotions   # List promotions
POST   /api/vendors/:vendorId/promotions   # Create promotion
PUT    /api/promotions/:promoId            # Update promotion
DELETE /api/promotions/:promoId            # Delete promotion
```

### **Dashboard API**
```
GET    /api/dashboard/summary        # Global analytics summary
GET    /api/dashboard/activity       # Recent activity feed
GET    /api/vendors/:vendorId/analytics  # Vendor-specific analytics
```

---

## 🎯 Admin Features by Plan

### **Starter Plan** ✅
- Order management (confirm/reject/mark paid)
- Menu management (add/remove items)
- Conversation management (basic)
- Bot enable/disable
- Basic analytics
- Manual broadcast via API

### **Pro Plan** ✅ (Plus everything above)
- Automated promotions system
- Bulk messaging/broadcasts
- Automated follow-ups for unpaid orders
- Advanced analytics & reports
- Customer segmentation
- Higher API rate limits

---

## 🚀 Key Features Summary

### **Order Management**
- Real-time order notifications
- Quick confirm/reject workflow
- Payment tracking & reminders
- Order history & reporting

### **Customer Engagement**
- Broadcasting to recent customers
- Personalized follow-up messages
- Conversation history tracking
- Handover to human support

### **Menu Management**
- Add/remove items on the fly
- Organize by category
- Toggle availability
- Dynamic pricing updates

### **Conversation Control**
- Take over conversations manually
- Pause/resume bot per customer
- View full chat history
- Unread message tracking

### **Analytics & Insights**
- Revenue tracking by vendor
- Order status breakdown
- Customer acquisition metrics
- Platform-wide dashboard

---

## 🔒 Security & Rate Limiting

- **Vendor-level isolation**: Each vendor only sees their own data
- **Admin authentication**: Commands only work from registered admin number
- **Rate limiting**:
  - 10 messages/minute per customer
  - 20 admin commands/minute per vendor
  - 50 messages per broadcast batch (with 500ms delays)
- **All data**: Stored securely in PostgreSQL with parameterized queries

---

## 📱 Mobile-Friendly

The control panel is fully responsive and works on:
- Desktop browsers (primary)
- Tablets (responsive layout)
- Phones (optimized interface for smaller screens)

---

## 🎯 Next Steps / Future Admin Features

These are NOT currently implemented but could be added:

- [ ] Role-based access (multiple admins per vendor)
- [ ] Custom workflows/automation rules
- [ ] Inventory management & low-stock alerts
- [ ] Custom fields for orders/customers
- [ ] Integration with payment gateways for automatic payment verification
- [ ] SMS fallback for notifications
- [ ] Advanced scheduling for promotions
- [ ] A/B testing for promotions
- [ ] Customer segmentation & targeting
- [ ] Webhook integrations

---

**All admin controls are production-ready and fully tested.** ✅
