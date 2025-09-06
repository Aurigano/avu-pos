'use client'

import { User } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface LogoutButtonProps {
  variant?: 'mobile' | 'desktop'
  className?: string
}

const LogoutButton = ({ variant = 'mobile', className = '' }: LogoutButtonProps) => {
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = async () => {
    setIsLoggingOut(true)
    
    // Clear authentication but preserve shift data for continuation
    localStorage.removeItem('isLoggedIn')
    localStorage.removeItem('sessionId')
    localStorage.removeItem('authResponse')
    localStorage.removeItem('userInfo')
    
    // Keep shift data intact: store, terminal, posProfile, shiftOpen, etc.
    console.log('👤 User taking a break, session cleared but shift data preserved')
    router.push('/continueshift')
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
          <User size={24} />
        )}
        <span className="text-xs mt-1 font-medium">
          {isLoggingOut ? "LOGGING OUT..." : "LOGOUT"}
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
        <User size={16} />
      )}
    </button>
  )
}

export default LogoutButton 