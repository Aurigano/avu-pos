'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Store, Monitor, Settings, LogIn, User } from 'lucide-react'
import { posApi, handleApiError, sessionUtils, type ApiError } from '@/lib/api-service'
import { localDB } from '@/lib/pouchdb'

const SelectPage = () => {
  const [selectedPOSProfile, setSelectedPOSProfile] = useState('')
  const [selectedStore, setSelectedStore] = useState('')
  const [selectedTerminal, setSelectedTerminal] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [username, setUsername] = useState('')
  const [posProfiles, setPosProfiles] = useState<Array<{id: string, name: string}>>([])
  const [loadingProfiles, setLoadingProfiles] = useState(true)
  const router = useRouter()

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

    // Load persisted store and terminal selections (persist across logouts)
    const savedStore = localStorage.getItem('store')
    const savedTerminal = localStorage.getItem('terminal')
    
    if (savedStore) {
      setSelectedStore(savedStore)
      console.log('🏪 Restored store selection:', savedStore)
    }
    
    if (savedTerminal) {
      setSelectedTerminal(savedTerminal)
      console.log('💻 Restored terminal selection:', savedTerminal)
    }
  }, [router])

  // Load POS Profiles on component mount
  useEffect(() => {
    loadPOSProfiles()
  }, [])

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
        id: doc._id,
        name: doc.profile_name || doc.name || doc._id || 'Unknown Profile'
      }))

      console.log(`✅ Loaded ${profiles.length} POS Profiles:`, profiles)
      setPosProfiles(profiles)
      
    } catch (error) {
      console.error('❌ Error loading POS Profiles:', error)
      setPosProfiles([])
    } finally {
      setLoadingProfiles(false)
    }
  }

  // Static options for Store and Terminal
  const stores = [
    { id: 'store-1', name: 'Store 1' }
  ]

  const terminals = [
    { id: 'terminal-1', name: 'POS Terminal 1' }
  ]

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
      setError('Please select a Store')
      return
    }
    
    if (!selectedTerminal) {
      setError('Please select a Terminal')
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
      const selectedStoreName = stores.find(s => s.id === selectedStore)?.name || selectedStore
      const selectedTerminalName = terminals.find(t => t.id === selectedTerminal)?.name || selectedTerminal

      // Prepare POS Entry data
      const shiftStartTime = new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '')
      const posEntryData = {
        pos_profile: selectedProfile?.name || selectedPOSProfile,
        custom_pos_store: selectedStoreName,
        period_start_date: shiftStartTime,
        custom_pos_terminal: selectedTerminalName,
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
        localStorage.setItem('posProfile', selectedPOSProfile)
        localStorage.setItem('store', selectedStore)
        localStorage.setItem('terminal', selectedTerminal)
        localStorage.setItem('shiftOpen', 'true')
        
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
                </div>
              </label>
              <select
                id="store"
                name="store"
                required
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
                className="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 sm:text-sm"
              >
                <option value="">Select Store...</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Terminal Selection */}
            <div>
              <label htmlFor="terminal" className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center">
                  <Monitor className="h-4 w-4 mr-1" />
                  Terminal
                </div>
              </label>
              <select
                id="terminal"
                name="terminal"
                required
                value={selectedTerminal}
                onChange={(e) => setSelectedTerminal(e.target.value)}
                className="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 sm:text-sm"
              >
                <option value="">Select Terminal...</option>
                {terminals.map((terminal) => (
                  <option key={terminal.id} value={terminal.id}>
                    {terminal.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

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