const { createPublicClient, http } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');

// Define Akave Fuji chain
const akaveFuji = {
  id: 78963,
  name: "Akave Fuji",
  nativeCurrency: {
    decimals: 18,
    name: "AKAVE",
    symbol: "AKVF",
  },
  rpcUrls: {
    default: {
      http: ["https://node1-asia.ava.akave.ai/ext/bc/tLqcnkJkZ1DgyLyWmborZK9d7NmMj6YCzCFmf9d9oQEd2fHon/rpc"],
    },
  },
};

// Initialize client
const publicClient = createPublicClient({
  chain: akaveFuji,
  transport: http(),
});

//@note: This function highly depends on Akave Fuji's block time and transaction confirmation time.
//If the transaction is not confirmed in the first block, it will wait for 5 seconds and try again.
//If the transaction is not confirmed in the second block, it will return null.

//@TODO: Find a better way to get the related transaction hash.

async function getLatestTransaction(address, commandId) {
  try {
    // First attempt
    const blockNumber = await publicClient.getBlockNumber();
    console.log(`[${commandId}] 🔍 Checking block ${blockNumber} for transactions`);
    
    const block = await publicClient.getBlock({
      blockNumber,
      includeTransactions: true
    });

    let transactions = block.transactions.filter(tx => 
      tx.from?.toLowerCase() === address.toLowerCase()
    );

    if (transactions.length > 0) {
      const hash = transactions[transactions.length - 1].hash;
      console.log(`[${commandId}] ✅ Found transaction hash in first attempt: ${hash}`);
      return hash;
    }

    console.log(`[${commandId}] ⏳ No transaction found, waiting 5 seconds...`);
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Second attempt
    const newBlockNumber = await publicClient.getBlockNumber();
    console.log(`[${commandId}] 🔍 Checking block ${newBlockNumber} for transactions`);
    
    const newBlock = await publicClient.getBlock({
      blockNumber: newBlockNumber,
      includeTransactions: true
    });

    transactions = newBlock.transactions.filter(tx => 
      tx.from?.toLowerCase() === address.toLowerCase()
    );

    const hash = transactions[transactions.length - 1]?.hash;
    if (hash) {
      console.log(`[${commandId}] ✅ Found transaction hash in second attempt: ${hash}`);
    } else {
      console.log(`[${commandId}] ❌ No transaction found after retrying`);
    }

    return hash || null;

  } catch (error) {
    console.error(`[${commandId}] 🔴 Error getting latest transaction:`, error);
    return null;
  }
}

module.exports = {
  getLatestTransaction,
}; 