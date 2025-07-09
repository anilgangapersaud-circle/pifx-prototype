// Load environment variables
require('dotenv').config();

const express = require('express');
const { ethers } = require('ethers');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Circle Developer Controlled Wallets client
const {
  initiateDeveloperControlledWalletsClient,
} = require('@circle-fin/developer-controlled-wallets')
const client = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET,
})

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Execute smart contract with EIP-712 signature
app.post('/ethereum/execute-contract', async (req, res) => {
  try {
    const {
      from,
      to,
      signature,
      contractAddress,
      rpcUrl = 'http://localhost:8545'
    } = req.body;

    if (!from || !to || !signature || !contractAddress) {
      return res.status(400).json({ error: 'Missing required parameters: from, to, signature, contractAddress' });
    }

    // Connect to provider and wallet
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    // Use a funded test wallet (Hardhat default account 0)
    const wallet = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider);

    // Contract ABI for the new signature
    const contractABI = [
      "function executeTrade(address from, address to, bytes signature) external"
    ];
    const contract = new ethers.Contract(contractAddress, contractABI, wallet);

    // Call the contract
    let tx;
    try {
      tx = await contract.executeTrade(
        from,
        to,
        signature
      );
    } catch (err) {
      console.error('Execute contract error:', err);
      return res.status(400).json({ error: 'Contract call failed', details: err.message });
    }

    // Wait for transaction to be mined
    let receipt;
    try {
      receipt = await tx.wait();
    } catch (err) {
      return res.status(500).json({ error: 'Transaction failed to be mined', details: err.message });
    }

    res.json({
      success: true,
      transactionHash: tx.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      message: 'Smart contract executed successfully'
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error during contract execution', message: error.message });
  }
});

// Prepare transaction data for MetaMask execution (backend handles ABI encoding)
app.post('/ethereum/prepare-record-transaction', async (req, res) => {
  try {
    const {
      senderAddress,
      receiverAddress,
      fromAmount,
      fromCurrency,
      toAmount,
      toCurrency,
      signature,
      contractAddress
    } = req.body;

      // Contract ABI for the recordTrade function
    const contractABI = [
      "function recordTrade(address senderAddress, address receiverAddress, uint256 fromAmount, string fromCurrency, uint256 toAmount, string toCurrency, bytes signature) external"
    ];

    // Create contract interface for ABI encoding
    const iface = new ethers.Interface(contractABI);

    // Encode the function call
    const transactionData = iface.encodeFunctionData("recordTrade", [
      senderAddress,
      receiverAddress,
      fromAmount,
      fromCurrency,
      toAmount,
      toCurrency,
      signature
    ]);

    res.json({
      success: true,
      transactionData: transactionData,
      message: 'Transaction Data prepared for MetaMask execution'
    });

  } catch (error) {
    console.error('Prepare Record Trade Transaction error:', error);
    res.status(500).json({ 
      error: 'Failed to prepare transaction data',
      message: error.message 
    });
  }
});

// Deploy smart contract
app.post('/ethereum/deploy-contract', async (req, res) => {
  try {
    const { rpcUrl = 'http://localhost:8545' } = req.body;

    // Create provider and wallet using the first Hardhat account
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider);

    // Contract ABI and bytecode - we'll need to load this from the compiled artifacts
    const fs = require('fs');
    const path = require('path');
    
    // Read the contract artifact
    const artifactPath = path.join(__dirname, 'artifacts/contracts/TradeContract.sol/TradeContract.json');
    
    if (!fs.existsSync(artifactPath)) {
      return res.status(500).json({ 
        error: 'Contract artifacts not found. Please run "npx hardhat compile" first.' 
      });
    }
    
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    const contractABI = artifact.abi;
    const contractBytecode = artifact.bytecode;

    // Create contract factory
    const contractFactory = new ethers.ContractFactory(contractABI, contractBytecode, wallet);
    
    // Deploy the contract
    const contract = await contractFactory.deploy();
    
    // Wait for deployment to complete
    await contract.waitForDeployment();
    
    // Get the deployed contract address
    const contractAddress = await contract.getAddress();
    
    res.json({
      success: true,
      contractAddress: contractAddress,
      deployer: wallet.address,
      transactionHash: contract.deploymentTransaction().hash,
      message: 'TradeContract deployed successfully'
    });
  } catch (error) {
    console.error('Deploy contract error:', error);
    res.status(500).json({ 
      error: 'Failed to deploy contract',
      message: error.message,
      details: error.stack 
    });
  }
});

