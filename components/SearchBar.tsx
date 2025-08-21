'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, User } from 'lucide-react'
import { localDB } from '../lib/pouchdb'
import { usePOSStore } from '../stores/pos-store'

interface Product {
  _id: string
  _rev?: string
  type: string
  erpnext_id: string
  item_code: string
  item_name: string
  item_group: string
  default_uom: string
  standard_selling_rate: number
  has_serial_no: boolean
  has_batch_no: boolean
  is_stock_item: boolean
  image?: string
  creation_date: string
  modified_date: string
  SchemaVersion: string
  CreatedBy: string
  AuditLogId: string
}

interface Customer {
  _id: string
  _rev?: string
  type: string
  erpnext_id: string
  customer_name: string
  customer_group?: string
  territory?: string
  customer_type?: string
  mobile_no?: string
  email_id?: string
  creation_date: string
  modified_date: string
  SchemaVersion: string
  CreatedBy: string
  AuditLogId: string
}

interface SearchBarProps {
  onItemSelect: (itemName: string) => void
  onCustomerSelect?: (customerName: string) => void
}

const SearchBar: React.FC<SearchBarProps> = ({ onItemSelect, onCustomerSelect }) => {
  // POS Store
  const { getItemPrice } = usePOSStore()
  
  // Product search states
  const [productSearchTerm, setProductSearchTerm] = useState('')
  const [showProductDropdown, setShowProductDropdown] = useState(false)
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const productSearchRef = useRef<HTMLDivElement>(null)

  // Customer search states
  const [customerSearchTerm, setCustomerSearchTerm] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([])
  const [allCustomers, setAllCustomers] = useState<Customer[]>([])
  const customerSearchRef = useRef<HTMLDivElement>(null)

  // Checkpoint 1: Commented console logs
  // console.log('allProducts', allProducts)

  // Load products and customers from database
  useEffect(() => {
    const loadData = async () => {
      if (!localDB) return;
      
      try {
        // Create indexes for efficient searching
        await localDB.createIndex({
          index: {
            fields: ['type']
          }
        })
        
        const productsResult = await localDB.find({ selector: { type: 'Item' } })
        setAllProducts(productsResult.docs as Product[])
        
        const customersResult = await localDB.find({ selector: { type: 'Customer' } })
        setAllCustomers(customersResult.docs as Customer[])
      } catch (error) {
        console.error('Error loading data for search:', error)
      }
    }
    
    loadData()
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (productSearchRef.current && !productSearchRef.current.contains(event.target as Node)) {
        setShowProductDropdown(false)
      }
      if (customerSearchRef.current && !customerSearchRef.current.contains(event.target as Node)) {
        setShowCustomerDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleProductInputChange = (value: string) => {
    setProductSearchTerm(value)
    
    const filtered = value.length > 0 
      ? allProducts
          .filter((product: Product) => 
            product.item_name.toLowerCase().includes(value.toLowerCase()) ||
            product.item_code.toLowerCase().includes(value.toLowerCase()) ||
            product.erpnext_id.toLowerCase().includes(value.toLowerCase())
          )
          .slice(0, 8)
      : allProducts.slice(0, 8) // Show first 8 products when no search term
    
    setFilteredProducts(filtered)
    setShowProductDropdown(filtered.length > 0)
  }

  const handleCustomerInputChange = (value: string) => {
    setCustomerSearchTerm(value)
    
    const filtered = value.length > 0
      ? allCustomers
          .filter((customer: Customer) => 
            customer.customer_name.toLowerCase().includes(value.toLowerCase()) ||
            customer.erpnext_id.toLowerCase().includes(value.toLowerCase()) ||
            (customer.mobile_no && customer.mobile_no.includes(value))
          )
          .slice(0, 8)
      : allCustomers.slice(0, 8) // Show first 8 customers when no search term
    
    setFilteredCustomers(filtered)
    setShowCustomerDropdown(filtered.length > 0)
  }

  const handleProductSelect = (product: Product) => {
    setProductSearchTerm('') // Clear the input after selection
    setShowProductDropdown(false)
    onItemSelect(product.item_name)
  }

  const handleCustomerSelect = (customer: Customer) => {
    setCustomerSearchTerm(customer.customer_name) // Keep the selected customer name in the input
    setShowCustomerDropdown(false)
    if (onCustomerSelect) {
      onCustomerSelect(customer.customer_name)
    }
  }

  return (
    <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 w-full">
      {/* Product Search */}
      <div ref={productSearchRef} className="relative flex-1 min-w-0">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Product search..."
          value={productSearchTerm}
          onChange={(e) => handleProductInputChange(e.target.value)}
          onFocus={() => {
            // Show suggestions immediately on focus
            const filtered = productSearchTerm.length > 0 
              ? allProducts
                  .filter((product: Product) => 
                    product.item_name.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
                    product.item_code.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
                    product.erpnext_id.toLowerCase().includes(productSearchTerm.toLowerCase())
                  )
                  .slice(0, 8)
              : allProducts.slice(0, 8)
            
            setFilteredProducts(filtered)
            setShowProductDropdown(filtered.length > 0)
          }}
          className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
        />
        
        {showProductDropdown && (
          <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
            {filteredProducts.map((product: Product) => (
              <div
                key={product._id}
                onClick={() => handleProductSelect(product)}
                className="px-4 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
              >
                <div className="flex items-center">
                  {product.image ? (
                    <img 
                      src={product.image} 
                      alt={product.item_name}
                      className="w-8 h-8 object-cover rounded mr-3 flex-shrink-0"
                      onError={(e) => {
                        const target = e.currentTarget as HTMLImageElement;
                        const fallback = target.nextElementSibling as HTMLElement;
                        target.style.display = 'none';
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                  ) : (
                    <div className="w-8 h-8 bg-gray-200 rounded mr-3 flex items-center justify-center flex-shrink-0">
                      <Search size={12} className="text-gray-400" />
                    </div>
                  )}
                  <div className="hidden w-8 h-8 bg-gray-200 rounded mr-3 flex items-center justify-center">
                    <Search size={12} className="text-gray-400" />
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-gray-700 font-medium truncate">{product.item_name}</span>
                    <span className="text-xs text-gray-500 truncate">
                      {product.item_group} • {(() => {
                        // const priceResult = getItemPrice(product.item_code, product.item_code)
                        const priceResult = getItemPrice(product.item_name, product.item_name)
                        return priceResult.isValid ? priceResult.price.toFixed(2) : product.standard_selling_rate.toFixed(2)
                      })()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Customer Search */}
      <div ref={customerSearchRef} className="relative flex-1 min-w-0">
        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Customer search..."
          value={customerSearchTerm}
          onChange={(e) => handleCustomerInputChange(e.target.value)}
          onFocus={() => {
            // Show suggestions immediately on focus
            const filtered = customerSearchTerm.length > 0
              ? allCustomers
                  .filter((customer: Customer) => 
                    customer.customer_name.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
                    customer.erpnext_id.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
                    (customer.mobile_no && customer.mobile_no.includes(customerSearchTerm))
                  )
                  .slice(0, 8)
              : allCustomers.slice(0, 8)
            
            setFilteredCustomers(filtered)
            setShowCustomerDropdown(filtered.length > 0)
          }}
          className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-green-500 text-black"
        />
        
        {showCustomerDropdown && (
          <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
            {filteredCustomers.map((customer: Customer) => (
              <div
                key={customer._id}
                onClick={() => handleCustomerSelect(customer)}
                className="px-4 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
              >
                <div className="flex items-center">
                  <User size={16} className="text-gray-400 mr-2 flex-shrink-0" />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-gray-700 font-medium truncate">{customer.customer_name}</span>
                    <span className="text-xs text-gray-500 truncate">{customer.mobile_no || customer.email_id || customer.erpnext_id}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default SearchBar 