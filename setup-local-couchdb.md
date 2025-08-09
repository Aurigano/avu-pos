# Local CouchDB Setup for AVU POS

Since the remote CouchDB requires authentication credentials that we don't have, here's how to set up a local CouchDB instance for development and testing.

## Option 1: Docker Setup (Recommended)

### 1. Install Docker
If you don't have Docker installed, download it from [docker.com](https://www.docker.com/products/docker-desktop)

### 2. Run CouchDB Container
```bash
docker run -d \
  --name couchdb \
  -p 5984:5984 \
  -e COUCHDB_USER=admin \
  -e COUCHDB_PASSWORD=admin \
  couchdb:latest
```

### 3. Verify Installation
```bash
curl http://localhost:5984
```

You should see a JSON response with CouchDB version info.

### 4. Create the Database
```bash
curl -X PUT http://admin:admin@localhost:5984/posdb
```

### 5. Enable CORS (for web access)
```bash
curl -X PUT http://admin:admin@localhost:5984/_config/httpd/enable_cors -d '"true"'
curl -X PUT http://admin:admin@localhost:5984/_config/cors/origins -d '"*"'
curl -X PUT http://admin:admin@localhost:5984/_config/cors/credentials -d '"true"'
curl -X PUT http://admin:admin@localhost:5984/_config/cors/methods -d '"GET, PUT, POST, HEAD, DELETE"'
curl -X PUT http://admin:admin@localhost:5984/_config/cors/headers -d '"accept, authorization, content-type, origin, referer, x-csrf-token"'
```

## Option 2: Native Installation

### macOS (using Homebrew)
```bash
brew install couchdb
brew services start couchdb
```

### Ubuntu/Debian
```bash
sudo apt update
sudo apt install couchdb
sudo systemctl start couchdb
sudo systemctl enable couchdb
```

### Windows
Download the installer from [CouchDB Downloads](https://couchdb.apache.org/#download)

## Sample Data Setup

### 1. Add Sample Products
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
    "available": true,
    "description": "Crispy chicken wings with sauce"
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
    "available": true,
    "description": "Fresh caesar salad with croutons"
  }'

curl -X POST http://admin:admin@localhost:5984/posdb \
  -H "Content-Type: application/json" \
  -d '{
    "_id": "Item::Margherita Pizza",
    "type": "Item",
    "item_id": "Item::Margherita Pizza", 
    "item_name": "Margherita Pizza",
    "item_group": "Main Course",
    "rate": 16.99,
    "uom": "Piece",
    "available": true,
    "description": "Classic margherita pizza with fresh basil"
  }'
```

### 2. Add Sample Customer
```bash
curl -X POST http://admin:admin@localhost:5984/posdb \
  -H "Content-Type: application/json" \
  -d '{
    "_id": "Customer::default",
    "type": "Customer",
    "customer_id": "Customer::default",
    "customer_name": "Walk-in Customer",
    "store_id": "Store::main"
  }'
```

## Update Environment Variables

Update your `.env.local` file:
```bash
# CouchDB Configuration
NEXT_PUBLIC_COUCHDB_URL=http://localhost:5984/

# Authentication
NEXT_PUBLIC_COUCHDB_USERNAME=admin
NEXT_PUBLIC_COUCHDB_PASSWORD=admin
```

## Test the Setup

Run the test script:
```bash
node test-db-connection.js
```

You should see successful connection and sample data.

## Start the Application

```bash
npm run dev
```

The application will now connect to your local CouchDB instance and sync data properly.

## Remote CouchDB Connection

To connect to the remote CouchDB at `http://64.227.153.214:5984/`, you'll need:

1. Valid username and password from the CouchDB administrator
2. Update `.env.local` with the correct credentials:
```bash
NEXT_PUBLIC_COUCHDB_URL=http://64.227.153.214:5984/
NEXT_PUBLIC_COUCHDB_USERNAME=your-actual-username
NEXT_PUBLIC_COUCHDB_PASSWORD=your-actual-password
```

Contact the database administrator for the correct credentials. 