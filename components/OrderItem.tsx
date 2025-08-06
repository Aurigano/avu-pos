'use client'

import { Trash2 } from 'lucide-react'

interface OrderItemProps {
  item: {
    id: string
    name: string
    category: string
    price: number
    quantity: number
    subtotal: number
  }
  onRemove: (id: string) => void
}

const OrderItem = ({ item, onRemove }: OrderItemProps) => {
  return (
    <tr className="border-b border-gray-100">
      <td className="py-3 px-4">
        <div>
          <div className="font-medium text-gray-900">{item.name}</div>
          <div className="text-sm text-gray-500">({item.category})</div>
        </div>
      </td>
      <td className="py-3 px-4 text-center font-medium">
        ${item.price.toFixed(2)}
      </td>
      <td className="py-3 px-4 text-center">
        {item.quantity}
      </td>
      <td className="py-3 px-4 text-center font-medium">
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