// Aptos Networks
export enum AptosNetwork {
  MAINNET = 'mainnet',
  TESTNET = 'testnet',
  DEVNET = 'devnet',
  LOCAL = 'local'
}

// Network configurations
export const NETWORK_CONFIG = {
  [AptosNetwork.MAINNET]: {
    nodeUrl: 'https://fullnode.mainnet.aptoslabs.com/v1',
    faucetUrl: undefined,
  },
  [AptosNetwork.TESTNET]: {
    nodeUrl: 'https://fullnode.testnet.aptoslabs.com/v1',
    faucetUrl: 'https://faucet.testnet.aptoslabs.com',
  },
  [AptosNetwork.DEVNET]: {
    nodeUrl: 'https://fullnode.devnet.aptoslabs.com/v1',
    faucetUrl: 'https://faucet.devnet.aptoslabs.com',
  },
  [AptosNetwork.LOCAL]: {
    nodeUrl: 'http://localhost:8080/v1',
    faucetUrl: 'http://localhost:8081',
  }
}

// DEX identifiers
export enum DexType {
  CETUS = 'CETUS',
  PANCAKE = 'PANCAKE',
  LIQUIDSWAP = 'LIQUIDSWAP',
  THALA = 'THALA',
  AUXEXCHANGE = 'AUXEXCHANGE',
  HIPPO = 'HIPPO'
}

// DEX IDs (match the ones in Move contracts)
export const DEX_IDS = {
  [DexType.CETUS]: 1,
  [DexType.PANCAKE]: 2,
  [DexType.LIQUIDSWAP]: 3,
  [DexType.THALA]: 4,
  [DexType.AUXEXCHANGE]: 5,
  [DexType.HIPPO]: 6,
} as const

// Common coin types on Aptos
export const APTOS_COINS = {
  APT: '0x1::aptos_coin::AptosCoin',
  USDC: '0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDC',
  USDT: '0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDT',
  WETH: '0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::WETH',
  WBTC: '0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::WBTC',
  DAI: '0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::DAI',
} as const

// Default slippage tolerance (0.5% = 50 basis points)
export const DEFAULT_SLIPPAGE_TOLERANCE = 50

// Default fee rate (0.3% = 30 basis points)
export const DEFAULT_FEE_RATE = 30

// Max slippage tolerance (10% = 1000 basis points)
export const MAX_SLIPPAGE_TOLERANCE = 1000

// Basis points denominator
export const BASIS_POINTS = 10000

// Default API endpoint for routing
export const DEFAULT_API_ENDPOINT = 'https://api.cetus.zone/aptos/router/v1'

// Timeout for API requests (in milliseconds)
export const API_TIMEOUT = 10000

// Maximum number of hops in a route
export const MAX_ROUTE_HOPS = 3

// Minimum trade amount (to avoid dust trades)
export const MIN_TRADE_AMOUNT = 1000 // Adjust based on coin decimals
