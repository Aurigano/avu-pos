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
      <td className="py-3 px-4">
        <div className="flex items-center space-x-3">
          {item.image ? (
            <img 
              src={item.image} 
              alt={item.name}
              className="w-10 h-10 object-cover rounded"
              onError={(e) => {
                const target = e.currentTarget as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          ) : (
            <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center">
              <span className="text-xs text-gray-400">IMG</span>
            </div>
          )}
          <div>
            <div className="font-medium text-black">{item.name}</div>
            <div className="text-sm text-gray-600">({item.category})</div>
          </div>
        </div>
      </td>
      <td className="py-3 px-4 text-center font-medium text-black">
        ${item.price.toFixed(2)}
      </td>
      <td className="py-3 px-4 text-center">
        <div className="flex items-center justify-center space-x-2">
          <button
            onClick={handleQuantityDecrease}
            disabled={item.quantity <= 1}
            className={`p-1 rounded ${
              item.quantity <= 1
                ? 'text-gray-300 cursor-not-allowed'
                : 'text-black hover:text-gray-800 hover:bg-gray-100'
            }`}
          >
            <Minus size={16} />
          </button>
          <span className="font-medium min-w-[2rem] text-center text-black">{item.quantity}</span>
          <button
            onClick={handleQuantityIncrease}
            className="p-1 rounded text-black hover:text-gray-800 hover:bg-gray-100"
          >
            <Plus size={16} />
          </button>
        </div>
      </td>
      <td className="py-3 px-4 text-center font-medium text-black">
        ${item.subtotal.toFixed(2)}
      </td>
      <td className="py-3 px-4 text-center">
        <button
          onClick={() => onRemove(item.id)}
          className="text-red-500 hover:text-red-700 p-1"
        >
          <Trash2 size={16} />
        </button>
      </td>
    </tr>
  )
}

export default OrderItem 