import "@acton/emulation/network"
import "@acton/emulation/testing"
import "@acton/testing/expect"
import "@acton/types/transaction"
import "test-utils"
import "../src/errors"
import "../src/messages"
import "../src/storage"
import "../src/tokenomics"
import "../wrappers/JettonMinter.gen"
import "../wrappers/JettonWallet.gen"
import "../wrappers/MiningIssuer.gen"
import "../wrappers/utils"

fun deployMiningIssuer(minter: JettonMinter, admin: Treasury, operatorAddress: address): MiningIssuer {
    val issuer = MiningIssuer.fromStorage(MiningIssuerStorage {
        adminAddress: admin.address,
        operatorAddress,
        minterAddress: minter.address,
        extra: MiningIssuerExtra {
            totalIssued: 0,
            totalPending: 0,
            paused: false,
            claims: [],
        }.toCell(),
    });
    val deploy = issuer.sendDeploy(admin.address, { value: grams("1") });
    expect(deploy).toHaveSuccessfulDeploy({ to: issuer.address });
    return issuer;
}

get fun `test mining issuer: claim mints once and records confirmed payout`() {
    val (minter, deployer, recipient) = setupTest(0, rcrMaxSupplyBaseUnits(9));
    val issuer = deployMiningIssuer(minter, deployer, deployer.address);
    val configured = minter.sendConfigureMiningIssuer(deployer.address, issuer.address);
    expect(configured).toHaveSuccessfulTx<SetMiningIssuer>({ from: deployer.address, to: minter.address });

    val amount = grams("2");
    val result = issuer.sendRegisterClaim(
        deployer.address,
        1,
        recipient.address,
        amount,
        grams("0.3"),
        grams("0.5"),
    );
    expect(result).toHaveSuccessfulTx<RegisterMiningClaim>({ from: deployer.address, to: issuer.address });
    expect(issuer.getMiningIssuerData().totalIssued).toEqual(amount);
    expect(issuer.getMiningIssuerData().totalPending).toEqual(0);
    expect(minter.getMiningIssued()).toEqual(amount);
    expect(userWallet(minter, recipient.address).getJettonBalance()).toEqual(amount);
}

get fun `test mining issuer: duplicate claim identifiers are rejected`() {
    val (minter, deployer, recipient) = setupTest(0, rcrMaxSupplyBaseUnits(9));
    val issuer = deployMiningIssuer(minter, deployer, deployer.address);
    val configured = minter.sendConfigureMiningIssuer(deployer.address, issuer.address);
    expect(configured).toHaveSuccessfulTx<SetMiningIssuer>({ from: deployer.address, to: minter.address });
    val amount = grams("1");
    val first = issuer.sendRegisterClaim(deployer.address, 9, recipient.address, amount, grams("0.3"), grams("0.5"));
    expect(first).toHaveSuccessfulTx<RegisterMiningClaim>({ from: deployer.address, to: issuer.address });
    val duplicate = issuer.sendRegisterClaim(deployer.address, 9, recipient.address, amount, grams("0.3"), grams("0.5"));
    expect(duplicate).toHaveFailedTx<RegisterMiningClaim>({
        from: deployer.address,
        to: issuer.address,
        exitCode: ERROR_CLAIM_ALREADY_EXISTS,
    });
}

get fun `test mining issuer: unauthorized sender cannot register a claim`() {
    val (minter, deployer, notOperator) = setupTest(0, rcrMaxSupplyBaseUnits(9));
    val issuer = deployMiningIssuer(minter, deployer, deployer.address);
    val result = issuer.sendRegisterClaim(notOperator.address, 3, notOperator.address, grams("1"), grams("0.3"), grams("0.5"));
    expect(result).toHaveFailedTx<RegisterMiningClaim>({
        from: notOperator.address,
        to: issuer.address,
        exitCode: ERROR_NOT_OPERATOR,
    });
}

get fun `test mining issuer: failed mint becomes retryable and can be retried safely`() {
    val (minter, deployer, recipient) = setupTest(0, rcrMaxSupplyBaseUnits(9));
    val issuer = deployMiningIssuer(minter, deployer, deployer.address);

    val first = issuer.sendRegisterClaim(deployer.address, 17, recipient.address, grams("2"), grams("0.3"), grams("0.5"));
    expect(first).toHaveSuccessfulTx<RegisterMiningClaim>({ from: deployer.address, to: issuer.address });
    expect(issuer.getMiningIssuerData().totalPending).toEqual(0);
    expect(issuer.getMiningIssuerData().totalIssued).toEqual(0);

    val configured = minter.sendConfigureMiningIssuer(deployer.address, issuer.address);
    expect(configured).toHaveSuccessfulTx<SetMiningIssuer>({ from: deployer.address, to: minter.address });
    val retry = issuer.sendRetryClaim(deployer.address, 17, grams("0.3"), grams("0.5"));
    expect(retry).toHaveSuccessfulTx<RetryMiningClaim>({ from: deployer.address, to: issuer.address });
    expect(issuer.getMiningIssuerData().totalIssued).toEqual(grams("2"));
    expect(issuer.getMiningIssuerData().totalPending).toEqual(0);
    expect(minter.getMiningIssued()).toEqual(grams("2"));
}
