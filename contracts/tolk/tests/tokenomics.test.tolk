import "@acton/testing/expect"
import "../src/tokenomics"

get fun `test tokenomics: RCR fixed supply uses nine decimals`() {
    expect(rcrMaxSupplyBaseUnits(9)).toEqual(1000000000000000000);
}
