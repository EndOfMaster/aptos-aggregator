/// Math utilities for the aggregator
module aggregator::math {
    use std::error;

    const EINVALID_AMOUNT: u64 = 2001;
    const EDIVISION_BY_ZERO: u64 = 2002;
    const EOVERFLOW: u64 = 2003;

    const BASIS_POINTS: u64 = 10000;
    const MAX_U64: u64 = 18446744073709551615;

    /// Calculate fee amount from basis points
    public fun calculate_fee(amount: u64, fee_rate_bp: u64): u64 {
        assert!(fee_rate_bp <= BASIS_POINTS, error::invalid_argument(EINVALID_AMOUNT));
        (amount * fee_rate_bp) / BASIS_POINTS
    }

    /// Calculate amount after deducting fee
    public fun amount_after_fee(amount: u64, fee_rate_bp: u64): u64 {
        let fee = calculate_fee(amount, fee_rate_bp);
        amount - fee
    }

    /// Calculate slippage tolerance
    public fun calculate_min_output(amount: u64, slippage_tolerance_bp: u64): u64 {
        assert!(slippage_tolerance_bp <= BASIS_POINTS, error::invalid_argument(EINVALID_AMOUNT));
        let slippage_amount = (amount * slippage_tolerance_bp) / BASIS_POINTS;
        assert!(amount >= slippage_amount, error::invalid_argument(EINVALID_AMOUNT));
        amount - slippage_amount
    }

    /// Safe multiplication with overflow check
    public fun safe_mul(a: u64, b: u64): u64 {
        if (a == 0 || b == 0) return 0;
        assert!(a <= MAX_U64 / b, error::out_of_range(EOVERFLOW));
        a * b
    }

    /// Safe division
    public fun safe_div(a: u64, b: u64): u64 {
        assert!(b != 0, error::invalid_argument(EDIVISION_BY_ZERO));
        a / b
    }

    /// Calculate AMM output amount (constant product formula)
    /// Based on x * y = k formula
    public fun get_amount_out(
        amount_in: u64,
        reserve_in: u64,
        reserve_out: u64,
        fee_rate_bp: u64
    ): u64 {
        assert!(amount_in > 0, error::invalid_argument(EINVALID_AMOUNT));
        assert!(reserve_in > 0 && reserve_out > 0, error::invalid_argument(EINVALID_AMOUNT));

        let amount_in_with_fee = amount_after_fee(amount_in, fee_rate_bp);
        let numerator = safe_mul(amount_in_with_fee, reserve_out);
        let denominator = reserve_in + amount_in_with_fee;
        
        safe_div(numerator, denominator)
    }

    /// Calculate required input amount for desired output
    public fun get_amount_in(
        amount_out: u64,
        reserve_in: u64,
        reserve_out: u64,
        fee_rate_bp: u64
    ): u64 {
        assert!(amount_out > 0, error::invalid_argument(EINVALID_AMOUNT));
        assert!(reserve_in > 0 && reserve_out > 0, error::invalid_argument(EINVALID_AMOUNT));
        assert!(amount_out < reserve_out, error::invalid_argument(EINVALID_AMOUNT));

        let numerator = safe_mul(reserve_in, amount_out);
        let denominator = reserve_out - amount_out;
        let amount_in = safe_div(numerator, denominator) + 1; // Add 1 for rounding

        // Account for fee
        let fee_multiplier = BASIS_POINTS;
        let fee_divisor = BASIS_POINTS - fee_rate_bp;
        safe_div(safe_mul(amount_in, fee_multiplier), fee_divisor)
    }

    /// Calculate price impact in basis points
    public fun calculate_price_impact(
        amount_in: u64,
        amount_out: u64,
        reserve_in: u64,
        reserve_out: u64
    ): u64 {
        if (reserve_in == 0 || reserve_out == 0) return BASIS_POINTS; // 100% impact
        
        let spot_price = safe_div(safe_mul(reserve_out, BASIS_POINTS), reserve_in);
        let execution_price = safe_div(safe_mul(amount_out, BASIS_POINTS), amount_in);
        
        if (execution_price >= spot_price) return 0;
        
        let price_diff = spot_price - execution_price;
        safe_div(safe_mul(price_diff, BASIS_POINTS), spot_price)
    }

    #[test]
    fun test_calculate_fee() {
        // Test 0.3% fee (30 basis points)
        let fee = calculate_fee(1000, 30);
        assert!(fee == 3, 0);

        // Test 1% fee (100 basis points)
        let fee = calculate_fee(1000, 100);
        assert!(fee == 10, 1);
    }

    #[test]
    fun test_amount_after_fee() {
        let amount = amount_after_fee(1000, 30); // 0.3% fee
        assert!(amount == 997, 0);
    }

    #[test]
    fun test_calculate_min_output() {
        let min_out = calculate_min_output(1000, 50); // 0.5% slippage
        assert!(min_out == 995, 0);
    }
}
