#[test_only]
module aggregator::test_router {
    use aggregator::router;
    use std::signer;
    use aptos_framework::coin::{Self, Coin};
    use aptos_framework::account;
    use aptos_framework::aptos_coin::AptosCoin;

    // Mock coin types for testing
    struct MockCoinA {}
    struct MockCoinB {}

    #[test(admin = @aggregator)]
    fun test_initialize_router(admin: &signer) {
        // Initialize the router
        router::initialize(admin, 30, @0x123); // 0.3% fee, collector at 0x123
        
        // Check configuration
        let (admin_addr, fee_rate, fee_collector, paused) = router::get_config();
        assert!(admin_addr == signer::address_of(admin), 0);
        assert!(fee_rate == 30, 1);
        assert!(fee_collector == @0x123, 2);
        assert!(!paused, 3);
    }

    #[test(admin = @aggregator)]
    fun test_admin_functions(admin: &signer) {
        // Initialize first
        router::initialize(admin, 30, @0x123);
        
        // Test setting fee rate
        router::set_fee_rate(admin, 50);
        let (_, fee_rate, _, _) = router::get_config();
        assert!(fee_rate == 50, 0);
        
        // Test updating fee collector
        router::update_fee_collector(admin, @0x456);
        let (_, _, fee_collector, _) = router::get_config();
        assert!(fee_collector == @0x456, 1);
        
        // Test pause/unpause
        router::set_pause_status(admin, true);
        let (_, _, _, paused) = router::get_config();
        assert!(paused, 2);
        
        router::set_pause_status(admin, false);
        let (_, _, _, paused) = router::get_config();
        assert!(!paused, 3);
    }

    #[test(admin = @aggregator, user = @0x789)]
    #[expected_failure(abort_code = 0x103ed, location = aggregator::router)] // EZERO_AMOUNT
    fun test_swap_not_implemented(admin: &signer, user: &signer) {
        // Initialize router
        router::initialize(admin, 30, @0x123);
        
        // This should fail because coin_in has value 0
        let coin_in = coin::zero<MockCoinA>();
        let coin_out = router::swap_exact_input<MockCoinA, MockCoinB>(
            user,
            1, // DEX_CETUS
            coin_in,
            90, // min_amount_out
            @0x111 // pool_address
        );
        
        // This line should never be reached due to the abort above
        coin::destroy_zero(coin_out);
    }
}
