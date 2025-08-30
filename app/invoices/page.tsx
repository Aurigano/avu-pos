'use client'

import { useState, useEffect } from 'react'
import { Calendar, User, TrendingUp, CreditCard, Eye, Clock, Printer, Package, FileText, Edit3 } from 'lucide-react'
import Sidebar from '../../components/Sidebar'
import { localDB, remoteDB } from '@/lib/pouchdb'
import { printInvoiceReceipt } from '@/lib/print-utils'

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

    // Load invoices from PouchDB
  const loadInvoices = async () => {
    console.log('DEBUG: Starting to load invoices...')
    
    if (!localDB) {
      console.log('DEBUG: LocalDB not available')
      setError('Database not available')
      setLoading(false)
      return
    }

    try {
      console.log('DEBUG: LocalDB is available, checking documents...')
      
      // Debug: Check all documents first
      const allDocs = await localDB.allDocs({ include_docs: true })
      console.log('DEBUG: Total documents in DB:', allDocs.rows.length)
      
      const allPOSInvoices = allDocs.rows
        .map((row: any) => row.doc)
        .filter((doc: any) => doc && doc.type === 'POSInvoice')
      
      console.log('DEBUG: All POSInvoice documents in DB:', allPOSInvoices.map(doc => ({
        id: doc._id,
        type: doc.type,
        status: doc.status,
        CreatedBy: doc.CreatedBy,
        customer: doc.customer_id?.split('::').pop()
      })))
      
      // Use the simple approach directly - skip the complex query for now
      console.log('DEBUG: Using direct filtering approach')
      const finalInvoices = allPOSInvoices.filter((doc: any) => 
        doc && doc.type === 'POSInvoice' && doc.CreatedBy === 'POS_USER'
      )
      
      console.log('DEBUG: Filtered invoices:', finalInvoices.map((doc: any) => ({
        id: doc._id,
        type: doc.type,
        status: doc.status,
        CreatedBy: doc.CreatedBy
      })))

      const invoiceData = finalInvoices as POSInvoice[]
      console.log('DEBUG: Final invoices being displayed:', invoiceData.length)
      invoiceData.sort((a, b) => new Date(b.creation_date).getTime() - new Date(a.creation_date).getTime())
      setInvoices(invoiceData)
      setError(null)
      
    } catch (err) {
      console.error('Error loading invoices:', err)
      setError(`Failed to load invoices: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const initializePage = async () => {
      setLoading(true)
      await loadInvoices()
      setLoading(false)
    }

    initializePage()
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
    return `${parseFloat(amount.toFixed(2))}`
  }

  // Function to continue a draft invoice
  const handleContinueDraft = (invoiceId: string) => {
    // Navigate to orders page with draft ID parameter
    window.location.href = `/order?continueDraft=${invoiceId}`
  }



  const InvoiceCard = ({ invoice }: { invoice: POSInvoice }) => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 hover:shadow-md transition-shadow"
         onClick={invoice.status === 'Draft' ? undefined : () => setSelectedInvoice(invoice)}>
      <div className="flex items-start justify-between mb-3 sm:mb-4">
        <div className="min-w-0 flex-1 mr-4">
          <h3 className="text-base sm:text-lg font-semibold text-gray-800 truncate">
            {invoice.status === 'Draft' ? (
              <span className="text-gray-600 italic">Draft Invoice</span>
            ) : (
              invoice.erpnext_id || invoice._id
            )}
          </h3>
          <div className="flex items-center text-gray-600 mt-1">
            <User size={16} className="mr-1 flex-shrink-0" />
            <span className="text-xs sm:text-sm truncate">{invoice.customer_id?.split('::').pop() || 'Unknown Customer'}</span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-lg sm:text-2xl font-bold text-green-600">
            {formatCurrency(invoice.total_amount)}
          </div>
          <div className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
            invoice.status === 'Submitted' ? 'bg-green-100 text-green-800' : 
            invoice.status === 'Draft' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
          }`}>
            {invoice.status}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs sm:text-sm text-gray-600 mb-3 sm:mb-0">
        <div className="flex items-center min-w-0 mr-2">
          <Package size={16} className="mr-1 flex-shrink-0" />
          <span className="truncate">{invoice.items.length} items</span>
        </div>
        <div className="flex items-center min-w-0 mx-2">
          <CreditCard size={16} className="mr-1 flex-shrink-0" />
          <span className="truncate">{invoice.payment_method}</span>
        </div>
        <div className="flex items-center min-w-0 ml-2">
          <Clock size={16} className="mr-1 flex-shrink-0" />
          <span className="truncate">{formatDate(invoice.creation_date)}</span>
        </div>
      </div>

      <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-100">
        <div className="flex items-center justify-between text-xs sm:text-sm">
          <span className="text-gray-600">Total: {formatCurrency(invoice.total_amount)}</span>
          {invoice.tip_amount && invoice.tip_amount > 0 && (
            <span className="text-gray-600">Tip: {formatCurrency(invoice.tip_amount)}</span>
          )}
          <div className="flex items-center space-x-2 flex-shrink-0">
            {invoice.status === 'Draft' ? (
              <button 
                onClick={(e) => {
                  e.stopPropagation()
                  handleContinueDraft(invoice._id)
                }}
                className="text-blue-600 hover:text-blue-800 flex items-center"
              >
                <Edit3 size={16} className="mr-1" />
                <span className="hidden sm:inline">Continue Draft</span>
                <span className="sm:hidden">Continue</span>
              </button>
            ) : (
              <button 
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedInvoice(invoice)
                }}
                className="text-blue-600 hover:text-blue-800 flex items-center"
              >
                <Eye size={16} className="mr-1" />
                <span className="hidden sm:inline">View Details</span>
                <span className="sm:hidden">View</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  const InvoiceDetail = ({ invoice }: { invoice: POSInvoice }) => {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
        <div className="bg-white rounded-lg max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
          <div className="p-4 sm:p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-black">
                {invoice.status === 'Draft' ? 'Draft Invoice Details' : 'Invoice Details'}
              </h2>
              <div className="flex items-center space-x-2">
                {invoice.status === 'Draft' ? (
                  <button
                    onClick={() => {
                      setSelectedInvoice(null)
                      handleContinueDraft(invoice._id)
                    }}
                    className="flex items-center px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base"
                  >
                    <Edit3 size={16} className="mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Continue Draft</span>
                    <span className="sm:hidden">Continue</span>
                  </button>
                ) : (
                  <button
                    onClick={() => printInvoiceReceipt(invoice)}
                    className="flex items-center px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base"
                  >
                    <Printer size={16} className="mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Print Receipt</span>
                    <span className="sm:hidden">Print</span>
                  </button>
                )}
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="text-gray-500 hover:text-gray-700 text-xl sm:text-2xl p-1"
                >
                  ×
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6">
            {/* Invoice Header */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-black mb-2">Invoice Information</h3>
                <div className="space-y-1 sm:space-y-2 text-sm">
                  {invoice.status !== 'Draft' ? (
                    <div><span className="font-medium text-gray-700">Invoice ID:</span> <span className="text-black break-all">{invoice.erpnext_id || invoice._id}</span></div>
                  ) : (
                    <div><span className="font-medium text-gray-700">Draft ID:</span> <span className="text-black break-all">{invoice._id}</span></div>
                  )}
                  <div><span className="font-medium text-gray-700">Customer:</span> <span className="text-black break-words">{invoice.customer_id?.split('::').pop() || 'Unknown Customer'}</span></div>
                  <div><span className="font-medium text-gray-700">Status:</span> 
                    <span className={`ml-2 inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                      invoice.status === 'Submitted' ? 'bg-green-100 text-green-800' : 
                      invoice.status === 'Draft' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {invoice.status}
                    </span>
                  </div>
                  <div><span className="font-medium text-gray-700">Payment Method:</span> <span className="text-black">{invoice.payment_method}</span></div>
                </div>
              </div>

              <div>
                <h3 className="text-base sm:text-lg font-semibold text-black mb-2">Timestamps</h3>
                <div className="space-y-1 sm:space-y-2 text-sm">
                  <div><span className="font-medium text-gray-700">Created:</span> <span className="text-black">{formatDate(invoice.creation_date)}</span></div>
                  <div><span className="font-medium text-gray-700">Modified:</span> <span className="text-black">{formatDate(invoice.modified_date)}</span></div>
                  <div><span className="font-medium text-gray-700">Created By:</span> <span className="text-black">{invoice.CreatedBy}</span></div>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="mb-4 sm:mb-6">
              <h3 className="text-base sm:text-lg font-semibold text-black mb-3 sm:mb-4">Items</h3>
              <div className="overflow-x-auto">
                <table className="w-full border border-gray-200 min-w-[500px]">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-black border-b text-xs sm:text-sm">Item</th>
                      <th className="text-center py-2 sm:py-3 px-2 sm:px-4 font-semibold text-black border-b text-xs sm:text-sm">UOM</th>
                      <th className="text-center py-2 sm:py-3 px-2 sm:px-4 font-semibold text-black border-b text-xs sm:text-sm">Qty</th>
                      <th className="text-center py-2 sm:py-3 px-2 sm:px-4 font-semibold text-black border-b text-xs sm:text-sm">Rate</th>
                      <th className="text-center py-2 sm:py-3 px-2 sm:px-4 font-semibold text-black border-b text-xs sm:text-sm">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items && Array.isArray(invoice.items) ? invoice.items.map((item, index) => (
                      <tr key={index} className="border-b border-gray-100">
                        <td className="py-2 sm:py-3 px-2 sm:px-4">
                          <div>
                            <div className="font-medium text-black text-sm truncate">{item.item_id?.split('::').pop() || item.item_id || 'Unknown Item'}</div>
                            <div className="text-xs text-gray-600 truncate">{item.item_id}</div>
                          </div>
                        </td>
                        <td className="text-center py-2 sm:py-3 px-2 sm:px-4 text-black text-sm">{item.uom}</td>
                        <td className="text-center py-2 sm:py-3 px-2 sm:px-4 text-black text-sm">{item.qty}</td>
                        <td className="text-center py-2 sm:py-3 px-2 sm:px-4 text-black text-sm">{formatCurrency(item.rate)}</td>
                        <td className="text-center py-2 sm:py-3 px-2 sm:px-4 font-medium text-black text-sm">{formatCurrency(item.amount)}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-gray-500 text-sm">No items found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Total Breakdown */}
            <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
              <h3 className="text-base sm:text-lg font-semibold text-black mb-3 sm:mb-4">Payment Summary</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700">Subtotal:</span>
                  <span className="font-medium text-black">{formatCurrency(
                    invoice.items && Array.isArray(invoice.items) 
                      ? invoice.items.reduce((sum, item) => sum + (item.rate * item.qty), 0)
                      : 0
                  )}</span>
                </div>
                {invoice.taxes && Array.isArray(invoice.taxes) && invoice.taxes.length > 0 && invoice.taxes.map((tax, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="text-gray-700">{tax.tax_type} ({tax.tax_rate}%):</span>
                    <span className="font-medium text-black">{formatCurrency(tax.tax_amount)}</span>
                  </div>
                ))}
                {invoice.tip_amount && invoice.tip_amount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700">Tip:</span>
                    <span className="font-medium text-black">{formatCurrency(invoice.tip_amount)}</span>
                  </div>
                )}
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between text-base sm:text-lg font-bold">
                    <span className="text-black">Total:</span>
                    <span className="text-green-600">{formatCurrency(invoice.total_amount)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-gray-50 overflow-x-hidden">
      <Sidebar />
      
      <div className="flex-1 p-3 sm:p-4 lg:p-6 min-w-0">
        <div className="mb-4 sm:mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800 mb-1 sm:mb-2">Invoices</h1>
              <p className="text-sm sm:text-base text-gray-600">Manage and view your POS invoices and order history</p>
            </div>
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
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 sm:p-6 text-center">
            <p className="text-red-600 text-sm sm:text-base">{error}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm sm:text-base"
            >
              Retry
            </button>
          </div>
        ) : invoices.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 sm:p-12 text-center">
            <FileText size={64} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg sm:text-xl font-semibold text-gray-600 mb-2">No invoices found</h3>
            <p className="text-sm sm:text-base text-gray-500">Start creating orders to see invoices here.</p>
          </div>
        ) : (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-6 mb-4 sm:mb-6">
              <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4 lg:p-6">
                <div className="flex items-center">
                  <FileText className="text-blue-500 mr-2 lg:mr-3" size={24} />
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-gray-600">Total Invoices</p>
                    <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800">{invoices.length}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4 lg:p-6">
                <div className="flex items-center">
                  <FileText className="text-yellow-500 mr-2 lg:mr-3" size={24} />
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-gray-600">Draft Invoices</p>
                    <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800">
                      {invoices.filter(inv => inv.status === 'Draft').length}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4 lg:p-6">
                <div className="flex items-center">
                  <TrendingUp className="text-green-500 mr-2 lg:mr-3" size={24} />
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-gray-600">Total Revenue</p>
                    <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800">
                      {formatCurrency(invoices.filter(inv => inv.status === 'Submitted').reduce((sum, inv) => sum + inv.total_amount, 0))}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4 lg:p-6">
                <div className="flex items-center">
                  <User className="text-purple-500 mr-2 lg:mr-3" size={24} />
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-gray-600">Unique Customers</p>
                    <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800">
                      {new Set(invoices.map(inv => inv.customer_id?.split('::').pop() || 'Unknown')).size}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4 lg:p-6">
                <div className="flex items-center">
                  <Calendar className="text-orange-500 mr-2 lg:mr-3" size={24} />
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-gray-600">Today's Orders</p>
                    <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800">
                      {invoices.filter(inv => 
                        new Date(inv.creation_date).toDateString() === new Date().toDateString()
                      ).length}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Invoices Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
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