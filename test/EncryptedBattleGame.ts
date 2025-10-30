import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { EncryptedBattleGame, EncryptedBattleGame__factory } from "../types";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("EncryptedBattleGame")) as EncryptedBattleGame__factory;
  const game = (await factory.deploy()) as EncryptedBattleGame;
  const address = await game.getAddress();

  return { game, address };
}

describe("EncryptedBattleGame", function () {
  let signers: Signers;
  let game: EncryptedBattleGame;
  let gameAddress: string;

  before(async function () {
    const allSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: allSigners[0], alice: allSigners[1], bob: allSigners[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      this.skip();
    }

    const deployment = await deployFixture();
    game = deployment.game;
    gameAddress = deployment.address;
  });

  async function encryptRole(role: number, player: HardhatEthersSigner) {
    return fhevm.createEncryptedInput(gameAddress, player.address).add8(role).encrypt();
  }

  it("registers a player with encrypted data", async function () {
    const aliceInput = await encryptRole(1, signers.alice);

    const tx = await game.connect(signers.alice).registerPlayer(aliceInput.handles[0], aliceInput.inputProof);
    await tx.wait();

    expect(await game.isRegistered(signers.alice.address)).to.equal(true);

    const cipher = await game.getPlayerCiphertexts(signers.alice.address);

    const role = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      cipher.role,
      gameAddress,
      signers.alice,
    );

    const attack = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      cipher.attackPower,
      gameAddress,
      signers.alice,
    );

    expect(role).to.equal(1n);
    expect(Number(attack)).to.be.gte(10);
    expect(Number(attack)).to.be.lte(100);
  });

  it("prevents duplicate registrations", async function () {
    const aliceInput = await encryptRole(2, signers.alice);

    await (await game.connect(signers.alice).registerPlayer(aliceInput.handles[0], aliceInput.inputProof)).wait();

    await expect(
      game.connect(signers.alice).registerPlayer(aliceInput.handles[0], aliceInput.inputProof),
    ).to.be.revertedWith("Player already registered");
  });

  it("refreshes access for ciphertexts", async function () {
    const bobInput = await encryptRole(3, signers.bob);
    await (await game.connect(signers.bob).registerPlayer(bobInput.handles[0], bobInput.inputProof)).wait();

    await expect(game.connect(signers.bob).refreshMyAccess()).to.emit(game, "PlayerAccessRefreshed");
  });

  it("tracks registered player addresses", async function () {
    const aliceInput = await encryptRole(1, signers.alice);
    const bobInput = await encryptRole(4, signers.bob);

    await (await game.connect(signers.alice).registerPlayer(aliceInput.handles[0], aliceInput.inputProof)).wait();
    await (await game.connect(signers.bob).registerPlayer(bobInput.handles[0], bobInput.inputProof)).wait();

    const players = await game.getRegisteredPlayers();

    expect(players).to.deep.equal([signers.alice.address, signers.bob.address]);
  });
});
