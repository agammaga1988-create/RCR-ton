import "@gen/JettonWallet.code"
import "@stdlib/gas-payments"
import "errors"
import "fees-management"
import "jetton-utils"
import "messages"
import "storage"
import "tokenomics"

const CLAIM_STATUS_PENDING = 1
const CLAIM_STATUS_PAID = 2
const CLAIM_STATUS_RETRYABLE = 3
const MIN_MINT_TON_AMOUNT = grams("0.3")
const MIN_ISSUER_MESSAGE_FUNDING = grams("0.12")

contract MiningIssuer {
    author: "RCR"
    version: "1.0"
    description: "Capped, replay-protected RCR mining issuer"
    incomingMessages: AllowedMessageToMiningIssuer
    storage: MiningIssuerStorage
}

type AllowedMessageToMiningIssuer =
    | RegisterMiningClaim
    | RetryMiningClaim
    | ReturnExcessesBack
    | MintFailureNotification
    | ChangeMiningOperator
    | PauseMining
    | ResumeMining

fun sendMiningMint(
    minterAddress: address,
    claimId: uint64,
    recipient: address,
    amount: coins,
    tonAmount: coins,
) {
    reserveGramsOnBalance(grams("0.01"), RESERVE_MODE_EXACT_AMOUNT);
    val forwardPayload = beginCell().storeUint(0, 1).endCell().beginParse();
    val internalTransferMsg = InternalTransferStep {
        queryId: claimId,
        jettonAmount: amount,
        transferInitiator: null,
        sendExcessesTo: contract.getAddress(),
        forwardTonAmount: 0,
        forwardPayload,
    };
    val mintMsg = createMessage({
        bounce: BounceMode.Only256BitsOfBody,
        dest: minterAddress,
        value: tonAmount + grams("0.08"),
        body: MintNewJettons {
            queryId: claimId,
            mintRecipient: recipient,
            tonAmount,
            internalTransferMsg: internalTransferMsg.toCell(),
        },
    });
    mintMsg.send(SEND_MODE_BOUNCE_ON_ACTION_FAIL);
}

fun onBouncedMessage(in: InMessageBounced) {
    in.bouncedBody.skipBouncedPrefix();
    val msg = lazy MintNewJettons.fromSlice(in.bouncedBody);
    var storage = lazy MiningIssuerStorage.load();
    assert (in.senderAddress == storage.minterAddress) throw ERROR_NOT_OWNER;
    var extra = MiningIssuerExtra.fromCell(storage.extra);
    val lookup = extra.claims.get(msg.queryId);
    assert (lookup.isFound) throw ERROR_CLAIM_NOT_FOUND;
    var claim = lookup.loadValue();
    assert (claim.status == CLAIM_STATUS_PENDING) throw ERROR_CLAIM_STATE;
    claim.status = CLAIM_STATUS_RETRYABLE;
    extra.totalPending -= claim.amount;
    extra.claims.set(msg.queryId, claim);
    storage.extra = extra.toCell();
    storage.save();
}

