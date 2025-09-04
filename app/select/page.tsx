'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Store, Monitor, Settings, LogIn, User } from 'lucide-react'

const SelectPage = () => {
  const [selectedPOSProfile, setSelectedPOSProfile] = useState('')
  const [selectedStore, setSelectedStore] = useState('')
  const [selectedTerminal, setSelectedTerminal] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [username, setUsername] = useState('')
  const router = useRouter()

  // Check if user is logged in
  useEffect(() => {
    const isLoggedIn = localStorage.getItem('isLoggedIn')
    const storedUsername = localStorage.getItem('username')
    
    if (!isLoggedIn) {
      router.push('/login')
      return
    }
    
    if (storedUsername) {
      setUsername(storedUsername)
    }
  }, [router])

  // Mock data - replace with API calls later
  const posProfiles = [
    { id: 'pos-profile-1', name: 'POS Profile 1' },
    { id: 'pos-profile-2', name: 'POS Profile 2' },
    { id: 'pos-profile-3', name: 'Restaurant Profile' },
    { id: 'pos-profile-4', name: 'Retail Profile' }
  ]

  const stores = [
    { id: 'store-a', name: 'Store A - Main Branch' },
    { id: 'store-b', name: 'Store B - Mall Branch' },
    { id: 'store-c', name: 'Store C - Downtown' },
    { id: 'store-d', name: 'Store D - Airport' }
  ]

  const terminals = [
    { id: 'terminal-1', name: 'Terminal 1' },
    { id: 'terminal-2', name: 'Terminal 2' },
    { id: 'terminal-3', name: 'Terminal 3' },
    { id: 'terminal-4', name: 'Terminal 4' }
  ]

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Basic validation
    if (!selectedPOSProfile) {
      setError('Please select a POS Profile')
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
      // TODO: Implement actual 'open shift API' call here
      // const response = await fetch('/api/open-shift', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     username,
      //     posProfile: selectedPOSProfile,
      //     store: selectedStore,
      //     terminal: selectedTerminal
      //   })
      // })
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      // For demo purposes, allow access
      // Store session data
      localStorage.setItem('posProfile', selectedPOSProfile)
      localStorage.setItem('store', selectedStore)
      localStorage.setItem('terminal', selectedTerminal)
      localStorage.setItem('shiftOpen', 'true')
      
      // Redirect to POS system
      router.push('/order')
      
    } catch (err) {
      setError('Failed to open shift. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.clear()
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
                className="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 sm:text-sm"
              >
                <option value="">Select POS Profile...</option>
                {posProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
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

        {/* Info Box */}
        {/* <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-yellow-800 text-sm font-medium mb-1">Shift Management</p>
              <p className="text-yellow-700 text-xs">
                The system will check if a shift is already open for the selected configuration. 
                API integration can be added later.
              </p>
            </div>
          </div>
        </div> */}
      </div>
    </div>
  )
}

export default SelectPage 