import { Aptos, AptosConfig, Account, Ed25519PrivateKey } from '@aptos-labs/ts-sdk'
import { 
  SwapParams, 
  TransactionPayload, 
  SwapRoute, 
  QuoteParams, 
  QuoteResult,
  AggregatorError 
} from './types'
import { AptosRouter } from './router'
import { MathUtils } from './math'
import { AptosNetwork, NETWORK_CONFIG, DEFAULT_SLIPPAGE_TOLERANCE } from './constants'

export class AptosAggregatorClient {
  private aptos: Aptos
  private router: AptosRouter
  private aggregatorAddress: string

  constructor(
    network: AptosNetwork = AptosNetwork.TESTNET,
    aggregatorAddress: string,
    routerApiEndpoint?: string
  ) {
    const config = new AptosConfig({
      network: network as any,
      fullnode: NETWORK_CONFIG[network].nodeUrl,
      faucet: NETWORK_CONFIG[network].faucetUrl,
    })

    this.aptos = new Aptos(config)
    this.router = new AptosRouter(routerApiEndpoint)
    this.aggregatorAddress = aggregatorAddress
  }

  /**
   * Get quote for a swap
   */
  async getQuote(params: QuoteParams): Promise<QuoteResult> {
    // Validate input parameters
    if (!MathUtils.isValidCoinType(params.coinIn)) {
      throw new AggregatorError(`Invalid coin type: ${params.coinIn}`)
    }
    if (!MathUtils.isValidCoinType(params.coinOut)) {
      throw new AggregatorError(`Invalid coin type: ${params.coinOut}`)
    }

    try {
      return await this.router.getQuote(params)
    } catch (error) {
      // Fallback to local computation if API fails
      console.warn('API quote failed, trying local computation:', error)
      const localResult = await this.router.findOptimalRouteLocal(params)
      if (!localResult) {
        throw new AggregatorError('No route found')
      }
      return localResult
    }
  }

  /**
   * Build transaction payload for a swap
   */
  buildSwapTransaction(swapParams: SwapParams): TransactionPayload {
    const { route, slippageTolerance, deadline, recipient } = swapParams

    if (route.steps.length === 1) {
      // Single DEX swap
      const step = route.steps[0]
      return this.buildSingleSwapPayload(step, slippageTolerance, deadline, recipient)
    } else {
      // Multi-hop swap
      return this.buildMultiHopSwapPayload(route, slippageTolerance, deadline, recipient)
    }
  }

  /**
   * Execute a swap transaction
   */
  async executeSwap(
    account: Account,
    swapParams: SwapParams
  ): Promise<string> {
    const payload = this.buildSwapTransaction(swapParams)
    
    const transaction = await this.aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: payload,
    })

    const signedTransaction = await this.aptos.signAndSubmitTransaction({
      signer: account,
      transaction,
    })

    return signedTransaction.hash
  }

  /**
   * Simulate a swap transaction
   */
  async simulateSwap(
    account: Account,
    swapParams: SwapParams
  ): Promise<any> {
    const payload = this.buildSwapTransaction(swapParams)
    
    const transaction = await this.aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: payload,
    })

    return await this.aptos.transaction.simulate.simple({
      signerPublicKey: account.publicKey,
      transaction,
    })
  }

  /**
   * Get transaction status
   */
  async getTransactionStatus(txHash: string): Promise<any> {
    return await this.aptos.getTransactionByHash({ transactionHash: txHash })
  }

  /**
   * Get account balance for a coin
   */
  async getBalance(accountAddress: string, coinType: string): Promise<string> {
    try {
      const balance = await this.aptos.getAccountCoinAmount({
        accountAddress,
        coinType,
      })
      return balance.toString()
    } catch (error) {
      return '0'
    }
  }

  /**
   * Register coin if not already registered
   */
  async registerCoinIfNeeded(account: Account, coinType: string): Promise<string | null> {
    const isRegistered = await this.isCoinRegistered(account.accountAddress.toString(), coinType)
    
    if (!isRegistered) {
      const payload: TransactionPayload = {
        type: 'entry_function_payload',
        function: '0x1::managed_coin::register',
        arguments: [],
        type_arguments: [coinType],
      }

      const transaction = await this.aptos.transaction.build.simple({
        sender: account.accountAddress,
        data: payload,
      })

      const signedTransaction = await this.aptos.signAndSubmitTransaction({
        signer: account,
        transaction,
      })

      return signedTransaction.hash
    }

    return null
  }

  /**
   * Check if coin is registered for account
   */
  async isCoinRegistered(accountAddress: string, coinType: string): Promise<boolean> {
    try {
      await this.aptos.getAccountCoinAmount({
        accountAddress,
        coinType,
      })
      return true
    } catch (error) {
      return false
    }
  }

  private buildSingleSwapPayload(
    step: any,
    slippageTolerance: number,
    deadline?: number,
    recipient?: string
  ): TransactionPayload {
    const minAmountOut = MathUtils.calculateMinOutput(step.amountOut, slippageTolerance)
    const deadlineTimestamp = deadline ?? Math.floor(Date.now() / 1000) + 300 // 5 minutes default

    return {
      type: 'entry_function_payload',
      function: `${this.aggregatorAddress}::router::swap_exact_input`,
      arguments: [
        step.dexId.toString(),
        step.amountIn,
        minAmountOut.toString(),
        step.poolAddress,
      ],
      type_arguments: [step.coinIn, step.coinOut],
    }
  }

  private buildMultiHopSwapPayload(
    route: SwapRoute,
    slippageTolerance: number,
    deadline?: number,
    recipient?: string
  ): TransactionPayload {
    const minAmountOut = MathUtils.calculateMinOutput(route.amountOut, slippageTolerance)
    const deadlineTimestamp = deadline ?? Math.floor(Date.now() / 1000) + 300

    // Build swap steps for multi-hop
    const steps = route.steps.map(step => ({
      dex_id: step.dexId,
      coin_in: step.coinIn,
      coin_out: step.coinOut,
      pool_address: step.poolAddress,
    }))

    return {
      type: 'entry_function_payload',
      function: `${this.aggregatorAddress}::router::swap_exact_input_multihop`,
      arguments: [
        JSON.stringify(steps), // This would need to be serialized properly for Move
        route.amountIn,
        minAmountOut.toString(),
      ],
      type_arguments: [route.steps[0].coinIn, route.steps[route.steps.length - 1].coinOut],
    }
  }

  /**
   * Get aggregator configuration
   */
  async getAggregatorConfig(): Promise<any> {
    try {
      const config = await this.aptos.view({
        payload: {
          function: `${this.aggregatorAddress}::router::get_config`,
          arguments: [],
          typeArguments: [],
        },
      })
      return config[0]
    } catch (error) {
      throw new AggregatorError('Failed to get aggregator config')
    }
  }

  /**
   * Create account from private key
   */
  static createAccountFromPrivateKey(privateKeyHex: string): Account {
    const privateKey = new Ed25519PrivateKey(privateKeyHex)
    return Account.fromPrivateKey({ privateKey })
  }

  /**
   * Create random account (for testing)
   */
  static createRandomAccount(): Account {
    return Account.generate()
  }

  /**
   * Format amount for display
   */
  formatAmount(amount: string, decimals: number): string {
    return MathUtils.formatAmount(amount, decimals)
  }

  /**
   * Parse amount to raw units
   */
  parseAmount(amount: string, decimals: number): string {
    return MathUtils.parseAmount(amount, decimals)
  }
}
