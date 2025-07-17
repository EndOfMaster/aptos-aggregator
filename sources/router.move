/// Core aggregator module for routing trades across multiple DEXes on Aptos
module aggregator::router {
    use std::error;
    use std::signer;
    use std::vector;
    use std::type_info::{Self, TypeInfo};
    use aptos_framework::coin::{Self, Coin};
    use aptos_framework::event::{Self, EventHandle};
    use aptos_framework::account;
    use aptos_framework::timestamp;

    // Error codes
    const EINSUFFICIENT_OUTPUT_AMOUNT: u64 = 1001;
    const EEXCESSIVE_INPUT_AMOUNT: u64 = 1002;
    const EINVALID_PATH: u64 = 1003;
    const EUNSUPPORTED_DEX: u64 = 1004;
    const EZERO_AMOUNT: u64 = 1005;

    // DEX identifiers
    const DEX_CETUS: u8 = 1;
    const DEX_PANCAKE: u8 = 2;
    const DEX_LIQUIDSWAP: u8 = 3;
    const DEX_THALA: u8 = 4;

    /// Swap step in a multi-hop path
    struct SwapStep has copy, drop, store {
        dex_id: u8,
        coin_in: TypeInfo,
        coin_out: TypeInfo,
        pool_address: address,
    }

    /// Complete swap path
    struct SwapPath has copy, drop, store {
        steps: vector<SwapStep>,
        amount_in: u64,
        min_amount_out: u64,
    }

    /// Swap event
    #[event]
    struct SwapEvent has drop, store {
        user: address,
        path: SwapPath,
        amount_in: u64,
        amount_out: u64,
        timestamp: u64,
    }

    /// Global configuration for the aggregator
    struct AggregatorConfig has key {
        admin: address,
        fee_rate: u64, // in basis points (e.g., 30 = 0.3%)
        fee_collector: address,
        paused: bool,
    }

    /// Initialize the aggregator
    public entry fun initialize(admin: &signer, fee_rate: u64, fee_collector: address) {
        let admin_addr = signer::address_of(admin);
        
        move_to(admin, AggregatorConfig {
            admin: admin_addr,
            fee_rate,
            fee_collector,
            paused: false,
        });
    }

    /// Single DEX swap
    public fun swap_exact_input<CoinIn, CoinOut>(
        user: &signer,
        dex_id: u8,
        coin_in: Coin<CoinIn>,
        min_amount_out: u64,
        pool_address: address,
    ): Coin<CoinOut> acquires AggregatorConfig {
        let config = borrow_global<AggregatorConfig>(@aggregator);
        assert!(!config.paused, error::permission_denied(0));

        let amount_in = coin::value(&coin_in);
        assert!(amount_in > 0, error::invalid_argument(EZERO_AMOUNT));

        let coin_out = if (dex_id == DEX_CETUS) {
            swap_via_cetus<CoinIn, CoinOut>(coin_in, pool_address)
        } else {
            abort error::invalid_argument(EUNSUPPORTED_DEX)
        };

        let amount_out = coin::value(&coin_out);
        assert!(amount_out >= min_amount_out, error::invalid_argument(EINSUFFICIENT_OUTPUT_AMOUNT));

        // Emit swap event
        let swap_step = SwapStep {
            dex_id,
            coin_in: type_info::type_of<CoinIn>(),
            coin_out: type_info::type_of<CoinOut>(),
            pool_address,
        };

        let path = SwapPath {
            steps: vector::singleton(swap_step),
            amount_in,
            min_amount_out,
        };

        event::emit(SwapEvent {
            user: signer::address_of(user),
            path,
            amount_in,
            amount_out,
            timestamp: timestamp::now_seconds(),
        });

        coin_out
    }

    /// Multi-hop swap through multiple DEXes
    public fun swap_exact_input_multihop<CoinIn, CoinOut>(
        user: &signer,
        steps: vector<SwapStep>,
        coin_in: Coin<CoinIn>,
        min_amount_out: u64,
    ): Coin<CoinOut> acquires AggregatorConfig {
        let config = borrow_global<AggregatorConfig>(@aggregator);
        assert!(!config.paused, error::permission_denied(0));

        assert!(!vector::is_empty(&steps), error::invalid_argument(EINVALID_PATH));
        
        let amount_in = coin::value(&coin_in);
        assert!(amount_in > 0, error::invalid_argument(EZERO_AMOUNT));

        // TODO: Implement multi-hop logic
        // This would require dynamic type handling or pre-defined paths
        abort error::unavailable(0)
    }

    /// Swap via Cetus AMM
    fun swap_via_cetus<CoinIn, CoinOut>(
        coin_in: Coin<CoinIn>,
        pool_address: address,
    ): Coin<CoinOut> {
        // TODO: Integrate with Cetus AMM Aptos version
        // This should call the appropriate Cetus AMM functions
        abort error::unavailable(0)
    }

    /// Admin functions
    public entry fun set_fee_rate(admin: &signer, new_fee_rate: u64) acquires AggregatorConfig {
        let config = borrow_global_mut<AggregatorConfig>(@aggregator);
        assert!(signer::address_of(admin) == config.admin, error::permission_denied(0));
        config.fee_rate = new_fee_rate;
    }

    public entry fun set_pause_status(admin: &signer, paused: bool) acquires AggregatorConfig {
        let config = borrow_global_mut<AggregatorConfig>(@aggregator);
        assert!(signer::address_of(admin) == config.admin, error::permission_denied(0));
        config.paused = paused;
    }

    public entry fun update_fee_collector(admin: &signer, new_collector: address) acquires AggregatorConfig {
        let config = borrow_global_mut<AggregatorConfig>(@aggregator);
        assert!(signer::address_of(admin) == config.admin, error::permission_denied(0));
        config.fee_collector = new_collector;
    }

    // View functions
    #[view]
    public fun get_config(): (address, u64, address, bool) acquires AggregatorConfig {
        let config = borrow_global<AggregatorConfig>(@aggregator);
        (config.admin, config.fee_rate, config.fee_collector, config.paused)
    }
}
