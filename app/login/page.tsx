'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, Lock, LogIn, Database, Wifi, HardDrive, Settings } from 'lucide-react'
import { databaseManager } from '@/lib/database-manager'
import { authApi, handleApiError, type LoginResponse, type ApiError } from '@/lib/api-service'

const LoginPage = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [initializationStep, setInitializationStep] = useState('')
  const [showProgress, setShowProgress] = useState(false)
  const router = useRouter()

  const getProgressIcon = (step: string) => {
    switch (step) {
      case 'connection': return <Wifi className="h-4 w-4" />
      case 'sync': return <Database className="h-4 w-4" />
      case 'indexes': return <HardDrive className="h-4 w-4" />
      case 'documents': return <HardDrive className="h-4 w-4" />
      case 'pos-data': return <Settings className="h-4 w-4" />
      default: return <Database className="h-4 w-4" />
    }
  }

  const getProgressMessage = (step: string) => {
    switch (step) {
      case 'connection': return 'Testing database connection...'
      case 'sync': return 'Synchronizing data...'
      case 'indexes': return 'Creating database indexes...'
      case 'documents': return 'Loading documents...'
      case 'pos-data': return 'Initializing POS data...'
      default: return 'Initializing system...'
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Basic validation
    if (!username.trim()) {
      setError('Username is required')
      return
    }
    
    if (!password.trim()) {
      setError('Password is required')
      return
    }

    setIsLoading(true)
    setError('')
    setShowProgress(false)

    try {
      // Call the authentication API using centralized service
      console.log('🔐 Authenticating user...')
      
      const authData: LoginResponse = await authApi.login(username, password)
      
      // Authentication successful - store user data
      localStorage.setItem('isLoggedIn', 'true')
      localStorage.setItem('authResponse', JSON.stringify(authData))
      localStorage.setItem('userInfo', JSON.stringify(authData.message.user))
      localStorage.setItem('sessionId', authData.message.user.session_id)
      
      console.log('✅ Authentication successful for user:', authData.message.user.full_name)
        
        // Show database initialization progress
        setShowProgress(true)
        setInitializationStep('Starting database initialization...')
        
        // Initialize database after successful login
        const initResult = await databaseManager.initializeDatabase({
          skipSync: false,
          syncDirection: 'pull',
          onProgress: (step, status, details) => {
            console.log(`Database init progress: ${step} - ${status}`, details)
            if (status === 'starting') {
              setInitializationStep(step)
            }
          }
        })
        
        if (initResult.success) {
          console.log('✅ Database initialization completed successfully')
          // Store initialization state
          localStorage.setItem('dbInitialized', 'true')
          
          // Redirect to selection page
          router.push('/select')
        } else {
          console.error('❌ Database initialization failed:', initResult.error)
          // Even if DB init fails, allow user to proceed (offline mode)
          setError(`Database initialization failed: ${initResult.error || 'Unknown error'}. You can continue in offline mode.`)
          localStorage.setItem('dbInitialized', 'false')
          
          // Still redirect after a short delay to let user see the error
          setTimeout(() => {
            router.push('/select')
          }, 3000)
        }
        
    } catch (err: any) {
      console.error('Login or initialization failed:', err)
      
      // Use centralized error handler for API errors
      const errorMessage = handleApiError(err as ApiError)
      setError(errorMessage)
    } finally {
      setIsLoading(false)
      setShowProgress(false)
      setInitializationStep('')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Sign in to AVU POS
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Enter your credentials to access the point of sale system
          </p>
        </div>

        {/* Login Form */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Username Field */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="appearance-none relative block w-full px-10 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:z-10 sm:text-sm"
                  placeholder="Enter your username"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none relative block w-full px-10 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:z-10 sm:text-sm"
                  placeholder="Enter your password"
                />
              </div>
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

          {/* Login Button */}
          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <span className="flex items-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  {showProgress ? 'Initializing System...' : 'Signing in...'}
                </span>
              ) : (
                <span className="flex items-center">
                  <LogIn className="h-5 w-5 mr-2" />
                  Sign in
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default LoginPage 