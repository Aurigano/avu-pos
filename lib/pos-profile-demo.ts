// Demo: POS Profile Management Integration
// This file demonstrates how the POS profile system will work with login API

import { switchToUserProfile, getCurrentPOSProfile, handleUserLogin } from './pos-profile-manager'

/**
 * Demo: Simulating different user login scenarios
 * This shows how the system will work when login API is implemented
 */

// Demo 1: Cashier Login
export const simulateCashierLogin = async () => {
  console.log('🎭 DEMO: Cashier Login Simulation')
  
  // Future: This data will come from login API
  const mockLoginResponse = {
    user: {
      name: 'John Doe',
      role: 'cashier',
      pos_profile_name: 'POS Profile 1',  // ← This comes from API
      permissions: ['create_sales', 'view_inventory']
    },
    token: 'mock_jwt_token'
  }
  
  // Switch to user's POS profile
  const result = await switchToUserProfile(mockLoginResponse.user.pos_profile_name)
  
  if (result.success) {
    const currentProfile = getCurrentPOSProfile()
    console.log('✅ Cashier logged in successfully')
    console.log('📋 Active Profile:', currentProfile.profileName)
    console.log('🔐 Permissions:', currentProfile.permissions)
  }
  
  return result
}

// Demo 2: Manager Login  
export const simulateManagerLogin = async () => {
  console.log('🎭 DEMO: Manager Login Simulation')
  
  // Future: Different profile for managers
  const mockManagerResponse = {
    user: {
      name: 'Jane Smith',
      role: 'manager', 
      pos_profile_name: 'Manager POS Profile',  // ← Different profile
      permissions: ['create_sales', 'view_inventory', 'manage_discounts', 'view_reports']
    },
    token: 'mock_manager_token'
  }
  
  const result = await switchToUserProfile(mockManagerResponse.user.pos_profile_name)
  
  if (result.success) {
    console.log('✅ Manager logged in successfully')
    console.log('📋 Active Profile:', result.profileName)
  } else {
    console.log('ℹ️ Manager profile not found, using default')
    // In real scenario, you'd create the profile or fall back gracefully
  }
  
  return result
}

// Demo 3: Multi-store scenario
export const simulateStoreLogin = async (storeId: string) => {
  console.log(`🎭 DEMO: Store ${storeId} Login Simulation`)
  
  const storeProfiles = {
    'store_a': 'POS Profile 1',
    'store_b': 'Store B POS Profile', 
    'store_c': 'Store C POS Profile'
  }
  
  const profileName = storeProfiles[storeId as keyof typeof storeProfiles] || 'POS Profile 1'
  const result = await switchToUserProfile(profileName)
  
  console.log(`🏪 Switched to ${storeId} profile:`, result.profileName || 'fallback')
  return result
}

// Demo 4: Real login API integration example
export const handleRealLoginAPI = async (username: string, password: string) => {
  console.log('🔮 DEMO: Real Login API Integration')
  
  try {
    // TODO: Replace with actual API call
    // const response = await fetch('/api/auth/login', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ username, password })
    // })
    // const loginData = await response.json()
    
    // For now, simulate the API response
    const mockAPIResponse = {
      success: true,
      user: {
        id: 123,
        name: username,
        pos_profile_name: username === 'manager' ? 'Manager POS Profile' : 'POS Profile 1'
      },
      token: 'real_jwt_token'
    }
    
    if (mockAPIResponse.success) {
      // Use the handleUserLogin function for real integration
      await handleUserLogin(mockAPIResponse)
      
      // Switch to user's profile
      return await switchToUserProfile(mockAPIResponse.user.pos_profile_name)
    }
    
  } catch (error) {
    console.error('❌ Login API failed:', error)
    return { success: false, error: 'Login failed' }
  }
}

// Demo 5: Profile permissions check
export const checkCurrentPermissions = () => {
  const current = getCurrentPOSProfile()
  
  console.log('🔐 Current POS Profile Permissions:')
  console.log('Profile Name:', current.profileName)
  console.log('Loaded:', current.isLoaded)
  
  if (current.permissions) {
    console.log('Customer Discounts:', current.permissions.enableCustomerDiscount)
    console.log('POS Offers:', current.permissions.enablePOSOffers)
    console.log('Negative Stock:', current.permissions.allowNegativeStock)
    console.log('Payment Methods:', current.permissions.paymentMethods)
  }
  
  return current.permissions
}

// Demo: Run all simulations
export const runPOSProfileDemos = async () => {
  console.log('🚀 Starting POS Profile System Demos...')
  console.log('=' .repeat(50))
  
  // Test 1: Cashier login
  await simulateCashierLogin()
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  // Test 2: Manager login (will fail but show graceful handling)
  await simulateManagerLogin()
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  // Test 3: Store-specific login
  await simulateStoreLogin('store_a')
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  // Test 4: Check current permissions
  checkCurrentPermissions()
  
  console.log('=' .repeat(50))
  console.log('✅ All demos completed!')
} 