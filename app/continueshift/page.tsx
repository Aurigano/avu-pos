'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { User, Lock, LogIn, ArrowLeft } from 'lucide-react'
import { authApi, handleApiError, sessionUtils, type ApiError } from '@/lib/api-service'
import { databaseManager } from '@/lib/database-manager'

const ContinueShiftPage = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [loginStatus, setLoginStatus] = useState<'idle' | 'authenticating' | 'initializing' | 'success'>('idle')
  const router = useRouter()

  // Note: We intentionally don't redirect logged-in users here
  // because they may be taking a break and want to continue their shift

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    // Clear error when user starts typing
    if (error) setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.username || !formData.password) {
      setError('Please fill in all fields')
      return
    }

    setIsLoading(true)
    setError('')
    setLoginStatus('authenticating')

         try {
       // Step 1: Authenticate user
       console.log('🔐 Authenticating user...')
       const authData = await authApi.login(formData.username, formData.password)
       
       console.log('✅ Authentication successful')
       
       // Step 2: Store session data (similar to login page)
       localStorage.setItem('isLoggedIn', 'true')
       localStorage.setItem('authResponse', JSON.stringify(authData))
       localStorage.setItem('userInfo', JSON.stringify(authData.message.user))
       localStorage.setItem('sessionId', authData.message.user.session_id)
      
      // Step 4: Initialize database with existing shift data
      setLoginStatus('initializing')
      console.log('🔄 Initializing with existing shift data...')
      
      // Get existing shift data from localStorage (should still be there)
      const existingStore = localStorage.getItem('store') || 'store-1'
      const existingTerminal = localStorage.getItem('terminal') || 'pos-1'
      const existingPOSProfile = localStorage.getItem('posProfileName') || localStorage.getItem('posProfile')
      const shiftOpen = localStorage.getItem('shiftOpen')
      
      console.log('📋 Using existing shift data:', {
        store: existingStore,
        terminal: existingTerminal,
        posProfile: existingPOSProfile,
        shiftOpen: shiftOpen
      })

             // Initialize database (this will use existing POS profile data)
       const dbResult = await databaseManager.initializeDatabase({
         syncDirection: 'pull',
         skipSync: false,
         onProgress: (stage: string, status: 'starting' | 'success' | 'error', details?: any) => {
           console.log(`📊 DB Init - ${stage}: ${status}`, details)
         }
       })

      if (dbResult.success) {
        // Mark database as initialized  
        localStorage.setItem('dbInitialized', 'true')
        
        // Ensure shift is still marked as open
        localStorage.setItem('shiftOpen', 'true')
        
        console.log('✅ Database initialized successfully, continuing shift')
        setLoginStatus('success')
        
        // Redirect to orders page
        router.push('/order')
        
      } else {
        console.warn('⚠️ Database initialization failed, but allowing offline mode')
        localStorage.setItem('dbInitialized', 'false')
        localStorage.setItem('shiftOpen', 'true')
        router.push('/order')
      }
      
    } catch (err: any) {
      console.error('❌ Continue shift failed:', err)
      const errorMessage = handleApiError(err as ApiError)
      setError(errorMessage)
      setLoginStatus('idle')
    } finally {
      setIsLoading(false)
    }
  }

  const handleBackToLogin = () => {
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Continue Your Shift
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Welcome back! Enter your credentials to continue working.
          </p>
        </div>

        {/* Login Form */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            
            {/* Username Field */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center">
                  <User className="h-4 w-4 mr-1" />
                  Username
                </div>
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                value={formData.username}
                onChange={handleInputChange}
                className="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:z-10 sm:text-sm"
                placeholder="Enter your username"
              />
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center">
                  <Lock className="h-4 w-4 mr-1" />
                  Password
                </div>
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={formData.password}
                onChange={handleInputChange}
                className="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:z-10 sm:text-sm"
                placeholder="Enter your password"
              />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Status Messages */}
          {loginStatus !== 'idle' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2"></div>
                <p className="text-blue-700 text-sm">
                  {loginStatus === 'authenticating' && 'Authenticating...'}
                  {loginStatus === 'initializing' && 'Initializing your shift...'}
                  {loginStatus === 'success' && 'Success! Redirecting...'}
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <LogIn className="h-5 w-5 text-teal-500 group-hover:text-teal-400" />
                )}
              </span>
              {isLoading ? 'Continuing Shift...' : 'Continue Shift'}
            </button>

            {/* Back to Login */}
            <button
              type="button"
              onClick={handleBackToLogin}
              disabled={isLoading}
              className="w-full flex justify-center items-center py-3 px-4 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Full Login
            </button>
          </div>
        </form>

        {/* Information Note */}
        <div className="mt-6 p-4 bg-gray-100 rounded-lg">
          <p className="text-xs text-gray-600 text-center">
            <span className="font-medium">Note:</span> This will continue your existing shift with the same store, terminal, and POS profile settings. 
            Use "Close Shift" if you want to end your shift completely.
          </p>
        </div>
      </div>
    </div>
  )
}

export default ContinueShiftPage 