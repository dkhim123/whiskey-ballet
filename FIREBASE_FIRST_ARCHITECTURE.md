# Firebase-First Architecture Implementation Guide

## Overview

The Smart-Biz-KE system has been updated from **offline-first** to **online-first** architecture, making Firebase the primary storage while maintaining full offline capabilities.

---

## Architecture Changes

### Before (Offline-First)
```
User Action → IndexedDB (Primary) → Firebase (Optional)
```
- IndexedDB was the main storage
- Firebase was optional backup
- Worked offline by default

### After (Online-First with Offline Fallback)
```
User Action → Firebase (Primary) → IndexedDB (Cache) → Sync Queue (if offline)
                                                              ↓
                                                      Auto-sync when online
```
- Firebase is the primary storage
- IndexedDB is the offline cache
- Automatic sync when connection restored
- Firebase serves as the backup

---

## Key Components

### 1. Sync Manager (`src/utils/syncManager.js`)

**Purpose**: Manages online/offline transitions and data synchronization

**Features**:
- ✅ Real-time online/offline detection
- ✅ Sync queue for offline changes
- ✅ Auto-sync when connection restored
- ✅ Batch operations for efficiency (500 items per batch)
- ✅ Full sync capability for data recovery
- ✅ Status notifications via listeners

**Usage**:
```javascript
import syncManager from '../utils/syncManager'

// Get current status
const status = syncManager.getStatus()
// { online: true, syncing: false, queueSize: 0, lastSync: Date }

// Listen to status changes
syncManager.addListener((status) => {
  console.log('Status changed:', status)
})

// Trigger full sync (backup all local data to Firebase)
await syncManager.fullSync(adminId)

// Get sync status
const { online, syncing, queueSize, lastSync } = syncManager.getStatus()
```

### 2. Firebase-First Storage (`src/utils/firebaseStorageOnline.js`)

**Purpose**: Provides Firebase-first storage with offline fallback

**Key Functions**:

#### Write Data
```javascript
import { writeSharedDataOnline } from '../utils/firebaseStorageOnline'

// Write to Firebase (primary) and cache to IndexedDB
await writeSharedDataOnline(data, adminId)
// → Writes to Firebase first
// → Caches to IndexedDB
// → If offline: queues for sync
```

#### Read Data
```javascript
import { readSharedDataOnline } from '../utils/firebaseStorageOnline'

// Read from Firebase (primary) or IndexedDB cache (offline)
const data = await readSharedDataOnline(adminId)
// → Tries Firebase first (when online)
// → Falls back to IndexedDB cache (if offline)
// → Updates cache in background
```

#### Real-Time Subscriptions (Admin Monitoring)
```javascript
import { subscribeToSharedData } from '../utils/firebaseStorageOnline'

// Subscribe to real-time updates from Firebase
const unsubscribe = subscribeToSharedData(
  adminId,
  'transactions',
  (transactions) => {
    console.log('Real-time update:', transactions)
    // Update UI with new data
  },
  {
    branchId: 'branch_123',  // Optional: filter by branch
    userId: 'user_456',      // Optional: filter by user
    orderBy: 'timestamp',    // Optional: order results
    limit: 50                // Optional: limit results
  }
)

// Unsubscribe when done
unsubscribe()
```

#### Write Single Item
```javascript
import { writeItemOnline } from '../utils/firebaseStorageOnline'

// Write single item to Firebase and cache
await writeItemOnline('transactions', transaction, adminId)
// → Writes to Firebase
// → Caches to IndexedDB
// → Queues if offline
```

#### Delete Item (Soft Delete)
```javascript
import { deleteItemOnline } from '../utils/firebaseStorageOnline'

// Soft delete item
await deleteItemOnline('transactions', transactionId, adminId)
// → Marks as deleted in Firebase
// → Updates cache
// → Queues if offline
```

### 3. Sync Status Component (`src/components/SyncStatus.jsx`)

**Purpose**: Visual indicator for sync status

**Features**:
- ✅ Online/Offline indicator (Green/Red)
- ✅ Firebase connection status (Purple)
- ✅ Sync progress (Blue spinner)
- ✅ Pending queue count (Yellow)
- ✅ Last sync timestamp (Gray)

