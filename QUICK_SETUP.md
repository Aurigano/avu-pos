# Quick Local CouchDB Setup

The remote CouchDB has CORS issues that prevent proper syncing. Here's how to set up a local CouchDB instance:

## Option 1: Docker (Recommended)

```bash
# Run CouchDB in Docker
docker run -d \
  --name couchdb \
  -p 5984:5984 \
  -e COUCHDB_USER=admin \
  -e COUCHDB_PASSWORD=admin \
  couchdb:latest
```

## Option 2: macOS with Homebrew

```bash
# Install CouchDB
brew install couchdb

# Start CouchDB
brew services start couchdb
```

## Setup Database

1. **Create the database:**
```bash
curl -X PUT http://admin:admin@localhost:5984/posdb
```

2. **Add sample products:**
```bash
curl -X POST http://admin:admin@localhost:5984/posdb \
  -H "Content-Type: application/json" \
  -d '{
    "_id": "Item::Chicken Wings",
    "type": "Item",
    "item_id": "Item::Chicken Wings",
    "item_name": "Chicken Wings",
    "item_group": "Starter",
    "rate": 12.99,
    "uom": "Plate",
    "available": true
  }'

curl -X POST http://admin:admin@localhost:5984/posdb \
  -H "Content-Type: application/json" \
  -d '{
    "_id": "Item::Caesar Salad",
    "type": "Item",
    "item_id": "Item::Caesar Salad", 
    "item_name": "Caesar Salad",
    "item_group": "Salad",
    "rate": 8.99,
    "uom": "Bowl",
    "available": true
  }'
```

3. **Verify setup:**
```bash
# Check database exists
curl http://admin:admin@localhost:5984/posdb

# Check documents
curl http://admin:admin@localhost:5984/posdb/_all_docs
```

## Environment Configuration

Your `.env.local` is already configured for localhost:

```bash
NEXT_PUBLIC_COUCHDB_URL=http://localhost:5984/
NEXT_PUBLIC_COUCHDB_USERNAME=admin
NEXT_PUBLIC_COUCHDB_PASSWORD=admin
```

## Test the Application

1. Start the app: `npm run dev`
2. Open http://localhost:3001
3. Check the sync status indicator (should show green "synced")
4. Try searching for products in the search bar

## For Remote CouchDB

To use the remote CouchDB, you'll need the administrator to:

1. **Enable CORS properly:**
```bash
curl -X PUT http://admin:password@64.227.153.214:5984/_config/httpd/enable_cors -d '"true"'
curl -X PUT http://admin:password@64.227.153.214:5984/_config/cors/origins -d '"*"'
curl -X PUT http://admin:password@64.227.153.214:5984/_config/cors/methods -d '"GET, PUT, POST, HEAD, DELETE"'
curl -X PUT http://admin:password@64.227.153.214:5984/_config/cors/headers -d '"accept, authorization, content-type, origin, referer, x-csrf-token"'
```

2. **Provide correct credentials** for the database

Then update `.env.local` with the remote URL and credentials. 