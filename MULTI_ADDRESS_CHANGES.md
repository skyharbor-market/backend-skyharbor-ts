# Multi-Address Support Implementation

## Overview
Implemented seamless multi-address support for UTXO collection across all transaction types. The system now utilizes all addresses passed from browser wallets instead of just the first one.

## Changes Made

### 1. Core UTXO Functions (`src/ergofunctions/utxos.ts`)

#### New Function: `get_utxos_multi_address()`
- Accepts array of wallet addresses
- Iterates through addresses to collect UTXOs
- Prevents duplicate boxes using Set for boxId tracking
- Optimizes by stopping when requirements are met
- Provides detailed logging for debugging
- Falls back to single-address function for backward compatibility

#### New Helper: `collectRequiredInputs()`
- Centralizes the common UTXO collection pattern
- Manages both ERG and token requirements
- Returns success status and collected inputs
- Replaces repetitive code across transaction files

### 2. Transaction Updates

All transaction files now use multi-address collection:

- **`bulkList.ts`**: Validates all addresses, collects UTXOs from all
- **`buyNFT.ts`**: Buyer can use multiple addresses for payment
- **`refund.ts`**: Refunds can draw from multiple addresses
- **`relistNFT.ts`**: Relisting uses all available addresses

### 3. Key Features

1. **Backward Compatibility**: Single-address arrays work exactly as before
2. **Deduplication**: Prevents double-spending by tracking used boxIds
3. **Efficiency**: Stops collecting once requirements are satisfied
4. **Validation**: All addresses are validated before use
5. **Logging**: Comprehensive logging for debugging multi-address flows

## Usage

The API remains unchanged. Frontend continues to pass:
```typescript
{
  userAddresses: string[],  // Now all addresses are utilized
  // ... other parameters
}
```

## Benefits

1. **Better Liquidity**: Users can utilize funds across all their addresses
2. **Improved UX**: No need to consolidate UTXOs to a single address
3. **Flexibility**: Supports complex wallet configurations
4. **No Breaking Changes**: Existing integrations continue to work

## Testing

Run the test script to see the functionality:
```bash
node test-multi-address.js
```

## Future Enhancements

1. Add preference for which address receives change
2. Implement UTXO selection strategies (e.g., minimize fees)
3. Add metrics for multi-address usage
4. Consider parallel UTXO fetching for performance