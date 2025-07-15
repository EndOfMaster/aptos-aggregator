#[test_only]
module aggregator::test_math {
    use aggregator::math;
    use std::error;

    #[test]
    fun test_calculate_fee() {
        // Test 0.3% fee (30 basis points)
        let fee = math::calculate_fee(1000, 30);
        assert!(fee == 3, 0);

        // Test 1% fee (100 basis points)
        let fee = math::calculate_fee(1000, 100);
        assert!(fee == 10, 1);

        // Test 0% fee
        let fee = math::calculate_fee(1000, 0);
        assert!(fee == 0, 2);

        // Test with large amount
        let fee = math::calculate_fee(1000000, 50); // 0.5%
        assert!(fee == 5000, 3);
    }

    #[test]
    fun test_amount_after_fee() {
        let amount = math::amount_after_fee(1000, 30); // 0.3% fee
        assert!(amount == 997, 0);

        let amount = math::amount_after_fee(1000, 100); // 1% fee
        assert!(amount == 990, 1);

        let amount = math::amount_after_fee(1000, 0); // 0% fee
        assert!(amount == 1000, 2);
    }

    #[test]
    fun test_calculate_min_output() {
        let min_out = math::calculate_min_output(1000, 50); // 0.5% slippage
        assert!(min_out == 995, 0);

        let min_out = math::calculate_min_output(1000, 100); // 1% slippage
        assert!(min_out == 990, 1);

        let min_out = math::calculate_min_output(1000, 0); // 0% slippage
        assert!(min_out == 1000, 2);
    }

    #[test]
    fun test_get_amount_out() {
        // Test AMM calculation with reserves 1000:2000 and input 100
        // With 0.3% fee (30 bp)
        let amount_out = math::get_amount_out(100, 1000, 2000, 30);
        
        // Expected calculation:
        // amount_in_with_fee = 100 * (10000 - 30) / 10000 = 99.7
        // amount_out = (99.7 * 2000) / (1000 + 99.7) = 181.2...
        // Should be around 181
        assert!(amount_out >= 180 && amount_out <= 182, 0);
    }

    #[test]
    fun test_get_amount_in() {
        // Test reverse AMM calculation
        let amount_in = math::get_amount_in(181, 1000, 2000, 30);
        
        // Should be close to 100 (accounting for fees and rounding)
        assert!(amount_in >= 99 && amount_in <= 102, 0);
    }

    #[test]
    fun test_calculate_price_impact() {
        // Test price impact calculation
        let impact = math::calculate_price_impact(100, 180, 1000, 2000);
        
        // With reserves 1:2, spot price is 2
        // Execution price is 180/100 = 1.8
        // Price impact = (2 - 1.8) / 2 = 0.1 = 10% = 1000 bp
        assert!(impact >= 900 && impact <= 1100, 0); // Allow some tolerance
    }

    #[test]
    fun test_safe_mul() {
        assert!(math::safe_mul(100, 200) == 20000, 0);
        assert!(math::safe_mul(0, 100) == 0, 1);
        assert!(math::safe_mul(100, 0) == 0, 2);
    }

    #[test]
    fun test_safe_div() {
        assert!(math::safe_div(1000, 10) == 100, 0);
        assert!(math::safe_div(1000, 3) == 333, 1); // Integer division
    }

    #[test]
    #[expected_failure(abort_code = 0x60002)] // EDIVISION_BY_ZERO
    fun test_safe_div_by_zero() {
        math::safe_div(100, 0);
    }

    #[test]
    #[expected_failure(abort_code = 0x60001)] // EINVALID_AMOUNT
    fun test_invalid_fee_rate() {
        math::calculate_fee(1000, 10001); // Fee rate > 100%
    }

    #[test]
    #[expected_failure(abort_code = 0x60001)] // EINVALID_AMOUNT
    fun test_invalid_slippage() {
        math::calculate_min_output(1000, 10001); // Slippage > 100%
    }
}
