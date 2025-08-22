import { ItemPriceList, PricingValidationResult } from '../types/pos-types'

/**
 * Validates if a price is valid for the current date
 */
export function validatePriceDate(item: ItemPriceList, currentDate: Date = new Date()): boolean {
  const currentDateStr = currentDate.toISOString().split('T')[0] // Get YYYY-MM-DD format
  
  // Extract date part from Valid_From and Valid_To (they might have timezone info)
  const validFrom = item.Valid_From ? item.Valid_From.split('Z')[0].split('T')[0] : null
  const validTo = item.Valid_To ? item.Valid_To.split('Z')[0].split('T')[0] : null
  
  // Checkpoint 1: Commented console logs
  // console.log('Validating price date:', {
  //   item: item.item,
  //   currentDate: currentDateStr,
  //   validFrom,
  //   validTo
  // })
  
  // If both dates are empty, price is always valid
  if (!validFrom && !validTo) {
    // console.log('Both dates empty, price is valid')
    return true
  }
  
  // Check valid_from constraint
  if (validFrom && currentDateStr < validFrom) {
    // console.log('Current date is before valid_from, price invalid')
    return false
  }
  
  // Check valid_to constraint
  if (validTo && currentDateStr > validTo) {
    // console.log('Current date is after valid_to, price invalid')
    return false
  }
  
  // console.log('Price is valid for current date')
  return true
}

/**
 * Gets the best valid price for an item from multiple ItemPriceList docs
 * Prioritizes the most recent valid date if multiple valid prices exist
 */
export function getBestValidPrice(
  itemPrices: ItemPriceList[], 
  currentDate: Date = new Date()
): PricingValidationResult {
  // console.log('Getting best valid price for:', itemPrices.length, 'price entries')
  
  if (itemPrices.length === 0) {
    return { isValid: false, price: 0, message: 'No price entries found' }
  }
  
  // Filter to only valid prices
  const validPrices = itemPrices.filter(item => validatePriceDate(item, currentDate))
  
  if (validPrices.length === 0) {
    // console.log('No valid prices found')
    return { isValid: false, price: 0, message: 'No valid prices for current date' }
  }
  
  // If only one valid price, return it
  if (validPrices.length === 1) {
    // console.log('Single valid price found:', validPrices[0].Rate)
    return { isValid: true, price: validPrices[0].Rate }
  }
  
  // Multiple valid prices - find the one with the latest valid_from date
  // If valid_from is empty, treat it as oldest possible date for sorting
  const sortedPrices = validPrices.sort((a, b) => {
    const dateA = a.Valid_From || '1900-01-01'
    const dateB = b.Valid_From || '1900-01-01'
    
    // Sort descending to get latest first
    return dateB.localeCompare(dateA)
  })
  
  const bestPrice = sortedPrices[0]
  // console.log('Best valid price selected:', bestPrice.Rate, 'from', bestPrice.Valid_From || 'no date')
  
  return { 
    isValid: true, 
    price: bestPrice.Rate,
    message: `Price from ${bestPrice.Valid_From || 'default'}`
  }
}

/**
 * Filters ItemPriceList documents by matching price list
 */
export function filterItemsByPriceList(
  itemPrices: ItemPriceList[],
  priceListId: string
): ItemPriceList[] {
  // console.log('Filtering items by price list:', priceListId)
  const filtered = itemPrices.filter(item => item.priceList === priceListId)
  // console.log('Filtered', filtered.length, 'items from', itemPrices.length, 'total')
  return filtered
}

/**
 * Gets price for a specific item from price list
 */
export function getItemPriceFromList(
  itemId: string,
  itemPrices: ItemPriceList[],
  currentDate: Date = new Date()
): PricingValidationResult {
  // console.log('Getting price for item:', itemId)

  
  const itemPriceEntries = itemPrices.filter(price => price.ItemCode === itemId)
  
  if (itemPriceEntries.length === 0) {
    // console.log('No price entries found for item:', itemId)
    return { isValid: false, price: 0, message: 'Item not found in price list' }
  }
  
  return getBestValidPrice(itemPriceEntries, currentDate)
} 