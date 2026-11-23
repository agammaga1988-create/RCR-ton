import "errors"

const RCR_MAX_SUPPLY_WHOLE_TOKENS = 1000000000
const RCR_DECIMALS = 9

fun rcrMaxSupplyBaseUnits(decimals: int): coins {
    assert (decimals == RCR_DECIMALS) throw ERROR_INVALID_DECIMALS;
    var scale = 1;
    var i = 0;
    while (i < decimals) {
        scale *= 10;
        i += 1;
    }
    return RCR_MAX_SUPPLY_WHOLE_TOKENS * scale;
}
