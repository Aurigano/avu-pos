import { useEffect, useState } from 'react'

export const useHydration = () => {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return mounted
} 