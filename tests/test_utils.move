#[test_only]
module aggregator::test_utils {
    use aggregator::utils;
    use aptos_framework::coin::{Self, Coin};
    
    // Mock coin types for testing
    struct MockCoinA {}
    struct MockCoinB {}
    struct MockCoinC {}

    #[test]
    fun test_is_same_coin() {
        assert!(utils::is_same_coin<MockCoinA, MockCoinA>(), 0);
        assert!(!utils::is_same_coin<MockCoinA, MockCoinB>(), 1);
    }

    #[test] 
    fun test_sort_coins() {
        // This test assumes MockCoinA comes before MockCoinB lexicographically
        // The actual result depends on the full type names
        let a_before_b = utils::sort_coins<MockCoinA, MockCoinB>();
        let b_before_a = utils::sort_coins<MockCoinB, MockCoinA>();
        
        // One should be true, the other false (unless they're the same, which they're not)
        assert!(a_before_b != b_before_a, 0);
    }

    #[test]
    fun test_get_coin_name() {
        let name_a = utils::get_coin_name<MockCoinA>();
        let name_b = utils::get_coin_name<MockCoinB>();
        
        // Names should be different
        assert!(name_a != name_b, 0);
        
        // Names should be non-empty
        assert!(std::vector::length(&name_a) > 0, 1);
        assert!(std::vector::length(&name_b) > 0, 2);
    }

    #[test]
    fun test_bp_to_percentage() {
        let result = utils::bp_to_percentage(30); // 0.3%
        assert!(std::vector::length(&result) > 0, 0);
        
        let result = utils::bp_to_percentage(0); // 0%
        assert!(result == b"0.00%", 1);
    }
}