// Execute token swap
app.post('/ethereum/swap-tokens', async (req, res) => {
  try {
    const {
      tradeHash,
      contractAddress,
      rpcUrl = 'http://localhost:8545'
    } = req.body;

    if (!tradeHash || !contractAddress) {
      return res.status(400).json({ 
        error: 'Missing required parameters: tradeHash, contractAddress' 
      });
    }

    // Validate trade hash format
    if (!tradeHash.startsWith('0x') || tradeHash.length !== 66) {
      return res.status(400).json({ 
        error: `Invalid trade hash format: ${tradeHash}. Must be a 32-byte hex string.` 
      });
    }

    // Validate contract address
    if (!ethers.isAddress(contractAddress)) {
      return res.status(400).json({ 
        error: `Invalid contract address format: ${contractAddress}` 
      });
    }

    // Connect to provider and wallet
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    // Use a funded test wallet (Hardhat default account 0)
    const wallet = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider);

    // Contract ABI for the swapTokens function
    const contractABI = [
      "function swapTokens(bytes32 tradeHash) external",
      "function getStoredTrade(bytes32 tradeHash) external view returns (tuple(address from, address to, uint256 fromAmount, string fromCurrency, uint256 toAmount, string toCurrency, uint256 timestamp, bool fromFunded, bool toFunded, bool executed, uint256 fromFundedAmount, uint256 toFundedAmount))",
      "function isTradeReady(bytes32 tradeHash) external view returns (bool)"
    ];
    const contract = new ethers.Contract(contractAddress, contractABI, wallet);

    // Get trade details first to validate
    const trade = await contract.getStoredTrade(tradeHash);
    
    if (trade.from === ethers.ZeroAddress) {
      return res.status(400).json({ 
        error: 'Trade does not exist' 
      });
    }

    if (trade.executed) {
      return res.status(400).json({ 
        error: 'Trade has already been executed' 
      });
    }

    // Check if both parties have provided funds
    if (!trade.fromFunded || !trade.toFunded) {
      return res.status(400).json({ 
        error: 'Both parties must provide funds before executing the swap',
        details: {
          fromFunded: trade.fromFunded,
          toFunded: trade.toFunded
        }
      });
    }

    // Call the swapTokens function
    let tx;
    try {
      tx = await contract.swapTokens(tradeHash);
    } catch (err) {
      console.error('Swap tokens error:', err);
      return res.status(400).json({ 
        error: 'Failed to execute token swap', 
        details: err.message 
      });
    }

    // Wait for transaction to be mined
    let receipt;
    try {
      receipt = await tx.wait();
    } catch (err) {
      return res.status(500).json({ 
        error: 'Transaction failed to be mined', 
        details: err.message 
      });
    }

    res.json({
      success: true,
      transactionHash: tx.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      tradeHash: tradeHash,
      from: trade.from,
      to: trade.to,
      fromAmount: trade.fromAmount.toString(),
      fromCurrency: trade.fromCurrency,
      toAmount: trade.toAmount.toString(),
      toCurrency: trade.toCurrency,
      executor: wallet.address,
      message: 'Token swap executed successfully'
    });

  } catch (error) {
    console.error('Swap tokens error:', error);
    res.status(500).json({ 
      error: 'Failed to execute token swap',
      message: error.message 
    });
  }
});

