import "@acton/env"
import "@acton/emulation/scripts"
import "@acton/io"
import "@wrappers/JettonMinter.gen"
import "@wrappers/MiningIssuer.gen"
import "utils/common"
import "../src/tokenomics"
import "../wrappers/utils"

// Mainnet-only release script. The local Acton wallet store must contain
// the two owner-controlled signers; public addresses alone cannot sign.
const RCR_DEPLOYER = "UQDvqZ56PiYwhyyUshMJR4VGyUEWogLhhnQKsaMo0XWzIoZv"
const RCR_ADMIN = "UQC-0SBzMfz36M1rqf3eik4igzLQBHcIItqzbWVIBd_1bsEY"
const MAINNET_CONFIRMATION = "DEPLOY RCR MAINNET"

fun main() {
    val confirmation = env<string>("RCR_MAINNET_DEPLOY_CONFIRMATION");
    assert (confirmation != null && confirmation! == MAINNET_CONFIRMATION) throw 1010;

    val deployer = promptJettonWallet("JETTON_DEPLOYER", "Select the owner-controlled RCR deployment wallet");
    val adminWallet = promptJettonWallet("JETTON_ADMIN_WALLET", "Select the owner-controlled RCR admin wallet");

    assert (deployer.address == parseAddress(RCR_DEPLOYER)) throw 1011;
    assert (adminWallet.address == parseAddress(RCR_ADMIN)) throw 1012;
    assert (deployer.address.getWorkchain() == 0) throw 1013;
    assert (adminWallet.address.getWorkchain() == 0) throw 1013;

    // Refuse deployment with placeholder/empty token artwork metadata.
    val imageUrl = env<string>("JETTON_IMAGE");
    assert (imageUrl != null && imageUrl! != "") throw 1014;

    val operatorAddress = promptJettonAddress(
        "RCR_MINING_OPERATOR_ADDRESS",
        "Enter Mining Issuer Operator Address",
        adminWallet.address,
    );
    assert (operatorAddress.getWorkchain() == 0) throw 1013;

    val minterStorage = promptJettonMinterStorage(adminWallet.address);
    assert (minterStorage.totalSupply == 0) throw 1003;
    assert (minterStorage.maxSupply == rcrMaxSupplyBaseUnits(9)) throw 1004;

    val minter = deployJettonMinter(deployer, minterStorage);
    printJettonMinterInfo(minter, "RCR_MAINNET");
    assert (minter.getPublicIssuerAddress() == adminWallet.address) throw 1007;

    val miningIssuerStorage = buildMiningIssuerStorage(
        adminWallet.address,
        operatorAddress,
        minter.address,
    );
    val miningIssuer = deployMiningIssuer(deployer, miningIssuerStorage);
    val configured = minter.sendConfigureMiningIssuer(adminWallet.address, miningIssuer.address);
    configured.waitForFirstTransaction();

    assert (minter.getMiningIssuerAddress() != null && minter.getMiningIssuerAddress()! == miningIssuer.address) throw 1005;
    assert (miningIssuer.getMiningIssuerData().paused) throw 1008;

    println("RCR MAINNET MINTER_ADDRESS={}", minter.address);
    println("RCR MAINNET MINING_ISSUER_ADDRESS={}", miningIssuer.address);
    println("RCR MAINNET ADMIN_ADDRESS={}", adminWallet.address);
    println("RCR MAINNET DEPLOYER_ADDRESS={}", deployer.address);
    println("RCR MAINNET GENESIS_SUPPLY={}", minter.getTotalSupply());
    println("RCR MAINNET MAX_SUPPLY_BASE_UNITS={}", minter.getMaxSupply());
    println("RCR MAINNET MINING_ISSUER_PAUSED={}", miningIssuer.getMiningIssuerData().paused);
    printJettonWalletInfo(minter, adminWallet.address, "PUBLIC_ISSUER");
}
