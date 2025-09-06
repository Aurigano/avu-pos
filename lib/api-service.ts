// API Service - Centralized API calls for the POS system

// Base API configuration
const API_BASE_URL = 'https://demo15.etoserp.com/api/method'

// API Response Types
export interface LoginResponse {
  message: {
    status: string
    message: string
    user: {
      name: string
      full_name: string
      email: string
      username: string
      roles: string[]
      session_id: string
    }
  }
  home_page: string
  full_name: string
}

export interface ApiError {
  error: string
  message?: string
  exc?: string
  status?: number
}

// Utility function to get session headers
const getAuthHeaders = (): HeadersInit => {
  const sessionId = localStorage.getItem('sessionId')
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }
  
  if (sessionId) {
    // ERPNext/Frappe uses session_id in cookies or X-Frappe-API-Key header
    // Try both approaches for compatibility
    headers['Cookie'] = `sid=${sessionId}`
    headers['X-Frappe-API-Key'] = sessionId
  }
  
  return headers
}

// Generic API call wrapper with error handling
const apiCall = async <T>(
  endpoint: string, 
  options: RequestInit = {}, 
  requireAuth: boolean = false
): Promise<T> => {
  const url = `${API_BASE_URL}/${endpoint}`
  
  const defaultOptions: RequestInit = {
    method: 'GET',
    headers: requireAuth ? getAuthHeaders() : {
      'Content-Type': 'application/json',
    },
    ...options,
  }

  try {
    console.log(`🌐 API Call: ${defaultOptions.method} ${url}`)
    
    const response = await fetch(url, defaultOptions)
    const data = await response.json()
    
    if (!response.ok) {
      console.error(`❌ API Error (${response.status}):`, data)
      
      const error: ApiError = {
        error: `API Error (${response.status})`,
        message: data.message || data.exc || response.statusText,
        status: response.status
      }
      
      throw error
    }
    
    console.log('✅ API Success:', data)
    return data as T
    
  } catch (error: any) {
    // Network or parsing errors
    if (error.name === 'TypeError' || error.message?.includes('fetch')) {
      const networkError: ApiError = {
        error: 'Network Error',
        message: 'Unable to connect to server. Please check your internet connection.'
      }
      throw networkError
    }
    
    // Re-throw API errors
    throw error
  }
}

// Authentication API calls
export const authApi = {
  /**
   * Login user with username and password
   */
  login: async (username: string, password: string): Promise<LoginResponse> => {
    return apiCall<LoginResponse>('pos_retail.api.custom_login', {
      method: 'POST',
      body: JSON.stringify({
        usr: username.trim(),
        pwd: password.trim()
      })
    })
  },

  /**
   * Logout current user
   */
  logout: async (): Promise<void> => {
    return apiCall('logout', { method: 'POST' }, true)
  },

  /**
   * Validate current session
   */
  validateSession: async (): Promise<any> => {
    return apiCall('validate_session', { method: 'GET' }, true)
  }
}

// POS Management API calls
export const posApi = {
  /**
   * Open a POS shift
   */
  openShift: async (shiftData: {
    username: string
    userId: string
    posProfile: string
    store: string
    terminal: string
  }): Promise<any> => {
    return apiCall('pos_retail.api.open_shift', {
      method: 'POST',
      body: JSON.stringify(shiftData)
    }, true)
  },

  /**
   * Close current POS shift
   */
  closeShift: async (shiftId: string): Promise<any> => {
    return apiCall('pos_retail.api.close_shift', {
      method: 'POST',
      body: JSON.stringify({ shift_id: shiftId })
    }, true)
  },

  /**
   * Get POS profiles
   */
  getPOSProfiles: async (): Promise<any> => {
    return apiCall('pos_retail.api.get_pos_profiles', { method: 'GET' }, true)
  },

  /**
   * Get stores
   */
  getStores: async (): Promise<any> => {
    return apiCall('pos_retail.api.get_stores', { method: 'GET' }, true)
  },

  /**
   * Get terminals
   */
  getTerminals: async (): Promise<any> => {
    return apiCall('pos_retail.api.get_terminals', { method: 'GET' }, true)
  },

  /**
   * Create POS Entry (Open Shift)
   */
  createPOSEntry: async (entryData: {
    pos_profile: string
    custom_pos_store: string
    period_start_date: string
    custom_pos_terminal: string
    user: string
    company: string
    balance_details: Array<{
      mode_of_payment: string
      opening_amount: number
    }>
  }): Promise<any> => {
    return apiCall('pos_retail.api.create_pos_entry', {
      method: 'POST',
      body: JSON.stringify(entryData)
    }, true)
  },

  /**
   * Create POS Closing Entry (Close Shift)
   */
  createPOSClosingEntry: async (closingData: {
    doctype: string
    pos_profile: string
    user: string
    company: string
    period_start_date: string
    period_end_date: string
    pos_opening_entry: string
  }): Promise<any> => {
    return apiCall('pos_retail.api.create_pos_closing_entry', {
      method: 'POST',
      body: JSON.stringify(closingData)
    }, true)
  }
}

