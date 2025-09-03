import { localDB, remoteDB } from '@/lib/pouchdb'
import serviceWorkerManager from '@/lib/service-worker-manager'
import { initializePOSProfile } from '@/lib/pos-profile-manager'

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error'
export type SyncDirection = 'pull' | 'push' | 'both'

export interface DatabaseInitResult {
  success: boolean
  error?: string
  syncStatus: SyncStatus
  posDataLoaded: boolean
  posProfileName?: string
}

export interface SyncResult {
  success: boolean
  error?: string
  docsRead?: number
  docsWritten?: number
}

export class DatabaseManager {
  private static instance: DatabaseManager
  private syncStatus: SyncStatus = 'idle'
  private isInitialized: boolean = false

  private constructor() {}

  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager()
    }
    return DatabaseManager.instance
  }

  /**
   * Test database connection to both local and remote databases
   */
  async testConnection(): Promise<boolean> {
    console.log('🔌 Testing database connection...')
    
    try {
      if (!localDB) {
        console.error('❌ Local DB not available')
        return false
      }
      
      if (!remoteDB) {
        console.error('❌ Remote DB not available')
        return false
      }
      
      // Test local DB
      const localInfo = await localDB.info()
      console.log('✅ Local DB connected:', localInfo.db_name)
      
      // Test remote DB
      const remoteInfo = await remoteDB.info()
      console.log('✅ Remote DB connected:', remoteInfo.db_name)
      
      console.log('✅ Database connection test successful')
      return true
    } catch (error) {
      console.error('❌ Database connection test failed:', error)
      return false
    }
  }

  /**
   * Perform database synchronization
   */
  async performSync(direction: SyncDirection = 'both'): Promise<SyncResult> {
    this.syncStatus = 'syncing'
    console.log(`🔄 Starting ${direction} sync...`)
    
    try {
      if (!localDB || !remoteDB) {
        throw new Error('Database not available')
      }

      let docsRead = 0
      let docsWritten = 0

      if (direction === 'pull' || direction === 'both') {
        // Pull from remote to local
        console.log('⬇️ Pulling data from remote database...')
        const pullResult = await localDB.replicate.from(remoteDB, {
          timeout: 15000, // 15 second timeout
          retry: false    // Don't retry automatically to avoid hanging
        })
        docsRead = pullResult.docs_read || 0
        console.log(`✅ Pull sync completed: ${docsRead} docs received`)
      }
      
      if (direction === 'push' || direction === 'both') {
        // Push from local to remote
        console.log('⬆️ Pushing data to remote database...')
        const pushResult = await localDB.sync(remoteDB, {
          timeout: 15000, // 15 second timeout
          retry: false    // Don't retry automatically to avoid hanging
        })
        console.log('✅ Push sync completed:', pushResult)
        // Note: pushResult structure may vary, adjust as needed
      }
      
      this.syncStatus = 'synced'
      console.log(`✅ ${direction} sync completed successfully`)
      
      return {
        success: true,
        docsRead,
        docsWritten
      }
      
    } catch (error: any) {
      console.error('❌ Sync failed:', error.message || error)
      this.syncStatus = 'error'
      
      // Log specific error types for debugging
      this.logSyncError(error)
      
      return {
        success: false,
        error: error.message || 'Sync failed'
      }
    }
  }

  /**
   * Create necessary database indexes
   */
  async createIndexes(): Promise<void> {
    console.log('📑 Creating database indexes...')
    
    if (!localDB) {
      throw new Error('Local database not available for indexing')
    }

    try {
      // Index for invoice queries
      await localDB.createIndex({
        index: {
          fields: ['type', 'CreatedBy', 'creation_date']
        }
      })
      
      // Index for item queries
      await localDB.createIndex({
        index: {
          fields: ['type', 'item_name']
        }
      })

      // Index for draft invoices
      await localDB.createIndex({
        index: {
          fields: ['type', 'status']
        }
      })

      console.log('✅ Database indexes created successfully')
    } catch (error) {
      console.error('❌ Error creating indexes:', error)
      throw error
    }
  }

  /**
   * Load and log database documents (for debugging)
   */
  async loadDatabaseDocuments(): Promise<void> {
    if (!localDB) {
      console.warn('⚠️ Local DB not available for document loading')
      return
    }

    try {
      const allDocs = await localDB.allDocs({ include_docs: true })
      console.log(`📄 Total documents in local DB: ${allDocs.rows.length}`)
      
      // Log document types summary
      const docTypes: { [key: string]: number } = {}
      allDocs.rows.forEach((row: any) => {
        const type = row.doc?.type || 'unknown'
        docTypes[type] = (docTypes[type] || 0) + 1
      })
      
      console.log('📊 Document types summary:', docTypes)
      
      // Log draft invoices specifically
      const draftInvoices = allDocs.rows.filter((row: any) => 
        row.doc.type === 'POSInvoice' && row.doc.status === 'Draft'
      )
      console.log(`📋 Draft invoices found: ${draftInvoices.length}`)
      
      if (draftInvoices.length > 0) {
        console.log('Draft invoices:', draftInvoices.map((row: any) => ({
          id: row.doc._id,
          customer: row.doc.customer_id,
          total: row.doc.total_amount,
          created: row.doc.creation_date
        })))
      }
    } catch (error) {
      console.error('❌ Error loading database documents:', error)
    }
  }

  /**
   * Initialize POS data and profile
   */
  async initializePOSData(): Promise<{ success: boolean; profileName?: string; error?: string }> {
    console.log('🏪 Initializing POS pricing data...')
    
    try {
      const result = await initializePOSProfile()
      
      if (result.success) {
        console.log('✅ POS data loaded successfully with profile:', result.profileName)
        return {
          success: true,
          profileName: result.profileName
        }
      } else {
        console.error('❌ POS data loading error:', result.error)
        return {
          success: false,
          error: result.error
        }
      }
    } catch (error: any) {
      console.error('❌ POS data initialization failed:', error)
      return {
        success: false,
        error: error.message || 'POS initialization failed'
      }
    }
  }

  /**
   * Full database initialization workflow
   */
  async initializeDatabase(options?: {
    skipSync?: boolean
    syncDirection?: SyncDirection
    onProgress?: (step: string, status: 'starting' | 'success' | 'error', details?: any) => void
  }): Promise<DatabaseInitResult> {
    const { skipSync = false, syncDirection = 'pull', onProgress } = options || {}
    
    console.log('🚀 Starting database initialization...')
    
    try {
      // Step 1: Test database connection
      onProgress?.('connection', 'starting')
      const connectionOk = await this.testConnection()
      if (!connectionOk) {
        onProgress?.('connection', 'error')
        console.log('⚠️ Database connection failed, working offline')
        return {
          success: false,
          error: 'Database connection failed',
          syncStatus: 'error',
          posDataLoaded: false
        }
      }
      onProgress?.('connection', 'success')

      let syncSuccess = true
      let syncError: string | undefined

      // Step 2: Sync data (if not skipped)
      if (!skipSync) {
        onProgress?.('sync', 'starting')
        
        // Try direct sync first
        try {
          console.log('🔄 Attempting direct database sync...')
          const directSyncResult = await this.performSync(syncDirection)
          if (!directSyncResult.success) {
            throw new Error(directSyncResult.error)
          }
          console.log('✅ Direct sync completed successfully')
          onProgress?.('sync', 'success', { docs: directSyncResult.docsRead })
        } catch (directSyncError) {
          console.log('⚠️ Direct sync failed, trying service worker...', directSyncError)
          
          // Fallback to service worker
          try {
            const isServiceWorkerReady = await serviceWorkerManager.initialize()
            
            if (isServiceWorkerReady) {
              console.log('🔄 Service Worker ready, performing sync...')
              await serviceWorkerManager.performSync(syncDirection)
              console.log('✅ Service Worker sync completed')
              onProgress?.('sync', 'success', { method: 'service-worker' })
            } else {
              throw new Error('Service Worker not available')
            }
          } catch (swError) {
            console.log('❌ Service Worker sync also failed:', swError)
            syncSuccess = false
            syncError = 'Both direct sync and service worker sync failed'
            onProgress?.('sync', 'error', { error: syncError })
          }
        }
      }

      // Step 3: Create indexes
      onProgress?.('indexes', 'starting')
      await this.createIndexes()
      onProgress?.('indexes', 'success')

      // Step 4: Load documents (for debugging/logging)
      onProgress?.('documents', 'starting')
      await this.loadDatabaseDocuments()
      onProgress?.('documents', 'success')

      // Step 5: Initialize POS data
      onProgress?.('pos-data', 'starting')
      const posResult = await this.initializePOSData()
      onProgress?.(posResult.success ? 'pos-data' : 'pos-data', posResult.success ? 'success' : 'error', posResult)

      this.isInitialized = true
      
      const result: DatabaseInitResult = {
        success: true,
        syncStatus: syncSuccess ? 'synced' : 'error',
        posDataLoaded: posResult.success,
        posProfileName: posResult.profileName
      }

      if (syncError) {
        result.error = syncError
      }

      console.log('🎉 Database initialization completed:', result)
      return result

    } catch (error: any) {
      console.error('❌ Database initialization failed:', error)
      onProgress?.('initialization', 'error', { error: error.message })
      
      return {
        success: false,
        error: error.message || 'Database initialization failed',
        syncStatus: 'error',
        posDataLoaded: false
      }
    }
  }

  /**
   * Get current sync status
   */
  getSyncStatus(): SyncStatus {
    return this.syncStatus
  }

  /**
   * Check if database is initialized
   */
  isDbInitialized(): boolean {
    return this.isInitialized
  }

  /**
   * Reset initialization state (useful for testing or re-initialization)
   */
  reset(): void {
    this.isInitialized = false
    this.syncStatus = 'idle'
  }

  /**
   * Log detailed sync errors for debugging
   */
  private logSyncError(error: any): void {
    if (error.status === 401 || error.status === 403) {
      console.log('🔐 Authentication error - check credentials')
    } else if (error.status === 404) {
      console.log('🔍 Database not found - check URL')
    } else if (error.message && error.message.includes('CORS')) {
      console.log('🌐 CORS error - check server configuration')
    } else if (error.code === 'ENOTFOUND' || error.message?.includes('fetch')) {
      console.log('📡 Network error - check internet connection')
    } else {
      console.log('❓ Unknown sync error:', error)
    }
  }
}

// Export singleton instance
export const databaseManager = DatabaseManager.getInstance()

// Export convenience functions for backward compatibility
export const testDatabaseConnection = () => databaseManager.testConnection()
export const performDatabaseSync = (direction?: SyncDirection) => databaseManager.performSync(direction)
export const initializeDatabase = (options?: Parameters<typeof databaseManager.initializeDatabase>[0]) => 
  databaseManager.initializeDatabase(options) 