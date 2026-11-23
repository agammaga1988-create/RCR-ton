import "@gen/JettonWallet.code"
import "errors"
import "fees-management"
import "jetton-utils"
import "messages"
import "sharding"
import "storage"
import "tokenomics"

contract JettonMinter {
    author: "The Tolk Team"
    version: "2.1"
    description: "Standard Jetton Minter. TEP-74 and TEP-89 compliant"
    incomingMessages: AllowedMessageToMinter
    storage: MinterStorage
}

type AllowedMessageToMinter =
    | MintNewJettons
    | BurnNotificationForMinter
    | RequestWalletAddress
    | ChangeMinterAdmin
    | ClaimMinterAdmin
    | DropMinterAdmin
    | ChangeMinterMetadata
    | SetMiningIssuer
    | ReturnExcessesBack
    | TopUpTons

fun onBouncedMessage(in: InMessageBounced) {
    in.bouncedBody.skipBouncedPrefix();
    val msg = lazy InternalTransferStep.fromSlice(in.bouncedBody);
    var storage = lazy MinterStorage.load();
    var extra = MinterExtra.fromCell(storage.extra);
    val lookup = extra.pendingMints.get(msg.queryId);
    assert (lookup.isFound) throw ERROR_CLAIM_NOT_FOUND;
    val pending = lookup.loadValue();
    assert (pending.amount == msg.jettonAmount) throw ERROR_INVALID_MESSAGE;
    assert (
        in.senderAddress == calcAddressOfJettonWallet(
            pending.recipient,
            contract.getAddress(),
            jettonWalletCompiledCode(),
        )
    ) throw ERROR_NOT_VALID_WALLET;
    if (pending.isMining) {
        extra.miningIssued -= msg.jettonAmount;
    } else {
        extra.publicIssued -= msg.jettonAmount;
    }
    extra.pendingMints.delete(msg.queryId);
    storage.extra = extra.toCell();
    storage.totalSupply -= msg.jettonAmount;
    storage.totalMinted -= msg.jettonAmount;
    storage.save();
    if (pending.isMining) {
        val failureMsg = createMessage({
            bounce: BounceMode.NoBounce,
            dest: pending.issuerAddress,
            value: 0,
            body: MintFailureNotification { queryId: msg.queryId },
        });
        failureMsg.send(SEND_MODE_CARRY_ALL_REMAINING_MESSAGE_VALUE | SEND_MODE_IGNORE_ERRORS);
    }
}

fun assertSenderIsAdmin(senderAddress: address, adminAddress: address?) {
    // theoretically, minter's admin can be dropped and be `null`, so being precise, we should check:
    // ```
    // assert (adminAddress != null) throw ERROR_NOT_OWNER;
    // ```
    // but in practice, the above assertion is redundant, we just bypass the nullability check:
    assert (
        senderAddress == adminAddress!
    ) throw ERROR_NOT_OWNER;                                       // then, if admin is `null`, error code 7 will be thrown (while executing operator `==`),// it's suitable for current implementation
}