// Prepare transaction data for MetaMask execution of swapTokens
app.post('/ethereum/prepare-swap-tokens', async (req, res) => {
  try {
    const {
      tradeHash,
      contractAddress
    } = req.body;

    if (!tradeHash || !contractAddress) {
      return res.status(400).json({ 
        error: 'Missing required parameters: tradeHash, contractAddress' 
      });
    }

    // Validate trade hash format
    if (!tradeHash.startsWith('0x') || tradeHash.length !== 66) {
      return res.status(400).json({ 
        error: `Invalid trade hash format: ${tradeHash}. Must be a 32-byte hex string.` 
      });
    }

    // Validate contract address
    if (!ethers.isAddress(contractAddress)) {
      return res.status(400).json({ 
        error: `Invalid contract address format: ${contractAddress}` 
      });
    }

    // Contract ABI for the swapTokens function
    const contractABI = [
      "function swapTokens(bytes32 tradeHash) external",
      "function getStoredTrade(bytes32 tradeHash) external view returns (tuple(address from, address to, uint256 fromAmount, string fromCurrency, uint256 toAmount, string toCurrency, uint256 timestamp, bool fromFunded, bool toFunded, bool executed, uint256 fromFundedAmount, uint256 toFundedAmount))",
      "function isTradeReady(bytes32 tradeHash) external view returns (bool)"
    ];

    // Create contract interface for ABI encoding
    const iface = new ethers.Interface(contractABI);

    // Encode the function call
    const transactionData = iface.encodeFunctionData("swapTokens", [
      tradeHash
    ]);
    
    res.json({
      success: true,
      transactionData: transactionData,
      message: 'Transaction data prepared for MetaMask execution of swapTokens'
    });

  } catch (error) {
    console.error('Prepare swap tokens error:', error);
    res.status(500).json({ 
      error: 'Failed to prepare transaction data',
      message: error.message 
    });
  }
});

// Prepare transaction data for MetaMask execution of provideFunds
app.post('/ethereum/prepare-provide-funds', async (req, res) => {
  try {
    const {
      tradeHash,
      amount,
      currency,
      contractAddress
    } = req.body;

    if (!tradeHash || !amount || !currency || !contractAddress) {
      return res.status(400).json({ 
        error: 'Missing required parameters: tradeHash, amount, currency, contractAddress' 
      });
    }

    // Validate trade hash format (should be 32 bytes = 66 characters including 0x)
    if (!tradeHash.startsWith('0x') || tradeHash.length !== 66) {
      return res.status(400).json({ 
        error: `Invalid trade hash format: ${tradeHash}. Must be a 32-byte hex string (66 characters including 0x).` 
      });
    }

    // Contract ABI for the provideFunds function
    const contractABI = [
      "function provideFunds(bytes32 tradeHash, uint256 amount) external payable"
    ];

    // Create contract interface for ABI encoding
    const iface = new ethers.Interface(contractABI);

    // Convert ETH amount to wei for both the function parameter and transaction value
    const amountInWei = ethers.parseEther(amount.toString());

    // Encode the function call with amount in wei
    const transactionData = iface.encodeFunctionData("provideFunds", [
      tradeHash,
      amountInWei
    ]);

    // Convert ETH amount to wei for MetaMask display
    const valueInWei = ethers.parseEther(amount.toString());

    res.json({
      success: true,
      transactionData: transactionData,
      value: valueInWei.toString(),
      message: 'Transaction Data prepared for MetaMask execution'
    });

  } catch (error) {
    console.error('Prepare provide funds error:', error);
    res.status(500).json({ 
      error: 'Failed to prepare transaction data',
      message: error.message 
    });
  }
});

// Get all stored trades
app.get('/ethereum/get-trades', async (req, res) => {
  try {
    const { contractAddress } = req.query;

    if (!contractAddress) {
      return res.status(400).json({ 
        error: 'Missing required parameter: contractAddress' 
      });
    }

    // Contract ABI for the getAllStoredTrades function (no pagination)
    const contractABI = [
      "function getAllStoredTrades() external view returns (bytes32[] memory tradeHashesArray, tuple(address senderAddress, address receiverAddress, uint256 fromAmount, string fromCurrency, uint256 toAmount, string toCurrency, uint256 timestamp, bool fromFunded, bool toFunded, bool executed, uint256 fromFundedAmount, uint256 toFundedAmount)[] memory tradesArray)"
    ];

    // Create contract instance
    const provider = new ethers.JsonRpcProvider('http://localhost:8545');
    const contract = new ethers.Contract(contractAddress, contractABI, provider);

    // Call the contract function
    const [tradeHashes, trades] = await contract.getAllStoredTrades();

    // Format the response
    const formattedTrades = trades.map((trade, index) => ({
      tradeHash: tradeHashes[index],
      senderAddress: trade.senderAddress,
      receiverAddress: trade.receiverAddress,
      fromAmount: trade.fromAmount.toString(),
      fromCurrency: trade.fromCurrency,
      toAmount: trade.toAmount.toString(),
      toCurrency: trade.toCurrency,
      timestamp: trade.timestamp.toString(),
      fromFunded: trade.fromFunded,
      toFunded: trade.toFunded,
      executed: trade.executed,
      fromFundedAmount: ethers.formatEther(trade.fromFundedAmount),
      toFundedAmount: ethers.formatEther(trade.toFundedAmount),
      status: trade.executed ? 'executed' : 
              (trade.fromFunded && trade.toFunded) ? 'fully_funded' :
              (trade.fromFunded || trade.toFunded) ? 'partially_funded' : 'pending'
    }));

    res.json({
      success: true,
      trades: formattedTrades,
      message: 'Stored trades retrieved successfully'
    });

  } catch (error) {
    console.error('Get stored trades error:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve stored trades',
      message: error.message 
    });
  }
});

