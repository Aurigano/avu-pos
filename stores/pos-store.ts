import { create } from 'zustand'
import { POSProfile, ItemPriceList, ItemWithPrice } from '../types/pos-types'
import { filterItemsByPriceList, getItemPriceFromList } from '../lib/pricing-utils'
import { localDB } from '../lib/pouchdb'

interface POSStore {
  // State
  currentPOSProfile: POSProfile | null
  currentProfileName: string | null
  itemPriceList: ItemPriceList[]
  filteredPriceList: ItemPriceList[]
  isLoaded: boolean
  loadError: string | null
  
  // Actions
  initializePOSData: (profileName?: string) => Promise<void>
  setCurrentPOSProfile: (profile: POSProfile) => void
  switchPOSProfile: (profileName: string) => Promise<void>
  loadPOSProfileFromStorage: () => string | null
  savePOSProfileToStorage: (profile: POSProfile) => void
  clearPOSProfileStorage: () => void
  updateItemPriceList: (priceList: ItemPriceList[]) => void
  getItemPrice: (itemId: string, itemCode?: string) => { price: number; isValid: boolean; message?: string }
  reset: () => void
}

// Constants for localStorage keys
const POS_PROFILE_STORAGE_KEY = 'pos_current_profile'
const POS_PROFILE_NAME_STORAGE_KEY = 'pos_current_profile_name'

