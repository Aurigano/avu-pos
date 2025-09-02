# 🔐 POS Profile Permissions Guide

## Overview
The POS system now supports permission-based controls based on the user's POS Profile. Different users can have different capabilities based on their profile settings.

## 📋 Current Permissions

### 1. **Customer Discount Permission** (`enable_customer_discount`)
- **Source**: Real field from POSProfile document in database
- **Controls**: Whether user can modify discount amounts
- **UI Behavior**:
  - ✅ **Enabled**: Shows editable discount input field
  - ❌ **Disabled**: Shows grayed-out, disabled input with "Not Permitted" message

### 2. **Rate Change Permission** (`enable_rate_change`) 
- **Source**: ⚠️ **DUMMY FIELD** - Currently defaults to `true` 
- **TODO**: Replace with real field when backend adds it to POSProfile
- **Controls**: Whether user can modify item rates/prices in the billing table  
- **UI Behavior**:
  - ✅ **Enabled**: Rate column shows editable number inputs with "✏️ Editable" indicator
  - ❌ **Disabled**: Rate column shows read-only price display

## 🎯 How It Works

### Profile Loading & Storage
```javascript
// 1. Profile loads from database on app start
const targetPOSProfile = posProfiles.find(profile => 
  profile.erpnext_id === 'POS Profile 1'
)

// 2. Permissions extracted and saved to localStorage
const permissions = {
  enableCustomerDiscount: profile.enable_customer_discount,
  enableRateChange: profile.enable_rate_change ?? true,  // Dummy default
  // ... other permissions
}
```

### Permission Checking in UI
```javascript
// Discount input conditional rendering
{posPermissions?.enableCustomerDiscount ? (
  <input type="number" ... />  // Editable
) : (
  <input disabled placeholder="Not permitted" />  // Disabled
)}

// Rate input conditional rendering  
{enableRateChange ? (
  <input type="number" onChange={handleRateChange} />  // Editable
) : (
  <span>{item.price}</span>  // Read-only
)}
```

## 🧪 Testing the Permissions

### Test Scenario 1: Enable All Permissions
```json
// POSProfile document in database:
{
  "enable_customer_discount": true,
  "enable_rate_change": true  // TODO: Add this field to real profile
}
```
**Expected**: Both discount and rates are editable

### Test Scenario 2: Disable Discount Permission
```json
// POSProfile document:
{
  "enable_customer_discount": false,
  "enable_rate_change": true
}
```
**Expected**: Rates editable, discount disabled and grayed out

### Test Scenario 3: Disable Rate Changes (Future)
```json
// POSProfile document (when field is added):
{
  "enable_customer_discount": true,
  "enable_rate_change": false
}
```
**Expected**: Discount editable, rates read-only

## 🔮 Future Integration

### When Backend Adds `enable_rate_change`
1. **Remove dummy logic** from `/lib/pos-profile-manager.ts`:
   ```javascript
   // Remove this line:
   enableRateChange: currentPOSProfile.enable_rate_change ?? true,
   
   // Replace with:
   enableRateChange: currentPOSProfile.enable_rate_change,
   ```

2. **Remove UI indicator** from `/components/OrderItem.tsx`:
   ```javascript
   // Remove this section:
   {enableRateChange && (
     <div className="text-xs text-blue-500 mt-1">✏️ Editable</div>
   )}
   ```

3. **Update type definition** in `/types/pos-types.ts`:
   ```javascript
   // Change from optional to required:
   enable_rate_change: boolean  // Remove the `?`
   ```

## 🚀 Adding New Permissions

### Steps to Add New Permission:
1. **Add to POSProfile type**:
   ```typescript
   export interface POSProfile {
     // ... existing fields
     enable_new_feature?: boolean
   }
   ```

2. **Add to permissions manager**:
   ```javascript
   permissions: {
     // ... existing permissions
     enableNewFeature: currentPOSProfile.enable_new_feature ?? false,
   }
   ```

3. **Use in UI**:
   ```javascript
   {posPermissions?.enableNewFeature ? (
     <EnabledComponent />
   ) : (
     <DisabledComponent />
   )}
   ```

## 🏷️ Permission Categories

### Current Permissions:
- `enable_customer_discount` - Financial controls
- `enable_pos_offers` - Promotional controls  
- `allow_negative_stock` - Inventory controls
- `enable_rate_change` - Pricing controls (dummy)

### Future Permissions:
- `enable_refunds` - Return/refund operations
- `enable_void_transactions` - Cancel transactions
- `enable_cash_drawer` - Physical cash drawer access
- `enable_reports` - View sales reports
- `enable_user_management` - Manage other users

## 📱 Multi-User Scenarios

### Different User Types:
```javascript
// Cashier Profile
{
  "enable_customer_discount": false,
  "enable_rate_change": false,
  "enable_refunds": false
}

// Manager Profile  
{
  "enable_customer_discount": true,
  "enable_rate_change": true,
  "enable_refunds": true
}

// Admin Profile
{
  "enable_customer_discount": true,
  "enable_rate_change": true,
  "enable_refunds": true,
  "enable_user_management": true
}
```

## 🛡️ Security Notes

- ✅ Permissions checked both in UI and business logic
- ✅ Rate changes validate permissions before applying  
- ✅ localStorage persists permissions across sessions
- ✅ Graceful fallbacks when permissions not loaded
- ⚠️ **TODO**: Add server-side permission validation for API endpoints

---
**Status**: ✅ Discount permissions fully implemented | 🚧 Rate permissions implemented with dummy data 