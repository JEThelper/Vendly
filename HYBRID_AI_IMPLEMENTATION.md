# Hybrid AI/Rule-Based Order Extraction Implementation

## ✅ What's Implemented

The WhatsApp bot now uses a **hybrid intelligence system** for smarter order processing while maintaining full system stability.

### Architecture

```
Customer Message
      ↓
[Is this an order?]
      ↓ Yes
[Try AI Extraction] → OpenAI GPT-4o-mini
      ↓ (if AI fails) → [Use Rule-Based Parser]
      ↓
[Fuzzy Match Against Menu] → Fuse.js
      ↓
[Ask for Confirmation] → Store in Pending Orders
      ↓
[Customer replies "YES"/NO] → [Create Order] or [Cancel]
```

### New Features

1. **AI-Powered Order Understanding**
   - Uses OpenAI GPT-4o-mini to extract item and quantity
   - Handles natural language orders like "I need one plate of jellof rice"
   - Results in JSON: `{ "item": "Jollof Rice", "quantity": 1 }`

2. **Fuzzy Matching**
   - Uses Fuse.js for intelligent menu matching
   - Handles typos and variations (e.g., "Jollof" matches "Jollof Rice")
   - 3-tier matching: exact → substring → fuzzy

3. **Confirmation Step (NEW)**
   - Before creating orders, bot asks for confirmation
   - Message: "You want 1× Jollof Rice for ₦5,000. Reply YES to confirm or NO to cancel."
   - Customer response triggers order creation
   - 15-minute timeout on pending orders (auto-cleanup)

4. **Graceful Fallback**
   - If AI fails (no API key, network error, invalid response) → rule-based parser takes over
   - System ALWAYS works, AI is optional enhancement
   - No broken orders from AI failures

### Core Files Created

#### 1. `src/lib/ai-extractor.ts`
- `aiExtractOrder(text: string): Promise<ExtractedOrder | null>`
- Calls OpenAI API with fail-safe error handling
- Returns `{ item: string, quantity: number }` or `null`
- Handles JSON parsing, validation, and timeout

#### 2. `src/lib/fuzzy-match.ts`
- `findBestMenuMatch(itemName, menuItems): MenuItemRow | null`
- Exact match → Substring match → Fuzzy match
- Uses Fuse.js with 0.6 similarity threshold

#### 3. `src/lib/pending-orders.ts`
- In-memory store for order confirmations awaiting customer "YES"
- Key: `${vendorId}:${customerPhone}`
- Auto-cleanup after 15 minutes of inactivity
- Functions: `setPendingOrder()`, `getPendingOrder()`, `clearPendingOrder()`

### Modified Files

#### `artifacts/api-server/package.json`
- Added dependencies:
  - `openai`: ^4.47.0 (OpenAI API client)
  - `fuse.js`: ^7.0.0 (Fuzzy matching)

#### `artifacts/api-server/src/lib/bot.ts`
**New function: `getOrderData(text)`**
- Hybrid extraction: tries AI first, then rule-based
- Returns `{ item?: string, quantity?: number }`

**Updated: `computeBotReply()`**
- New confirmation flow before order creation
- Checks for "YES"/"NO" replies to pending orders
- Stores pending orders with fuzzy-matched menu items
- Creates order only after confirmation

## 🔄 Order Flow (New)

### Customer Journey

```
Customer: "I need one jelly rice"
   ↓
Bot uses AI to extract: { item: "jelly rice", quantity: 1 }
   ↓
Fuzzy match: finds "Jelly Rice" (₦4,500)
   ↓
Store as pending order
   ↓
Bot: "You want 1× Jelly Rice for ₦4,500. Reply YES to confirm or NO to cancel."
   ↓
Customer: "YES"
   ↓
Order created in database
   ↓
Bot: "Order confirmed! Order #abc123 sent to vendor. They'll confirm shortly."
   ↓
Admin notified
```

### Fallback Scenario (No AI Key)

```
Customer: "I need one jelly rice"
   ↓
AI extraction returns null (no OPENAI_API_KEY)
   ↓
Rule-based parser tries patterns: can't match exact pattern
   ↓
Fuzzy match: finds "Jelly Rice"
   ↓
[Same flow continues from confirmation...]
```

## 🔐 Configuration

### Environment Variable

Add to your `.env`:
```env
OPENAI_API_KEY=sk-proj-your-key-here
```

**Note:** If not set, bot works in stub mode using only rule-based extraction.

## ✅ Strict Requirements Met

- ✅ AI is OPTIONAL, not required
- ✅ System works with or without AI
- ✅ NEVER breaks existing logic
- ✅ NEVER creates order without menu validation
- ✅ NEVER skips confirmation step
- ✅ Fuzzy matching prevents wrong orders
- ✅ AI failures fail gracefully
- ✅ Timeout cleanup prevents orphaned orders

## 🧪 Test Cases

### AI Success Path
```
Input: "I'd like two plates of jollof rice"
AI: { "item": "jollof rice", "quantity": 2 }
Menu match: "Jollof Rice" ✓
Pending order created
Bot asks: "You want 2× Jollof Rice for ₦10,000. Reply YES..."
Customer: "YES"
Order created ✓
```

### AI Failure → Fallback Path
```
Input: "I'd like two plates of jollof rice"
AI fails (timeout/error)
Rule-based parser runs
Can't parse exact pattern
Fuzzy match: tries "plates of jollof rice"
Menu match: "Jollof Rice" ✓
Pending order created
[Rest of flow same as above]
```

### Number-Based Order (Still Works)
```
Input: "1, 3x2"
looksLikeOrder() = true
parseOrderLine() = [{ kind: "number", index: 1, qty: 1 }, { kind: "number", index: 3, qty: 2 }]
Items matched from menu
Pending order created
Bot asks for confirmation ✓
```

## 🚀 Future Enhancements

1. Multi-item support: "I want 2 jollof rice and 1 chicken" 
   - Current: handles first item, user must confirm separately
   - Future: extract multiple items in one shot

2. Conversation memory: remember customer's last orders (Pro feature)

3. Smart sizing: detect "large" vs "medium" pizza variations

4. Allergen/diet info: "I want vegan pizza"

## 📋 Backward Compatibility

- ✅ All existing number-based orders work unchanged
- ✅ All existing name-based orders work unchanged
- ✅ All existing admin commands unchanged
- ✅ Database schema unchanged
- ✅ Existing menu and order creation flow preserved

