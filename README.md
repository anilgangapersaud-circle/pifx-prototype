# EIP712 Node.js Project

A Node.js application with Express.js framework and ethers.js for Ethereum interactions.

## Features

- Express.js web server
- JSON API endpoints
- Health check endpoint
- Environment variable support
- **Ethers.js integration** for Ethereum blockchain interactions
- EIP-712 typed data signing support

## Getting Started

### Prerequisites

- Node.js (version 14 or higher)
- npm

### Installation

1. Clone the repository or navigate to the project directory
2. Install dependencies:
   ```bash
   npm install
   ```

### Running the Application

Start the development server:
```bash
npm start
```

Or run directly with Node:
```bash
node index.js
```

The application will be available at `http://localhost:3000`

### Available Endpoints

### Ethereum Endpoints
- `GET /` - Welcome message
- `GET /health` - Health check endpoint
- `POST /ethereum/wallet` - Create a new Ethereum wallet
- `POST /ethereum/sign-typed-data` - Sign EIP-712 typed data
- `POST /ethereum/execute-contract` - Execute smart contract with EIP-712 signature
- `POST /ethereum/prepare-record-transaction` - Prepare transaction data for MetaMask
- `POST /ethereum/deploy-contract` - Deploy smart contract
- `POST /ethereum/swap-tokens` - Execute token swap
- `POST /ethereum/prepare-swap-tokens` - Prepare swap transaction data
- `POST /ethereum/prepare-provide-funds` - Prepare funds transaction data
- `GET /ethereum/get-trades` - Get all stored trades
- `GET /ethereum/trade-count` - Get trade count
- `GET /ethereum/trades-by-hash` - Get trade by hash

### Circle Wallet Sets API Endpoints
- `POST /circle/wallet-sets` - Create a new wallet set
- `GET /circle/wallet-sets` - Get all wallet sets
- `GET /circle/wallet-sets/:walletSetId` - Get specific wallet set by ID

## Scripts

- `npm start` - Start the application
- `npm test` - Run tests (to be implemented)
- `npm run dev` - Start in development mode with nodemon

## Environment Variables

Create a `.env` file in the root directory with the following variables:

- `PORT` - Server port (default: 3000)
- `CIRCLE_API_KEY` - Circle API key for wallet operations (required for Circle endpoints)
- `CIRCLE_ENTITY_SECRET` - Circle entity secret for wallet set creation (required for Circle endpoints)
- `ETHEREUM_RPC_URL` - Ethereum RPC URL (default: http://localhost:8545)

See `config.example.env` for an example configuration file.

## Dependencies

- **express** - Web framework
- **ethers** - Ethereum library for interacting with the blockchain
- **@circle-fin/developer-controlled-wallets** - Circle Developer Controlled Wallets SDK
- **dotenv** - Environment variable loader

## Project Structure

```
eip712/
├── index.js          # Main application file
├── package.json      # Project configuration
├── README.md         # Project documentation
└── .gitignore        # Git ignore file
```

## Ethereum Features

This project includes ethers.js for:
- Creating and managing Ethereum wallets
- Signing EIP-712 typed data
- Interacting with smart contracts
- Sending transactions
- Reading blockchain data 