'use client'

import { useState } from 'react'
import { Calendar, CreditCard, DollarSign } from 'lucide-react'
import Sidebar from '../../components/Sidebar'
import OrderItem from '../../components/OrderItem'
import SearchBar from '../../components/SearchBar'

interface OrderItemType {
  id: string
  name: string
  category: string
  price: number
  quantity: number
  subtotal: number
}

const OrderPage = () => {
  const [orderItems, setOrderItems] = useState<OrderItemType[]>([
    {
      id: '1',
      name: 'CHICKEN WINGS',
      category: 'starter',
      price: 20.00,
      quantity: 1,
      subtotal: 20.00
    },
    {
      id: '2',
      name: 'SUMMER SALAD',
      category: 'starter',
      price: 10.00,
      quantity: 1,
      subtotal: 10.00
    },
    {
      id: '3',
      name: 'FRENCH FRIES',
      category: 'starter',
      price: 5.00,
      quantity: 1,
      subtotal: 5.00
    }
  ])

  const [cashReceived, setCashReceived] = useState<string>('45')
  const [selectedTip, setSelectedTip] = useState<number>(5)

  const subtotal = orderItems.reduce((sum, item) => sum + item.subtotal, 0)
  const tipAmount = selectedTip
  const serviceCharge = subtotal * 0.10 // 10% service charge
  const total = subtotal + tipAmount + serviceCharge

  const handleRemoveItem = (id: string) => {
    setOrderItems(orderItems.filter(item => item.id !== id))
  }

  const handleSubmit = () => {
    // Handle order submission
    console.log('Order submitted:', {
      items: orderItems,
      subtotal,
      tip: tipAmount,
      serviceCharge,
      total,
      cashReceived: parseFloat(cashReceived)
    })
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 flex">
        {/* Main Content */}
        <div className="flex-1 p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <SearchBar />
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-gray-600">
                <Calendar size={20} />
                <span>October 18th 2002, 10:00AM</span>
              </div>
            </div>
          </div>



          {/* Order Details */}
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <span className="text-black font-medium">ORDER #: 12564878</span>
                </div>
              </div>
            </div>

            {/* Order Items Table */}
            <div className="p-6">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">ITEM</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">PRICE</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">QTY</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">SUBTOTAL</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700"></th>
                  </tr>
                </thead>
                <tbody>
                  {orderItems.map((item) => (
                    <OrderItem
                      key={item.id}
                      item={item}
                      onRemove={handleRemoveItem}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center mt-6">
            <button className="bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-8 rounded-lg mr-4">
              CANCEL ORDER
            </button>
          </div>
        </div>

        {/* Right Panel */}
        <div className="w-80 bg-white border-l border-gray-200 p-6">
          {/* Total Payable Amount */}
          <div className="mb-6 text-center">
            <div className="text-lg font-semibold text-gray-700 mb-2">TOTAL PAYABLE AMOUNT</div>
            <div className="text-3xl font-bold text-orange-500">${total.toFixed(2)}</div>
          </div>

          {/* Tips Section */}
          <div className="mb-6">
            <div className="flex items-center mb-3">
              <DollarSign size={20} className="text-gray-600 mr-2" />
              <h3 className="font-semibold text-gray-700">TIPS</h3>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[5, 10, 15, 20].map((tip) => (
                <button
                  key={tip}
                  onClick={() => setSelectedTip(tip)}
                  className={`py-2 px-3 rounded text-sm font-medium ${
                    selectedTip === tip
                      ? 'bg-gray-800 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  ${tip}
                </button>
              ))}
            </div>
          </div>

          {/* Transaction Methods */}
          <div className="mb-6">
            <div className="flex items-center mb-3">
              <CreditCard size={20} className="text-gray-600 mr-2" />
              <h3 className="font-semibold text-gray-700">TRANSACTION METHOD</h3>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button className="bg-gray-800 text-white py-3 px-4 rounded text-sm font-medium">
                CASH
              </button>
              <button className="bg-gray-200 text-gray-700 py-3 px-4 rounded text-sm font-medium hover:bg-gray-300">
                CARD
              </button>
              <button className="bg-gray-200 text-gray-700 py-3 px-4 rounded text-sm font-medium hover:bg-gray-300">
                VOUCHER
              </button>
            </div>
          </div>

          {/* Cash Received */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">ADD CASH RECEIVED</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-lg font-bold">$</span>
              <input
                type="number"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                className="pl-8 pr-4 py-3 border border-gray-300 rounded w-full text-xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Order Summary */}
          <div className="space-y-3 mb-6">
            <div className="flex justify-between">
              <span>SUBTOTAL</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>TIPS</span>
              <span>${tipAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>SERVICE CHARGE 10%</span>
              <span>${serviceCharge.toFixed(2)}</span>
            </div>
            <div className="border-t pt-3">
              <div className="flex justify-between text-lg font-bold">
                <span>TOTAL</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-4 rounded-lg text-lg"
          >
            SUBMIT
          </button>
        </div>
      </div>
    </div>
  )
}

export default OrderPage 