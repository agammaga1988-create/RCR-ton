import "@acton/testing/expect"
import "../src/tokenomics"

get fun `test tokenomics: RCR fixed supply uses nine decimals`() {
    expect(rcrMaxSupplyBaseUnits(9)).toEqual(1000000000000000000);
    expect(rcrPublicIssuanceCapBaseUnits()).toEqual(600000000000000000);
    expect(rcrMiningIssuerCapBaseUnits()).toEqual(400000000000000000);
    expect(rcrPublicIssuanceCapBaseUnits() + rcrMiningIssuerCapBaseUnits()).toEqual(rcrMaxSupplyBaseUnits(9));
}
