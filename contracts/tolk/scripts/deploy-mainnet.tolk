import "@acton/env"
import "@acton/emulation/scripts"
import "@acton/io"
import "@acton/fmt"
import "@wrappers/JettonMinter.gen"
import "@wrappers/MiningIssuer.gen"
import "utils/common"
import "../src/tokenomics"
import "@wrappers/utils"

// Phase 1: deploy from the owner's deployment wallet.
// MiningIssuer authorization is intentionally a separate admin-wallet step.
const RCR_DEPLOYER = "UQDvqZ56PiYwhyyUshMJR4VGyUEWogLhhnQKsaMo0XWzIoZv"
const RCR_ADMIN = "UQC-0SBzMfz36M1rqf3eik4igzLQBHcIItqzbWVIBd_1bsEY"
const MAINNET_CONFIRMATION = 314159
const METADATA_CONFIRMATION = 271828

fun main() {
    val confirmation = env<int>("RCR_MAINNET_DEPLOY_CONFIRMATION");
    assert (confirmation != null && confirmation == MAINNET_CONFIRMATION) throw 1010;

    val deployer = scripts.wallet("rcr-mainnet-deployer");
    val adminAddress = parseAddress(RCR_ADMIN);
    assert (deployer.address == parseAddress(RCR_DEPLOYER)) throw 1011;
    assert (deployer.address.getWorkchain() == 0) throw 1013;
    assert (adminAddress.getWorkchain() == 0) throw 1013;

    val imageUrl = env<string>("JETTON_IMAGE");
    val metadataConfirmation = env<int>("RCR_MAINNET_METADATA_CONFIRMED");
    assert (imageUrl != null) throw 1014;
    assert (metadataConfirmation != null && metadataConfirmation == METADATA_CONFIRMATION) throw 1015;

    val operatorAddress = promptJettonAddress(
        "RCR_MINING_OPERATOR_ADDRESS",
        "Enter Mining Issuer Operator Address",
        adminAddress,
    );
    assert (operatorAddress.getWorkchain() == 0) throw 1013;

    val minterStorage = promptJettonMinterStorage(adminAddress);
    assert (minterStorage.totalSupply == 0) throw 1003;
    assert (minterStorage.maxSupply == rcrMaxSupplyBaseUnits(9)) throw 1004;

    val minter = deployJettonMinter(deployer, minterStorage);
    val miningIssuerStorage = buildMiningIssuerStorage(
        adminAddress,
        operatorAddress,
        minter.address,
    );
    val miningIssuer = deployMiningIssuer(deployer, miningIssuerStorage);

    assert (minter.getPublicIssuerAddress() == adminAddress) throw 1007;
    assert (miningIssuer.getMiningIssuerData().paused) throw 1008;
    println("RCR MAINNET MINTER_ADDRESS={}", minter.address);
    println("RCR MAINNET MINING_ISSUER_ADDRESS={}", miningIssuer.address);
    println("RCR MAINNET ADMIN_ADDRESS={}", adminAddress);
    println("RCR MAINNET DEPLOYER_ADDRESS={}", deployer.address);
    println("RCR MAINNET GENESIS_SUPPLY={}", minter.getTotalSupply());
    println("RCR MAINNET MAX_SUPPLY_BASE_UNITS={}", minter.getMaxSupply());
    println("RCR MAINNET MINING_ISSUER_PAUSED={}", miningIssuer.getMiningIssuerData().paused);
    println("NEXT: run scripts/configure-mainnet-mining-issuer.tolk with the admin wallet");
    printJettonWalletInfo(minter, adminAddress, "PUBLIC_ISSUER");
}
