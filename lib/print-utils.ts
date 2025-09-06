'use client'

import QRCode from 'qrcode'

// Types for order data (from order page)
export interface OrderData {
  items: Array<{
    id: string
    name: string
    price: number
    quantity: number
    subtotal: number
  }>
  customer: string
  paymentMethod: string
  subtotal: number
  vatAmount: number
  discountAmount: number
  total: number
  cashReceived?: string
  currentDateTime: string
  invoiceNumber?: string  // New field for actual invoice number
}

// Types for invoice data (from invoice page)
export interface InvoiceData {
  _id: string
  erpnext_id: string
  customer_id: string
  creation_date: string
  payment_method: string
  total_amount: number
  items: Array<{
    item_id: string
    qty: number
    rate: number
    amount: number
    uom?: string
  }>
  taxes?: Array<{
    tax_type: string
    tax_rate: number
    tax_amount: number
  }>
  discounts?: Array<{
    discount_type: string
    discount_amount: number
  }>
  tip_amount?: number
  cash_received?: number
  cashier_id?: string
  is_pos?: boolean
}

/**
 * Generate QR code for order/invoice data
 */
export const generateQRCode = async (data: OrderData | InvoiceData): Promise<string> => {
  let qrData: any

  if ('_id' in data) {
    // Invoice data
    qrData = {
      invoice_id: data.erpnext_id || data._id,
      customer: data.customer_id?.split('::').pop() || 'Unknown',
      total: data.total_amount,
      date: data.creation_date,
      payment_method: data.payment_method
    }
  } else {
    // Order data
    qrData = {
      order_id: `ORDER-${Date.now()}`,
      customer: data.customer,
      total: data.total,
      date: new Date().toISOString(),
      payment_method: data.paymentMethod
    }
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
 * Print order receipt (for new orders from order page)
 */
export const printOrderReceipt = async (orderData: OrderData) => {
  const qrCodeBase64 = await generateQRCode(orderData)
  
  const printWindow = window.open('', '_blank')
  if (printWindow) {
    const printDate = new Date()
    const formattedDate = printDate.toLocaleDateString('en-GB')
    const formattedTime = printDate.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    })
    
    // Use provided invoice number or generate a fallback
    const invoiceNumber = orderData.invoiceNumber || 
      `TEMP-${printDate.getFullYear()}-${String(printDate.getMonth() + 1).padStart(2, '0')}-${String(printDate.getDate()).padStart(2, '0')}-${Date.now().toString().slice(-6)}`

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Order Receipt</title>
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
              <div style="font-size: 14px; font-weight: bold;">Order #${invoiceNumber.split('-').pop()}</div>
              <div style="font-size: 10px;">${formattedDate}        ${formattedTime}</div>
              <div style="font-size: 10px;">Host: POS User</div>
              <div style="font-size: 10px;">Customer: ${orderData.customer}</div>
              <div style="font-size: 10px;">Order Type: Take Away</div>
            </div>

            <div style="border-top: 1px dashed #000; margin-bottom: 5px;"></div>

            <!-- Items -->
            ${orderData.items.map(item => `
              <div style="margin-bottom: 8px;">
                <div style="font-size: 11px; font-weight: bold;">${item.name} (${item.quantity} @ ${item.price.toFixed(2)})</div>
                <div style="text-align: right; font-size: 11px; margin-top: 2px;">${item.subtotal.toFixed(2)}</div>
              </div>
            `).join('')}

            <div style="border-top: 1px dashed #000; margin-top: 5px; margin-bottom: 5px;"></div>

            <!-- Totals -->
            <div style="text-align: center; font-size: 10px; margin-bottom: 5px;">Invoice Total</div>
            <div style="font-size: 11px; margin-bottom: 8px;">
              <div style="display: flex; justify-content: space-between;">
                <span>Subtotal</span>
                <span>${orderData.subtotal.toFixed(2)}</span>
              </div>
              ${orderData.discountAmount > 0 ? `
                <div style="display: flex; justify-content: space-between; margin-top: 2px;">
                  <span>Discount</span>
                  <span>-${orderData.discountAmount.toFixed(2)}</span>
                </div>
              ` : ''}
              <div style="display: flex; justify-content: space-between; margin-top: 2px;">
                <span>VAT (15%)</span>
                <span>${orderData.vatAmount.toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-top: 2px; font-weight: bold;">
                <span>${orderData.paymentMethod.toUpperCase()} #</span>
                <span>SR${orderData.total.toFixed(2)}</span>
              </div>
              ${orderData.paymentMethod === 'Cash' && orderData.cashReceived ? `
                <div style="display: flex; justify-content: space-between; margin-top: 2px;">
                  <span>Cash Received</span>
                  <span>SR${orderData.cashReceived}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 2px;">
                  <span>Change</span>
                  <span>SR${(parseFloat(orderData.cashReceived) - orderData.total).toFixed(2)}</span>
                </div>
              ` : ''}
            </div>

            <!-- Payment Info -->
            <div style="font-size: 9px; text-align: center; margin-bottom: 8px;">
              Auth:<br />
              Value Added Tax<br />
              15.00% Tax Amount: ${orderData.vatAmount.toFixed(2)}<br />
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

/**
 * Print invoice receipt (for existing invoices from invoice page)
 */
export const printInvoiceReceipt = async (invoice: InvoiceData) => {
  const qrCodeBase64 = await generateQRCode(invoice)
  
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

    const totalDiscount = invoice.discounts && Array.isArray(invoice.discounts)
      ? invoice.discounts.reduce((sum, discount) => sum + discount.discount_amount, 0)
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
              <div style="font-size: 10px;">Customer: ${invoice.customer_id?.split('::').pop() || 'Unknown'}</div>
              <div style="font-size: 10px;">Order Type: ${invoice.is_pos ? 'Take Away' : 'Dine In'}</div>
            </div>

            <div style="border-top: 1px dashed #000; margin-bottom: 5px;"></div>

            <!-- Items -->
            ${invoice.items && Array.isArray(invoice.items) ? invoice.items.map(item => `
              <div style="margin-bottom: 8px;">
                <div style="font-size: 11px; font-weight: bold;">${item.item_id?.split('::').pop() || item.item_id} (${item.qty} @ ${item.rate.toFixed(2)})</div>
                <div style="font-size: 9px; color: #666;">${item.item_id?.includes('::') ? item.item_id.split('::')[0] : ''}</div>
                <div style="text-align: right; font-size: 11px; margin-top: 2px;">${item.amount.toFixed(2)}</div>
              </div>
            `).join('') : ''}

            <div style="border-top: 1px dashed #000; margin-top: 5px; margin-bottom: 5px;"></div>

            <!-- Totals -->
            <div style="text-align: center; font-size: 10px; margin-bottom: 5px;">Invoice Total</div>
            <div style="font-size: 11px; margin-bottom: 8px;">
              <div style="display: flex; justify-content: space-between;">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              ${totalDiscount > 0 ? `
                <div style="display: flex; justify-content: space-between; margin-top: 2px;">
                  <span>Discount</span>
                  <span>-${totalDiscount.toFixed(2)}</span>
                </div>
              ` : ''}
              ${totalTax > 0 ? `
                <div style="display: flex; justify-content: space-between; margin-top: 2px;">
                  <span>VAT (${((totalTax/subtotal) * 100).toFixed(1)}%)</span>
                  <span>${totalTax.toFixed(2)}</span>
                </div>
              ` : ''}
              <div style="display: flex; justify-content: space-between; margin-top: 2px; font-weight: bold;">
                <span>${invoice.payment_method.toUpperCase()} #</span>
                <span>SR${invoice.total_amount.toFixed(2)}</span>
              </div>
              ${invoice.payment_method === 'Cash' && invoice.cash_received ? `
                <div style="display: flex; justify-content: space-between; margin-top: 2px;">
                  <span>Cash Received</span>
                  <span>SR${invoice.cash_received.toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 2px;">
                  <span>Change</span>
                  <span>SR${(invoice.cash_received - invoice.total_amount).toFixed(2)}</span>
                </div>
              ` : ''}
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