// Get trade count
app.get('/ethereum/trade-count', async (req, res) => {
  try {
    const { contractAddress } = req.query;

    if (!contractAddress) {
      return res.status(400).json({ 
        error: 'Missing required parameter: contractAddress' 
      });
    }

    // Validate contract address
    if (!ethers.isAddress(contractAddress)) {
      return res.status(400).json({ 
        error: `Invalid contract address format: ${contractAddress}` 
      });
    }

    // Contract ABI for the getTradeCount function
    const contractABI = [
      "function getTradeCount() external view returns (uint256)"
    ];

    // Create contract instance
    const provider = new ethers.JsonRpcProvider('http://localhost:8545');
    const contract = new ethers.Contract(contractAddress, contractABI, provider);

    // Call the contract function
    const count = await contract.getTradeCount();

    res.json({
      success: true,
      count: count.toString(),
      message: 'Trade count retrieved successfully'
    });

  } catch (error) {
    console.error('Get trade count error:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve trade count',
      message: error.message 
    });
  }
});

// Get trade by hash
app.get('/ethereum/trades-by-hash', async (req, res) => {
  try {
    const { contractAddress, tradeHash } = req.query;

    if (!contractAddress || !tradeHash) {
      return res.status(400).json({ 
        error: 'Missing required parameters: contractAddress, tradeHash' 
      });
    }

    // Validate contract address
    if (!ethers.isAddress(contractAddress)) {
      return res.status(400).json({ 
        error: `Invalid contract address format: ${contractAddress}` 
      });
    }

    // Validate trade hash format
    if (!tradeHash.startsWith('0x') || tradeHash.length !== 66) {
      return res.status(400).json({ 
        error: `Invalid trade hash format: ${tradeHash}. Must be a 32-byte hex string.` 
      });
    }

    // Contract ABI for the getStoredTrade function
    const contractABI = [
      "function getStoredTrade(bytes32 tradeHash) external view returns (tuple(address senderAddress, address receiverAddress, uint256 fromAmount, string fromCurrency, uint256 toAmount, string toCurrency, uint256 timestamp, bool fromFunded, bool toFunded, bool executed, uint256 fromFundedAmount, uint256 toFundedAmount))"
    ];

    // Create contract instance
    const provider = new ethers.JsonRpcProvider('http://localhost:8545');
    const contract = new ethers.Contract(contractAddress, contractABI, provider);

    // Call the contract function
    const trade = await contract.getStoredTrade(tradeHash);

    // Check if trade exists (senderAddress will be zero address if trade doesn't exist)
    if (trade.senderAddress === ethers.ZeroAddress) {
      return res.status(404).json({ 
        error: 'Trade not found',
        message: `No trade found with hash: ${tradeHash}`
      });
    }

    // Format the response
    const formattedTrade = {
      tradeHash: tradeHash,
      senderAddress: trade.senderAddress,
      receiverAddress: trade.receiverAddress,
      fromAmount: trade.fromAmount.toString(),
      fromCurrency: trade.fromCurrency,
      toAmount: trade.toAmount.toString(),
      toCurrency: trade.toCurrency,
      timestamp: trade.timestamp.toString(),
      fromFunded: trade.fromFunded,
      toFunded: trade.toFunded,
      executed: trade.executed,
      fromFundedAmount: ethers.formatEther(trade.fromFundedAmount),
      toFundedAmount: ethers.formatEther(trade.toFundedAmount),
      status: trade.executed ? 'executed' : 
              (trade.fromFunded && trade.toFunded) ? 'fully_funded' :
              (trade.fromFunded || trade.toFunded) ? 'partially_funded' : 'pending'
    };

    res.json({
      success: true,
      tradeHash: tradeHash,
      trade: formattedTrade,
      pagination: {
        offset: 0,
        limit: 1,
        totalCount: '1',
        hasMore: false
      },
      message: 'Trade found successfully'
    });

  } catch (error) {
    console.error('Get trade by hash error:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve trade by hash',
      message: error.message 
    });
  }
});

