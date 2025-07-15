import { DexType } from './constants'
import { SwapStep, TransactionPayload } from './types'

export abstract class BaseDexAdapter {
  abstract readonly dexType: DexType
  abstract readonly name: string
  abstract readonly feeRate: number

  abstract buildSwapPayload(
    step: SwapStep,
    minAmountOut: string,
    aggregatorAddress: string
  ): TransactionPayload

  abstract getQuote(
    coinIn: string,
    coinOut: string,
    amountIn: string
  ): Promise<string>
}

export class CetusAdapter extends BaseDexAdapter {
  readonly dexType = DexType.CETUS
  readonly name = 'Cetus'
  readonly feeRate = 30 // 0.3%

  buildSwapPayload(
    step: SwapStep,
    minAmountOut: string,
    aggregatorAddress: string
  ): TransactionPayload {
    return {
      type: 'entry_function_payload',
      function: `${aggregatorAddress}::cetus_adapter::swap_a_to_b`,
      arguments: [
        step.amountIn,
        minAmountOut,
      ],
      type_arguments: [step.coinIn, step.coinOut],
    }
  }

  async getQuote(
    coinIn: string,
    coinOut: string,
    amountIn: string
  ): Promise<string> {
    // TODO: Implement Cetus-specific quote logic
    // This would typically call the Cetus AMM view functions
    throw new Error('Not implemented')
  }
}

export class PancakeAdapter extends BaseDexAdapter {
  readonly dexType = DexType.PANCAKE
  readonly name = 'PancakeSwap'
  readonly feeRate = 25 // 0.25%

  buildSwapPayload(
    step: SwapStep,
    minAmountOut: string,
    aggregatorAddress: string
  ): TransactionPayload {
    return {
      type: 'entry_function_payload',
      function: `${aggregatorAddress}::pancake_adapter::swap`,
      arguments: [
        step.amountIn,
        minAmountOut,
      ],
      type_arguments: [step.coinIn, step.coinOut],
    }
  }

  async getQuote(
    coinIn: string,
    coinOut: string,
    amountIn: string
  ): Promise<string> {
    // TODO: Implement PancakeSwap-specific quote logic
    throw new Error('Not implemented')
  }
}

export class LiquidSwapAdapter extends BaseDexAdapter {
  readonly dexType = DexType.LIQUIDSWAP
  readonly name = 'LiquidSwap'
  readonly feeRate = 30 // 0.3%

  buildSwapPayload(
    step: SwapStep,
    minAmountOut: string,
    aggregatorAddress: string
  ): TransactionPayload {
    return {
      type: 'entry_function_payload',
      function: `${aggregatorAddress}::liquidswap_adapter::swap`,
      arguments: [
        step.amountIn,
        minAmountOut,
      ],
      type_arguments: [step.coinIn, step.coinOut],
    }
  }

  async getQuote(
    coinIn: string,
    coinOut: string,
    amountIn: string
  ): Promise<string> {
    // TODO: Implement LiquidSwap-specific quote logic
    throw new Error('Not implemented')
  }
}

// DEX adapter registry
export class DexAdapterRegistry {
  private adapters: Map<DexType, BaseDexAdapter> = new Map()

  constructor() {
    this.registerAdapter(new CetusAdapter())
    this.registerAdapter(new PancakeAdapter())
    this.registerAdapter(new LiquidSwapAdapter())
  }

  registerAdapter(adapter: BaseDexAdapter) {
    this.adapters.set(adapter.dexType, adapter)
  }

  getAdapter(dexType: DexType): BaseDexAdapter | undefined {
    return this.adapters.get(dexType)
  }

  getAllAdapters(): BaseDexAdapter[] {
    return Array.from(this.adapters.values())
  }

  getEnabledAdapters(): BaseDexAdapter[] {
    // For now, return all adapters
    // In the future, this could check enabled status from configuration
    return this.getAllAdapters()
  }
}
