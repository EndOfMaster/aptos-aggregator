/// Utility functions for the aggregator
module aggregator::utils {
    use std::vector;
    use std::type_info::{Self, TypeInfo};
    use std::string::{Self, String};
    use aptos_framework::coin;

    /// Check if two types are the same
    public fun is_same_coin<CoinA, CoinB>(): bool {
        type_info::type_of<CoinA>() == type_info::type_of<CoinB>()
    }

    /// Get coin type name as string
    public fun get_coin_name<CoinType>(): vector<u8> {
        let type_name = type_info::type_name<CoinType>();
        *string::bytes(&type_name)
    }

    /// Check if coin is registered
    public fun is_coin_registered<CoinType>(account_addr: address): bool {
        coin::is_account_registered<CoinType>(account_addr)
    }

    /// Sort two coin types for consistent ordering
    public fun sort_coins<CoinA, CoinB>(): bool {
        let name_a = *string::bytes(&type_info::type_name<CoinA>());
        let name_b = *string::bytes(&type_info::type_name<CoinB>());
        
        compare_vectors(&name_a, &name_b)
    }

    /// Compare two byte vectors lexicographically
    /// Returns true if first vector is "less than" second vector
    fun compare_vectors(a: &vector<u8>, b: &vector<u8>): bool {
        let len_a = vector::length(a);
        let len_b = vector::length(b);
        let min_len = if (len_a < len_b) len_a else len_b;
        
        let i = 0;
        while (i < min_len) {
            let byte_a = *vector::borrow(a, i);
            let byte_b = *vector::borrow(b, i);
            
            if (byte_a < byte_b) return true;
            if (byte_a > byte_b) return false;
            
            i = i + 1;
        };
        
        // If all compared bytes are equal, shorter vector is "less"
        len_a < len_b
    }

    /// Convert basis points to percentage string (for display purposes)
    public fun bp_to_percentage(basis_points: u64): vector<u8> {
        // This is a simplified version - in practice you'd want better formatting
        let percentage = basis_points / 100;
        if (percentage == 0) {
            b"0.00%"
        } else if (percentage < 10) {
            b"0.0X%" // X would be replaced with actual digit
        } else {
            b"X.XX%" // Format would be more sophisticated
        }
    }

    #[test]
    fun test_compare_vectors() {
        let a = b"apple";
        let b = b"banana";
        assert!(compare_vectors(&a, &b), 0);
        assert!(!compare_vectors(&b, &a), 1);
        
        let c = b"app";
        assert!(compare_vectors(&c, &a), 2); // shorter is less
    }
}
