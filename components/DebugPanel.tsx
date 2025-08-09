'use client'

import { useState, useEffect } from 'react'
import { localDB, getDatabaseInfo } from '../lib/pouchdb'

const DebugPanel = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [allDocs, setAllDocs] = useState<any[]>([])
  const [dbInfo, setDbInfo] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [products, setProducts] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])

  const loadAllDocs = async () => {
    if (!localDB) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      // Create indexes for efficient querying
      await localDB.createIndex({
        index: {
          fields: ['type']
        }
      })

      // Load all documents
      const result = await localDB.allDocs({ include_docs: true })
      setAllDocs(result.rows)
      
      // Get database info using the singleton manager
      const info = await getDatabaseInfo()
      setDbInfo(info)

      // Load specific document types
      const productsResult = await localDB.find({
        selector: { type: 'Item' }
      })
      setProducts(productsResult.docs)

      const customersResult = await localDB.find({
        selector: { type: 'Customer' }
      })
      setCustomers(customersResult.docs)

      const invoicesResult = await localDB.find({
        selector: { type: 'POSInvoice' }
      })
      setInvoices(invoicesResult.docs)

    } catch (error) {
      console.error('Error loading docs:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadAllDocs()
    }
  }, [isOpen])

  const groupDocsByType = () => {
    const groups: { [key: string]: any[] } = {}
    
    allDocs.forEach(row => {
      const type = row.id.split('::')[0] || 'Other'
      if (!groups[type]) groups[type] = []
      groups[type].push(row)
    })
    
    return groups
  }

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsOpen(true)}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-blue-600"
        >
          🔍 Debug DB
        </button>
      </div>
    )
  }

  const docGroups = groupDocsByType()

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-11/12 h-5/6 flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-bold">PouchDB Debug Panel</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>
        
        <div className="flex-1 overflow-auto p-4">
          {isLoading && (
            <div className="text-center py-8">
              <div className="text-gray-500">Loading database...</div>
            </div>
          )}
          
          {dbInfo && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold mb-2">Database Info</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>DB Name: {dbInfo.db_name}</div>
                <div>Doc Count: {dbInfo.doc_count}</div>
                <div>Update Seq: {dbInfo.update_seq}</div>
                <div>Size: {dbInfo.data_size || 'N/A'}</div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-800 mb-2">
                Context Data
              </h3>
              <div className="text-sm space-y-1">
                <div>Products: {products.length}</div>
                <div>Customers: {customers.length}</div>
                <div>Invoices: {invoices.length}</div>
              </div>
            </div>

            {Object.entries(docGroups).map(([type, docs]) => (
              <div key={type} className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold mb-2">
                  {type} ({docs.length})
                </h3>
                <div className="max-h-40 overflow-y-auto">
                  {docs.slice(0, 5).map((row) => (
                    <div key={row.id} className="text-xs mb-2 p-2 bg-white rounded">
                      <div className="font-mono text-blue-600 truncate">
                        {row.id}
                      </div>
                      {row.doc && (
                        <div className="text-gray-600 mt-1">
                          {JSON.stringify(row.doc).slice(0, 100)}...
                        </div>
                      )}
                    </div>
                  ))}
                  {docs.length > 5 && (
                    <div className="text-xs text-gray-500">
                      ... and {docs.length - 5} more
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <h3 className="font-semibold mb-2">Actions</h3>
            <div className="flex gap-2">
              <button
                onClick={loadAllDocs}
                className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600"
              >
                Refresh Data
              </button>
              <button
                onClick={() => {
                  console.log('All docs:', allDocs)
                  console.log('DB Info:', dbInfo)
                  console.log('Products:', products)
                  console.log('Customers:', customers)
                  console.log('Invoices:', invoices)
                }}
                className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
              >
                Log to Console
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DebugPanel 