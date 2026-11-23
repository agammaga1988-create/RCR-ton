import "@acton/emulation/scripts"
import "@acton/io"
import "@wrappers/JettonMinter.gen"
import "utils/common"

fun main() {
    val deployer = promptJettonWallet("JETTON_DEPLOYER", "Select Jetton Deployer");
    val admin = promptJettonAddress(
        "JETTON_ADMIN_ADDRESS",
        "Enter admin address",
        deployer.address,
    );
    val storage = promptJettonMinterStorage(admin);
    assert (storage.totalSupply == 0) throw 1003;
    assert (storage.maxSupply > 0) throw 1004;

    val minter = deployJettonMinter(deployer, storage);

    printJettonMinterInfo(minter, "RCR");
    println("RCR MAX_SUPPLY_BASE_UNITS={}", minter.getMaxSupply());
    printJettonWalletInfo(minter, admin, "JETTON_ADMIN");
}
