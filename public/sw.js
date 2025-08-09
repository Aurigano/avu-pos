// Service Worker for PouchDB Sync Operations
importScripts('https://cdn.jsdelivr.net/npm/pouchdb@8.0.1/dist/pouchdb.min.js');

// For this simple use case, we don't actually need the find plugin in the service worker
// since we're only doing basic replication operations
console.log('PouchDB loaded in Service Worker');

let localDB = null;
let remoteDB = null;
let isInitialized = false;

// Initialize databases
function initializeDatabases(config) {
  try {
    localDB = new PouchDB('local_posdb');
    
    if (config.remoteUrl && config.username && config.password) {
      const authUrl = `${config.remoteUrl.replace('://', `://${config.username}:${config.password}@`)}posdb`;
      remoteDB = new PouchDB(authUrl);
    } else if (config.remoteUrl) {
      remoteDB = new PouchDB(`${config.remoteUrl}posdb`);
    }
    
    isInitialized = true;
    console.log('Service Worker: Databases initialized');
    return { success: true };
  } catch (error) {
    console.error('Service Worker: Database initialization failed:', error);
    return { success: false, error: error.message };
  }
}

// Perform sync operation
async function performSync(direction = 'both') {
  if (!isInitialized || !localDB) {
    return { success: false, error: 'Databases not initialized' };
  }

  const result = {
    success: true,
    pull: { docs_read: 0, errors: [] },
    push: { docs_written: 0, errors: [] }
  };

  try {
    if (!remoteDB) {
      console.log('Service Worker: No remote database configured, working offline');
      return { success: true, offline: true };
    }

    // Pull from remote to local
    if (direction === 'pull' || direction === 'both') {
      try {
        const pullResult = await localDB.replicate.from(remoteDB);
        result.pull.docs_read = pullResult.docs_read || 0;
        console.log(`Service Worker: Pull completed - ${result.pull.docs_read} docs received`);
      } catch (pullError) {
        console.error('Service Worker: Pull failed:', pullError);
        result.pull.errors.push(pullError.message);
      }
    }

    // Push from local to remote
    if (direction === 'push' || direction === 'both') {
      try {
        const pushResult = await localDB.replicate.to(remoteDB);
        result.push.docs_written = pushResult.docs_written || 0;
        console.log(`Service Worker: Push completed - ${result.push.docs_written} docs sent`);
      } catch (pushError) {
        console.error('Service Worker: Push failed:', pushError);
        result.push.errors.push(pushError.message);
      }
    }

    return result;
  } catch (error) {
    console.error('Service Worker: Sync operation failed:', error);
    return { success: false, error: error.message };
  }
}

// Save invoice to local database
async function saveInvoice(invoiceData) {
  if (!isInitialized || !localDB) {
    return { success: false, error: 'Database not initialized' };
  }

  try {
    // The invoiceData already contains all the required fields in the correct format
    const result = await localDB.put(invoiceData);
    console.log('Service Worker: Invoice saved locally:', result.id);
    return { success: true, id: result.id, rev: result.rev };
  } catch (error) {
    console.error('Service Worker: Failed to save invoice:', error);
    return { success: false, error: error.message };
  }
}

// Message handler
self.addEventListener('message', async (event) => {
  const { type, data, messageId } = event.data;

  try {
    let response = { messageId, success: false };

    switch (type) {
      case 'INIT_DB':
        response = { ...response, ...initializeDatabases(data) };
        break;

      case 'SYNC':
        const syncResult = await performSync(data.direction);
        response = { ...response, ...syncResult };
        break;

      case 'SAVE_INVOICE':
        const saveResult = await saveInvoice(data.invoice);
        response = { ...response, ...saveResult };
        break;

      case 'SAVE_AND_SYNC':
        // Save invoice first
        const saveAndSyncResult = await saveInvoice(data.invoice);
        if (saveAndSyncResult.success) {
          // Then sync to push the new invoice
          const syncAfterSave = await performSync('push');
          response = { 
            ...response, 
            success: true, 
            invoice: saveAndSyncResult, 
            sync: syncAfterSave 
          };
        } else {
          response = { ...response, ...saveAndSyncResult };
        }
        break;

      default:
        response.error = `Unknown message type: ${type}`;
    }

    // Send response back to main thread
    event.ports[0].postMessage(response);
  } catch (error) {
    console.error('Service Worker: Message handler error:', error);
    event.ports[0].postMessage({
      messageId,
      success: false,
      error: error.message
    });
  }
});

// Install event
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(self.clients.claim());
});

console.log('Service Worker: Loaded and ready'); 