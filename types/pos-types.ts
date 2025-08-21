export interface POSProfile {
  _id: string
  _rev?: string
  type: "POSProfile"
  erpnext_id: string
  name: string
  company_id: string
  currency: string
  default_warehouse_id: string
  price_list_id: string
  enable_customer_discount: boolean
  enable_pos_offers: boolean
  payment_methods: Array<{
    mode_of_payment_id: string
    default: boolean
    allow_returns: boolean
  }>
  allow_negative_stock: boolean
  creation_date: string
  modified_date: string
  SchemaVersion: string
  CreatedBy: string
  AuditLogId: string
}

export interface ItemPriceList {
  _id: string
  _rev?: string
  type: "ItemPriceList"
  erpnext_id: string
  name: string
  priceList: string
  item: string
  Uom: string
  Rate: number
  Valid_From: string
  Valid_To: string
  SchemaVersion: string
  CreatedBy: string
  AuditLogId: string
}

export interface ItemWithPrice {
  item_id: string
  item_name: string
  price: number
  uom: string
  valid_from?: string
  valid_to?: string
  is_valid: boolean
}

export interface PricingValidationResult {
  isValid: boolean
  price: number
  message?: string
} 