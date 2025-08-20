# AVU POS System

A modern Point of Sale (POS) system built with Next.js 14, TypeScript, and Tailwind CSS.

## Features

- **Order Management**: Create and manage customer orders with an intuitive interface
- **Dynamic Pricing**: Real-time calculation of subtotals, tips, service charges, and totals
- **Payment Processing**: Support for cash, card, and voucher payments
- **Table Management**: Track orders by table number and guest count
- **Invoice System**: Order history and invoice management (placeholder)
- **Responsive Design**: Modern UI with clean, professional styling

## Technologies Used

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide React** - Beautiful icons
- **PouchDB** - Local database (configured for future use)

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd avu-pos
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

### Order Page Features

- **Search**: Search for products or orders using the search bar
- **Order Details**: View order number, table, time, and guest count
- **Item Management**: Add/remove items from orders with real-time pricing
- **Tip Selection**: Choose from preset tip amounts (5, 10, 15, 20)
- **Payment Methods**: Select between Cash, Card, or Voucher
- **Cash Received**: Input cash amount received from customer
- **Order Summary**: View subtotal, tips, service charge (10%), and total
- **Submit**: Process the order (replaces "Pay Now" button as requested)

### Navigation

- **HOME**: Main order management page
- **ORDERS**: Invoice and order history (placeholder)

## Project Structure

```
avu-pos/
├── app/
│   ├── globals.css          # Global styles and Tailwind
│   ├── layout.tsx           # Root layout
│   ├── page.tsx             # Home page (redirects to /order)
│   ├── order/
│   │   └── page.tsx         # Main order page
│   └── orders/
│       └── page.tsx         # Orders/invoices page
├── components/
│   ├── Sidebar.tsx          # Navigation sidebar
│   └── OrderItem.tsx        # Individual order item component
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── next.config.js
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Customization

The design closely matches the provided mockup with:
- Clean, modern interface
- Proper color scheme and spacing
- Responsive layout
- Professional typography
- Intuitive user interactions

## Future Enhancements

- Database integration with PouchDB
- User authentication
- Inventory management
- Reporting and analytics
- Receipt printing
- Multi-location support