'use client'

import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { sessionUtils, posApi, handleApiError } from '@/lib/api-service'
import { performDatabaseSync } from '@/lib/database-manager'

interface LogoutButtonProps {
  variant?: 'mobile' | 'desktop'
  className?: string
}

const LogoutButton = ({ variant = 'mobile', className = '' }: LogoutButtonProps) => {
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = async () => {
    setIsLoggingOut(true)
    
    try {
      console.log('🔄 Syncing data before logout...')
      
      // Perform sync operation (both push and pull)
      const syncResult = await performDatabaseSync('both')
      
      if (syncResult.success) {
        console.log('✅ Sync completed successfully before logout:', syncResult)
        
        // Only create POS Closing Entry if sync was successful
        await createPOSClosingEntry()
        
      } else {
        console.warn('⚠️ Sync failed before logout, proceeding anyway:', syncResult.error)
      }
      
    } catch (error) {
      console.warn('⚠️ Sync error before logout, proceeding anyway:', error)
    }
    
    // Clear session and logout regardless of sync result
    sessionUtils.clearSession()
    console.log('🔒 User logged out and session cleared')
    router.push('/login')
  }

  const createPOSClosingEntry = async () => {
    try {
      console.log('🏪 Creating POS Closing Entry...')
      
      // Get required data from localStorage
      const posEntry = localStorage.getItem('posEntry')
      const userInfo = sessionUtils.getCurrentUser()
      
      if (!posEntry || !userInfo) {
        console.warn('⚠️ Missing POS entry or user info, skipping POS Closing Entry')
        return
      }

      const posEntryData = JSON.parse(posEntry)
      const posProfileName = posEntryData.pos_profile || localStorage.getItem('posProfileName')
      const posOpeningEntryName = posEntryData.name || localStorage.getItem('posEntryName')
      const shiftStartTime = localStorage.getItem('shiftStartTime') || posEntryData.period_start_date || new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '')
      
      // Prepare closing entry data
      const closingData = {
        doctype: "POS Closing Entry",
        pos_profile: posProfileName,
        user: userInfo.full_name || userInfo.name,
        company: "Great Eastern",
        period_start_date: shiftStartTime,
        period_end_date: new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ''),
        pos_opening_entry: posOpeningEntryName
      }

      console.log('📊 POS Closing Entry data:', closingData)
      
      const result = await posApi.createPOSClosingEntry(closingData)
      
      if (result) {
        console.log('✅ POS Closing Entry created successfully:', result)
      }
      
    } catch (error: any) {
      console.error('❌ Failed to create POS Closing Entry:', error)
      const errorMessage = handleApiError(error)
      console.warn('POS Closing Entry error:', errorMessage)
      // Don't block logout if closing entry fails
    }
  }

  if (variant === 'desktop') {
    return (
      <div className="mt-auto">
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className={`sidebar-item hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
          title={isLoggingOut ? "Syncing data..." : "Logout"}
        >
          {isLoggingOut ? (
            <div className="w-6 h-6 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <LogOut size={24} />
          )}
          <span className="text-xs mt-1 font-medium">
            {isLoggingOut ? "SYNCING..." : "LOGOUT"}
          </span>
        </button>
      </div>
    )
  }

  // Mobile variant
  return (
    <button
      onClick={handleLogout}
      disabled={isLoggingOut}
      className={`flex items-center p-1 rounded text-gray-600 hover:bg-red-50 hover:text-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      title={isLoggingOut ? "Syncing data..." : "Logout"}
    >
      {isLoggingOut ? (
        <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
      ) : (
        <LogOut size={16} />
      )}
    </button>
  )
}

export default LogoutButton 