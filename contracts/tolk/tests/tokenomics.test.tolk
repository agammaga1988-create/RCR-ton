import "@acton/testing/expect"
import "../src/tokenomics"

get fun `test tokenomics: RCR max supply scales with decimals`() {
    expect(rcrMaxSupplyBaseUnits(0)).toEqual(1000000000);
    expect(rcrMaxSupplyBaseUnits(9)).toEqual(1000000000000000000);
    expect(rcrMaxSupplyBaseUnits(18)).toEqual(1000000000000000000000000000);
}
