'use client'

import { useState, useRef, useEffect } from 'react'
import { Search } from 'lucide-react'

const SearchBar = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [filteredItems, setFilteredItems] = useState<string[]>([])
  const searchRef = useRef<HTMLDivElement>(null)

  // Dummy autocomplete data
  const searchData = [
    'Chicken Wings',
    'Summer Salad',
    'French Fries',
    'Caesar Salad',
    'Buffalo Wings',
    'Onion Rings',
    'Mozzarella Sticks',
    'Garlic Bread',
    'Fish and Chips',
    'Grilled Chicken',
    'Beef Burger',
    'Veggie Burger',
    'Pasta Carbonara',
    'Margherita Pizza',
    'Order #12564878',
    'Order #12564877',
    'Order #12564876',
    'Table 1',
    'Table 2',
    'Table 3'
  ]

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleInputChange = (value: string) => {
    setSearchTerm(value)
    
    if (value.length > 0) {
      const filtered = searchData.filter(item =>
        item.toLowerCase().includes(value.toLowerCase())
      )
      setFilteredItems(filtered.slice(0, 8)) // Limit to 8 results
      setShowDropdown(filtered.length > 0)
    } else {
      setShowDropdown(false)
    }
  }

  const handleItemSelect = (item: string) => {
    setSearchTerm(item)
    setShowDropdown(false)
  }

  return (
    <div ref={searchRef} className="relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
      <input
        type="text"
        placeholder="Search product or any order..."
        value={searchTerm}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => searchTerm.length > 0 && setShowDropdown(filteredItems.length > 0)}
        className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-96 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
          {filteredItems.map((item, index) => (
            <div
              key={index}
              onClick={() => handleItemSelect(item)}
              className="px-4 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
            >
              <div className="flex items-center">
                <Search size={16} className="text-gray-400 mr-2" />
                <span className="text-gray-700">{item}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default SearchBar 