fun onInternalMessage(in: InMessage) {
    val msg = lazy AllowedMessageToMinter.fromSlice(in.body);

    match (msg) {
        BurnNotificationForMinter => {
            var storage = lazy MinterStorage.load();
            val jettonWalletCode = jettonWalletCompiledCode();
            assert (
                in.senderAddress ==
                calcAddressOfJettonWallet(
                    msg.burnInitiator,
                    contract.getAddress(),
                    jettonWalletCode,
                )
            ) throw ERROR_NOT_VALID_WALLET;
            storage.totalSupply -= msg.jettonAmount;
            storage.save();

            if (msg.sendExcessesTo == null) {
                return;
            }

            val excessesMsg = createMessage({
                bounce: BounceMode.NoBounce,
                dest: msg.sendExcessesTo,
                value: 0,
                body: ReturnExcessesBack { queryId: msg.queryId },
            });
            excessesMsg.send(SEND_MODE_IGNORE_ERRORS | SEND_MODE_CARRY_ALL_REMAINING_MESSAGE_VALUE);
        }

        RequestWalletAddress => {
            val ownerAddress: Cell<address>? = msg.includeOwnerAddress
                ? msg.ownerAddress.toCell()
                : null;

            var walletAddress: address? = null;
            if (msg.ownerAddress.getWorkchain() == MY_WORKCHAIN) {
                val jettonWalletCode = jettonWalletCompiledCode();
                walletAddress = calcAddressOfJettonWallet(
                    msg.ownerAddress,
                    contract.getAddress(),
                    jettonWalletCode,
                );
            }

            val respondMsg = createMessage({
                bounce: BounceMode.NoBounce,
                dest: in.senderAddress,
                value: 0,
                body: ResponseWalletAddress {
                    queryId: msg.queryId,
                    jettonWalletAddress: walletAddress,
                    ownerAddress,
                },
            });
            respondMsg.send(
                SEND_MODE_CARRY_ALL_REMAINING_MESSAGE_VALUE | SEND_MODE_BOUNCE_ON_ACTION_FAIL,
            );
        }

        MintNewJettons => {
            var storage = lazy MinterStorage.load();
            var extra = MinterExtra.fromCell(storage.extra);
            assert (msg.mintRecipient.getWorkchain() == MY_WORKCHAIN) throw ERROR_WRONG_WORKCHAIN;

            var internalTransferMsg = msg
                .internalTransferMsg
                .load({ throwIfOpcodeDoesNotMatch: ERROR_INVALID_OP });
            val forwardTonAmount = internalTransferMsg.forwardTonAmount;
            internalTransferMsg.forwardPayload.checkIsCorrectTlbEither();

            // a little more than needed, it’s ok since it’s sent by the admin and excesses will return back
            checkAmountIsEnoughToTransfer(msg.tonAmount, forwardTonAmount, in.originalForwardFee);

            assert (internalTransferMsg.jettonAmount > 0) throw ERROR_INVALID_MESSAGE;
            assert (internalTransferMsg.transferInitiator == null) throw ERROR_INVALID_MESSAGE;
            assert (internalTransferMsg.queryId == msg.queryId) throw ERROR_INVALID_MESSAGE;
            assert (!extra.pendingMints.exists(msg.queryId)) throw ERROR_INVALID_MESSAGE;
            if (in.senderAddress == extra.publicIssuerAddress) {
                assert (extra.publicIssued + internalTransferMsg.jettonAmount <= rcrPublicIssuanceCapBaseUnits()) throw ERROR_ISSUER_CAP;
                extra.publicIssued += internalTransferMsg.jettonAmount;
            } else if (extra.miningIssuerAddress != null && in.senderAddress == extra.miningIssuerAddress!) {
                assert (extra.miningIssued + internalTransferMsg.jettonAmount <= rcrMiningIssuerCapBaseUnits()) throw ERROR_ISSUER_CAP;
                extra.miningIssued += internalTransferMsg.jettonAmount;
            } else {
                throw ERROR_NOT_OWNER;
            }
            assert (storage.totalMinted + internalTransferMsg.jettonAmount <= storage.maxSupply) throw ERROR_MAX_SUPPLY;
            internalTransferMsg.sendExcessesTo = contract.getAddress();
            extra.pendingMints.set(msg.queryId, PendingMintRecord {
                issuerAddress: in.senderAddress,
                recipient: msg.mintRecipient,
                amount: internalTransferMsg.jettonAmount,
                isMining: extra.miningIssuerAddress != null && in.senderAddress == extra.miningIssuerAddress!,
            });
            storage.extra = extra.toCell();
            storage.totalSupply += internalTransferMsg.jettonAmount;
            storage.totalMinted += internalTransferMsg.jettonAmount;
            storage.save();

            reserveGramsOnBalance(
                grams("0.01"),
                RESERVE_MODE_EXACT_AMOUNT,
            ); // reserve for storage fees

            val jettonWalletCode = jettonWalletCompiledCode();
            val deployMsg = createMessage({
                bounce: BounceMode.Only256BitsOfBody,
                dest: calcDeployedJettonWallet(
                    msg.mintRecipient,
                    contract.getAddress(),
                    jettonWalletCode,
                ),
                value: msg.tonAmount,
                body: internalTransferMsg.toCell(),
            });
            deployMsg.send(SEND_MODE_PAY_FEES_SEPARATELY | SEND_MODE_BOUNCE_ON_ACTION_FAIL);
        }

        ReturnExcessesBack => {
            var storage = lazy MinterStorage.load();
            var extra = MinterExtra.fromCell(storage.extra);
            val lookup = extra.pendingMints.get(msg.queryId);
            assert (lookup.isFound) throw ERROR_CLAIM_NOT_FOUND;
            val pending = lookup.loadValue();
            assert (
                in.senderAddress == calcAddressOfJettonWallet(
                    pending.recipient,
                    contract.getAddress(),
                    jettonWalletCompiledCode(),
                )
            ) throw ERROR_NOT_VALID_WALLET;
            extra.pendingMints.delete(msg.queryId);
            storage.extra = extra.toCell();
            storage.save();
            if (pending.isMining) {
                val successMsg = createMessage({
                    bounce: BounceMode.NoBounce,
                    dest: pending.issuerAddress,
                    value: 0,
                    body: MintSuccessNotification { queryId: msg.queryId },
                });
                successMsg.send(SEND_MODE_CARRY_ALL_REMAINING_MESSAGE_VALUE | SEND_MODE_IGNORE_ERRORS);
            }
        }

        SetMiningIssuer => {
            var storage = lazy MinterStorage.load();
            var extra = MinterExtra.fromCell(storage.extra);
            assertSenderIsAdmin(in.senderAddress, storage.adminAddress);
            assert (extra.miningIssuerAddress == null) throw ERROR_ISSUER_ALREADY_SET;
            assert (msg.miningIssuerAddress != extra.publicIssuerAddress) throw ERROR_INVALID_ISSUER;
            assert (msg.miningIssuerAddress.getWorkchain() == MY_WORKCHAIN) throw ERROR_INVALID_ISSUER;
            extra.miningIssuerAddress = msg.miningIssuerAddress;
            storage.extra = extra.toCell();
            storage.save();
        }

        ChangeMinterAdmin => {
            var storage = lazy MinterStorage.load();
            assertSenderIsAdmin(in.senderAddress, storage.adminAddress);
            storage.nextAdminAddress = msg.newAdminAddress;
            storage.save();
        }

        ClaimMinterAdmin => {
            var storage = lazy MinterStorage.load();
            assertSenderIsAdmin(in.senderAddress, storage.nextAdminAddress);
            storage.adminAddress = storage.nextAdminAddress;
            storage.nextAdminAddress = null;
            storage.save();
        }

        DropMinterAdmin => {
            var storage = lazy MinterStorage.load();
            assertSenderIsAdmin(in.senderAddress, storage.adminAddress);
            storage.adminAddress = null;
            storage.nextAdminAddress = null;
            storage.save();
        }

        ChangeMinterMetadata => {
            var storage = lazy MinterStorage.load();
            assertSenderIsAdmin(in.senderAddress, storage.adminAddress);
            storage.metadata = msg.newMetadata;
            storage.save();
        }

        TopUpTons => {
            // just accept tons
        }

        else => throw 0xFFFF,
    }
}

