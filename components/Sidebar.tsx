'use client'

import { ShoppingCart, FileText } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const Sidebar = () => {
  const pathname = usePathname()

  const menuItems = [
    {
      name: 'ORDERS',
      icon: ShoppingCart,
      href: '/order',
      active: pathname === '/order'
    },
    {
      name: 'INVOICES',
      icon: FileText,
      href: '/invoices',
      active: pathname === '/invoices'
    }
  ]

  return (
    <>
      {/* Mobile Top Navigation */}
      <div className="lg:hidden w-full bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <h1 className="text-xl font-bold text-gray-800">POS</h1>
          
          {/* Navigation Items */}
          <div className="flex items-center space-x-1">
            {menuItems.map((item) => {
              const Icon = item.icon
              return (
                <Link key={item.name} href={item.href}>
                  <div className={`flex items-center space-x-1 px-3 py-2 rounded-lg transition-all ${
                    item.active 
                      ? 'bg-blue-500 text-white shadow-md' 
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}>
                    <Icon size={18} />
                    <span className="text-sm font-medium">{item.name}</span>
                  </div>
                </Link>
              )
            })}
          </div>
          
          {/* Version */}
          <div className="text-xs text-gray-400">V 1.0</div>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex w-20 bg-white border-r border-gray-200 flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-800">POS</h1>
        </div>
        
        <div className="flex-1 flex flex-col">
          {menuItems.map((item) => {
            const Icon = item.icon
            return (
              <Link key={item.name} href={item.href}>
                <div className={`sidebar-item ${item.active ? 'active' : ''}`}>
                  <Icon size={24} />
                  <span className="text-xs mt-1 font-medium">{item.name}</span>
                </div>
              </Link>
            )
          })}
        </div>
        
        <div className="p-4 text-xs text-gray-400">
          V 1.0
        </div>
      </div>
    </>
  )
}

export default Sidebar 