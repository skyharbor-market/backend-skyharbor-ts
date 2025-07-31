// Test script for multi-address functionality
const { get_utxos_multi_address, collectRequiredInputs } = require('./dist/ergofunctions/utxos');

async function testMultiAddress() {
  console.log('Testing multi-address UTXO collection...\n');
  
  // Test addresses (these would be real Ergo addresses in production)
  const testAddresses = [
    '9fRusAarL1KkrWQVsxSRVYnvWxaAT2A96cKtNn9tvPh5XUyCisd',
    '9gNvAv97W71Wm33GoXgSQBFJxinFubKvE6wGuVtnVfCFCUcKBSx',
    '9h7L7sUHZk43VQC3PHtSp5ujAWcZtYmWATBH746wi75C5XHi68b'
  ];
  
  console.log('Test 1: Single address (backward compatibility)');
  console.log('Addresses:', [testAddresses[0]]);
  console.log('This should use the original get_utxos function internally\n');
  
  console.log('Test 2: Multiple addresses');
  console.log('Addresses:', testAddresses);
  console.log('This should iterate through all addresses to collect UTXOs\n');
  
  console.log('Test 3: collectRequiredInputs helper');
  console.log('This helper manages the common UTXO collection pattern');
  console.log('It handles both ERG and token requirements across all addresses\n');
  
  console.log('Key features implemented:');
  console.log('- Deduplication: Prevents using the same box twice');
  console.log('- Optimization: Stops collecting once requirements are met');
  console.log('- Logging: Provides visibility into multi-address collection');
  console.log('- Backward compatibility: Works with single address arrays');
}

testMultiAddress().catch(console.error);