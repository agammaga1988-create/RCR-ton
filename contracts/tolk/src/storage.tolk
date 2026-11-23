struct WalletStorage {
    jettonBalance: coins
    ownerAddress: address
    minterAddress: address
}

struct PendingMintRecord {
    issuerAddress: address
    recipient: address
    amount: coins
    isMining: bool
}

struct MinterExtra {
    publicIssuerAddress: address
    miningIssuerAddress: address?
    publicIssued: coins
    miningIssued: coins
    pendingMints: map<uint64, PendingMintRecord>
}

struct MinterStorage {
    totalSupply: coins
    totalMinted: coins
    maxSupply: coins
    adminAddress: address?
    nextAdminAddress: address?
    metadata: cell
    extra: cell
}

fun MinterStorage.load(): MinterStorage {
    return MinterStorage.fromCell(contract.getData());
}

fun MinterStorage.save(self) {
    contract.setData(self.toCell());
}

fun WalletStorage.load(): WalletStorage {
    return WalletStorage.fromCell(contract.getData());
}

fun WalletStorage.save(self) {
    contract.setData(self.toCell());
}

struct JettonWalletDataReply {
    jettonBalance: coins
    ownerAddress: address
    minterAddress: address
    jettonWalletCode: cell
}

struct JettonDataReply {
    totalSupply: int
    mintable: bool
    adminAddress: address?
    jettonContent: Cell<OnchainMetadataReply>
    jettonWalletCode: cell
}

struct (0x00) OnchainMetadataReply {
    contentDict: map<uint256, Cell<SnakeDataReply>>
}

struct (0x00) SnakeDataReply {
    string: string
}

struct MiningClaimRecord {
    recipient: address
    amount: coins
    status: uint8
}

struct MiningIssuerExtra {
    totalIssued: coins
    totalPending: coins
    paused: bool
    claims: map<uint64, MiningClaimRecord>
}

struct MiningIssuerStorage {
    adminAddress: address
    operatorAddress: address
    minterAddress: address
    extra: cell
}

struct MiningIssuerDataReply {
    adminAddress: address
    operatorAddress: address
    minterAddress: address
    totalIssued: coins
    totalPending: coins
    paused: bool
}

fun MiningIssuerStorage.load() {
    return MiningIssuerStorage.fromCell(contract.getData());
}

fun MiningIssuerStorage.save(self) {
    contract.setData(self.toCell());
}
