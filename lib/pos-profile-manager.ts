// POS Profile Manager
// This utility helps manage POS profile switching and can be easily integrated with login API

import { usePOSStore } from '@/stores/pos-store'

/**
 * Configuration for POS profile management
 * Update this when login API is implemented
 */
export const POSProfileConfig = {
  // No default profile - user must select one during login
  
  // Future: This will come from login API
  // getCurrentUserProfile: () => getFromLoginAPI(),
  
  // Future: Profile mapping based on user roles
  // USER_PROFILE_MAPPING: {
  //   'cashier': 'Cashier Profile',
  //   'manager': 'Manager Profile',
  //   'admin': 'Admin Profile'
  // }
}

/**
 * Initialize POS profile on app startup
 * This handles the profile loading priority
 */
export const initializePOSProfile = async (userProfileName?: string) => {
  const { initializePOSData, loadPOSProfileFromStorage } = usePOSStore.getState()
  
  try {
    // Priority order:
    // 1. User profile from login API (future)
    // 2. Profile name from localStorage (current session)  
    // No fallback - user must have selected a profile during login
    const profileName = userProfileName || loadPOSProfileFromStorage()
    
    if (!profileName) {
      throw new Error('No POS profile selected. Please login and select a profile.')
    }
    
    console.log('🔧 Initializing POS with profile:', profileName)
    await initializePOSData(profileName)
    
    return { success: true, profileName }
  } catch (error) {
    console.error('❌ Failed to initialize POS profile:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Switch POS profile (useful for user login/logout)
 * This will be called when user logs in with different credentials
 */
export const switchToUserProfile = async (userProfileName: string) => {
  const { switchPOSProfile } = usePOSStore.getState()
  
  try {
    console.log('👤 Switching to user profile:', userProfileName)
    await switchPOSProfile(userProfileName)
    
    return { success: true, profileName: userProfileName }
  } catch (error) {
    console.error('❌ Failed to switch POS profile:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Get current POS profile info
 */
export const getCurrentPOSProfile = () => {
  const { currentPOSProfile, currentProfileName, isLoaded } = usePOSStore.getState()
  
  return {
    profile: currentPOSProfile,
    profileName: currentProfileName,
    isLoaded,
    permissions: currentPOSProfile ? {
      enableCustomerDiscount: currentPOSProfile.allow_discount_change,
      enableRateChange: currentPOSProfile.allow_rate_change,
      enablePOSOffers: currentPOSProfile.enable_pos_offers,
      allowNegativeStock: currentPOSProfile.allow_negative_stock,
      paymentMethods: currentPOSProfile.payment_methods
    } : null
  }
}

/**
 * Clear current POS profile (useful for logout)
 */
export const clearCurrentPOSProfile = () => {
  const { reset } = usePOSStore.getState()
  
  console.log('🚪 Clearing current POS profile (logout)')
  reset()
}

/**
 * Future: Integration point for login API
 * This function will be called when login API is implemented
 */
export const handleUserLogin = async (loginResponse: any) => {
  // TODO: Replace with actual login API integration
  
  // Example of how this will work:
  // const userProfileName = loginResponse.user.pos_profile_name
  // const result = await switchToUserProfile(userProfileName)
  // 
  // if (result.success) {
  //   console.log('✅ User logged in successfully with profile:', result.profileName)
  // } else {
  //   console.error('❌ Login failed:', result.error)
  // }
  
  console.log('🔮 Future: Login API integration point')
  console.log('Login response will contain user POS profile name')
}

/**
 * Future: Integration point for logout
 */
export const handleUserLogout = () => {
  // TODO: Replace with actual logout logic
  clearCurrentPOSProfile()
  console.log('🔮 Future: User logged out, POS profile cleared')
} 