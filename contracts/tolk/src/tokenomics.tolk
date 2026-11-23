import "errors"

const RCR_MAX_SUPPLY_WHOLE_TOKENS = 1000000000
const RCR_DECIMALS = 9
const RCR_PUBLIC_ISSUANCE_WHOLE_TOKENS = 600000000
const RCR_MINING_ISSUER_WHOLE_TOKENS = 400000000

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

fun rcrPublicIssuanceCapBaseUnits(): coins {
    return RCR_PUBLIC_ISSUANCE_WHOLE_TOKENS * 1000000000;
}

fun rcrMiningIssuerCapBaseUnits(): coins {
    return RCR_MINING_ISSUER_WHOLE_TOKENS * 1000000000;
}
