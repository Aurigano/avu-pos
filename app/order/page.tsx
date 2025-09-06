'use client'

import { useState, useEffect } from 'react'
import { Calendar, CreditCard, Banknote } from 'lucide-react'
import Sidebar from '../../components/Sidebar'
import OrderItem from '../../components/OrderItem'
import SearchBar from '../../components/SearchBar'
import { useHydration } from '../../hooks/useHydration'
import { localDB, remoteDB } from '@/lib/pouchdb'
import { usePOSStore } from '@/stores/pos-store'
import { printOrderReceipt } from '@/lib/print-utils'
import { getCurrentPOSProfile } from '@/lib/pos-profile-manager'
import { databaseManager } from '@/lib/database-manager'

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
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [resetTrigger, setResetTrigger] = useState(0)
  const [isDraftContinuation, setIsDraftContinuation] = useState(false)
  const [draftId, setDraftId] = useState<string | null>(null)
  
  // POS Profile Permissions
  const [posPermissions, setPosPermissions] = useState<{
    enableCustomerDiscount: boolean
    enableRateChange: boolean
    enablePOSOffers: boolean
    allowNegativeStock: boolean
  } | null>(null)
  
  // POS Store
  const { initializePOSData, getItemPrice, isLoaded: posDataLoaded, loadError: posLoadError, currentPOSProfile } = usePOSStore()

  // Update permissions when POS profile changes
  const updatePOSPermissions = () => {
    const currentProfile = getCurrentPOSProfile()
    if (currentProfile.permissions) {
      setPosPermissions({
        enableCustomerDiscount: currentProfile.permissions.enableCustomerDiscount,
        enableRateChange: currentProfile.permissions.enableRateChange,
        enablePOSOffers: currentProfile.permissions.enablePOSOffers,
        allowNegativeStock: currentProfile.permissions.allowNegativeStock
      })
      console.log('📋 POS Permissions updated:', currentProfile.permissions)
      console.log('📋 Current POS Profile:', currentProfile.profile?.name, currentProfile.profile?._id)
    }
  }

  // Note: POS permissions logging moved to useEffect

  // Simple sync function for order operations only
  const performSync = async (direction: 'pull' | 'push' | 'both' = 'both') => {
    return databaseManager.performSync(direction)
  }
  
  // Function to continue from a draft invoice
  const continueDraftInvoice = async (draftInvoiceId: string) => {
    try {
      // Get draft from localStorage using helper function
      const draftInvoice = getDraftById(draftInvoiceId)

      if (!draftInvoice) {
        showToast('Draft invoice not found', 'error')
        return
      }
      
      if (draftInvoice.type === 'POSInvoice' && draftInvoice.status === 'Draft') {
        // Pre-populate order items from draft - get full product details
        const draftItems: OrderItemType[] = []
        
        for (const item of draftInvoice.items) {
          try {
            console.log('Loading product for draft item:', item.item_id)
            const product = await getProductById(item.item_id)
            
            // Get dynamic price from POS store (similar to handleAddItemFromSearch)
            const priceResult = getItemPrice(product.item_code, product.item_code)
            const itemPrice = priceResult.isValid ? priceResult.price : (Number(product.standard_selling_rate) || item.rate)
            
            const draftItem: OrderItemType = {
              id: `${item.item_id}-${Date.now()}-${draftItems.length}`,
              name: product.item_name || 'Unknown Item', // Use actual product name
              category: product.item_group || 'General', // Use actual category
              price: item.rate, // Keep the original draft price
              quantity: item.qty,
              subtotal: item.amount,
              item_id: item.item_id,
              uom: item.uom || product.default_uom || 'Unit', // Use product UOM if available
              image: product.image || ''
            }
            
            draftItems.push(draftItem)
            console.log('Successfully loaded product:', product.item_name, 'for draft item')
            
          } catch (error) {
            console.error('Failed to load product for draft item:', item.item_id, error)
            
            // Fallback: create item with limited info
            const fallbackItem: OrderItemType = {
              id: `${item.item_id}-${Date.now()}-${draftItems.length}`,
              name: item.item_id?.split('::').pop() || 'Unknown Item',
              category: 'General',
              price: item.rate,
              quantity: item.qty,
              subtotal: item.amount,
              item_id: item.item_id,
              uom: item.uom || 'Unit'
            }
            
            draftItems.push(fallbackItem)
            console.warn('Using fallback item data for:', item.item_id)
          }
        }

        console.log('DEBUG: Draft items with proper names:', draftItems)

        setOrderItems(draftItems)
        setSelectedCustomer(draftInvoice.customer_id?.split('::').pop() || '')
        setSelectedPaymentMethod(draftInvoice.payment_method || 'Cash')
        setCashReceived(draftInvoice.cash_received?.toString() || '0')
        setSelectedDiscount(draftInvoice.discounts?.[0]?.discount_amount || 0)
        setIsDraftContinuation(true)
        setDraftId(draftInvoiceId)
        
        showToast('Draft invoice loaded successfully. Complete payment to generate invoice.', 'info')
      }
    } catch (error) {
      console.error('Error loading draft invoice:', error)
      showToast('Failed to load draft invoice', 'error')
    }
  }

  // Check URL parameters for draft continuation
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const continueDraftId = urlParams.get('continueDraft')
    
    if (continueDraftId) {
      continueDraftInvoice(continueDraftId)
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])
  
    // Check database initialization status and initialize POS store
  useEffect(() => {
    const initializeOrderPage = async () => {
      // Debug: Log all POS-related localStorage values at page start
      console.log('🚀 OrderPage initializing - Current localStorage:', {
        'dbInitialized': localStorage.getItem('dbInitialized'),
        'posProfileName': localStorage.getItem('posProfileName'),
        'posProfile': localStorage.getItem('posProfile'),
        'pos_current_profile_name': localStorage.getItem('pos_current_profile_name'),
        'pos_current_profile': localStorage.getItem('pos_current_profile') ? 'exists' : 'not found'
      })
      
      // Check if database was initialized during login
      const dbInitialized = localStorage.getItem('dbInitialized')
      const posProfileName = localStorage.getItem('posProfileName')
      
      if (dbInitialized === 'true') {
        setSyncStatus('synced')
        console.log('✅ Database already initialized during login')
        if (posProfileName) {
          console.log('✅ POS Profile loaded:', posProfileName)
        }
        
        // Initialize POS store from already-loaded database
        if (!posDataLoaded) {
          console.log('🏪 Initializing POS store from existing database...')
          try {
            await initializePOSData()
            console.log('✅ POS store initialized successfully from database')
          } catch (error) {
            console.error('❌ Failed to initialize POS store:', error)
          }
        } else {
          console.log('✅ POS store already loaded')
        }
      } else {
        console.log('⚠️ Database not initialized during login, working in offline mode')
        setSyncStatus('error')
      }

      // Update POS permissions regardless of DB status
      updatePOSPermissions()
    }

    initializeOrderPage()
  }, [posDataLoaded, initializePOSData]);

  // Separate effect to update permissions when profile changes
  useEffect(() => {
    if (currentPOSProfile) {
      console.log('🔄 POS profile changed, updating permissions...')
      console.log('📋 New Profile:', currentPOSProfile.name, 'ID:', currentPOSProfile._id)
      updatePOSPermissions()
    }
  }, [currentPOSProfile]);



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

  // Handle rate changes (only allowed if user has permission)
  const handleRateChange = (id: string, newRate: number) => {
    // Check permission before allowing change
    if (!posPermissions?.enableRateChange) {
      console.warn('⚠️ Rate change attempted but user does not have permission')
      return
    }

    console.log('💰 Rate changed for item:', id, 'New rate:', newRate)
    setOrderItems(orderItems.map(item => 
      item.id === id 
        ? { ...item, price: newRate, subtotal: newRate * item.quantity }
        : item
    ))
  }

  // Helper function to get product by item ID
  const getProductById = async (itemId: string) => {
    if (!localDB) {
      throw new Error('Database not available')
    }
    
    try {
      // Try to get the product directly by ID first
      const directResult = await localDB.get(itemId) as any
      if (directResult && directResult.type === 'Item') {
        return directResult
      }
    } catch (e) {
      // If direct get fails, try searching
    }
    
    // Fallback: search by item ID in all Item documents
    const result = await localDB.find({ 
      selector: { 
        type: 'Item'
      } 
    })
    
    const product = result.docs.find((doc: any) => 
      doc._id === itemId || 
      doc.erpnext_id === itemId ||
      doc.item_code === itemId ||
      itemId.includes(doc.item_code) // Handle cases like "Item::StoreA::POS1::ITEM001"
    )
    
    if (!product) {
      throw new Error(`Product not found for ID: ${itemId}`)
    }
    
    return product as any
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

  // Draft management helper functions
  const getAllDrafts = (): any[] => {
    try {
      return JSON.parse(localStorage.getItem('draftInvoices') || '[]')
    } catch (error) {
      console.error('Failed to get drafts from localStorage:', error)
      return []
    }
  }

  const saveDraftToLocalStorage = (draftData: any): boolean => {
    try {
      const existingDrafts = getAllDrafts()
      const draftIndex = existingDrafts.findIndex((draft: any) => draft._id === draftData._id)
      
      if (draftIndex !== -1) {
        // Update existing draft
        existingDrafts[draftIndex] = draftData
        console.log('Updated existing draft in localStorage')
      } else {
        // Add new draft
        existingDrafts.push(draftData)
        console.log('Added new draft to localStorage')
      }
      
      localStorage.setItem('draftInvoices', JSON.stringify(existingDrafts))
      console.log(`Draft saved successfully. Total drafts: ${existingDrafts.length}`)
      return true
    } catch (error) {
      console.error('Failed to save draft to localStorage:', error)
      return false
    }
  }

  const removeDraftFromLocalStorage = (draftId: string): boolean => {
    try {
      const existingDrafts = getAllDrafts()
      const updatedDrafts = existingDrafts.filter((draft: any) => draft._id !== draftId)
      localStorage.setItem('draftInvoices', JSON.stringify(updatedDrafts))
      console.log(`Draft ${draftId} removed from localStorage`)
      return true
    } catch (error) {
      console.error('Failed to remove draft from localStorage:', error)
      return false
    }
  }

  const getDraftById = (draftId: string): any | null => {
    try {
      const existingDrafts = getAllDrafts()
      return existingDrafts.find((draft: any) => draft._id === draftId) || null
    } catch (error) {
      console.error('Failed to get draft by ID:', error)
      return null
    }
  }

  const handlePrintOrder = async (invoiceNumber?: string) => {
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
      currentDateTime,
      invoiceNumber // Pass the actual invoice number if provided
    }

    await printOrderReceipt(orderData)
  }

  const handleConfirmAndPrint = async () => {
    const result = await handleConfirmOrder()
    setTimeout(() => {
      // result should contain the invoice number if successful
      handlePrintOrder(result?.invoiceNumber)
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

  const handleSaveDraft = async () => {
    try {
      setShowConfirmDialog(false)
      setSyncStatus('syncing')

      console.log('Saving draft with items:', orderItems)
      console.log('Draft continuation state:', { isDraftContinuation, draftId })
      
      // Generate draft ID using Store-Terminal format with DRAFT prefix
      const generateDraftId = (params: {
        isDraftContinuation: boolean
        existingDraftId: string | null
        orderData?: any
        customerData?: any
        timestamp?: Date
      }) => {
        const { isDraftContinuation, existingDraftId, timestamp = new Date() } = params
        
        if (isDraftContinuation && existingDraftId) {
          // Updating existing draft
          return {
            draftId: existingDraftId,
            isNewDraft: false
          }
        } else {
          // Create new draft with Store-Terminal-DRAFT-Timestamp format
          const { storeNum, terminalNum } = getStoreTerminalInfo()
          const timestampValue = timestamp.getTime()
          const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
          const draftNumber = `DRAFT-${storeNum}-${terminalNum}-${timestampValue}-${random}`
          const draftId = `POSInvoice::StoreA::POS1::${draftNumber}`
          
          console.log('📝 Generated draft ID:', draftNumber, {
            store: storeNum,
            terminal: terminalNum,
            timestamp: timestampValue
          })
          
          return {
            draftId: draftId,
            isNewDraft: true
          }
        }
      }
      
      const draftIdInfo = generateDraftId({
        isDraftContinuation,
        existingDraftId: draftId,
        orderData: orderItems,
        customerData: selectedCustomer,
        timestamp: new Date()
      })
      
      const { draftId: currentDraftId, isNewDraft } = draftIdInfo
      console.log('Generated/Using draft ID:', currentDraftId, isNewDraft ? '(creating new)' : '(updating existing)')
      
      // Date/time for draft creation
      const now = new Date()
      
      // Calculate amounts
      const subtotalAmount = orderItems.reduce((sum, item) => sum + item.subtotal, 0)
      const vatAmountForInvoice = subtotalAmount * 0.15 // 15% VAT
      const totalAmount = subtotalAmount + vatAmountForInvoice - selectedDiscount

      // Prepare draft invoice data
      const draftData: any = {
        _id: currentDraftId,
        type: "POSInvoice",
        erpnext_id: null, // No invoice number for drafts
        customer_id: `Customer::StoreA::POS1::${selectedCustomer || 'Walk-in Customer'}`,
        posting_date: now.toISOString().split("T")[0],
        posting_time: now.toTimeString().split(" ")[0],
        due_date: now.toISOString().split("T")[0],
        total_amount: totalAmount,
        paid_amount: 0, // Not paid yet for drafts
        payment_method: selectedPaymentMethod,
        status: "Draft",
        is_pos: true,
        is_return_credit_note: false,
        pos_profile_id: currentPOSProfile?._id || "",
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

      // Save draft to localStorage (not localDB)
      try {
        console.log('Saving draft to localStorage...')
        
        const saveSuccess = saveDraftToLocalStorage(draftData)
        
        if (!saveSuccess) {
          throw new Error('Failed to save draft to localStorage')
        }
        
        setSyncStatus('synced')
        showToast('Draft saved successfully!', 'success')
        
        // Clear the order after successful save
        setOrderItems([])
        setCashReceived('0')
        setSelectedDiscount(0)
        setSelectedCustomer('')
        setIsDraftContinuation(false)
        setDraftId(null)
        setResetTrigger(prev => prev + 1) // Trigger SearchBar reset
        
      } catch (syncError) {
        console.error('Save draft failed:', syncError)
        setSyncStatus('error')
        showToast('Failed to save draft. Please try again.', 'error')
      }
      
    } catch (error) {
      console.error('Error saving draft:', error)
      setSyncStatus('error')
      showToast('Failed to save draft. Please try again.', 'error')
    }
  }

  // Helper function to get next invoice sequence number
  const getNextInvoiceSeqNo = (): number => {
    try {
      const currentSeqNo = localStorage.getItem('invoiceSeqNo')
      const seqNo = currentSeqNo ? parseInt(currentSeqNo, 10) : 1
      
      console.log('📊 Getting next invoice sequence number:', seqNo)
      return seqNo
    } catch (error) {
      console.error('❌ Error getting invoice sequence number:', error)
      return 1 // Fallback to 1
    }
  }

  // Helper function to increment invoice sequence number in localStorage
  const incrementInvoiceSeqNo = (): void => {
    try {
      const currentSeqNo = getNextInvoiceSeqNo()
      const nextSeqNo = currentSeqNo + 1
      localStorage.setItem('invoiceSeqNo', nextSeqNo.toString())
      console.log('📈 Invoice sequence incremented:', currentSeqNo, '->', nextSeqNo)
    } catch (error) {
      console.error('❌ Error incrementing invoice sequence number:', error)
    }
  }

  // Helper function to get store and terminal info for invoice numbering
  const getStoreTerminalInfo = (): { store: string; terminal: string; storeNum: string; terminalNum: string } => {
    try {
      const store = localStorage.getItem('store') || 'store-1'
      const terminal = localStorage.getItem('terminal') || 'pos-1'
      
      // Extract numbers from store and terminal IDs
      // e.g., 'store-1' -> '1', 'pos-2' -> '2'
      const storeNum = store.split('-').pop() || '1'
      const terminalNum = terminal.split('-').pop() || '1'
      
      return { store, terminal, storeNum, terminalNum }
    } catch (error) {
      console.error('❌ Error getting store/terminal info:', error)
      return { store: 'store-1', terminal: 'pos-1', storeNum: '1', terminalNum: '1' }
    }
  }

  // New invoice number generation function: Store-Terminal-SeqNo format
  const generateInvoiceNumber = (params: {
    isDraftContinuation: boolean
    draftId: string | null
    orderData?: any
    customerData?: any
    timestamp?: Date
  }) => {
    const { isDraftContinuation, draftId } = params
    
    if (isDraftContinuation && draftId) {
      // Converting draft to final invoice - extract existing sequence from draft
      try {
        const draftParts = draftId.split("::")
        if (draftParts.length >= 4 && draftParts[3].startsWith('DRAFT-')) {
          // This is a draft, generate new invoice number for final invoice
          const { storeNum, terminalNum } = getStoreTerminalInfo()
          const seqNo = getNextInvoiceSeqNo()
          const invoiceNumber = `${storeNum}-${terminalNum}-${seqNo.toString().padStart(6, '0')}`
          
          return {
            invoiceId: `POSInvoice::StoreA::POS1::${invoiceNumber}`,
            erpnextId: invoiceNumber,
            invoiceNumber: invoiceNumber,
            sequenceNo: seqNo,
            isFromDraft: true
          }
        } else {
          // This might already be a final invoice, just return as is
          return {
            invoiceId: draftId,
            erpnextId: draftParts[3] || draftId,
            invoiceNumber: draftParts[3] || draftId,
            sequenceNo: null,
            isFromDraft: true
          }
        }
      } catch (error) {
        console.error('❌ Error processing draft invoice ID:', error)
        // Fallback to generating new number
      }
    }
    
    // Generate new invoice number for new invoices or fallback
    const { storeNum, terminalNum } = getStoreTerminalInfo()
    const seqNo = getNextInvoiceSeqNo()
    const invoiceNumber = `${storeNum}-${terminalNum}-${seqNo.toString().padStart(6, '0')}`
    
    console.log('🧾 Generated invoice number:', invoiceNumber, {
      store: storeNum,
      terminal: terminalNum,
      sequence: seqNo
    })
    
    return {
      invoiceId: `POSInvoice::StoreA::POS1::${invoiceNumber}`,
      erpnextId: invoiceNumber,
      invoiceNumber: invoiceNumber,
      sequenceNo: seqNo,
      isFromDraft: false
    }
  }

  const handleConfirmOrder = async (): Promise<{ invoiceNumber: string } | void> => {
    try {
      setShowConfirmDialog(false)
      setSyncStatus('syncing')

      console.log('Submitting order with items:', orderItems)
      
      // Generate invoice number using scalable logic
      const invoiceNumberData = generateInvoiceNumber({
        isDraftContinuation,
        draftId,
        orderData: orderItems,
        customerData: selectedCustomer,
        timestamp: new Date()
      })
      
      const { invoiceId, erpnextId, invoiceNumber, sequenceNo, isFromDraft } = invoiceNumberData
      console.log('Generated invoice number:', { invoiceId, erpnextId, invoiceNumber, sequenceNo, isFromDraft })
      
      // Date/time for invoice creation
      const now = new Date()
      
      // Calculate amounts
      const subtotalAmount = orderItems.reduce((sum, item) => sum + item.subtotal, 0)
      const vatAmountForInvoice = subtotalAmount * 0.15 // 15% VAT
      const totalAmount = subtotalAmount + vatAmountForInvoice - selectedDiscount

      // Prepare invoice data following the exact schema
      const invoiceData: any = {
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
        pos_profile_id: currentPOSProfile?._id || "",
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
        
        // If continuing from draft, get the revision to update existing document
        if (isDraftContinuation && draftId) {
          try {
            const existingDraft = await localDB.get(draftId) as any
            invoiceData._rev = existingDraft._rev
          } catch (e) {
            // Draft doesn't exist, create new one
            console.log('Draft not found, creating new invoice')
          }
        }
        
        // Save to local DB first - this is the primary operation
        await localDB.put(invoiceData)
        console.log('Invoice saved to local database successfully')
        
        // Increment invoice sequence number after successful save
        if (sequenceNo !== null) {
          incrementInvoiceSeqNo()
          console.log('✅ Invoice sequence number incremented after successful save')
        }
        
        // Now try to sync to remote (secondary operation)
        try {
          console.log('Syncing to remote database...')
          const syncResult = await performSync('push')
          if (syncResult.success) {
            console.log('Remote sync completed successfully')
          } else {
            console.log('Remote sync failed:', syncResult.error)
          }
        } catch (syncError) {
          console.log('Remote sync failed, but order was saved locally:', syncError)
          // Don't fail the entire operation - local save succeeded
        }
        
        setSyncStatus('synced')
        showToast('Order submitted successfully!', 'success')
        
        // If this was a draft continuation, remove the draft from localStorage
        if (isDraftContinuation && draftId) {
          const removeSuccess = removeDraftFromLocalStorage(draftId)
          if (removeSuccess) {
            console.log(`✅ Draft ${draftId} removed from localStorage after conversion to final invoice`)
          } else {
            console.warn(`⚠️ Failed to remove draft ${draftId} from localStorage`)
          }
        }
        
        // Clear the order after successful submission
        setOrderItems([])
        setCashReceived('0')
        setSelectedDiscount(0)
        setSelectedCustomer('')
        setIsDraftContinuation(false)
        setDraftId(null)
        setResetTrigger(prev => prev + 1) // Trigger SearchBar reset
        
        // Return the invoice number for printing
        return { invoiceNumber }
        
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
          {/* Draft Continuation Notice */}
          {isDraftContinuation && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-blue-800 text-sm font-medium">
                  Continuing from draft invoice. Complete payment to generate final invoice with invoice number.
                </p>
              </div>
            </div>
          )}

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
                        {isDraftContinuation ? (
                          <>
                            <span className="hidden sm:inline text-yellow-600">DRAFT INVOICE - NO INVOICE NUMBER YET</span>
                            <span className="sm:hidden text-yellow-600">DRAFT</span>
                          </>
                        ) : (
                          (() => {
                            // Preview the next invoice number that will be generated
                            const { storeNum, terminalNum } = getStoreTerminalInfo()
                            const nextSeq = getNextInvoiceSeqNo()
                            const previewInvoiceNumber = `${storeNum}-${terminalNum}-${nextSeq.toString().padStart(6, '0')}`
                            
                            return (
                              <>
                                <span className="hidden sm:inline">
                                  {`NEXT INVOICE #: ${previewInvoiceNumber}`}
                                </span>
                                <span className="sm:hidden">
                                  {`NEXT: ${previewInvoiceNumber}`}
                                </span>
                              </>
                            )
                          })()
                        )}
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
                          onRateChange={handleRateChange}
                          enableRateChange={posPermissions?.enableRateChange ?? false}
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
            
            {/* Discount Section - Conditional based on POS Profile permissions */}
            {posPermissions?.enableCustomerDiscount ? (
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
            ) : (
              <div>
                <div className="flex items-center mb-2 sm:mb-3">
                  <Banknote size={20} className="text-gray-400 mr-2" />
                  <h3 className="font-semibold text-gray-400 text-sm lg:text-base">DISCOUNT (Not Permitted)</h3>
                </div>
                <input
                  type="number"
                  value={selectedDiscount}
                  disabled
                  placeholder="Discount not allowed for this user"
                  className="py-2 lg:py-3 px-3 border border-gray-200 rounded text-sm w-full text-gray-400 bg-gray-50 cursor-not-allowed"
                />
              </div>
            )}

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
                <span className="text-sm lg:text-base">SAVING...</span>
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
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-3">
                <button
                  onClick={() => setShowConfirmDialog(false)}
                  className="px-3 lg:px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 text-sm lg:text-base"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveDraft}
                  disabled={syncStatus === 'syncing'}
                  className="px-3 lg:px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 disabled:bg-gray-400 text-sm lg:text-base"
                >
                  {syncStatus === 'syncing' ? 'Saving...' : isDraftContinuation ? 'Update Draft' : 'Save as Draft'}
                </button>
                <button
                  onClick={handleConfirmOrder}
                  disabled={syncStatus === 'syncing'}
                  className="px-3 lg:px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 text-sm lg:text-base"
                >
                  {syncStatus === 'syncing' ? 'Saving...' : isDraftContinuation ? 'Pay & Generate Invoice' : 'Submit'}
                </button>
                <button
                  onClick={handleConfirmAndPrint}
                  disabled={syncStatus === 'syncing'}
                  className="px-3 lg:px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-400 text-sm lg:text-base"
                >
                  {syncStatus === 'syncing' ? 'Saving...' : isDraftContinuation ? 'Pay & Print Invoice' : 'Submit & Print'}
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