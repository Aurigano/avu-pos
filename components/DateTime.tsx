'use client'

import { useState, useEffect } from 'react'
import { Calendar } from 'lucide-react'

interface DateTimeProps {
  className?: string
}

const DateTime: React.FC<DateTimeProps> = ({ className = '' }) => {
  const [currentDateTime, setCurrentDateTime] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    const updateDateTime = () => {
      const now = new Date()
      const formattedDateTime = now.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
      setCurrentDateTime(formattedDateTime)
    }

    // Initial call
    updateDateTime()

    // Update every minute
    const interval = setInterval(updateDateTime, 60000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className={`flex items-center justify-center space-x-2 text-black bg-white px-2 sm:px-3 py-2 rounded-lg shadow-sm flex-shrink-0 ${className}`}>
      <Calendar size={18} className="text-gray-600" />
      <span className="text-xs sm:text-sm font-medium">
        {mounted ? currentDateTime : 'Loading...'}
      </span>
    </div>
  )
}

export default DateTime 