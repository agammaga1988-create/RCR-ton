import "@acton/env"
import "@acton/emulation/scripts"
import "@acton/io"
import "@wrappers/JettonMinter.gen"
import "utils/common"

const RCR_ADMIN = "UQC-0SBzMfz36M1rqf3eik4igzLQBHcIItqzbWVIBd_1bsEY"
const MAINNET_CONFIRMATION = "AUTHORIZE RCR MINING ISSUER"

fun main() {
    val confirmation = env<string>("RCR_MAINNET_ADMIN_CONFIRMATION");
    assert (confirmation != null && confirmation == MAINNET_CONFIRMATION) throw 1020;

    val adminWallet = scripts.wallet("rcr-mainnet-admin");
    assert (adminWallet.address == parseAddress(RCR_ADMIN)) throw 1021;
    assert (adminWallet.address.getWorkchain() == 0) throw 1022;

    val minterAddress = promptJettonAddressRequired(
        "RCR_MINTER_ADDRESS",
        "Enter the deployed RCR Mainnet Jetton Minter address",
    );
    val miningIssuerAddress = promptJettonAddressRequired(
        "RCR_MINING_ISSUER_ADDRESS",
        "Enter the deployed RCR Mainnet MiningIssuer address",
    );
    assert (minterAddress.getWorkchain() == 0) throw 1022;
    assert (miningIssuerAddress.getWorkchain() == 0) throw 1022;

    val minter = JettonMinter { address: minterAddress };
    assert (minter.getPublicIssuerAddress() == adminWallet.address) throw 1023;
    assert (minter.getMiningIssuerAddress() == null) throw 1024;

    val configured = minter.sendConfigureMiningIssuer(adminWallet.address, miningIssuerAddress);
    configured.waitForFirstTransaction();

    val configuredAddress = minter.getMiningIssuerAddress();
    assert (configuredAddress != null && configuredAddress == miningIssuerAddress) throw 1025;
    println("RCR MAINNET MINING_ISSUER_CONFIGURED={}", configuredAddress);
    println("RCR MAINNET ADMIN_ADDRESS={}", adminWallet.address);
}