export const usePOSStore = create<POSStore>((set, get) => ({
  // Initial state
  currentPOSProfile: null,
  currentProfileName: null,
  itemPriceList: [],
  filteredPriceList: [],
  isLoaded: false,
  loadError: null,
  
  // Load POS profile name from localStorage
  loadPOSProfileFromStorage: () => {
    if (typeof window === 'undefined') return null
    try {
      return localStorage.getItem(POS_PROFILE_NAME_STORAGE_KEY)
    } catch (error) {
      console.error('Error loading POS profile from storage:', error)
      return null
    }
  },

  // Save POS profile to localStorage
  savePOSProfileToStorage: (profile: POSProfile) => {
    console.log('🔧 savePOSProfileToStorage called with:', profile?.name, profile?.erpnext_id)
    
    if (typeof window === 'undefined') {
      console.warn('⚠️ Cannot save POS profile - running on server side')
      return
    }
    
    if (!profile) {
      console.error('❌ Cannot save POS profile - profile is null/undefined')
      return
    }
    
    try {
      console.log('💾 Attempting to save to localStorage...')
      console.log('🔑 Keys to set:', { 
        [POS_PROFILE_STORAGE_KEY]: POS_PROFILE_STORAGE_KEY,
        [POS_PROFILE_NAME_STORAGE_KEY]: POS_PROFILE_NAME_STORAGE_KEY 
      })
      
      localStorage.setItem(POS_PROFILE_STORAGE_KEY, JSON.stringify(profile))
      localStorage.setItem(POS_PROFILE_NAME_STORAGE_KEY, profile.erpnext_id)
      
      // Verify the save worked
      const savedProfile = localStorage.getItem(POS_PROFILE_STORAGE_KEY)
      const savedName = localStorage.getItem(POS_PROFILE_NAME_STORAGE_KEY)
      
      console.log('🔐 POS profile saved to localStorage:', profile.erpnext_id)
      console.log('✅ Verification - saved keys exist:', {
        [POS_PROFILE_STORAGE_KEY]: savedProfile ? 'EXISTS' : 'MISSING',
        [POS_PROFILE_NAME_STORAGE_KEY]: savedName || 'MISSING'
      })
    } catch (error) {
      console.error('❌ Error saving POS profile to storage:', error)
      console.error('❌ Profile object:', profile)
    }
  },

  // Clear POS profile from localStorage
  clearPOSProfileStorage: () => {
    if (typeof window === 'undefined') return
    try {
      console.log('🗑️ Clearing POS profile storage...')
      console.log('🔍 Before clear:', {
        [POS_PROFILE_STORAGE_KEY]: localStorage.getItem(POS_PROFILE_STORAGE_KEY) ? 'exists' : 'not found',
        [POS_PROFILE_NAME_STORAGE_KEY]: localStorage.getItem(POS_PROFILE_NAME_STORAGE_KEY)
      })
      localStorage.removeItem(POS_PROFILE_STORAGE_KEY)
      localStorage.removeItem(POS_PROFILE_NAME_STORAGE_KEY)
      console.log('🗑️ POS profile cleared from localStorage')
    } catch (error) {
      console.error('Error clearing POS profile from storage:', error)
    }
  },

  // Switch to a different POS profile (useful for login API integration)
  switchPOSProfile: async (profileName: string) => {
    console.log('🔄 Switching to POS profile:', profileName)
    console.log('🔍 Current localStorage before switch:', {
      'pos_current_profile_name': localStorage.getItem('pos_current_profile_name'),
      'posProfileName': localStorage.getItem('posProfileName'),
      'posProfile': localStorage.getItem('posProfile')
    })
    const { initializePOSData } = get()
    await initializePOSData(profileName)
    console.log('🔍 Current localStorage after switch:', {
      'pos_current_profile_name': localStorage.getItem('pos_current_profile_name'),
      'posProfileName': localStorage.getItem('posProfileName'),
      'posProfile': localStorage.getItem('posProfile')
    })
  },

  // Initialize POS data from database
  initializePOSData: async (profileName?: string) => {
    console.log('Initializing POS data...')
    
    try {
      if (!localDB) {
        throw new Error('Local database not available')
      }

      // Determine which profile to load
      // Priority: 1. Parameter, 2. localStorage
      const { loadPOSProfileFromStorage } = get()
      const targetProfileName = profileName || loadPOSProfileFromStorage()
      
      console.log('Loading POS Profile:', targetProfileName)
      
      // Get all documents
      const allDocs = await localDB.allDocs({ include_docs: true })
      const docs = allDocs.rows.map((row: any) => row.doc)
      
      console.log('Retrieved', docs.length, 'documents from database')
      
      // Find all POSProfile documents
      const posProfiles = docs.filter((doc: any) => doc.type === 'POSProfile')
      console.log('Found', posProfiles.length, 'POS profiles:', posProfiles.map((p: any) => p.erpnext_id))
      console.log('POSSSSS', posProfiles)
      
      // Find the target POS profile by erpnext_id
      const targetPOSProfile = posProfiles.find((profile: any) => 
        profile.erpnext_id === targetProfileName
      )
      
      if (!targetPOSProfile) {
        throw new Error(`POS Profile with erpnext_id "${targetProfileName}" not found. Available profiles: ${posProfiles.map((p: any) => p.erpnext_id).join(', ')}`)
      }
      
      console.log('Found target POS profile:', targetPOSProfile.name, 'with price_list_id:', targetPOSProfile.price_list_id)
      
      // Find all ItemPriceList documents
      const allItemPrices = docs.filter((doc: any) => doc.type === 'ItemPriceList') as ItemPriceList[]
      console.log('Found', allItemPrices.length, 'item price list documents')
      
      // Filter by matching price list
      const filteredPrices = filterItemsByPriceList(allItemPrices, targetPOSProfile.price_list_id)
      console.log('Filtered to', filteredPrices.length, 'matching price list items for price list:', targetPOSProfile.price_list_id)
      
      // Save to localStorage for persistence
      console.log('💾 About to save POS profile to storage:', targetPOSProfile.name)
      console.log('🔍 Profile object details:', {
        _id: targetPOSProfile._id,
        name: targetPOSProfile.name,
        erpnext_id: targetPOSProfile.erpnext_id,
        hasProfile: !!targetPOSProfile
      })
      
      const { savePOSProfileToStorage } = get()
      console.log('📞 Calling savePOSProfileToStorage...')
      savePOSProfileToStorage(targetPOSProfile as POSProfile)
      console.log('✅ savePOSProfileToStorage call completed')
      
      // Update store
      set({
        currentPOSProfile: targetPOSProfile as POSProfile,
        currentProfileName: targetProfileName,
        itemPriceList: allItemPrices,
        filteredPriceList: filteredPrices,
        isLoaded: true,
        loadError: null
      })
      
      // Final verification that localStorage was saved correctly
      console.log('🔍 Final localStorage verification after store update:', {
        'pos_current_profile': localStorage.getItem('pos_current_profile') ? 'EXISTS' : 'MISSING',
        'pos_current_profile_name': localStorage.getItem('pos_current_profile_name') || 'MISSING'
      })
      
      console.log('POS data initialization completed successfully')
      
    } catch (error) {
      console.error('Error initializing POS data:', error)
      set({
        loadError: error instanceof Error ? error.message : 'Unknown error occurred',
        isLoaded: false,
        currentProfileName: null
      })
    }
  },
  
  // Set current POS profile
  setCurrentPOSProfile: (profile: POSProfile) => {
    console.log('Setting current POS profile:', profile.name)
    
    const { itemPriceList, savePOSProfileToStorage } = get()
    const filteredPrices = filterItemsByPriceList(itemPriceList, profile.price_list_id)
    
    // Save to localStorage
    savePOSProfileToStorage(profile)
    
    set({
      currentPOSProfile: profile,
      currentProfileName: profile.erpnext_id,
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
    const { clearPOSProfileStorage } = get()
    
    // Clear localStorage
    clearPOSProfileStorage()
    
    set({
      currentPOSProfile: null,
      currentProfileName: null,
      itemPriceList: [],
      filteredPriceList: [],
      isLoaded: false,
      loadError: null
    })
  }
})) 