get fun get_jetton_data(): JettonDataReply {
    val storage = lazy MinterStorage.load();
    val extra = MinterExtra.fromCell(storage.extra);
    val jettonWalletCode = jettonWalletCompiledCode();

    return {
        totalSupply: storage.totalSupply,
        mintable: extra.publicIssued < rcrPublicIssuanceCapBaseUnits() || (extra.miningIssuerAddress != null && extra.miningIssued < rcrMiningIssuerCapBaseUnits()),
        adminAddress: storage.adminAddress,
        jettonContent: storage.metadata as Cell<OnchainMetadataReply>,
        jettonWalletCode,
    };
}

get fun get_wallet_address(ownerAddress: address): address {
    val jettonWalletCode = jettonWalletCompiledCode();
    return calcAddressOfJettonWallet(ownerAddress, contract.getAddress(), jettonWalletCode);
}

get fun get_next_admin_address(): address? {
    val storage = lazy MinterStorage.load();
    return storage.nextAdminAddress;
}

get fun get_cumulative_minted(): coins {
    val storage = lazy MinterStorage.load();
    return storage.totalMinted;
}

get fun get_public_issuer_address(): address {
    val storage = lazy MinterStorage.load();
    val extra = MinterExtra.fromCell(storage.extra);
    return extra.publicIssuerAddress;
}

get fun get_mining_issuer_address(): address? {
    val storage = lazy MinterStorage.load();
    val extra = MinterExtra.fromCell(storage.extra);
    return extra.miningIssuerAddress;
}

get fun get_public_issued(): coins {
    val storage = lazy MinterStorage.load();
    val extra = MinterExtra.fromCell(storage.extra);
    return extra.publicIssued;
}

get fun get_mining_issued(): coins {
    val storage = lazy MinterStorage.load();
    val extra = MinterExtra.fromCell(storage.extra);
    return extra.miningIssued;
}

get fun get_max_supply(): coins {
    val storage = lazy MinterStorage.load();
    return storage.maxSupply;
}

get fun get_pending_mint(queryId: uint64): PendingMintRecord? {
    val storage = lazy MinterStorage.load();
    val extra = MinterExtra.fromCell(storage.extra);
    val lookup = extra.pendingMints.get(queryId);
    return lookup.isFound ? lookup.loadValue() : null;
}