fun onInternalMessage(in: InMessage) {
    val msg = lazy AllowedMessageToMiningIssuer.fromSlice(in.body);
    match (msg) {
        RegisterMiningClaim => {
            var storage = lazy MiningIssuerStorage.load();
            var extra = MiningIssuerExtra.fromCell(storage.extra);
            assert (in.senderAddress == storage.operatorAddress) throw ERROR_NOT_OPERATOR;
            assert (!extra.paused) throw ERROR_MINING_PAUSED;
            assert (msg.claimId != 0) throw ERROR_INVALID_MESSAGE;
            assert (!extra.claims.exists(msg.claimId)) throw ERROR_CLAIM_ALREADY_EXISTS;
            assert (msg.amount > 0) throw ERROR_INVALID_MESSAGE;
            assert (msg.recipient.getWorkchain() == MY_WORKCHAIN) throw ERROR_WRONG_WORKCHAIN;
            assert (msg.tonAmount >= MIN_MINT_TON_AMOUNT) throw ERROR_INVALID_MESSAGE;
            assert (in.valueCoins >= msg.tonAmount + MIN_ISSUER_MESSAGE_FUNDING) throw ERROR_NOT_ENOUGH_TON;
            assert (
                extra.totalIssued + extra.totalPending + msg.amount <=
                rcrMiningIssuerCapBaseUnits()
            ) throw ERROR_ISSUER_CAP;

            extra.claims.set(msg.claimId, MiningClaimRecord {
                recipient: msg.recipient,
                amount: msg.amount,
                status: CLAIM_STATUS_PENDING,
            });
            extra.totalPending += msg.amount;
            storage.extra = extra.toCell();
            storage.save();
            sendMiningMint(storage.minterAddress, msg.claimId, msg.recipient, msg.amount, msg.tonAmount);
        }

        RetryMiningClaim => {
            var storage = lazy MiningIssuerStorage.load();
            var extra = MiningIssuerExtra.fromCell(storage.extra);
            assert (in.senderAddress == storage.operatorAddress) throw ERROR_NOT_OPERATOR;
            assert (!extra.paused) throw ERROR_MINING_PAUSED;
            assert (msg.tonAmount >= MIN_MINT_TON_AMOUNT) throw ERROR_INVALID_MESSAGE;
            assert (in.valueCoins >= msg.tonAmount + MIN_ISSUER_MESSAGE_FUNDING) throw ERROR_NOT_ENOUGH_TON;
            val lookup = extra.claims.get(msg.claimId);
            assert (lookup.isFound) throw ERROR_CLAIM_NOT_FOUND;
            var claim = lookup.loadValue();
            assert (claim.status == CLAIM_STATUS_RETRYABLE) throw ERROR_CLAIM_STATE;
            assert (
                extra.totalIssued + extra.totalPending + claim.amount <=
                rcrMiningIssuerCapBaseUnits()
            ) throw ERROR_ISSUER_CAP;

            claim.status = CLAIM_STATUS_PENDING;
            extra.claims.set(msg.claimId, claim);
            extra.totalPending += claim.amount;
            storage.extra = extra.toCell();
            storage.save();
            sendMiningMint(storage.minterAddress, msg.claimId, claim.recipient, claim.amount, msg.tonAmount);
        }

        ReturnExcessesBack => {
            var storage = lazy MiningIssuerStorage.load();
            var extra = MiningIssuerExtra.fromCell(storage.extra);
            val lookup = extra.claims.get(msg.queryId);
            assert (lookup.isFound) throw ERROR_CLAIM_NOT_FOUND;
            var claim = lookup.loadValue();
            assert (claim.status == CLAIM_STATUS_PENDING) throw ERROR_CLAIM_STATE;
            val walletCode = jettonWalletCompiledCode();
            assert (
                in.senderAddress ==
                calcAddressOfJettonWallet(claim.recipient, storage.minterAddress, walletCode)
            ) throw ERROR_NOT_VALID_WALLET;

            claim.status = CLAIM_STATUS_PAID;
            extra.totalPending -= claim.amount;
            extra.totalIssued += claim.amount;
            extra.claims.set(msg.queryId, claim);
            storage.extra = extra.toCell();
            storage.save();
        }

        MintFailureNotification => {
            var storage = lazy MiningIssuerStorage.load();
            var extra = MiningIssuerExtra.fromCell(storage.extra);
            assert (in.senderAddress == storage.minterAddress) throw ERROR_NOT_OWNER;
            val lookup = extra.claims.get(msg.queryId);
            assert (lookup.isFound) throw ERROR_CLAIM_NOT_FOUND;
            var claim = lookup.loadValue();
            assert (claim.status == CLAIM_STATUS_PENDING) throw ERROR_CLAIM_STATE;
            claim.status = CLAIM_STATUS_RETRYABLE;
            extra.totalPending -= claim.amount;
            extra.claims.set(msg.queryId, claim);
            storage.extra = extra.toCell();
            storage.save();
        }

        ChangeMiningOperator => {
            var storage = lazy MiningIssuerStorage.load();
            assert (in.senderAddress == storage.adminAddress) throw ERROR_NOT_OWNER;
            assert (msg.newOperatorAddress.getWorkchain() == MY_WORKCHAIN) throw ERROR_INVALID_ISSUER;
            storage.operatorAddress = msg.newOperatorAddress;
            storage.save();
        }

        PauseMining => {
            var storage = lazy MiningIssuerStorage.load();
            var extra = MiningIssuerExtra.fromCell(storage.extra);
            assert (in.senderAddress == storage.adminAddress) throw ERROR_NOT_OWNER;
            extra.paused = true;
            storage.extra = extra.toCell();
            storage.save();
        }

        ResumeMining => {
            var storage = lazy MiningIssuerStorage.load();
            var extra = MiningIssuerExtra.fromCell(storage.extra);
            assert (in.senderAddress == storage.adminAddress) throw ERROR_NOT_OWNER;
            extra.paused = false;
            storage.extra = extra.toCell();
            storage.save();
        }

        else => throw 0xFFFF,
    }
}

get fun get_mining_issuer_data(): MiningIssuerDataReply {
    val storage = lazy MiningIssuerStorage.load();
    val extra = MiningIssuerExtra.fromCell(storage.extra);
    return {
        adminAddress: storage.adminAddress,
        operatorAddress: storage.operatorAddress,
        minterAddress: storage.minterAddress,
        totalIssued: extra.totalIssued,
        totalPending: extra.totalPending,
        paused: extra.paused,
    };
}

get fun get_claim_status(claimId: uint64): MiningClaimRecord? {
    val storage = lazy MiningIssuerStorage.load();
    val extra = MiningIssuerExtra.fromCell(storage.extra);
    val lookup = extra.claims.get(claimId);
    return lookup.isFound ? lookup.loadValue() : null;
}
