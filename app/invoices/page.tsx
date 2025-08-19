'use client'

import { useState, useEffect } from 'react'
import { Calendar, User, DollarSign, CreditCard, Eye, Receipt, Clock, Printer } from 'lucide-react'
import Sidebar from '../../components/Sidebar'
import { localDB, remoteDB } from '@/lib/pouchdb'
import QRCode from 'qrcode'

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
    if (!localDB) {
      setError('Database not available')
      setLoading(false)
      return
    }

    try {
      const result = await localDB.find({
        selector: {
          type: 'POSInvoice',
          CreatedBy: 'POS_USER'
        }
      })

      const invoiceData = result.docs as POSInvoice[]
      invoiceData.sort((a, b) => new Date(b.creation_date).getTime() - new Date(a.creation_date).getTime())
      setInvoices(invoiceData)
      setError(null)
    } catch (err) {
      console.error('Error loading invoices:', err)
      setError('Failed to load invoices')
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
    return `$${parseFloat(amount.toFixed(2))}`
  }

  /**
   * Generate QR code for invoice data
   */
  const generateInvoiceQRCode = async (invoice: POSInvoice): Promise<string> => {
    const qrData = {
      invoice_id: invoice.erpnext_id || invoice._id,
      customer: invoice.customer_id?.split('::').pop() || 'Unknown',
      total: invoice.total_amount,
      date: invoice.creation_date,
      payment_method: invoice.payment_method
    }

    try {
      const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(qrData), {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })
      // Return just the base64 part without the data URL prefix
      return qrCodeDataURL.split(',')[1]
    } catch (error) {
      console.error('Error generating QR code:', error)
      return ''
    }
  }

  /**
   * Print invoice with dynamically generated QR code
   */
  const printInvoice = async (invoice: POSInvoice) => {
    const qrCodeBase64 = await generateInvoiceQRCode(invoice)
    
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      const printDate = new Date(invoice.creation_date)
      const formattedDate = printDate.toLocaleDateString('en-GB')
      const formattedTime = printDate.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      })
      
      const subtotal = invoice.items && Array.isArray(invoice.items) 
        ? invoice.items.reduce((sum, item) => sum + (item.rate * item.qty), 0)
        : 0
      
      const totalTax = invoice.taxes && Array.isArray(invoice.taxes)
        ? invoice.taxes.reduce((sum, tax) => sum + tax.tax_amount, 0)
        : 0

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Invoice ${invoice.erpnext_id || invoice._id}</title>
            <style>
              body { margin: 0; padding: 0; }
              @media print {
                body * { visibility: hidden; }
                .print-content, .print-content * { visibility: visible; }
                .print-content {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 58mm;
                  font-size: 10px;
                }
                @page {
                  size: 58mm auto;
                  margin: 0;
                }
              }
            </style>
          </head>
          <body>
            <div class="print-content" style="font-family: monospace; max-width: 58mm; padding: 10px; font-size: 12px; line-height: 1.2; color: #000;">
              <!-- Company Header -->
              <div style="text-align: center; margin-bottom: 10px;">
                <div style="font-size: 16px; font-weight: bold; letter-spacing: 2px;">AVU</div>
                <div style="font-size: 9px; margin-top: 2px;">Simplified Tax Invoice</div>
              </div>

              <!-- Location -->
              <div style="text-align: center; margin-bottom: 10px; font-size: 10px;">
                Welcome to AVU<br />Location TBD
              </div>

              <!-- Order Header -->
              <div style="margin-bottom: 10px;">
                <div style="font-size: 14px; font-weight: bold;">Order #${invoice.erpnext_id?.split('-').pop() || invoice._id.slice(-3)}</div>
                <div style="font-size: 10px;">${formattedDate}        ${formattedTime}</div>
                <div style="font-size: 10px;">Host: ${invoice.cashier_id || 'POS User'}</div>
                <div style="font-size: 10px;">Order Type: ${invoice.is_pos ? 'Take Away' : 'Dine In'}</div>
              </div>

              <div style="border-top: 1px dashed #000; margin-bottom: 5px;"></div>

              <!-- Items -->
              ${invoice.items && Array.isArray(invoice.items) ? invoice.items.map(item => `
                <div style="margin-bottom: 8px;">
                  <div style="font-size: 11px; font-weight: bold;">${item.item_id?.split('::').pop() || item.item_id} (${item.qty} @ $${item.rate.toFixed(2)})</div>
                  <div style="font-size: 9px; color: #666;">${item.item_id?.includes('::') ? item.item_id.split('::')[0] : ''}</div>
                  <div style="text-align: right; font-size: 11px; margin-top: 2px;">${item.amount.toFixed(2)}</div>
                </div>
              `).join('') : ''}

              <div style="border-top: 1px dashed #000; margin-top: 5px; margin-bottom: 5px;"></div>

              <!-- Totals -->
              <div style="text-align: center; font-size: 10px; margin-bottom: 5px;">Invoice Total</div>
              <div style="font-size: 11px; margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between;">
                  <span>Take Away Total</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                ${totalTax > 0 ? `
                  <div style="display: flex; justify-content: space-between; margin-top: 2px;">
                    <span>VAT (${((totalTax/subtotal) * 100).toFixed(1)}%)</span>
                    <span>${totalTax.toFixed(2)}</span>
                  </div>
                ` : ''}
                <div style="display: flex; justify-content: space-between; margin-top: 2px; font-weight: bold;">
                  <span>VISA #</span>
                  <span>SR${invoice.total_amount.toFixed(2)}</span>
                </div>
              </div>

              <!-- Payment Info -->
              <div style="font-size: 9px; text-align: center; margin-bottom: 8px;">
                Auth:<br />
                Value Added Tax<br />
                15.00% Tax Amount: ${totalTax.toFixed(2)}<br />
                Thank you for choosing AVU<br />
                Restaurant Services<br />
                Business Location<br />
                City - Postal Code
              </div>

              <!-- VAT Number -->
              <div style="text-align: center; font-size: 10px; margin-bottom: 10px;">VAT: 300716182600003</div>

              <!-- Footer -->
              <div style="text-align: center; font-size: 10px; margin-bottom: 10px;">--- Check Closed ---</div>

              <!-- QR Code -->
              <div style="text-align: center; font-size: 9px; margin-bottom: 5px;">*** SCAN QR CODE ***</div>
              
              <div style="text-align: center; margin-bottom: 10px;">
                ${qrCodeBase64 ? `
                  <img 
                    src="data:image/png;base64,${qrCodeBase64}"
                    alt="QR Code"
                    style="width: 80px; height: 80px; display: block; margin: 0 auto;"
                  />
                ` : `
                  <div style="width: 80px; height: 80px; border: 1px solid #000; margin: 0 auto; display: flex; align-items: center; justify-content: center; font-size: 8px;">
                    QR CODE
                  </div>
                `}
              </div>
            </div>
            <script>
              window.onload = function() {
                window.print();
                window.onafterprint = function() {
                  window.close();
                }
              }
            </script>
          </body>
        </html>
      `)
      printWindow.document.close()
    }
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
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => printInvoice(invoice)}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Printer size={16} className="mr-2" />
                  Print Receipt
                </button>
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>
            </div>
          </div>

          <div className="p-6">
            {/* Invoice Header */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Invoice Information</h3>
                <div className="space-y-2 text-sm">
                  <div><span className="font-medium text-gray-800">Invoice ID:</span> {invoice.erpnext_id || invoice._id}</div>
                  <div><span className="font-medium text-gray-800">Customer:</span> {invoice.customer_id?.split('::').pop() || 'Unknown Customer'}</div>
                  <div><span className="font-medium text-gray-800">Status:</span> 
                    <span className={`ml-2 inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                      invoice.status === 'Submitted' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {invoice.status}
                    </span>
                  </div>
                  <div><span className="font-medium text-gray-800">Payment Method:</span> {invoice.payment_method}</div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Timestamps</h3>
                <div className="space-y-2 text-sm">
                  <div><span className="font-medium text-gray-800">Created:</span> {formatDate(invoice.creation_date)}</div>
                  <div><span className="font-medium text-gray-800">Modified:</span> {formatDate(invoice.modified_date)}</div>
                  <div><span className="font-medium text-gray-800">Created By:</span> {invoice.CreatedBy}</div>
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
                  <span className="font-medium">{formatCurrency(
                    invoice.items && Array.isArray(invoice.items) 
                      ? invoice.items.reduce((sum, item) => sum + (item.rate * item.qty), 0)
                      : 0
                  )}</span>
                </div>
                {invoice.taxes && Array.isArray(invoice.taxes) && invoice.taxes.length > 0 && invoice.taxes.map((tax, index) => (
                  <div key={index} className="flex justify-between">
                    <span className="text-gray-600">{tax.tax_type} ({tax.tax_rate}%):</span>
                    <span className="font-medium">{formatCurrency(tax.tax_amount)}</span>
                  </div>
                ))}
                {invoice.tip_amount && invoice.tip_amount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tip:</span>
                    <span className="font-medium">{formatCurrency(invoice.tip_amount)}</span>
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
    )
  }

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