import { create } from 'zustand'
import { POSProfile, ItemPriceList, ItemWithPrice } from '../types/pos-types'
import { filterItemsByPriceList, getItemPriceFromList } from '../lib/pricing-utils'
import { localDB } from '../lib/pouchdb'

interface POSStore {
  // State
  currentPOSProfile: POSProfile | null
  itemPriceList: ItemPriceList[]
  filteredPriceList: ItemPriceList[]
  isLoaded: boolean
  loadError: string | null
  
  // Actions
  initializePOSData: () => Promise<void>
  setCurrentPOSProfile: (profile: POSProfile) => void
  updateItemPriceList: (priceList: ItemPriceList[]) => void
  getItemPrice: (itemId: string, itemCode?: string) => { price: number; isValid: boolean; message?: string }
  reset: () => void
}

export const usePOSStore = create<POSStore>((set, get) => ({
  // Initial state
  currentPOSProfile: null,
  itemPriceList: [],
  filteredPriceList: [],
  isLoaded: false,
  loadError: null,
  
  // Initialize POS data from database
  initializePOSData: async () => {
    // Checkpoint 1: Commented console logs
    // console.log('Initializing POS data...')
    
    try {
      if (!localDB) {
        throw new Error('Local database not available')
      }
      
      // Get all documents
      const allDocs = await localDB.allDocs({ include_docs: true })
      const docs = allDocs.rows.map((row: any) => row.doc)
      
      // console.log('Retrieved', docs.length, 'documents from database')
      
      // Find POSProfile with erpnext_id: "POS Profile 1"
      const posProfiles = docs.filter((doc: any) => doc.type === 'POSProfile')
      // console.log('Found', posProfiles.length, 'POS profiles')
      
      const targetPOSProfile = posProfiles.find((profile: any) => profile.erpnext_id === 'POS Profile 1')
      
      if (!targetPOSProfile) {
        throw new Error('POS Profile with erpnext_id "POS Profile 1" not found')
      }
      
      // console.log('Found target POS profile:', targetPOSProfile.name, 'with price_list_id:', targetPOSProfile.price_list_id)
      
      // Find all ItemPriceList documents
      const allItemPrices = docs.filter((doc: any) => doc.type === 'ItemPriceList') as ItemPriceList[]
      // console.log('Found', allItemPrices.length, 'item price list documents')
      
      // Filter by matching price list
      const filteredPrices = filterItemsByPriceList(allItemPrices, targetPOSProfile.price_list_id)
      // console.log('Filtered to', filteredPrices.length, 'matching price list items', filteredPrices, allItemPrices)
      
      // Update store
      set({
        currentPOSProfile: targetPOSProfile as POSProfile,
        itemPriceList: allItemPrices,
        filteredPriceList: filteredPrices,
        isLoaded: true,
        loadError: null
      })
      
      // console.log('POS data initialization completed successfully')
      
    } catch (error) {
      // console.error('Error initializing POS data:', error)
      set({
        loadError: error instanceof Error ? error.message : 'Unknown error occurred',
        isLoaded: false
      })
    }
  },
  
  // Set current POS profile
  setCurrentPOSProfile: (profile: POSProfile) => {
    // console.log('Setting current POS profile:', profile.name)
    
    const { itemPriceList } = get()
    const filteredPrices = filterItemsByPriceList(itemPriceList, profile.price_list_id)
    
    set({
      currentPOSProfile: profile,
      filteredPriceList: filteredPrices
    })
  },
  
  // Update item price list
  updateItemPriceList: (priceList: ItemPriceList[]) => {
    const { currentPOSProfile } = get()
    
    let filteredPrices: ItemPriceList[] = []
    if (currentPOSProfile) {
      filteredPrices = filterItemsByPriceList(priceList, currentPOSProfile.price_list_id)
    }
    
    set({
      itemPriceList: priceList,
      filteredPriceList: filteredPrices
    })
  },
  
  // Get price for an item
  getItemPrice: (itemId: string, itemCode?: string) => {
    const { filteredPriceList } = get()
    
    // console.log('Getting price from store for item:', itemId, 'or code:', itemCode)
    
    // Try to find by item code first, then by item ID
    let result = getItemPriceFromList(itemCode || itemId, filteredPriceList)
    
    // If not found by item code, try with item ID
    if (!result.isValid && itemCode && itemId !== itemCode) {
      result = getItemPriceFromList(itemId, filteredPriceList)
    }
    
    // console.log('Price lookup result:', result)
    return result
  },
  
  // Reset store
  reset: () => {
    set({
      currentPOSProfile: null,
      itemPriceList: [],
      filteredPriceList: [],
      isLoaded: false,
      loadError: null
    })
  }
})) 