// Invoice API calls
export const invoiceApi = {
  /**
   * Create a new POS invoice
   */
  createInvoice: async (invoiceData: any): Promise<any> => {
    return apiCall('pos_retail.api.create_invoice', {
      method: 'POST',
      body: JSON.stringify(invoiceData)
    }, true)
  },

  /**
   * Get all invoices
   */
  getInvoices: async (filters?: {
    from_date?: string
    to_date?: string
    customer?: string
    status?: string
  }): Promise<any> => {
    const queryParams = filters ? `?${new URLSearchParams(filters as any).toString()}` : ''
    return apiCall(`pos_retail.api.get_invoices${queryParams}`, { method: 'GET' }, true)
  },

  /**
   * Get invoice by ID
   */
  getInvoice: async (invoiceId: string): Promise<any> => {
    return apiCall(`pos_retail.api.get_invoice?invoice_id=${invoiceId}`, { method: 'GET' }, true)
  },

  /**
   * Update invoice status
   */
  updateInvoiceStatus: async (invoiceId: string, status: string): Promise<any> => {
    return apiCall('pos_retail.api.update_invoice_status', {
      method: 'POST',
      body: JSON.stringify({
        invoice_id: invoiceId,
        status: status
      })
    }, true)
  }
}

// Product/Item API calls
export const productApi = {
  /**
   * Get all items/products
   */
  getItems: async (filters?: {
    item_group?: string
    search?: string
    limit?: number
  }): Promise<any> => {
    const queryParams = filters ? `?${new URLSearchParams(filters as any).toString()}` : ''
    return apiCall(`pos_retail.api.get_items${queryParams}`, { method: 'GET' }, true)
  },

  /**
   * Get item by ID
   */
  getItem: async (itemId: string): Promise<any> => {
    return apiCall(`pos_retail.api.get_item?item_id=${itemId}`, { method: 'GET' }, true)
  },

  /**
   * Search items by name
   */
  searchItems: async (searchTerm: string): Promise<any> => {
    return apiCall(`pos_retail.api.search_items?search=${encodeURIComponent(searchTerm)}`, { method: 'GET' }, true)
  }
}

// Customer API calls
export const customerApi = {
  /**
   * Get all customers
   */
  getCustomers: async (filters?: {
    search?: string
    limit?: number
  }): Promise<any> => {
    const queryParams = filters ? `?${new URLSearchParams(filters as any).toString()}` : ''
    return apiCall(`pos_retail.api.get_customers${queryParams}`, { method: 'GET' }, true)
  },

  /**
   * Get customer by ID
   */
  getCustomer: async (customerId: string): Promise<any> => {
    return apiCall(`pos_retail.api.get_customer?customer_id=${customerId}`, { method: 'GET' }, true)
  },

  /**
   * Search customers by name
   */
  searchCustomers: async (searchTerm: string): Promise<any> => {
    return apiCall(`pos_retail.api.search_customers?search=${encodeURIComponent(searchTerm)}`, { method: 'GET' }, true)
  }
}

// Sync API calls
export const syncApi = {
  /**
   * Sync data from server
   */
  syncData: async (lastSyncTime?: string): Promise<any> => {
    const queryParams = lastSyncTime ? `?last_sync=${lastSyncTime}` : ''
    return apiCall(`pos_retail.api.sync_data${queryParams}`, { method: 'GET' }, true)
  },

  /**
   * Push offline data to server
   */
  pushOfflineData: async (data: any[]): Promise<any> => {
    return apiCall('pos_retail.api.push_offline_data', {
      method: 'POST',
      body: JSON.stringify({ data })
    }, true)
  }
}

// Error handler utility
export const handleApiError = (error: ApiError): string => {
  console.error('API Error:', error)
  
  if (error.status === 401) {
    return 'Session expired. Please login again.'
  } else if (error.status === 403) {
    return 'Access denied. You do not have permission to perform this action.'
  } else if (error.status === 404) {
    return 'Resource not found.'
  } else if (error.status === 500) {
    return 'Server error. Please try again later.'
  } else if (error.error === 'Network Error') {
    return error.message || 'Network connection error.'
  } else {
    return error.message || 'An unexpected error occurred.'
  }
}

// Session management utilities
export const sessionUtils = {
  /**
   * Check if user is authenticated
   */
  isAuthenticated: (): boolean => {
    return !!localStorage.getItem('sessionId') && !!localStorage.getItem('isLoggedIn')
  },

  /**
   * Get current user info
   */
  getCurrentUser: () => {
    const userInfo = localStorage.getItem('userInfo')
    return userInfo ? JSON.parse(userInfo) : null
  },

  /**
   * Clear session data
   * Note: 'store' and 'terminal' are intentionally preserved across logouts
   */
  clearSession: (): void => {
    localStorage.removeItem('isLoggedIn')
    localStorage.removeItem('username')
    localStorage.removeItem('authResponse')
    localStorage.removeItem('userInfo')
    localStorage.removeItem('sessionId')
    localStorage.removeItem('fullName')
    localStorage.removeItem('homePage')
    localStorage.removeItem('posProfile')
    // Preserve 'store' and 'terminal' - they persist across user sessions
    localStorage.removeItem('shiftOpen')
    localStorage.removeItem('dbInitialized')
    localStorage.removeItem('posProfileName')
    localStorage.removeItem('posEntry')
    localStorage.removeItem('posEntryName')
    localStorage.removeItem('invoiceSeqNo')
    localStorage.removeItem('shiftStartTime')
  }
}

export default {
  authApi,
  posApi,
  invoiceApi,
  productApi,
  customerApi,
  syncApi,
  handleApiError,
  sessionUtils
} 