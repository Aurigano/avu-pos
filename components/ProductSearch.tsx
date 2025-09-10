'use client'

import { useState, useRef, useEffect } from 'react'
import { Search } from 'lucide-react'
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

interface ProductSearchProps {
  onItemSelect: (itemName: string) => void
  className?: string
}

const ProductSearch: React.FC<ProductSearchProps> = ({ onItemSelect, className = '' }) => {
  // POS Store
  const { getItemPrice } = usePOSStore()
  
  // Product search states
  const [productSearchTerm, setProductSearchTerm] = useState('')
  const [showProductDropdown, setShowProductDropdown] = useState(false)
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const productSearchRef = useRef<HTMLDivElement>(null)

  // Load products from database
  useEffect(() => {
    const loadProducts = async () => {
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
      } catch (error) {
        console.error('Error loading products for search:', error)
      }
    }
    
    loadProducts()
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (productSearchRef.current && !productSearchRef.current.contains(event.target as Node)) {
        setShowProductDropdown(false)
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

  const handleProductSelect = (product: Product) => {
    setProductSearchTerm('') // Clear the input after selection
    setShowProductDropdown(false)
    onItemSelect(product.item_name)
  }

  return (
    <div ref={productSearchRef} className={`relative w-full ${className}`}>
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
      <input
        id="productSearch"
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
                {/* {product.image ? (
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
                </div> */}
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-gray-700 font-medium truncate">{product.item_name}</span>
                  <span className="text-xs text-gray-500 truncate">
                    {product.item_group} • {(() => {
                      const priceResult = getItemPrice(product.item_code, product.item_code)
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
  )
}

export default ProductSearch 