'use client'

import { useState, useEffect } from 'react'
import { Calendar, User, DollarSign, CreditCard, Eye, Receipt, Clock } from 'lucide-react'
import Sidebar from '../../components/Sidebar'
import { localDB, remoteDB } from '@/lib/pouchdb'

interface POSInvoiceItem {
  item_id: string
  qty: number
  rate: number
  amount: number
  uom: string
}

interface POSInvoiceTax {
  tax_type: string
  tax_rate: number
  tax_amount: number
}

interface POSInvoice {
  _id: string
  _rev?: string
  type: string
  erpnext_id: string
  customer_id: string
  posting_date: string
  posting_time: string
  due_date: string
  total_amount: number
  paid_amount: number
  payment_method: string
  status: string
  is_pos: boolean
  is_return_credit_note: boolean
  pos_profile_id: string
  cashier_id: string
  store_id: string
  items: POSInvoiceItem[]
  taxes: POSInvoiceTax[]
  discounts: any[]
  tip_amount?: number
  cash_received?: number
  creation_date: string
  modified_date: string
  hash: string
  previous_hash: string
  SchemaVersion: string
  CreatedBy: string
  AuditLogId: string
}

const InvoicesPage = () => {
  const [invoices, setInvoices] = useState<POSInvoice[]>([])
  const [selectedInvoice, setSelectedInvoice] = useState<POSInvoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle')

  // Sync with remote database
  const performSync = async () => {
    if (!localDB || !remoteDB) {
      console.warn('Databases not available for sync')
      return
    }

    setSyncStatus('syncing')
    try {
      console.log('Starting sync with remote database...')
      
      // Pull from remote to local to get latest invoices
      const pullResult = await localDB.replicate.from(remoteDB, {
        filter: (doc: any) => {
          // Only sync POSInvoice documents created by POS_USER
          return doc.type === 'POSInvoice' && doc.CreatedBy === 'POS_USER'
        }
      })
      
      console.log('Sync completed:', pullResult.docs_read, 'docs received')
      setSyncStatus('synced')
      return true
    } catch (error: any) {
      console.error('Sync failed:', error)
      setSyncStatus('error')
      
      // Don't fail completely on sync error - work offline
      if (error.status === 401 || error.status === 403) {
        console.log('Authentication error - working offline')
      } else if (error.message && error.message.includes('CORS')) {
        console.log('CORS error - working offline')
      } else {
        console.log('Network error - working offline')
      }
      return false
    }
  }

  // Load invoices from PouchDB
  const loadInvoices = async () => {
    if (!localDB) {
      setError('Database not available')
      setLoading(false)
      return
    }

    try {
      console.log('Loading invoices from local database...')
      
      // Create index for filtering by CreatedBy and sorting by creation_date if it doesn't exist
      try {
        await localDB.createIndex({
          index: {
            fields: ['type', 'CreatedBy', 'creation_date']
          }
        })
      } catch (indexError) {
        console.log('Index may already exist:', indexError)
      }

      const result = await localDB.find({
        selector: {
          type: 'POSInvoice',
          CreatedBy: 'POS_USER'
        },
        // sort: [{ creation_date: 'desc' }]
      })

      const invoiceData = result.docs as POSInvoice[]
      console.log(`Loaded ${invoiceData.length} invoices from local database`)
      setInvoices(invoiceData)
      setError(null)
    } catch (err) {
      console.error('Error loading invoices:', err)
      // Fallback: load without sorting if index creation fails
      try {
        const result = await localDB.find({
          selector: {
            type: 'POSInvoice',
            CreatedBy: 'POS_USER'
          }
        })
        const invoiceData = result.docs as POSInvoice[]
        // Sort in JavaScript as fallback
        invoiceData.sort((a, b) => new Date(b.creation_date).getTime() - new Date(a.creation_date).getTime())
        console.log(`Loaded ${invoiceData.length} invoices from local database (fallback)`)
        setInvoices(invoiceData)
        setError(null)
      } catch (fallbackErr) {
        setError('Failed to load invoices')
      }
    }
  }

  // Initialize page: load local data first, then sync
  useEffect(() => {
    const initializePage = async () => {
      setLoading(true)
      
      // Load local data first (immediate)
      console.log('Loading invoices from local database...')
      await loadInvoices()
      setLoading(false)
      
      // Then sync from remote in background (optional)
      console.log('Syncing from remote database in background...')
      try {
        await performSync()
        // Reload invoices after sync to show any new data
        await loadInvoices()
        console.log('Background sync completed')
      } catch (error) {
        console.log('Background sync failed, continuing with local data:', error)
        // Don't show error to user - local data is sufficient
      }
    }

    initializePage()

    // Set up real-time updates
    if (localDB) {
      const changes = localDB.changes({
        since: 'now',
        live: true,
        include_docs: true
      }).on('change', (change) => {
        if (change.doc && (change.doc as any).type === 'POSInvoice' && (change.doc as any).CreatedBy === 'POS_USER') {
          // Refresh invoices when POS_USER changes occur
          loadInvoices()
        }
      }).on('error', (err) => {
        console.error('Changes feed error:', err)
      })

      return () => {
        changes.cancel()
      }
    }
  }, [])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatCurrency = (amount: number) => {
    return `$${parseFloat(amount.toFixed(2))}`
  }

  const InvoiceCard = ({ invoice }: { invoice: POSInvoice }) => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
         onClick={() => setSelectedInvoice(invoice)}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">{invoice.erpnext_id || invoice._id}</h3>
          <div className="flex items-center text-gray-600 mt-1">
            <User size={16} className="mr-1" />
            <span className="text-sm">{invoice.customer_id?.split('::').pop() || 'Unknown Customer'}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-green-600">
            {formatCurrency(invoice.total_amount)}
          </div>
          <div className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
            invoice.status === 'Submitted' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
          }`}>
            {invoice.status}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-600">
        <div className="flex items-center">
          <Receipt size={16} className="mr-1" />
          <span>{invoice.items.length} items</span>
        </div>
        <div className="flex items-center">
          <CreditCard size={16} className="mr-1" />
          <span>{invoice.payment_method}</span>
        </div>
        <div className="flex items-center">
          <Clock size={16} className="mr-1" />
          <span>{formatDate(invoice.creation_date)}</span>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Total: {formatCurrency(invoice.total_amount)}</span>
          {invoice.tip_amount && invoice.tip_amount > 0 && (
            <span className="text-gray-600">Tip: {formatCurrency(invoice.tip_amount)}</span>
          )}
          <button className="text-blue-600 hover:text-blue-800 flex items-center">
            <Eye size={16} className="mr-1" />
            View Details
          </button>
        </div>
      </div>
    </div>
  )

  const InvoiceDetail = ({ invoice }: { invoice: POSInvoice }) => {
    
    return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-800">Invoice Details</h2>
            <button
              onClick={() => setSelectedInvoice(null)}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Invoice Header */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Invoice Information</h3>
              <div className="space-y-2 text-sm">
                <div className="text-black"><span className="font-medium text-gray-800">Invoice ID:</span> {invoice.erpnext_id || invoice._id}</div>
                <div className="text-black"><span className="font-medium text-gray-800">Customer:</span> {invoice.customer_id?.split('::').pop() || 'Unknown Customer'}</div>
                <div className="text-black"><span className="font-medium text-gray-800">Status:</span> 
                  <span className={`ml-2 inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                    invoice.status === 'Submitted' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {invoice.status}
                  </span>
                </div>
                <div className="text-black"><span className="font-medium text-gray-800">Payment Method:</span> {invoice.payment_method}</div>
                {invoice.cash_received && invoice.cash_received > 0 && (
                  <div className="text-black"><span className="font-medium text-gray-800">Cash Received:</span> {formatCurrency(invoice.cash_received)}</div>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Timestamps</h3>
              <div className="space-y-2 text-sm">
                <div className="text-black"><span className="font-medium text-gray-800">Created:</span> {formatDate(invoice.creation_date)}</div>
                <div className="text-black"><span className="font-medium text-gray-800">Modified:</span> {formatDate(invoice.modified_date)}</div>
                <div className="text-black"><span className="font-medium text-gray-800">Created By:</span> {invoice.CreatedBy}</div>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Items</h3>
            <div className="overflow-x-auto">
              <table className="w-full border border-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 border-b">Item</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700 border-b">UOM</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700 border-b">Qty</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700 border-b">Rate</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700 border-b">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items && Array.isArray(invoice.items) ? invoice.items.map((item, index) => (
                    <tr key={index} className="border-b border-gray-100">
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-medium text-gray-800">{item.item_id?.split('::').pop() || item.item_id || 'Unknown Item'}</div>
                          <div className="text-sm text-gray-500">{item.item_id}</div>
                        </div>
                      </td>
                      <td className="text-center py-3 px-4 text-gray-600">{item.uom}</td>
                      <td className="text-center py-3 px-4 text-gray-600">{item.qty}</td>
                      <td className="text-center py-3 px-4 text-gray-600">{formatCurrency(item.rate)}</td>
                      <td className="text-center py-3 px-4 font-medium text-gray-800">{formatCurrency(item.amount)}</td>
                    </tr>
                                     )) : (
                     <tr>
                       <td colSpan={5} className="py-8 text-center text-gray-500">No items found</td>
                     </tr>
                   )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Total Breakdown */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Payment Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-medium text-black">{formatCurrency(
                  invoice.items && Array.isArray(invoice.items) 
                    ? invoice.items.reduce((sum, item) => sum + (item.rate * item.qty), 0)
                    : 0
                )}</span>
              </div>
              {invoice.taxes && Array.isArray(invoice.taxes) && invoice.taxes.length > 0 && invoice.taxes.map((tax, index) => (
                <div key={index} className="flex justify-between">
                  <span className="text-gray-600">{tax.tax_type} ({tax.tax_rate}%):</span>
                  <span className="font-medium text-black">{formatCurrency(tax.tax_amount)}</span>
                </div>
              ))}
              {invoice.tip_amount && invoice.tip_amount > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Tip:</span>
                  <span className="font-medium text-black">{formatCurrency(invoice.tip_amount)}</span>
                </div>
              )}
              <div className="border-t pt-2 mt-2">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span className="text-green-600">{formatCurrency(invoice.total_amount)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )}

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 p-6">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">Invoices</h1>
              <p className="text-gray-600">Manage and view your POS invoices and order history</p>
            </div>
            
            {/* Sync Status Indicator */}
            {/* Commenting temporarily */}
            {/* <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${
                syncStatus === 'synced' ? 'bg-green-500' :
                syncStatus === 'syncing' ? 'bg-blue-500 animate-pulse' :
                syncStatus === 'error' ? 'bg-red-500' :
                'bg-gray-500'
              }`}></div>
              <span className="text-sm text-gray-600">
                {syncStatus === 'synced' ? 'Synced with remote' :
                 syncStatus === 'syncing' ? 'Syncing...' :
                 syncStatus === 'error' ? 'Sync failed (offline)' :
                 'Ready'}
              </span>
                             {(syncStatus === 'synced' || syncStatus === 'error') && (
                 <button
                   onClick={async () => {
                     await performSync()
                     await loadInvoices()
                   }}
                   className={`text-sm underline ${
                     syncStatus === 'error' 
                       ? 'text-red-600 hover:text-red-800' 
                       : 'text-blue-600 hover:text-blue-800'
                   }`}
                   disabled={false}
                 >
                   {syncStatus === 'error' ? 'Retry Sync' : 'Refresh'}
                 </button>
               )}
            </div> */}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Loading invoices...</p>
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-600">{error}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        ) : invoices.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <Receipt size={64} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">No invoices found</h3>
            <p className="text-gray-500">Start creating orders to see invoices here.</p>
          </div>
        ) : (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center">
                  <Receipt className="text-blue-500 mr-3" size={24} />
                  <div>
                    <p className="text-sm text-gray-600">Total Invoices</p>
                    <p className="text-2xl font-bold text-gray-800">{invoices.length}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center">
                  <DollarSign className="text-green-500 mr-3" size={24} />
                  <div>
                    <p className="text-sm text-gray-600">Total Revenue</p>
                    <p className="text-2xl font-bold text-gray-800">
                      {formatCurrency(invoices.reduce((sum, inv) => sum + inv.total_amount, 0))}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center">
                  <User className="text-purple-500 mr-3" size={24} />
                  <div>
                    <p className="text-sm text-gray-600">Unique Customers</p>
                    <p className="text-2xl font-bold text-gray-800">
                      {new Set(invoices.map(inv => inv.customer_id?.split('::').pop() || 'Unknown')).size}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center">
                  <Calendar className="text-orange-500 mr-3" size={24} />
                  <div>
                    <p className="text-sm text-gray-600">Today's Orders</p>
                    <p className="text-2xl font-bold text-gray-800">
                      {invoices.filter(inv => 
                        new Date(inv.creation_date).toDateString() === new Date().toDateString()
                      ).length}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Invoices Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {invoices.map((invoice) => (
                <InvoiceCard key={invoice._id} invoice={invoice} />
              ))}
            </div>
          </>
        )}

        {/* Invoice Detail Modal */}
        {selectedInvoice && (
          <InvoiceDetail invoice={selectedInvoice} />
        )}
      </div>
    </div>
  )
}

export default InvoicesPage 