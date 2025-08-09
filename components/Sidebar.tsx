'use client'

import { ShoppingCart, Receipt } from 'lucide-react'
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
      icon: Receipt,
      href: '/invoices',
      active: pathname === '/invoices'
    }
  ]

  return (
    <div className="w-20 bg-white border-r border-gray-200 flex flex-col">
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
  )
}

export default Sidebar 