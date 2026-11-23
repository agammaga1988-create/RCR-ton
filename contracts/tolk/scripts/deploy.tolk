import "@acton/emulation/scripts"
import "@acton/io"
import "@wrappers/JettonMinter.gen"
import "@wrappers/MiningIssuer.gen"
import "sharding"
import "utils/common"

fun main() {
    val deployer = promptJettonWallet("JETTON_DEPLOYER", "Select Jetton Deployer");
    val adminWallet = promptJettonWallet("JETTON_ADMIN_WALLET", "Select RCR Admin and Public Issuer Wallet");
    val operatorAddress = promptJettonAddress(
        "RCR_MINING_OPERATOR_ADDRESS",
        "Enter Mining Issuer Operator Address",
        adminWallet.address,
    );

    assert (adminWallet.address.getWorkchain() == MY_WORKCHAIN) throw 1006;
    assert (operatorAddress.getWorkchain() == MY_WORKCHAIN) throw 1006;

    val minterStorage = promptJettonMinterStorage(adminWallet.address);
    assert (minterStorage.totalSupply == 0) throw 1003;
    assert (minterStorage.maxSupply == rcrMaxSupplyBaseUnits(9)) throw 1004;

    val minter = deployJettonMinter(deployer, minterStorage);
    printJettonMinterInfo(minter, "RCR");
    println("RCR PUBLIC_ISSUER_ADDRESS={}", minter.getPublicIssuerAddress());

    val miningIssuerStorage = buildMiningIssuerStorage(
        adminWallet.address,
        operatorAddress,
        minter.address,
    );
    val miningIssuer = deployMiningIssuer(deployer, miningIssuerStorage);
    val configured = minter.sendConfigureMiningIssuer(adminWallet.address, miningIssuer.address);
    configured.waitForFirstTransaction();

    assert (minter.getMiningIssuerAddress() == miningIssuer.address) throw 1005;
    assert (minter.getPublicIssuerAddress() == adminWallet.address) throw 1007;
    assert (miningIssuer.getMiningIssuerData().paused) throw 1008;
    println("RCR MINING_ISSUER_ADDRESS={}", miningIssuer.address);
    println("RCR MINING_OPERATOR_ADDRESS={}", operatorAddress);
    println("RCR MINING_ISSUER_PAUSED={}", miningIssuer.getMiningIssuerData().paused);
    println("RCR GENESIS_SUPPLY={}", minter.getTotalSupply());
    println("RCR MAX_SUPPLY_BASE_UNITS={}", minter.getMaxSupply());
    printJettonWalletInfo(minter, adminWallet.address, "PUBLIC_ISSUER");
}
