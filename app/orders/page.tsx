'use client'

import Sidebar from '../../components/Sidebar'

const OrdersPage = () => {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 p-6">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Invoices</h1>
          <p className="text-gray-600">This page will contain invoice management and order history.</p>
        </div>
      </div>
    </div>
  )
}

export default OrdersPage 