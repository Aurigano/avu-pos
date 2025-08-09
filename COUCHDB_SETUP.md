# CouchDB + PouchDB Setup Guide

This guide will help you integrate your hosted CouchDB with the AVU POS system using PouchDB and service workers for offline-first functionality.

## 🎯 Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CouchDB       │◄──►│  Service Worker │◄──►│  React App      │
│   (Remote)      │    │  (Background)   │    │  (Main Thread)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              ▲
                              │
                       ┌─────────────────┐
                       │    PouchDB      │
                       │   (Local)       │
                       └─────────────────┘
```

## 📋 Prerequisites

1. **CouchDB Instance**: You mentioned you already have CouchDB hosted
2. **Node.js 18+**: For running the Next.js application
3. **Modern Browser**: With service worker support

## 🗄️ CouchDB Database Structure

Your CouchDB should have these databases:

### 1. Products Database (`products`)
```json
{
  "_id": "product_chicken_wings",
  "name": "CHICKEN WINGS",
  "category": "starter",
  "price": 20.00,
  "available": true,
  "description": "Crispy chicken wings",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### 2. Orders Database (`orders`)
```json
{
  "_id": "order_123456789",
  "orderNumber": "ORD-123456789",
  "tableNumber": "1",
  "guestCount": 2,
  "items": [
    {
      "id": "1",
      "name": "CHICKEN WINGS",
      "category": "starter",
      "price": 20.00,
      "quantity": 2,
      "subtotal": 40.00
    }
  ],
  "subtotal": 40.00,
  "tips": 5.00,
  "serviceCharge": 4.00,
  "total": 49.00,
  "status": "pending",
  "createdAt": "2024-01-01T12:00:00.000Z",
  "updatedAt": "2024-01-01T12:00:00.000Z"
}
```

## ⚙️ Configuration

### 1. Environment Setup

Create a `.env.local` file in your project root:

```bash
# Copy from env.example and update with your CouchDB URL
NEXT_PUBLIC_COUCHDB_URL=https://your-couchdb-host:5984

# If authentication is required
NEXT_PUBLIC_COUCHDB_USERNAME=your-username
NEXT_PUBLIC_COUCHDB_PASSWORD=your-password
```

### 2. Update Service Worker

Edit `public/sw.js` and update the CouchDB URL:

```javascript
// Replace this line
let COUCH_DB_URL = 'http://localhost:5984'

// With your actual CouchDB URL
let COUCH_DB_URL = 'https://your-couchdb-host:5984'
```

## 🚀 How It Works

### Client-Side Operations (Offline-First)
1. **Search Products**: Searches local PouchDB first
2. **Add Items**: Adds to local PouchDB immediately
3. **Create Orders**: Saves to local PouchDB first
4. **Real-time Updates**: UI updates immediately

### Background Sync (Service Worker)
1. **Automatic Sync**: Service worker syncs with CouchDB in background
2. **Conflict Resolution**: PouchDB handles conflicts automatically
3. **Retry Logic**: Failed syncs are retried automatically
4. **Offline Support**: Works completely offline

### Data Flow
```
User Action → Local PouchDB → UI Update → Background Sync → CouchDB
```

## 📊 Features

### ✅ **Implemented Features**
- **Offline-First**: Works without internet connection
- **Real-time Search**: Search products from local database
- **Auto-Sync**: Background synchronization with CouchDB
- **Conflict Resolution**: Handles sync conflicts automatically
- **Error Handling**: Graceful error handling and recovery
- **Loading States**: Shows loading indicators during operations

### 🔄 **Sync Behavior**
- **Initial Load**: Downloads all data from CouchDB on first run
- **Live Sync**: Continuous two-way sync with CouchDB
- **Batch Processing**: Syncs in batches for performance
- **Retry Logic**: Automatically retries failed syncs

## 🛠️ Development

### Start the Application
```bash
npm run dev
```

### Check Service Worker
1. Open Developer Tools (F12)
2. Go to **Application** tab
3. Click **Service Workers** to see registration status
4. Check **Console** for sync messages

### Monitor Database
```bash
# Check local PouchDB
console.log(await db.allDocs({include_docs: true}))

# Force sync
navigator.serviceWorker.controller.postMessage({
  type: 'FORCE_SYNC'
})
```

## 🐛 Troubleshooting

### Common Issues

1. **Service Worker Not Registering**
   - Check browser console for errors
   - Ensure HTTPS in production
   - Clear browser cache and reload

2. **CouchDB Connection Failed**
   - Verify CouchDB URL and credentials
   - Check CORS settings on CouchDB
   - Ensure databases exist

3. **Sync Not Working**
   - Check network connectivity
   - Verify database permissions
   - Look for authentication errors

### Enable CORS on CouchDB
```bash
# Enable CORS for your domain
curl -X PUT http://admin:password@your-couchdb:5984/_config/httpd/enable_cors -d '"true"'
curl -X PUT http://admin:password@your-couchdb:5984/_config/cors/origins -d '"*"'
curl -X PUT http://admin:password@your-couchdb:5984/_config/cors/credentials -d '"true"'
curl -X PUT http://admin:password@your-couchdb:5984/_config/cors/methods -d '"GET, PUT, POST, HEAD, DELETE"'
curl -X PUT http://admin:password@your-couchdb:5984/_config/cors/headers -d '"accept, authorization, content-type, origin, referer, x-csrf-token"'
```

## 📈 Production Deployment

### Before Deploying
1. Set production CouchDB URL in environment variables
2. Enable HTTPS for service worker support
3. Test offline functionality
4. Verify sync performance

### Environment Variables
```bash
NEXT_PUBLIC_COUCHDB_URL=https://your-production-couchdb:5984
NEXT_PUBLIC_COUCHDB_USERNAME=prod-username
NEXT_PUBLIC_COUCHDB_PASSWORD=prod-password
```

## 🔐 Security Considerations

1. **Authentication**: Use proper CouchDB authentication
2. **HTTPS**: Always use HTTPS in production
3. **Database Security**: Restrict database access permissions
4. **API Keys**: Use API keys instead of admin credentials

## 📱 Usage

### Adding Products to CouchDB
```bash
# Add a product via CouchDB API
curl -X POST https://your-couchdb:5984/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "PIZZA MARGHERITA",
    "category": "main",
    "price": 16.99,
    "available": true
  }'
```

### Viewing Orders
```bash
# Get all orders
curl https://your-couchdb:5984/orders/_all_docs?include_docs=true
```

## 🎉 You're All Set!

Once configured, your POS system will:
- Load products from your CouchDB
- Work offline with local data
- Sync orders back to CouchDB
- Handle network interruptions gracefully

The system is now ready for production use with your existing CouchDB data! 🚀 