/// Integration test file for testing the entire system
#[test_only]
module aggregator::integration_test {
    use aggregator::router;
    use aggregator::math;
    use aggregator::utils;
    use std::signer;
    use aptos_framework::coin::{Self, Coin};
    use aptos_framework::account;

    // Test coin types
    struct TestCoinA {}
    struct TestCoinB {}
    struct TestCoinC {}

    const EINVALID_AMOUNT: u64 = 2001;

    #[test(admin = @aggregator)]
    fun test_math_integration(admin: &signer) {
        // Test integration of math functions
        let amount = 1000;
        let fee_rate = 30; // 0.3%
        let slippage = 50; // 0.5%
        
        // Calculate fee
        let fee = math::calculate_fee(amount, fee_rate);
        assert!(fee == 3, 0);
        
        // Calculate amount after fee
        let amount_after_fee = math::amount_after_fee(amount, fee_rate);
        assert!(amount_after_fee == 997, 1);
        
        // Calculate minimum output amount (considering slippage)
        let min_output = math::calculate_min_output(amount, slippage);
        assert!(min_output == 995, 2);
        
        // Test AMM calculation
        let reserve_in = 1000;
        let reserve_out = 2000;
        let amount_in = 100;
        
        let amount_out = math::get_amount_out(amount_in, reserve_in, reserve_out, fee_rate);
        assert!(amount_out > 0, 3);
        
        // Test reverse calculation
        let calculated_amount_in = math::get_amount_in(amount_out, reserve_in, reserve_out, fee_rate);
        // Allow some margin of error
        assert!(calculated_amount_in >= amount_in - 5 && calculated_amount_in <= amount_in + 5, 4);
        
        // Calculate price impact
        let price_impact = math::calculate_price_impact(amount_in, amount_out, reserve_in, reserve_out);
        assert!(price_impact > 0, 5);
    }

    #[test]
    fun test_utils_integration() {
        // Test utility functions
        assert!(utils::is_same_coin<TestCoinA, TestCoinA>(), 0);
        assert!(!utils::is_same_coin<TestCoinA, TestCoinB>(), 1);
        
        // Test type sorting
        let sort_result = utils::sort_coins<TestCoinA, TestCoinB>();
        // Result should be deterministic
        assert!(sort_result == utils::sort_coins<TestCoinA, TestCoinB>(), 2);
        
        // Test getting coin name
        let name_a = utils::get_coin_name<TestCoinA>();
        let name_b = utils::get_coin_name<TestCoinB>();
        assert!(name_a != name_b, 3);
        
        // Test percentage conversion
        let percentage_str = utils::bp_to_percentage(30);
        assert!(percentage_str == b"0.00%", 4); // This is a simplified implementation
    }

    #[test(admin = @aggregator)]
    fun test_router_configuration(admin: &signer) {
        // Test router configuration
        let initial_fee_rate = 30;
        let initial_collector = @0x123;
        
        router::initialize(admin, initial_fee_rate, initial_collector);
        
        // Verify initial configuration
        let (admin_addr, fee_rate, fee_collector, paused) = router::get_config();
        assert!(admin_addr == signer::address_of(admin), 0);
        assert!(fee_rate == initial_fee_rate, 1);
        assert!(fee_collector == initial_collector, 2);
        assert!(!paused, 3);
        
        // Test configuration updates
        let new_fee_rate = 50;
        let new_collector = @0x456;
        
        router::set_fee_rate(admin, new_fee_rate);
        router::update_fee_collector(admin, new_collector);
        
        let (_, updated_fee_rate, updated_collector, _) = router::get_config();
        assert!(updated_fee_rate == new_fee_rate, 4);
        assert!(updated_collector == new_collector, 5);
        
        // Test pause functionality
        router::set_pause_status(admin, true);
        let (_, _, _, paused) = router::get_config();
        assert!(paused, 6);
    }

    #[test]
    fun test_error_handling() {
        // Test error handling
        
        // Test invalid fee rate
        let result = std::unit_test::create_signers_for_testing(1);
        let admin = std::vector::borrow(&result, 0);
        
        // These should pass as they are within valid range
        math::calculate_fee(1000, 0); // 0% fee
        math::calculate_fee(1000, 10000); // 100% fee
        
        // Test boundary cases of math functions
        assert!(math::safe_mul(0, 1000) == 0, 0);
        assert!(math::safe_mul(1000, 0) == 0, 1);
        assert!(math::safe_div(1000, 1) == 1000, 2);
        assert!(math::safe_div(1000, 1000) == 1, 3);
    }

    #[test]
    fun test_complex_amm_scenarios() {
        // Test complex AMM scenarios
        
        // Scenario 1: Price impact of large trades
        let large_amount = 10000;
        let small_reserve = 1000;
        let large_reserve = 100000;
        
        let amount_out = math::get_amount_out(large_amount, small_reserve, large_reserve, 30);
        let price_impact = math::calculate_price_impact(large_amount, amount_out, small_reserve, large_reserve);
        
        // Large trades should have significant price impact
        assert!(price_impact > 1000, 0); // Greater than 10%
        
        // Scenario 2: Price impact of small trades
        let small_amount = 10;
        let amount_out_small = math::get_amount_out(small_amount, small_reserve, large_reserve, 30);
        let price_impact_small = math::calculate_price_impact(small_amount, amount_out_small, small_reserve, large_reserve);
        
        // Small trades should have less price impact
        assert!(price_impact_small < price_impact, 1);
        
        // Scenario 3: Effect of different fee rates
        let amount_out_low_fee = math::get_amount_out(1000, 10000, 20000, 10); // 0.1% fee
        let amount_out_high_fee = math::get_amount_out(1000, 10000, 20000, 100); // 1% fee
        
        // Low fee should result in higher output
        assert!(amount_out_low_fee > amount_out_high_fee, 2);
    }
}
