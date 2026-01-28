# Smart Biz KE - Multi-Branch POS System

A comprehensive Point of Sale (POS) system built with Next.js for managing multi-branch retail operations. Features offline-first architecture with Firebase Firestore integration for real-time synchronization.

## 🚀 Features

### Core Features
- **Multi-Branch Management** - Manage multiple retail branches with isolated data
- **Offline-First** - Works completely offline using IndexedDB and localStorage
- **Real-time Sync** - Automatic synchronization with Firebase Firestore when online
- **PWA Support** - Install as a mobile/desktop app with offline capabilities
- **User Roles** - Admin and Cashier roles with branch-specific permissions

### Business Modules
- **Point of Sale** - Fast checkout with barcode scanning and QR code support
- **Inventory Management** - Track stock levels per branch with low-stock alerts
- **Expense Tracking** - Monitor expenses by branch with detailed reporting
- **Reports & Analytics** - Sales reports, profit analysis, and business insights
- **Supplier Management** - Manage suppliers and purchase orders
- **Payment Processing** - Cash and M-Pesa payment support
- **Customer Credit** - Track credit sales and loan repayments

## 📋 Prerequisites

- Node.js 18.x or higher
- npm or yarn package manager
- Firebase account (Spark plan - free tier)
- Modern web browser with IndexedDB support

## 🔧 Installation

### 1. Clone the Repository
```bash
git clone <your-repo-url>
cd "Smart Biz KE"
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables

Copy the example environment file:
```bash
cp .env.example .env.local
```

Edit `.env.local` and add your Firebase credentials:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key-here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX

# Optional: Enable/disable cloud sync
NEXT_PUBLIC_ENABLE_CLOUD_SYNC=true
NEXT_PUBLIC_SYNC_INTERVAL=30000
```

### 4. Firebase Setup

#### Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add Project" or use existing project
3. Enable Firestore Database (Start in test mode)
4. Copy your web app credentials to `.env.local`

#### Configure Firestore Security Rules
The project includes `firestore.rules` with branch-based security:
- Admins can access all branches
- Cashiers can only access their assigned branch
- All data is isolated by `branchId`

Deploy rules:
```bash
firebase deploy --only firestore:rules
```

#### Deploy Firestore Indexes
```bash
firebase deploy --only firestore:indexes
```

#### Configure Firebase Project
Copy `.firebaserc.example` to `.firebaserc` and update with your project ID:
```json
{
  "projects": {
    "default": "your-firebase-project-id"
  }
}
```

## 🚀 Development

Start the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Default Admin Account
On first run, create an admin account through the login page:
- **Username**: admin
- **Password**: (set your own)
- **Role**: Admin

## 📦 Building for Production

### Build Static Export
```bash
npm run build
npm run export
```

This creates an optimized static build in the `out/` directory.

### Deploy to Firebase Hosting

#### First-time Setup
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
```

Select options:
- Public directory: `out`
- Configure as single-page app: Yes
- Set up automatic builds: No
- Don't overwrite index.html

#### Deploy
```bash
npm run firebase:deploy
```

Or deploy everything (hosting + firestore):
```bash
npm run firebase:deploy:full
```

## 🏗️ Project Structure

```
Smart Biz KE/
├── app/                      # Next.js app directory
│   ├── api/                 # API routes (transactions, inventory)
│   ├── globals.css          # Global styles
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Home page
├── components/              # Shared UI components
│   └── ui/                  # Shadcn UI components
├── src/
│   ├── components/          # React components
│   │   ├── LoginForm.jsx
│   │   ├── BranchSelector.jsx
│   │   └── ...
│   ├── config/              # Configuration
│   │   └── firebase.js      # Firebase initialization
│   ├── services/            # Business logic
│   │   ├── branchService.js
│   │   └── ...
│   ├── utils/               # Utilities
│   │   ├── storage.js       # IndexedDB wrapper
│   │   └── auth.js          # Authentication
│   └── views/               # Page views
│       ├── PosPage.jsx
│       ├── InventoryPage.jsx
│       ├── ExpensesPage.jsx
│       └── ReportsPage.jsx
├── public/                  # Static assets
│   ├── manifest.json        # PWA manifest
│   └── sw.js               # Service worker (auto-generated)
├── firebase.json            # Firebase hosting config
├── firestore.rules          # Firestore security rules
├── firestore.indexes.json   # Firestore indexes
└── next.config.mjs          # Next.js configuration
```

## 💾 Data Architecture

### Storage Strategy
- **IndexedDB**: Primary storage (offline-first)
  - `SmartBizDB` database with stores per admin
  - `data_${userId}` - User-specific data
  - `data_${adminId}` - Shared data across users
  - `inventory_${adminId}` - Product inventory
  - `transactions_${adminId}` - Sales transactions

- **localStorage**: User and branch metadata
  - `pos-users-db` - User accounts
  - `pos-branches` - Branch information

- **Firebase Firestore**: Cloud backup and sync
  - Collections: users, branches, inventory, transactions, expenses, suppliers, purchaseOrders, payments
  - Automatic sync when online
  - Offline persistence enabled

### Branch Isolation
All data entities include:
- `branchId` - Links to specific branch
- `userId` - Tracks who created/modified
- `userName` - Audit trail
- `deletedAt` - Soft delete timestamp

## 🔐 Security

### Authentication
- Local password hashing with bcryptjs
- Session stored in localStorage
- Role-based access control (Admin/Cashier)

### Firestore Rules
- Branch-based data isolation
- Admins: Full access to all branches
- Cashiers: Access only to assigned branch
- All writes require authentication

### Environment Variables
- Never commit `.env.local` to git
- Use `.env.example` as template
- Keep Firebase credentials secure

## 📱 PWA Features

- Installable on mobile and desktop
- Offline functionality
- Background sync when reconnecting
- Service worker caching
- Push notifications ready

## 🧪 Testing

Run tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

Generate coverage report:
```bash
npm run test:coverage
```

## 🔄 Firebase Spark Plan Limits

The free Spark plan includes:
- **Firestore**: 1 GB storage, 50K reads/day, 20K writes/day
- **Hosting**: 10 GB storage, 360 MB/day transfer
- **Authentication**: Unlimited

Tips for staying within limits:
- App works fully offline - Firebase is backup only
- Sync happens on app start and periodically
- Optimize queries with proper indexes
- Use batch writes when possible

## 🐛 Troubleshooting

### Build Issues
```bash
# Clear cache and rebuild
rm -rf .next out node_modules
npm install
npm run build
```

### Firebase Connection Issues
- Verify `.env.local` credentials
- Check Firebase project is active
- Ensure Firestore is enabled
- Verify firestore.rules are deployed

### IndexedDB Issues
- Clear browser storage and refresh
- Check browser console for errors
- Ensure browser supports IndexedDB

## 📄 License

Private - Whiskey Ballet POS System

## 👥 Support

For issues and questions:
- Email: info@whiskeyballet.ke
- Create an issue in the repository

---

**Built with ❤️ for Whiskey Ballet - Premium Wines & Spirits**