app.post('/circle/wallet-sets', async (req, res) => {
  try {
    const { name, description, userIds, blockchain = 'ETH-SEPOLIA' } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Missing required parameter: name' });
    }
    const walletSetPayload = {
      name: name,
      ...(description && { description }),
      ...(userIds && { userIds: userIds.split(',').map(id => id.trim()) })
    };

    const walletSetResponse = await client.createWalletSet(walletSetPayload);
    const walletSet = walletSetResponse.data?.walletSet;
    if (!walletSet || !walletSet.id) {
      return res.status(500).json({ error: 'Failed to create wallet set', details: walletSetResponse });
    }

    const walletsResponse = await client.createWallets({
      blockchains: [blockchain],
      count: 2,
      walletSetId: walletSet.id,
    });
    res.json({
      success: true,
      walletSet: walletSet,
      wallets: walletsResponse.data?.wallets || [],
      message: 'Wallet set and 2 wallets created successfully'
    });
  } catch (error) {
    console.error('Circle Wallet Sets API error:', error);
    res.status(500).json({
      error: 'Failed to create wallet set and wallets',
      message: error.message
    });
  }
});

app.get('/circle/wallets/:walletSetId', async (req, res) => {
  try {
    const { walletSetId } = req.params;
    
    if (!walletSetId) {
      return res.status(400).json({ 
        error: 'Missing required parameter: walletSetId' 
      });
    }

    const walletsResponse = await client.getWalletsWithBalances({
      walletSetId: walletSetId,
      blockchain: 'ETH-SEPOLIA'
    });

    // Add debugging information
    console.log('Wallets response:', JSON.stringify(walletsResponse.data, null, 2));

    res.json({
      success: true,
      wallets: walletsResponse.data?.wallets || [],
      message: 'Wallets with balances retrieved successfully'
    });
  } catch (error) {
    console.error('Get wallets error:', error);
    res.status(500).json({
      error: 'Failed to retrieve wallets',
      message: error.message
    });
  }
});

app.post('/circle/fund-wallet', async (req, res) => {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({ 
        error: 'Missing required parameter: address' 
      });
    }

    if (!ethers.isAddress(address)) {
      return res.status(400).json({ 
        error: 'Invalid Ethereum address format' 
      });
    }

    const fundResponse = await client.requestTestnetTokens({
      address: address,
      blockchain: 'ETH-SEPOLIA',
      usdc: true
    });

    res.json({
      success: true,
      data: fundResponse.data,
      message: `Successfully funded ${address} with USDC testnet tokens`
    });
  } catch (error) {
    console.error('Fund wallet error:', error);
    
    // Handle rate limiting specifically
    if (error.message && error.message.includes('rate limit')) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'You have been rate limited for funding. Please wait a few minutes before trying again.',
        details: 'Circle testnet faucet has rate limits to prevent abuse. Try again in 5-10 minutes.',
        retryAfter: 300 // 5 minutes
      });
    }
    
    res.status(500).json({
      error: 'Failed to fund wallet',
      message: error.message
    });
  }
});

// Get wallet by ID with balances
app.get('/circle/wallet/:walletId', async (req, res) => {
  try {
    const { walletId } = req.params;
    
    if (!walletId) {
      return res.status(400).json({ 
        error: 'Missing required parameter: walletId' 
      });
    }

    const walletResponse = await client.getWallet({
      id: walletId
    });

    let balances = [];
    try {
      const balanceResponse = await client.getWalletTokenBalance({
        id: walletId
      });
      balances = balanceResponse.data?.tokenBalances || [];
    } catch (balanceError) {
      console.log('Could not fetch balances for wallet:', walletId, balanceError.message);
      // Continue without balances if they can't be fetched
    }

    res.json({
      success: true,
      wallet: walletResponse.data?.wallet,
      balances: balances,
      message: 'Wallet information and balances retrieved successfully'
    });
  } catch (error) {
    console.error('Get wallet error:', error);
    res.status(500).json({
      error: 'Failed to retrieve wallet information',
      message: error.message
    });
  }
});



// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 