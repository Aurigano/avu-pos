'use client'

import PouchDB from 'pouchdb'
import PouchDBFind from 'pouchdb-find'
import PouchDBAdapterHttp from 'pouchdb-adapter-http'

// Singleton pattern to ensure only one instance of each database
class PouchDBManager {
  private static instance: PouchDBManager | null = null
  private _localDB: PouchDB.Database | null = null
  private _remoteDB: PouchDB.Database | null = null
  private initialized = false

  private constructor() {
    // Private constructor to prevent direct instantiation
  }

  static getInstance(): PouchDBManager {
    if (!PouchDBManager.instance) {
      PouchDBManager.instance = new PouchDBManager()
    }
    return PouchDBManager.instance
  }

  private initializePouchDB() {
    if (this.initialized || typeof window === 'undefined') {
      return
    }

    try {
      // Configure PouchDB plugins only once
      PouchDB.plugin(PouchDBFind)
      PouchDB.plugin(PouchDBAdapterHttp)

      // Create database instances only once
      this._localDB = new PouchDB('local_posdb', {
        auto_compaction: true, // Enable auto-compaction
        revs_limit: 10 // Limit revision history to save space
      })

      this._remoteDB = new PouchDB('http://admin:123@64.227.153.214:5984/posdb', {
        skip_setup: true // Skip database creation on remote
      })

      this.initialized = true
      console.log('PouchDB instances initialized successfully')
    } catch (error) {
      console.error('Failed to initialize PouchDB:', error)
      this.initialized = false
    }
  }

  get localDB(): PouchDB.Database | null {
    if (!this.initialized) {
      this.initializePouchDB()
    }
    return this._localDB
  }

  get remoteDB(): PouchDB.Database | null {
    if (!this.initialized) {
      this.initializePouchDB()
    }
    return this._remoteDB
  }

  // Method to safely close all databases (useful for cleanup)
  async closeAll(): Promise<void> {
    try {
      if (this._localDB) {
        await this._localDB.close()
        this._localDB = null
      }
      if (this._remoteDB) {
        await this._remoteDB.close()
        this._remoteDB = null
      }
      this.initialized = false
      console.log('PouchDB instances closed successfully')
    } catch (error) {
      console.error('Error closing PouchDB instances:', error)
    }
  }

  // Method to get database info for debugging
  async getInfo() {
    if (!this._localDB) return null
    
    try {
      const info = await this._localDB.info()
      return {
        dbName: info.db_name,
        docCount: info.doc_count,
        updateSeq: info.update_seq,
        diskSize: (info as any).data_size || 'N/A'
      }
    } catch (error) {
      console.error('Error getting database info:', error)
      return null
    }
  }
}

// Create singleton instance
const dbManager = PouchDBManager.getInstance()

// Export the database instances through the singleton
export const localDB = dbManager.localDB
export const remoteDB = dbManager.remoteDB

// Export utility functions
export const getDatabases = () => {
  if (typeof window === 'undefined') {
    return { localDB: null, remoteDB: null }
  }
  return { 
    localDB: dbManager.localDB, 
    remoteDB: dbManager.remoteDB 
  }
}

// Export manager for advanced operations
export const closeDatabases = () => dbManager.closeAll()
export const getDatabaseInfo = () => dbManager.getInfo()

// Cleanup on page unload to prevent memory leaks
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    dbManager.closeAll()
  })
}