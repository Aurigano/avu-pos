'use client'

import { useState, useEffect } from 'react'
import { Calendar, CreditCard, Banknote } from 'lucide-react'
import Sidebar from '../../components/Sidebar'
import OrderItem from '../../components/OrderItem'
import SearchBar from '../../components/SearchBar'
import { useHydration } from '../../hooks/useHydration'
import { localDB, remoteDB } from '@/lib/pouchdb'
import serviceWorkerManager from '@/lib/service-worker-manager'
import { usePOSStore } from '@/stores/pos-store'
import { printOrderReceipt } from '@/lib/print-utils'

interface OrderItemType {
  id: string
  name: string
  category: string
  price: number
  quantity: number
  subtotal: number
  // Additional fields for CouchDB mapping
  item_id?: string
  uom?: string
  image?: string
}

const OrderPage = () => {
  const [orderItems, setOrderItems] = useState<OrderItemType[]>([])
  const [cashReceived, setCashReceived] = useState<string>('0')
  const [selectedDiscount, setSelectedDiscount] = useState<number>(0)
  const [currentDateTime, setCurrentDateTime] = useState<string>('')
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'Cash' | 'Card' | 'Voucher'>('Cash')
  const [selectedCustomer, setSelectedCustomer] = useState<string>('')
  const mounted = useHydration()
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle')
  const [serviceWorkerReady, setServiceWorkerReady] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [resetTrigger, setResetTrigger] = useState(0)
  
  // POS Store
  const { initializePOSData, getItemPrice, isLoaded: posDataLoaded, loadError: posLoadError } = usePOSStore()

  // Test database connection
  const testDatabaseConnection = async () => {
    console.log('Testing database connection...')
    
    try {
      if (!localDB) {
        console.error('Local DB not available')
        return false
      }
      
      if (!remoteDB) {
        console.error('Remote DB not available')
        return false
      }
      
      // Test local DB
      const localInfo = await localDB.info()
      console.log('Local DB info:', localInfo)
      
      // Test remote DB
      const remoteInfo = await remoteDB.info()
      console.log('Remote DB info:', remoteInfo)
      
      console.log('Database connection test successful')
      return true
    } catch (error) {
      console.error('Database connection test failed:', error)
      return false
    }
  }
  
  // One-time sync function
  const performSync = async (direction: 'pull' | 'push' | 'both' = 'both') => {
    setSyncStatus('syncing')
    
    try {
      if (!localDB || !remoteDB) {
        throw new Error('Database not available')
      }

      console.log(`Starting ${direction} sync...`)

      if (direction === 'pull' || direction === 'both') {
        // Pull from remote to local
        console.log('Pulling data from remote database...')
        const pullResult = await localDB.replicate.from(remoteDB, {
          timeout: 15000, // 15 second timeout
          retry: false    // Don't retry automatically to avoid hanging
        })
        console.log('Pull sync completed:', pullResult.docs_read, 'docs received')
      }
      
      if (direction === 'push' || direction === 'both') {
        // Push from local to remote
        console.log('Pushing data to remote database...')
        const pushResult = await localDB.sync(remoteDB, {
          timeout: 15000, // 15 second timeout
          retry: false    // Don't retry automatically to avoid hanging
        })
        console.log('Push sync completed:', pushResult)
        // console.log('Push sync completed:', pushResult.docs_written, 'docs sent')
      }
      
      setSyncStatus('synced')
      console.log(`${direction} sync completed successfully`)
    } catch (error: any) {
      console.error('Sync failed:', error.message || error)
      setSyncStatus('error')
      
      // Log specific error types
      if (error.status === 401 || error.status === 403) {
        console.log('Authentication error - check credentials')
      } else if (error.status === 404) {
        console.log('Database not found - check URL')
      } else if (error.message && error.message.includes('CORS')) {
        console.log('CORS error - check server configuration')
      } else if (error.code === 'ENOTFOUND' || error.message?.includes('fetch')) {
        console.log('Network error - check internet connection')
      } else {
        console.log('Unknown sync error:', error)
      }
      
      throw error // Re-throw to let caller handle
    }
  }
  
  // Initialize and perform initial sync
  useEffect(() => {
    const initializeApp = async () => {
      console.log('Initializing app and performing initial sync...')
      
      // Test database connection first
      const connectionOk = await testDatabaseConnection()
      if (!connectionOk) {
        console.log('Database connection failed, working offline')
        setSyncStatus('error')
        return
      }
      
      // Always try direct sync first (more reliable)
      try {
        console.log('Attempting direct database sync...')
        await performSync('pull')
        console.log('Direct sync completed successfully')
      } catch (directSyncError) {
        console.log('Direct sync failed, trying service worker...', directSyncError)
        
        // Fallback to service worker if available
        try {
          const isReady = await serviceWorkerManager.initialize()
          setServiceWorkerReady(isReady)
          
          if (isReady) {
            console.log('Service Worker ready, performing sync...')
            setSyncStatus('syncing')
            await serviceWorkerManager.performSync('pull')
            setSyncStatus('synced')
            console.log('Service Worker sync completed')
          } else {
            console.log('Service Worker not available, working offline')
            setSyncStatus('error')
          }
        } catch (swError) {
          console.log('Service Worker sync also failed, working offline:', swError)
          setSyncStatus('error')
        }
      }
    }
    
    // Only run on client side
    if (typeof window !== 'undefined') {
      initializeApp()
    }
  }, []);

  // Load all data from local database and create indexes
  useEffect(() => {
    const loadAllData = async () => {
      if (!localDB) return;
      
      try {
        // Create necessary indexes
        await localDB.createIndex({
          index: {
            fields: ['type', 'CreatedBy', 'creation_date']
          }
        })
        
        await localDB.createIndex({
          index: {
            fields: ['type', 'item_name']
          }
        })

        const allDocs = await localDB.allDocs({ include_docs: true });
        console.log('All local database documents:', allDocs.rows.map((row: any) => row.doc));
        
        // Initialize POS data (POSProfile and ItemPriceList)
        // Checkpoint 1: Commented console logs
        // console.log('Initializing POS pricing data...')
        await initializePOSData()
        
        if (posLoadError) {
          // console.error('POS data loading error:', posLoadError)
        } else if (posDataLoaded) {
          // console.log('POS data loaded successfully')
        }
        
      } catch (error) {
        console.error('Error loading data or creating indexes:', error);
      }
    };
    loadAllData();
  }, [initializePOSData]); // Added initializePOSData as dependency

  // Update current date and time
  useEffect(() => {
    
    const updateDateTime = () => {
      const now = new Date()
      const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }
      setCurrentDateTime(now.toLocaleDateString('en-US', options))
    }

    updateDateTime()
    const interval = setInterval(updateDateTime, 1000) // Update every second

    return () => clearInterval(interval)
  }, [])

  const subtotal = orderItems.reduce((sum, item) => sum + item.subtotal, 0)
  const discountAmount = selectedDiscount
  const vatAmount = subtotal * 0.15 // 15% VAT
  const total = subtotal + vatAmount - discountAmount

  const handleRemoveItem = (id: string) => {
    setOrderItems(orderItems.filter(item => item.id !== id))
  }

  const handleQuantityChange = (id: string, newQuantity: number) => {
    setOrderItems(orderItems.map(item => 
      item.id === id 
        ? { ...item, quantity: newQuantity, subtotal: item.price * newQuantity }
        : item
    ))
  }

  const handleAddItemFromSearch = async (itemName: string) => {
    try {
      console.log('Adding item:', itemName)
      
      if (!localDB) {
        showToast('Database not available', 'error')
        return
      }
      
      // Find the product from the database
      const result = await localDB.find({ 
        selector: { 
          type: 'Item',
          item_name: itemName
        } 
      })
      
      if (result.docs.length === 0) {
        console.error('Product not found in database:', itemName)
        showToast('Product not found in database', 'error')
        return
      }
      
      const product = result.docs[0] as any
      console.log('Found product:', product)
      
      // Ensure required fields exist
      if (!product.item_name) {
        console.error('Product missing item_name:', product)
        showToast('Invalid product data', 'error')
        return
      }
      
      // Check if item already exists in the order
      const existingItemIndex = orderItems.findIndex(item => 
        item.name === product.item_name || item.item_id === product._id
      )

      if (existingItemIndex >= 0) {
        // Item exists, increase quantity by 1
        const updatedItems = [...orderItems]
        updatedItems[existingItemIndex] = {
          ...updatedItems[existingItemIndex],
          quantity: updatedItems[existingItemIndex].quantity + 1,
          subtotal: updatedItems[existingItemIndex].price * (updatedItems[existingItemIndex].quantity + 1)
        }
        setOrderItems(updatedItems)
        console.log('Updated existing item quantity')
        showToast(`Updated ${product.item_name} quantity`, 'success')
      } else {
        // Item doesn't exist, add new item
        // Get dynamic price from POS store
        const priceResult = getItemPrice(product.item_code, product.item_code)
        const itemPrice = priceResult.isValid ? priceResult.price : (Number(product.standard_selling_rate) || 0)
        
        // console.log('Price lookup for', product.item_name, ':', priceResult)
        if (!priceResult.isValid) {
          // console.warn('Using fallback price from standard_selling_rate for item:', product.item_name)
        }
        
        const newItem: OrderItemType = {
          id: `${product.item_name}-${Date.now()}`,
          name: product.item_name || 'Unknown Item',
          category: product.item_group || 'General',
          price: itemPrice,
          quantity: 1,
          subtotal: itemPrice,
          item_id: product._id || product.erpnext_id || '',
          uom: product.default_uom || 'Unit',
          image: product.image || ''
        }
        setOrderItems([...orderItems, newItem])
        showToast(`Added ${product.item_name} to order`, 'success')
        // console.log('Added new item with dynamic pricing:', newItem)
      }
    } catch (error) {
      console.error('Error adding item from search:', error)
      showToast(`Error adding item: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
    }
  }

  const handleCustomerSelect = (customerName: string) => {
    setSelectedCustomer(customerName)
    console.log('Selected customer:', customerName)
  }

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000) // Auto-hide after 3 seconds
  }

  const handlePrintOrder = async () => {
    const orderData = {
      items: orderItems.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        subtotal: item.subtotal
      })),
      customer: selectedCustomer,
      paymentMethod: selectedPaymentMethod,
      subtotal,
      vatAmount,
      discountAmount,
      total,
      cashReceived: selectedPaymentMethod === 'Cash' ? cashReceived : undefined,
      currentDateTime
    }

    await printOrderReceipt(orderData)
  }

  const handleConfirmAndPrint = async () => {
    await handleConfirmOrder()
    setTimeout(() => {
      handlePrintOrder()
    }, 1000) // Small delay to ensure order is saved before printing
  }

  const handleSubmit = async () => {
    try {
      // Validation checks
      if (orderItems.length === 0) {
        showToast('Please add items to the order before submitting.', 'error')
        return
      }

      if (!selectedCustomer) {
        showToast('Customer Selection Required! Please select a customer using the search bar.', 'error')
        return
      }

      // Check if all items have valid rates (allow 0, but not negative prices)
      const invalidItems = orderItems.filter(item => item.price < 0)
      if (invalidItems.length > 0) {
        showToast('All items must have a valid rate (cannot be negative).', 'error')
        return
      }

      // Show confirmation dialog instead of direct submission
      setShowConfirmDialog(true)
    } catch (error) {
      console.error('Error in handleSubmit:', error)
      showToast('An error occurred. Please try again.', 'error')
    }
  }

  const handleConfirmOrder = async () => {
    try {
      setShowConfirmDialog(false)
      setSyncStatus('syncing')

      console.log('Submitting order with items:', orderItems)
      
      // Generate invoice ID following the exact format
      const now = new Date()
      const invoiceId = `POSInvoice::StoreA::POS1::${Date.now().toString().slice(-6)}`
      const erpnextId = invoiceId.split("::")[3]
      
      // Calculate amounts
      const subtotalAmount = orderItems.reduce((sum, item) => sum + item.subtotal, 0)
      const vatAmountForInvoice = subtotalAmount * 0.15 // 15% VAT
      const totalAmount = subtotalAmount + vatAmountForInvoice - selectedDiscount

      // Prepare invoice data following the exact schema
      const invoiceData = {
        _id: invoiceId,
        type: "POSInvoice",
        erpnext_id: erpnextId,
        customer_id: `Customer::StoreA::POS1::${selectedCustomer || 'Walk-in Customer'}`,
        posting_date: now.toISOString().split("T")[0],
        posting_time: now.toTimeString().split(" ")[0],
        due_date: now.toISOString().split("T")[0],
        total_amount: totalAmount,
        paid_amount: totalAmount,
        payment_method: selectedPaymentMethod,
        status: "Submitted",
        is_pos: true,
        is_return_credit_note: false,
        pos_profile_id: "POSProfile::StoreA::POS1::POS Profile 1",
        cashier_id: "User::StoreA::POS1::pos_user",
        store_id: "Store::StoreA",
        items: orderItems.map(item => ({
          item_id: item.item_id,
          qty: item.quantity,
          rate: item.price,
          amount: item.subtotal,
          uom: item.uom || 'Nos'
        })),
        taxes: [
          {
            tax_type: "VAT",
            tax_rate: 15,
            tax_amount: vatAmountForInvoice
          }
        ],
        discounts: [
          {
            discount_type: "General Discount",
            discount_amount: selectedDiscount
          }
        ],
        tip_amount: 0,
        cash_received: selectedPaymentMethod === 'Cash' ? parseFloat(cashReceived) : 0,
        creation_date: now.toISOString(),
        modified_date: now.toISOString(),
        hash: "TEMP_HASH",
        previous_hash: "PREV_HASH",
        SchemaVersion: "1.0",
        CreatedBy: "POS_USER",
        AuditLogId: `Audit::StoreA::POS1::AUDIT-${Date.now().toString().slice(-6)}`
      }

              try {
        // Always save to local database first (most important)
        console.log('Saving invoice to local database...')
        
        if (!localDB) {
          throw new Error('Local database not available')
        }
        
        // Save to local DB first - this is the primary operation
        await localDB.put(invoiceData)
        console.log('Invoice saved to local database successfully')
        
        // Now try to sync to remote (secondary operation)
        try {
          console.log('Syncing to remote database...')
          if (serviceWorkerReady) {
            // Try service worker sync
            await serviceWorkerManager.performSync('push')
            console.log('Remote sync completed via Service Worker')
          } else {
            // Direct sync to remote
            await performSync('push')
            console.log('Remote sync completed directly')
          }
        } catch (syncError) {
          console.log('Remote sync failed, but order was saved locally:', syncError)
          // Don't fail the entire operation - local save succeeded
        }
        
        setSyncStatus('synced')
        showToast('Order submitted successfully!', 'success')
        
        // Clear the order after successful submission
        setOrderItems([])
        setCashReceived('0')
        setSelectedDiscount(0)
        setSelectedCustomer('')
        setResetTrigger(prev => prev + 1) // Trigger SearchBar reset
        
      } catch (syncError) {
        console.error('Save and sync failed:', syncError)
        setSyncStatus('error')
        showToast('Failed to save order. Please try again.', 'error')
      }
      
    } catch (error) {
      console.error('Error submitting invoice:', error)
      setSyncStatus('error')
      showToast('Failed to submit invoice. Please try again.', 'error')
    }
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-gray-50 overflow-x-hidden">
      <Sidebar />
      
      {/* Mobile-first responsive container */}
      <div className="flex-1 flex flex-col lg:flex-row min-w-0">
        {/* Main Content */}
        <div className="flex-1 p-3 sm:p-4 lg:p-6 min-w-0">
          {/* Mobile-responsive Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-4 lg:mb-6 gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              <SearchBar onItemSelect={handleAddItemFromSearch} onCustomerSelect={handleCustomerSelect} resetTrigger={resetTrigger} />
            </div>
            
            {/* Date/Time - responsive display */}
            <div className="flex items-center justify-center sm:justify-end space-x-2 text-black bg-white px-2 sm:px-3 py-2 rounded-lg shadow-sm flex-shrink-0">
              <Calendar size={18} className="text-gray-600" />
              <span className="text-xs sm:text-sm font-medium">
                {mounted ? currentDateTime : 'Loading...'}
              </span>
            </div>
            
            {/* POS Data Status Indicator */}
            {!posDataLoaded && (
              <div className="flex items-center justify-center space-x-2 text-orange-600 bg-orange-50 px-2 sm:px-3 py-2 rounded-lg shadow-sm flex-shrink-0">
                <div className="w-4 h-4 border-2 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs sm:text-sm font-medium">Loading Prices...</span>
              </div>
            )}
            
            {posLoadError && (
              <div className="flex items-center justify-center space-x-2 text-red-600 bg-red-50 px-2 sm:px-3 py-2 rounded-lg shadow-sm flex-shrink-0">
                <span className="text-xs sm:text-sm font-medium">Price Error!</span>
              </div>
            )}
          </div>

          {/* Order Details */}
          <div className="bg-white rounded-lg shadow-sm min-w-0">
            <div className="p-3 sm:p-4 lg:p-6 border-b border-gray-200">
              <div className="flex items-center justify-between min-w-0">
                <div className="flex items-center space-x-4 min-w-0">
                  <span className="text-black font-medium text-xs sm:text-sm lg:text-base break-all sm:break-words">
                    {mounted ? (
                      <>
                        <span className="hidden sm:inline">
                          {`INVOICE #: SINV-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}-${Date.now().toString().slice(-6)}`}
                        </span>
                        <span className="sm:hidden">
                          {`INV: SINV-${Date.now().toString().slice(-6)}`}
                        </span>
                      </>
                    ) : (
                      'INVOICE #: Loading...'
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Order Items Table - responsive */}
            <div className="p-2 sm:p-4 lg:p-6">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[400px] sm:min-w-[500px]">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left py-2 lg:py-3 px-2 lg:px-4 font-semibold text-black text-xs lg:text-sm">ITEM</th>
                      <th className="text-center py-2 lg:py-3 px-1 lg:px-4 font-semibold text-black text-xs lg:text-sm">RATE</th>
                      <th className="text-center py-2 lg:py-3 px-1 lg:px-4 font-semibold text-black text-xs lg:text-sm">QTY</th>
                      <th className="text-center py-2 lg:py-3 px-1 lg:px-4 font-semibold text-black text-xs lg:text-sm">AMOUNT</th>
                      <th className="text-center py-2 lg:py-3 px-1 lg:px-4 font-semibold text-black text-xs lg:text-sm w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderItems.length > 0 ? (
                      orderItems.map((item) => (
                        <OrderItem
                          key={item.id}
                          item={item}
                          onRemove={handleRemoveItem}
                          onQuantityChange={handleQuantityChange}
                        />
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-gray-500 text-sm">
                          No items in order. Search and add products above.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Action Buttons - mobile responsive */}
          <div className="flex justify-center mt-3 sm:mt-4 lg:mt-6">
            <button 
              onClick={() => {
                setOrderItems([])
                setCashReceived('0')
                setSelectedDiscount(0)
                setSelectedCustomer('')
                setResetTrigger(prev => prev + 1)
              }}
              className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 sm:py-3 px-4 sm:px-6 lg:px-8 rounded-lg text-sm lg:text-base"
            >
              CANCEL ORDER
            </button>
          </div>
        </div>

        {/* Right Panel - Mobile Responsive */}
        <div className="w-full lg:w-80 bg-white border-t lg:border-t-0 lg:border-l border-gray-200 p-3 sm:p-4 lg:p-6">
          {/* Total Payable Amount */}
          <div className="mb-3 sm:mb-4 lg:mb-6 text-center">
            <div className="text-sm sm:text-base lg:text-lg font-semibold text-black mb-2">TOTAL PAYABLE AMOUNT</div>
            <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-orange-500">{subtotal.toFixed(2)}</div>
          </div>

          {/* Mobile layout - vertical sections */}
          <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:gap-6">
            
            {/* Discount Section */}
            <div>
              <div className="flex items-center mb-2 sm:mb-3">
                <Banknote size={20} className="text-gray-600 mr-2" />
                <h3 className="font-semibold text-black text-sm lg:text-base">DISCOUNT</h3>
              </div>
              <input
                type="number"
                value={selectedDiscount}
                onChange={(e) => setSelectedDiscount(Number(e.target.value))}
                placeholder="Enter discount amount"
                className="py-2 lg:py-3 px-3 border border-gray-300 rounded text-sm w-full text-black"
              />
            </div>

            {/* Transaction Methods */}
            <div>
              <div className="flex items-center mb-2 sm:mb-3">
                <CreditCard size={20} className="text-gray-600 mr-2" />
                <h3 className="font-semibold text-black text-sm lg:text-base">TRANSACTION METHOD</h3>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => setSelectedPaymentMethod('Cash')}
                  className={`py-2 lg:py-3 px-2 sm:px-3 lg:px-4 rounded text-xs lg:text-sm font-medium flex items-center justify-center space-x-1 lg:space-x-2 ${
                    selectedPaymentMethod === 'Cash'
                      ? 'bg-gray-800 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  <Banknote size={16} />
                  <span>CASH</span>
                </button>
                <button 
                  onClick={() => setSelectedPaymentMethod('Card')}
                  className={`py-2 lg:py-3 px-2 sm:px-3 lg:px-4 rounded text-xs lg:text-sm font-medium hover:bg-gray-300 flex items-center justify-center space-x-1 lg:space-x-2 ${
                    selectedPaymentMethod === 'Card'
                      ? 'bg-gray-800 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  <CreditCard size={16} />
                  <span>CARD</span>
                </button>
              </div>
            </div>
          </div>

          {/* Cash Received */}
          {selectedPaymentMethod === 'Cash' && (
            <div className="mb-3 sm:mb-4 lg:mb-6 mt-3 sm:mt-4 lg:mt-0">
              <label className="block text-sm font-medium text-black my-2">ADD CASH RECEIVED</label>
              <div className="relative">
                <input
                  type="number"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  className="px-4 py-2 lg:py-3 border border-gray-300 rounded w-full text-lg lg:text-xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                />
              </div>
            </div>
          )}

          {/* Payment Summary */}
          <div className="space-y-2 mb-3 sm:mb-4 lg:mb-6 bg-gray-50 p-3 lg:p-4 rounded-lg">
            <div className="flex justify-between text-sm text-black">
              <span>PAYABLE AMOUNT</span>
              <span className="font-medium">{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-black">
              <span>DISCOUNT</span>
              <span className="font-medium">-{discountAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-black">
              <span>VAT 15%</span>
              <span className="font-medium">{vatAmount.toFixed(2)}</span>
            </div>
            <div className="border-t border-gray-300 pt-3 mt-3">
              <div className="flex justify-between text-base sm:text-lg lg:text-xl font-bold text-black">
                <span>GRAND TOTAL</span>
                <span>{total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Submit Button - Mobile Responsive */}
          <button
            onClick={handleSubmit}
            disabled={
              orderItems.length === 0 || 
              !selectedCustomer || 
              orderItems.some(item => item.price < 0) ||
              syncStatus === 'syncing'
            }
            className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold py-3 lg:py-4 rounded-lg text-sm sm:text-base lg:text-lg transition-colors"
          >
            {syncStatus === 'syncing' ? (
              <span className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm lg:text-base">{serviceWorkerReady ? 'SAVING & SYNCING...' : 'SAVING...'}</span>
              </span>
            ) : orderItems.length === 0 ? (
              'ADD ITEMS TO SUBMIT'
            ) : !selectedCustomer ? (
              'SELECT CUSTOMER TO SUBMIT'
            ) : orderItems.some(item => item.price < 0) ? (
              'ITEMS HAVE NEGATIVE PRICES'
            ) : (
              'REVIEW ORDER'
            )}
          </button>

          {/* Validation Messages - Mobile Responsive */}
          {(orderItems.length === 0 || !selectedCustomer || orderItems.some(item => item.price <= 0)) && (
            <div className="mt-3 text-center">
              <div className="text-xs lg:text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                <p className="font-medium mb-2">To submit this order, please ensure:</p>
                <ul className="text-left space-y-1">
                  <li className={`flex items-start lg:items-center ${orderItems.length > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    <span className="mr-2 mt-0.5 lg:mt-0">{orderItems.length > 0 ? '✓' : '✗'}</span>
                    <span className="text-xs lg:text-sm">Add at least one item to the order</span>
                  </li>
                  <li className={`flex items-start lg:items-center ${selectedCustomer ? 'text-green-600' : 'text-red-600'}`}>
                    <span className="mr-2 mt-0.5 lg:mt-0">{selectedCustomer ? '✓' : '✗'}</span>
                    <span className="text-xs lg:text-sm">Select a customer (required)</span>
                  </li>
                  <li className={`flex items-start lg:items-center ${!orderItems.some(item => item.price < 0) ? 'text-green-600' : 'text-red-600'}`}>
                    <span className="mr-2 mt-0.5 lg:mt-0">{!orderItems.some(item => item.price < 0) ? '✓' : '✗'}</span>
                    <div className="text-xs lg:text-sm">
                      <span>All items have valid prices (≥ 0)</span>
                      {orderItems.some(item => item.price < 0) && (
                        <div className="text-xs text-red-500 mt-1">
                          Items with negative prices: {orderItems.filter(item => item.price < 0).map(item => item.name).join(', ')}
                        </div>
                      )}
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">Confirm Order</h2>
                <button 
                  onClick={() => setShowConfirmDialog(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Customer Info */}
              <div className="mb-4 p-3 bg-gray-50 rounded">
                <p className="text-sm text-gray-600">Customer: <span className="font-semibold text-gray-900">{selectedCustomer}</span></p>
                <p className="text-sm text-gray-600">Payment: <span className="font-semibold text-gray-900">{selectedPaymentMethod}</span></p>
              </div>

              {/* Order Items */}
              <div className="mb-4">
                <h3 className="font-semibold text-gray-900 mb-2">Order Items:</h3>
                <div className="border rounded overflow-hidden">
                  {orderItems.map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-2 border-b last:border-b-0 bg-white">
                      <div className="flex-1">
                        <p className="font-medium text-sm text-gray-900">{item.name}</p>
                        <p className="text-xs text-gray-600">{item.price.toFixed(2)} × {item.quantity}</p>
                      </div>
                      <div className="text-sm font-semibold text-gray-900">
                        {item.subtotal.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Summary */}
              <div className="mb-6 p-3 bg-gray-50 rounded">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="text-gray-900">{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">VAT (15%):</span>
                    <span className="text-gray-900">{vatAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Discount:</span>
                    <span className="text-gray-900">-{discountAmount.toFixed(2)}</span>
                  </div>
                  <hr className="my-2" />
                  <div className="flex justify-between text-lg font-bold">
                    <span className="text-gray-900">Grand Total:</span>
                    <span className="text-gray-900">{total.toFixed(2)}</span>
                  </div>
                  {selectedPaymentMethod === 'Cash' && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Cash Received:</span>
                        <span className="text-gray-900">{cashReceived}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Change:</span>
                        <span className="text-gray-900">{(parseFloat(cashReceived) - total).toFixed(2)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowConfirmDialog(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmOrder}
                  disabled={syncStatus === 'syncing'}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400"
                >
                  {syncStatus === 'syncing' ? 'Saving...' : 'Submit'}
                </button>
                <button
                  onClick={handleConfirmAndPrint}
                  disabled={syncStatus === 'syncing'}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-400"
                >
                  {syncStatus === 'syncing' ? 'Saving...' : 'Submit & Print'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg text-white font-medium transition-all duration-300 ${
          toast.type === 'success' ? 'bg-green-500' :
          toast.type === 'error' ? 'bg-red-500' :
          'bg-blue-500'
        }`}>
          <div className="flex items-center space-x-2">
            {toast.type === 'success' && (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            {toast.type === 'error' && (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            {toast.type === 'info' && (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <span>{toast.message}</span>
            <button 
              onClick={() => setToast(null)}
              className="ml-2 text-white hover:text-gray-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default OrderPage