**How it looks**:
```
[🟢 Online] [Firebase] [✓ Synced]  ← All good
[🔴 Offline] [⏳ 5 pending]         ← Offline with queue
[🟢 Online] [↻ Syncing...]          ← Syncing changes
```

---

## How It Works

### Scenario 1: Normal Operation (Online)

```
User creates a sale
      ↓
Write to Firebase ✓
      ↓
Cache to IndexedDB ✓
      ↓
Done! ✅
```

**Result**: Data saved to Firebase immediately, cached locally

### Scenario 2: Power Outage (Offline)

```
User creates a sale (offline)
      ↓
Firebase unreachable
      ↓
Cache to IndexedDB ✓
      ↓
Add to sync queue ✓
      ↓
Show "⏳ 1 pending"
```

**Result**: Data saved locally, queued for sync

### Scenario 3: Power Restored (Reconnection)

```
Internet connection restored
      ↓
Sync manager detects online
      ↓
Process sync queue
      ↓
Upload queued changes to Firebase ✓
      ↓
Update cache ✓
      ↓
Show "✓ Synced"
```

**Result**: All offline changes synced to Firebase

### Scenario 4: Data Loss Recovery

```
Local data lost
      ↓
Admin logs in
      ↓
Read from Firebase ✓
      ↓
Rebuild IndexedDB cache ✓
      ↓
All data restored!
```

**Result**: Data recovered from Firebase backup

---

## Admin Monitoring Features

### Real-Time Branch Monitoring

Admins can now monitor all branches in real-time:

```javascript
// Subscribe to all transactions across all branches
const unsubscribe = subscribeToSharedData(
  adminId,
  'transactions',
  (transactions) => {
    // Filter by branch
    const branchA = transactions.filter(t => t.branchId === 'branch_a')
    const branchB = transactions.filter(t => t.branchId === 'branch_b')
    
    // Update dashboard
    updateDashboard({ branchA, branchB })
  }
)
```

### Branch Switching

Dashboard will support branch filtering:

```javascript
// Filter transactions by branch
const branchTransactions = transactions.filter(t => 
  t.branchId === selectedBranch
)

// Filter by cashier within branch
const cashierTransactions = branchTransactions.filter(t => 
  t.userId === selectedCashier
)
```

### Data Isolation

Cashiers can only see their own work:

```javascript
// For cashiers: filter by their userId
const myTransactions = transactions.filter(t => 
  t.userId === currentUser.id &&
  t.branchId === currentUser.branchId
)

// For admins: see everything
const allTransactions = transactions // No filter
```

---

## Firebase Data Structure

```
organizations/
  └── {adminId}/
      ├── inventory/
      │   └── {itemId}: { name, quantity, branchId, ... }
      ├── transactions/
      │   └── {txId}: { items, total, userId, branchId, ... }
      ├── branches/
      │   └── {branchId}: { name, location, ... }
      ├── users/
      │   └── {userId}: { name, email, role, branchId, ... }
      ├── expenses/
      │   └── {expenseId}: { amount, category, branchId, ... }
      ├── customers/
      │   └── {customerId}: { name, phone, branchId, ... }
      └── settings/
          └── config: { storeName, vatRate, ... }
```

**Key Points**:
- All data is organized under `organizations/{adminId}`
- Each item includes `branchId` for isolation
- `userId` tracks who created/modified items
- `updatedAt` and `syncedAt` timestamps for tracking

---

## Migration Path

### Step 1: Install Dependencies (Already Done)
```bash
npm install  # Firebase SDK already in package.json
```

### Step 2: Configure Firebase

Create `.env.local` file:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

### Step 3: Deploy Firestore Rules

File: `firestore.rules`
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Organizations collection (admin isolation)
    match /organizations/{adminId}/{document=**} {
      // Admin can read/write their own organization
      allow read, write: if request.auth != null && 
        request.auth.uid == adminId;
      
      // Cashiers can read/write only their branch data
      allow read: if request.auth != null && 
        request.auth.token.branchId == resource.data.branchId;
      allow write: if request.auth != null && 
        request.auth.token.branchId == request.resource.data.branchId;
    }
  }
}
```

Deploy:
```bash
firebase deploy --only firestore:rules
```

### Step 4: Initial Data Sync

When admin first logs in after update:
```javascript
import syncManager from '../utils/syncManager'

