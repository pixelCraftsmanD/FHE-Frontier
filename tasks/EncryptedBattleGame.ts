import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

task("task:game-address", "Prints the EncryptedBattleGame address").setAction(async (_taskArguments: TaskArguments, hre) => {
  const { deployments } = hre;

  const deployment = await deployments.get("EncryptedBattleGame");
  console.log(`EncryptedBattleGame address: ${deployment.address}`);
});

task("task:game-register", "Registers the caller with an encrypted role")
  .addParam("role", "Role id between 1 and 4")
  .addOptionalParam("address", "Optional game contract address")
  .setAction(async (taskArguments: TaskArguments, hre) => {
    const { ethers, deployments, fhevm } = hre;

    const roleValue = parseInt(taskArguments.role);
    if (![1, 2, 3, 4].includes(roleValue)) {
      throw new Error("Role must be between 1 and 4");
    }

    await fhevm.initializeCLIApi();

    const gameDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("EncryptedBattleGame");
    console.log(`EncryptedBattleGame: ${gameDeployment.address}`);

    const signers = await ethers.getSigners();
    const signer = signers[0];

    const encryptedInput = await fhevm
      .createEncryptedInput(gameDeployment.address, signer.address)
      .add8(roleValue)
      .encrypt();

    const contract = await ethers.getContractAt("EncryptedBattleGame", gameDeployment.address);

    const tx = await contract.connect(signer).registerPlayer(encryptedInput.handles[0], encryptedInput.inputProof);
    console.log(`Wait for tx: ${tx.hash}`);
    await tx.wait();
    console.log(`Registered role ${roleValue}`);
  });

task("task:game-decrypt", "Decrypts sender's role and attack power")
  .addOptionalParam("address", "Optional game contract address")
  .setAction(async (taskArguments: TaskArguments, hre) => {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const gameDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("EncryptedBattleGame");
    console.log(`EncryptedBattleGame: ${gameDeployment.address}`);

    const signers = await ethers.getSigners();
    const signer = signers[0];

    const contract = await ethers.getContractAt("EncryptedBattleGame", gameDeployment.address);

    const ciphertexts = await contract.getPlayerCiphertexts(signer.address);

    const role = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      ciphertexts.role,
      gameDeployment.address,
      signer,
    );
    const attackPower = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      ciphertexts.attackPower,
      gameDeployment.address,
      signer,
    );

    console.log(`Role id: ${role}`);
    console.log(`Attack power: ${attackPower}`);
  });
