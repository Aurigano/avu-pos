'use client'

import { Trash2, Plus, Minus } from 'lucide-react'

interface OrderItemProps {
  item: {
    id: string
    name: string
    category: string
    price: number
    quantity: number
    subtotal: number
    image?: string
  }
  onRemove: (id: string) => void
  onQuantityChange: (id: string, newQuantity: number) => void
}

const OrderItem = ({ item, onRemove, onQuantityChange }: OrderItemProps) => {
  const handleQuantityIncrease = () => {
    onQuantityChange(item.id, item.quantity + 1)
  }

  const handleQuantityDecrease = () => {
    if (item.quantity > 1) {
      onQuantityChange(item.id, item.quantity - 1)
    }
  }

  return (
    <tr className="border-b border-gray-100">
      <td className="py-2 lg:py-3 px-2 lg:px-4">
        <div className="flex items-center space-x-2 lg:space-x-3">
          {item.image ? (
            <img 
              src={item.image} 
              alt={item.name}
              className="w-8 h-8 lg:w-10 lg:h-10 object-cover rounded flex-shrink-0"
              onError={(e) => {
                const target = e.currentTarget as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          ) : (
            <div className="w-8 h-8 lg:w-10 lg:h-10 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
              <span className="text-xs text-gray-400">IMG</span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="font-medium text-black text-sm lg:text-base truncate">{item.name}</div>
            <div className="text-xs lg:text-sm text-gray-600 truncate">({item.category})</div>
          </div>
        </div>
      </td>
      <td className="py-2 lg:py-3 px-1 lg:px-4 text-center font-medium text-black text-sm lg:text-base">
        ${item.price.toFixed(2)}
      </td>
      <td className="py-2 lg:py-3 px-1 lg:px-4 text-center">
        <div className="flex items-center justify-center space-x-1 lg:space-x-2">
          <button
            onClick={handleQuantityDecrease}
            disabled={item.quantity <= 1}
            className={`p-1 rounded ${
              item.quantity <= 1
                ? 'text-gray-300 cursor-not-allowed'
                : 'text-black hover:text-gray-800 hover:bg-gray-100'
            }`}
          >
            <Minus size={14} className="lg:hidden" />
            <Minus size={16} className="hidden lg:block" />
          </button>
          <span className="font-medium min-w-[1.5rem] lg:min-w-[2rem] text-center text-black text-sm lg:text-base">{item.quantity}</span>
          <button
            onClick={handleQuantityIncrease}
            className="p-1 rounded text-black hover:text-gray-800 hover:bg-gray-100"
          >
            <Plus size={14} className="lg:hidden" />
            <Plus size={16} className="hidden lg:block" />
          </button>
        </div>
      </td>
      <td className="py-2 lg:py-3 px-1 lg:px-4 text-center font-medium text-black text-sm lg:text-base">
        ${item.subtotal.toFixed(2)}
      </td>
      <td className="py-2 lg:py-3 px-1 lg:px-4 text-center">
        <button
          onClick={() => onRemove(item.id)}
          className="text-red-500 hover:text-red-700 p-1"
        >
          <Trash2 size={14} className="lg:hidden" />
          <Trash2 size={16} className="hidden lg:block" />
        </button>
      </td>
    </tr>
  )
}

export default OrderItem 