// Sync all existing data to Firebase
await syncManager.fullSync(adminId)
```

This will:
- ✅ Upload all inventory to Firebase
- ✅ Upload all transactions to Firebase
- ✅ Upload all customers, suppliers, etc.
- ✅ Preserve IndexedDB cache
- ✅ Enable real-time sync going forward

---

## Benefits of This Architecture

### 1. **Admin Can Monitor Everything**
- See all branches in real-time on phone
- Switch between branches in dashboard
- Monitor cashier activities live
- Get instant notifications

### 2. **Offline Resilience**
- Works during power outages
- Queues changes automatically
- Syncs when power restored
- No data loss

### 3. **Data Backup**
- Firebase serves as backup
- Can recover if local data lost
- Import from Firebase anytime
- Historical data preserved

### 4. **Data Isolation**
- Cashiers only see their work
- Branch data separated
- Admin sees everything
- Secure multi-tenant

### 5. **Scalability**
- Firebase handles unlimited data
- IndexedDB for fast local access
- Batch operations for efficiency
- Real-time updates at scale

---

## Testing Scenarios

### Test 1: Normal Operation
1. Create a sale while online
2. Verify appears in Firebase Console
3. Verify cached in IndexedDB
4. Check sync status shows "✓ Synced"

### Test 2: Power Outage
1. Disconnect internet
2. Create sales (should work offline)
3. Check sync status shows "⏳ 2 pending"
4. Reconnect internet
5. Verify auto-sync happens
6. Check Firebase Console has new sales

### Test 3: Data Recovery
1. Clear IndexedDB cache
2. Refresh app
3. Log in as admin
4. Verify data loads from Firebase
5. Check IndexedDB cache rebuilt

### Test 4: Branch Monitoring
1. Log in as admin
2. Switch to Branch A in dashboard
3. See only Branch A transactions
4. Switch to Branch B
5. See only Branch B transactions
6. Select "All Branches"
7. See all transactions

### Test 5: Cashier Isolation
1. Log in as cashier
2. Verify can only see own transactions
3. Verify cannot see other cashiers' work
4. Verify cannot switch branches

---

## Troubleshooting

### Issue: Sync Queue Not Clearing

**Check**:
```javascript
const status = syncManager.getStatus()
console.log(status.queueSize)  // Number of pending items
```

**Solution**:
```javascript
// Manually trigger sync
await syncManager.syncAll()
```

### Issue: Firebase Not Connected

**Check**:
```javascript
import { isFirebaseConfigured } from '../config/firebase'
console.log(isFirebaseConfigured())  // Should be true
```

**Solution**:
- Verify `.env.local` file exists
- Check Firebase credentials are correct
- Restart development server

### Issue: Data Not Syncing

**Check Browser Console**:
- Look for Firebase errors
- Check network tab for failures
- Verify Firestore rules allow access

**Solution**:
- Redeploy Firestore rules
- Check Firebase project is active
- Verify user has admin permissions

---

## Next Steps

### Phase 3: Branch Filtering in Dashboard
- [ ] Add branch selector to AdminDashboard
- [ ] Filter transactions by selected branch
- [ ] Show cashier dropdown for selected branch
- [ ] Update all metrics by branch

### Phase 4: Real-Time Monitoring
- [ ] Subscribe to real-time transactions
- [ ] Show live updates in dashboard
- [ ] Add activity feed for admin
- [ ] Implement notifications

### Phase 5: Data Isolation Enforcement
- [ ] Add middleware for cashier access
- [ ] Enforce branchId in all queries
- [ ] Test cashier cannot see other branches
- [ ] Add audit logging

---

## Support

For issues or questions:
- Check console logs for errors
- Verify Firebase configuration
- Test sync status component
- Review this guide

**Remember**: Firebase is now PRIMARY storage. Always ensure it's configured and working properly for production use.
