'use client'

import { useState, useRef, useEffect } from 'react'
import { User } from 'lucide-react'
import { localDB } from '../lib/pouchdb'

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

interface CustomerSearchProps {
  onCustomerSelect: (customerName: string) => void
  resetTrigger?: number
  className?: string
}

const CustomerSearch: React.FC<CustomerSearchProps> = ({ onCustomerSelect, resetTrigger, className = '' }) => {
  // Customer search states
  const [customerSearchTerm, setCustomerSearchTerm] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([])
  const [allCustomers, setAllCustomers] = useState<Customer[]>([])
  const [selectedCustomerIndex, setSelectedCustomerIndex] = useState(-1)
  const customerSearchRef = useRef<HTMLDivElement>(null)

  // Load customers from database
  useEffect(() => {
    const loadCustomers = async () => {
      if (!localDB) return;
      
      try {
        // Create indexes for efficient searching
        await localDB.createIndex({
          index: {
            fields: ['type']
          }
        })
        
        const customersResult = await localDB.find({ selector: { type: 'Customer' } })
        setAllCustomers(customersResult.docs as Customer[])
      } catch (error) {
        console.error('Error loading customers for search:', error)
      }
    }
    
    loadCustomers()
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (customerSearchRef.current && !customerSearchRef.current.contains(event.target as Node)) {
        setShowCustomerDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Reset customer field when resetTrigger changes
  useEffect(() => {
    if (resetTrigger !== undefined) {
      setCustomerSearchTerm('')
      setShowCustomerDropdown(false)
    }
  }, [resetTrigger])

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
    setSelectedCustomerIndex(-1) // Reset selection when search changes
  }

  const handleCustomerKeyDown = (e: React.KeyboardEvent) => {
    if (!showCustomerDropdown || filteredCustomers.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedCustomerIndex(prev => 
          prev < filteredCustomers.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedCustomerIndex(prev => 
          prev > 0 ? prev - 1 : filteredCustomers.length - 1
        )
        break
      case 'Enter':
        e.preventDefault()
        if (selectedCustomerIndex >= 0 && selectedCustomerIndex < filteredCustomers.length) {
          handleCustomerSelect(filteredCustomers[selectedCustomerIndex])
        }
        break
      case 'Escape':
        setShowCustomerDropdown(false)
        setSelectedCustomerIndex(-1)
        break
    }
  }

  const handleCustomerSelect = (customer: Customer) => {
    setCustomerSearchTerm(customer.customer_name) // Keep the selected customer name in the input
    setShowCustomerDropdown(false)
    onCustomerSelect(customer.customer_name)
  }

  return (
    <div ref={customerSearchRef} className={`relative ${className}`}>
      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
      <input
        type="text"
        placeholder="Customer search..."
        value={customerSearchTerm}
        onChange={(e) => handleCustomerInputChange(e.target.value)}
        onKeyDown={handleCustomerKeyDown}
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
          setSelectedCustomerIndex(-1) // Reset selection when focusing
        }}
        className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-green-500 text-black"
      />
      
      {showCustomerDropdown && (
        <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
          {filteredCustomers.map((customer: Customer, index: number) => (
            <div
              key={customer._id}
              onClick={() => handleCustomerSelect(customer)}
              className={`px-4 py-2 cursor-pointer border-b border-gray-100 last:border-b-0 ${
                index === selectedCustomerIndex 
                  ? 'bg-green-100 text-green-900' 
                  : 'hover:bg-gray-50'
              }`}
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
  )
}

export default CustomerSearch 