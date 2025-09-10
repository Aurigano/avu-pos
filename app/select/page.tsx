'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Store, Monitor, Settings, LogIn, User } from 'lucide-react'
import { posApi, handleApiError, sessionUtils, type ApiError } from '@/lib/api-service'
import { localDB } from '@/lib/pouchdb'
import { usePOSStore } from '@/stores/pos-store'

const SelectPage = () => {
  const [selectedPOSProfile, setSelectedPOSProfile] = useState('')
  const [selectedStore, setSelectedStore] = useState('')
  const [selectedTerminal, setSelectedTerminal] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [username, setUsername] = useState('')
  const [posProfiles, setPosProfiles] = useState<Array<{id: string, name: string}>>([])
  const [stores, setStores] = useState<Array<{id: string, name: string}>>([])
  const [terminals, setTerminals] = useState<Array<{id: string, name: string}>>([])
  const [loadingProfiles, setLoadingProfiles] = useState(true)
  const [loadingStores, setLoadingStores] = useState(true)
  const [loadingTerminals, setLoadingTerminals] = useState(true)
  const [canChangeStore, setCanChangeStore] = useState(false)
  const [previousStoreName, setPreviousStoreName] = useState('')
  const [previousTerminalName, setPreviousTerminalName] = useState('')
  const router = useRouter()
  
  // Get POS store methods for proper profile management
  const { switchPOSProfile } = usePOSStore()

  // Check if user is logged in and load persisted selections
  useEffect(() => {
    const isLoggedIn = localStorage.getItem('isLoggedIn')
    const storedUsername = localStorage.getItem('username')
    const fullName = localStorage.getItem('fullName')
    
    if (!isLoggedIn) {
      router.push('/login')
      return
    }
    
    // Use full name if available, otherwise fall back to username
    if (fullName) {
      setUsername(fullName)
    } else if (storedUsername) {
      setUsername(storedUsername)
    }

    // Check user roles to determine if they can change store/terminal
    const authResponse = localStorage.getItem('authResponse')
    let allowStoreChange = false
    
    if (authResponse) {
      try {
        const authData = JSON.parse(authResponse)
        const userRoles = authData?.message?.user?.roles || []
        allowStoreChange = userRoles.includes('Allow Store Change')
        console.log('🔐 User roles:', userRoles)
        console.log('🏪 Can change store:', allowStoreChange)
      } catch (error) {
        console.error('❌ Error parsing auth response:', error)
      }
    }
    
    setCanChangeStore(allowStoreChange)

    // Load persisted store and terminal selections (persist across logouts)
    const savedStore = localStorage.getItem('store')
    const savedTerminal = localStorage.getItem('terminal')
    const savedStoreName = localStorage.getItem('storeName')
    const savedTerminalName = localStorage.getItem('terminalName')
    
    if (savedStore) {
      setSelectedStore(savedStore)
      console.log('🏪 Restored store selection:', savedStore)
    }
    
    if (savedTerminal) {
      setSelectedTerminal(savedTerminal)
      console.log('💻 Restored terminal selection:', savedTerminal)
    }
    
    // Set previous names for read-only display when user can't change store
    if (savedStoreName) {
      setPreviousStoreName(savedStoreName)
    }
    
    if (savedTerminalName) {
      setPreviousTerminalName(savedTerminalName)
    }
  }, [router])

  // Load POS Profiles, Stores, and Terminals on component mount
  useEffect(() => {
    loadPOSProfiles()
    // Only load stores and terminals if user has permission to change them
    if (canChangeStore) {
      loadStores()
      loadTerminals()
    } else {
      // If user can't change store, mark loading as complete
      setLoadingStores(false)
      setLoadingTerminals(false)
    }
  }, [canChangeStore])

  // Load POS Profiles from localDB
  const loadPOSProfiles = async () => {
    if (!localDB) {
      console.error('LocalDB not available for loading POS Profiles')
      setLoadingProfiles(false)
      return
    }

    try {
      console.log('🏪 Loading POS Profiles from localDB...')
      
      // Query for documents with type 'POSProfile'
      const result = await localDB.find({
        selector: {
          type: 'POSProfile'
        }
      })

      const profiles = result.docs.map((doc: any) => ({
        id: doc.erpnext_id || doc._id, // Use erpnext_id for POS store compatibility
        name: doc.profile_name || doc.name || doc._id || 'Unknown Profile',
        _id: doc._id, // Keep _id for debugging
        erpnext_id: doc.erpnext_id
      }))

      console.log(`✅ Loaded ${profiles.length} POS Profiles:`, profiles)
      console.log('🔍 Profile details:', profiles.map(p => ({ id: p.id, name: p.name, erpnext_id: p.erpnext_id })))
      setPosProfiles(profiles)
      
    } catch (error) {
      console.error('❌ Error loading POS Profiles:', error)
      setPosProfiles([])
    } finally {
      setLoadingProfiles(false)
    }
  }

  // Load Stores from localDB
  const loadStores = async () => {
    if (!localDB) {
      console.error('LocalDB not available for loading Stores')
      setLoadingStores(false)
      return
    }

    try {
      console.log('🏬 Loading Stores from localDB...')
      
      // Query for documents with type 'POSStore'
      const result = await localDB.find({
        selector: {
          type: 'POSStore'
        }
      })

      const storeList = result.docs.map((doc: any) => ({
        id: doc.erpnext_id, // Use erpnext_id as the primary identifier
        name: doc.store_name || doc.name || doc.erpnext_id || 'Unknown Store',
        _id: doc._id,
        erpnext_id: doc.erpnext_id
      })).filter(store => store.id) // Filter out stores without erpnext_id

      console.log(`✅ Loaded ${storeList.length} Stores:`, storeList)
      console.log('🔍 Store details:', storeList.map(s => ({ id: s.id, name: s.name, erpnext_id: s.erpnext_id })))
      setStores(storeList)
      
    } catch (error) {
      console.error('❌ Error loading Stores:', error)
      setStores([])
    } finally {
      setLoadingStores(false)
    }
  }

  // Load Terminals from localDB
  const loadTerminals = async () => {
    if (!localDB) {
      console.error('LocalDB not available for loading Terminals')
      setLoadingTerminals(false)
      return
    }

    try {
      console.log('💻 Loading Terminals from localDB...')
      
      // Query for documents with type 'POSTerminal'
      const result = await localDB.find({
        selector: {
          type: 'POSTerminal'
        }
      })

      const terminalList = result.docs.map((doc: any) => ({
        id: doc.erpnext_id, // Use erpnext_id as the primary identifier
        name: doc.terminal_name || doc.name || doc.erpnext_id || 'Unknown Terminal',
        _id: doc._id,
        erpnext_id: doc.erpnext_id
      })).filter(terminal => terminal.id) // Filter out terminals without erpnext_id

      console.log(`✅ Loaded ${terminalList.length} Terminals:`, terminalList)
      console.log('🔍 Terminal details:', terminalList.map(t => ({ id: t.id, name: t.name, erpnext_id: t.erpnext_id })))
      setTerminals(terminalList)
      
    } catch (error) {
      console.error('❌ Error loading Terminals:', error)
      setTerminals([])
    } finally {
      setLoadingTerminals(false)
    }
  }

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Basic validation
    if (!selectedPOSProfile) {
      if (posProfiles.length === 0) {
        setError('No POS Profiles found in database. Please sync data first.')
      } else {
        setError('Please select a POS Profile')
      }
      return
    }
    
    if (!selectedStore) {
      if (canChangeStore) {
        setError('Please select a Store')
      } else {
        setError('No store configured. Please contact administrator.')
      }
      return
    }
    
    if (!selectedTerminal) {
      if (canChangeStore) {
        setError('Please select a Terminal')
      } else {
        setError('No terminal configured. Please contact administrator.')
      }
      return
    }

    setIsLoading(true)
    setError('')

    try {
      // Get current user info
      const userInfo = sessionUtils.getCurrentUser()
      
      if (!userInfo) {
        setError('User session not found. Please login again.')
        return
      }

      // Get selected profile name for display
      const selectedProfile = posProfiles.find(p => p.id === selectedPOSProfile)
      
      let selectedStoreName: string | undefined
      let selectedTerminalName: string | undefined
      
      if (canChangeStore) {
        // Find store and terminal names using erpnext_id as key
        const selectedStoreObj = stores.find(s => s.id === selectedStore)
        const selectedTerminalObj = terminals.find(t => t.id === selectedTerminal)
        
        selectedStoreName = selectedStoreObj?.name
        selectedTerminalName = selectedTerminalObj?.name
      } else {
        // Use previously stored names for users who can't change store/terminal
        selectedStoreName = previousStoreName || localStorage.getItem('storeName') || undefined
        selectedTerminalName = previousTerminalName || localStorage.getItem('terminalName') || undefined
      }
      
      // Validate that we found the store and terminal names
      if (!selectedStoreName || !selectedTerminalName) {
        const errorMsg = canChangeStore 
          ? 'Invalid store or terminal selection. Please try again.'
          : 'Store or terminal not configured properly. Please contact administrator.'
        setError(errorMsg)
        return
      }

      console.log('🔍 Selected items:', {
        storeId: selectedStore,
        storeName: selectedStoreName,
        terminalId: selectedTerminal,
        terminalName: selectedTerminalName
      })

      // Prepare POS Entry data - sending names to API
      const shiftStartTime = new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '')
      const posEntryData = {
        pos_profile: selectedProfile?.name || selectedPOSProfile,
        custom_pos_store: selectedStoreName, // Store name from erpnext_id lookup
        period_start_date: shiftStartTime,
        custom_pos_terminal: selectedTerminalName, // Terminal name from erpnext_id lookup
        user: userInfo.name || userInfo.full_name,
        company: "Great Eastern",
        balance_details: [
          {
            mode_of_payment: "Cash",
            opening_amount: 0
          }
        ]
      }

      console.log('🔄 Creating POS Entry with data:', posEntryData, userInfo.username, userInfo.name)
      
      // Call the real API to create POS entry
      const result = await posApi.createPOSEntry(posEntryData)
      
      if (result.message) {
        console.log('✅ POS Entry created successfully:', result.message)
        
        // Store the complete POS entry response
        localStorage.setItem('posEntry', JSON.stringify(result.message))
        localStorage.setItem('posEntryName', result.message.name)
        localStorage.setItem('invoiceSeqNo', result.message.invoice_seq_no?.toString() || '1')
        localStorage.setItem('shiftStartTime', shiftStartTime)
        
        // Store session data (keep existing for backward compatibility)
        console.log('💾 Setting localStorage keys with erpnext_id values...')
        localStorage.setItem('posProfile', selectedPOSProfile)
        localStorage.setItem('posProfileName', selectedPOSProfile) // Add this key for order page compatibility
        localStorage.setItem('store', selectedStore) // Store erpnext_id for store
        localStorage.setItem('storeName', selectedStoreName) // Store name for display
        localStorage.setItem('terminal', selectedTerminal) // Store erpnext_id for terminal
        localStorage.setItem('terminalName', selectedTerminalName) // Store name for display
        localStorage.setItem('shiftOpen', 'true')
        
        console.log('🔍 localStorage after basic keys:', {
          'posProfile': localStorage.getItem('posProfile'),
          'posProfileName': localStorage.getItem('posProfileName'),
          'pos_current_profile_name': localStorage.getItem('pos_current_profile_name')
        })
        
        // Initialize POS store with the selected profile
        try {
          console.log('🏪 Initializing POS store with selected profile:', selectedPOSProfile)
          await switchPOSProfile(selectedPOSProfile)
          console.log('✅ POS store initialized with profile:', selectedPOSProfile)
          
          // Final check of localStorage after POS store initialization
          console.log('🔍 Final localStorage check:', {
            'posProfile': localStorage.getItem('posProfile'),
            'posProfileName': localStorage.getItem('posProfileName'),
            'pos_current_profile_name': localStorage.getItem('pos_current_profile_name'),
            'pos_current_profile': localStorage.getItem('pos_current_profile') ? 'exists' : 'not found'
          })
        } catch (posError) {
          console.warn('⚠️ Failed to initialize POS store, but continuing:', posError)
          // Don't block the flow if POS initialization fails
        }
        
        console.log(`✅ Shift opened: ${result.message.name} for user: ${result.message.user}`)
        
        // Redirect to POS system
        router.push('/order')
      } else {
        throw new Error('Invalid response from POS Entry API')
      }
      
    } catch (err: any) {
      console.error('Failed to open shift:', err)
      const errorMessage = handleApiError(err as ApiError)
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = () => {
    // Use centralized session clearing
    sessionUtils.clearSession()
    console.log('🔒 User logged out and session cleared')
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Select POS Configuration
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Welcome back, <span className="font-medium text-teal-600">{username}</span>! 
            Choose your POS setup to continue.
          </p>
        </div>

        {/* Selection Form */}
        <form className="mt-8 space-y-6" onSubmit={handleOpenShift}>
          <div className="space-y-4">
            
            {/* POS Profile Selection */}
            <div>
              <label htmlFor="posProfile" className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center">
                  <Settings className="h-4 w-4 mr-1" />
                  POS Profile
                </div>
              </label>
              <select
                id="posProfile"
                name="posProfile"
                required
                value={selectedPOSProfile}
                onChange={(e) => setSelectedPOSProfile(e.target.value)}
                disabled={loadingProfiles}
                className="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                {loadingProfiles ? (
                  <option value="">Loading POS Profiles...</option>
                ) : posProfiles.length === 0 ? (
                  <option value="">No POS Profiles found</option>
                ) : (
                  <>
                    <option value="">Select POS Profile...</option>
                    {posProfiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>

            {/* Store Selection */}
            <div>
              <label htmlFor="store" className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center">
                  <Store className="h-4 w-4 mr-1" />
                  Store
                  {!canChangeStore && <span className="ml-2 text-xs text-gray-500">(Read-only)</span>}
                </div>
              </label>
              {canChangeStore ? (
                <select
                  id="store"
                  name="store"
                  required
                  value={selectedStore}
                  onChange={(e) => setSelectedStore(e.target.value)}
                  disabled={loadingStores}
                  className="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  {loadingStores ? (
                    <option value="">Loading Stores...</option>
                  ) : stores.length === 0 ? (
                    <option value="">No Stores found</option>
                  ) : (
                    <>
                      <option value="">Select Store...</option>
                      {stores.map((store) => (
                        <option key={store.id} value={store.id}>
                          {store.name}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              ) : (
                <div className="relative block w-full px-3 py-3 border border-gray-300 bg-gray-50 text-gray-700 rounded-lg sm:text-sm">
                  <div className="flex items-center justify-between">
                    <span>{previousStoreName || 'Not configured'}</span>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                </div>
              )}
            </div>

            {/* Terminal Selection */}
            <div>
              <label htmlFor="terminal" className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center">
                  <Monitor className="h-4 w-4 mr-1" />
                  Terminal
                  {!canChangeStore && <span className="ml-2 text-xs text-gray-500">(Read-only)</span>}
                </div>
              </label>
              {canChangeStore ? (
                <select
                  id="terminal"
                  name="terminal"
                  required
                  value={selectedTerminal}
                  onChange={(e) => setSelectedTerminal(e.target.value)}
                  disabled={loadingTerminals}
                  className="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  {loadingTerminals ? (
                    <option value="">Loading Terminals...</option>
                  ) : terminals.length === 0 ? (
                    <option value="">No Terminals found</option>
                  ) : (
                    <>
                      <option value="">Select Terminal...</option>
                      {terminals.map((terminal) => (
                        <option key={terminal.id} value={terminal.id}>
                          {terminal.name}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              ) : (
                <div className="relative block w-full px-3 py-3 border border-gray-300 bg-gray-50 text-gray-700 rounded-lg sm:text-sm">
                  <div className="flex items-center justify-between">
                    <span>{previousTerminalName || 'Not configured'}</span>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Info Message for Read-only Mode */}
          {!canChangeStore && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-blue-800 text-sm">Store and terminal are pre-configured. Contact administrator to change these settings.</p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Open Shift Button */}
          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <span className="flex items-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Opening Shift...
                </span>
              ) : (
                <span className="flex items-center">
                  <LogIn className="h-5 w-5 mr-2" />
                  Open Shift & Continue
                </span>
              )}
            </button>
          </div>

          {/* Logout Option */}
          <div className="text-center">
            <button
              type="button"
              onClick={handleLogout}
              className="text-sm text-gray-600 hover:text-gray-900 underline"
            >
              Switch User
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default SelectPage 