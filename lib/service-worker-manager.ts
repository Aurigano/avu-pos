// Service Worker Manager for PouchDB Sync Operations
// Handles communication between main thread and service worker

class ServiceWorkerManager {
  private serviceWorker: ServiceWorker | null = null;
  private messageId = 0;
  private pendingMessages = new Map<number, { resolve: Function; reject: Function }>();

  async initialize(): Promise<boolean> {
    try {
      // Check if service workers are supported
      if (!('serviceWorker' in navigator)) {
        console.warn('Service Workers not supported in this browser');
        return false;
      }

      // Register the service worker
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      console.log('Service Worker registered successfully:', registration.scope);

      // Wait for the service worker to be ready
      await navigator.serviceWorker.ready;

      // Get the active service worker
      this.serviceWorker = registration.active || registration.waiting || registration.installing;

      if (!this.serviceWorker) {
        throw new Error('No service worker available');
      }

      // Initialize database configuration
      const config = {
        remoteUrl: process.env.NEXT_PUBLIC_COUCHDB_URL || 'http://localhost:5984/',
        username: process.env.NEXT_PUBLIC_COUCHDB_USERNAME || '',
        password: process.env.NEXT_PUBLIC_COUCHDB_PASSWORD || ''
      };

      await this.sendMessage('INIT_DB', config);
      console.log('Service Worker initialized with database config');

      return true;
    } catch (error) {
      console.error('Failed to initialize Service Worker:', error);
      return false;
    }
  }

  private async sendMessage(type: string, data: any = {}): Promise<any> {
    if (!this.serviceWorker) {
      throw new Error('Service Worker not initialized');
    }

    return new Promise((resolve, reject) => {
      const messageId = ++this.messageId;
      
      // Store the promise resolvers
      this.pendingMessages.set(messageId, { resolve, reject });

      // Create a message channel for communication
      const messageChannel = new MessageChannel();
      
      // Listen for response
      messageChannel.port1.onmessage = (event) => {
        const { messageId: responseId, success, error, ...responseData } = event.data;
        
        const pending = this.pendingMessages.get(responseId);
        if (pending) {
          this.pendingMessages.delete(responseId);
          
          if (success) {
            pending.resolve(responseData);
          } else {
            pending.reject(new Error(error || 'Service Worker operation failed'));
          }
        }
      };

      // Send message to service worker
      this.serviceWorker!.postMessage(
        { type, data, messageId },
        [messageChannel.port2]
      );

      // Timeout after 30 seconds
      setTimeout(() => {
        const pending = this.pendingMessages.get(messageId);
        if (pending) {
          this.pendingMessages.delete(messageId);
          pending.reject(new Error('Service Worker operation timeout'));
        }
      }, 30000);
    });
  }

  async performSync(direction: 'pull' | 'push' | 'both' = 'both'): Promise<any> {
    try {
      const result = await this.sendMessage('SYNC', { direction });
      console.log(`Sync ${direction} completed:`, result);
      return result;
    } catch (error) {
      console.error(`Sync ${direction} failed:`, error);
      throw error;
    }
  }

  async saveInvoice(invoiceData: any): Promise<any> {
    try {
      const result = await this.sendMessage('SAVE_INVOICE', { invoice: invoiceData });
      console.log('Invoice saved:', result);
      return result;
    } catch (error) {
      console.error('Failed to save invoice:', error);
      throw error;
    }
  }

  async saveInvoiceAndSync(invoiceData: any): Promise<any> {
    try {
      const result = await this.sendMessage('SAVE_AND_SYNC', { invoice: invoiceData });
      console.log('Invoice saved and synced:', result);
      return result;
    } catch (error) {
      console.error('Failed to save and sync invoice:', error);
      throw error;
    }
  }

  // Check if service worker is available and ready
  isReady(): boolean {
    return this.serviceWorker !== null;
  }

  // Get sync status
  async getStatus(): Promise<string> {
    if (!this.serviceWorker) {
      return 'not_initialized';
    }

    try {
      // Try a simple sync to test connectivity
      await this.performSync('pull');
      return 'connected';
    } catch (error) {
      return 'offline';
    }
  }
}

// Create singleton instance
const serviceWorkerManager = new ServiceWorkerManager();

export default serviceWorkerManager; 