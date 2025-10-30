import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedEncryptedBattleGame = await deploy("EncryptedBattleGame", {
    from: deployer,
    log: true,
  });

  console.log(`EncryptedBattleGame contract: `, deployedEncryptedBattleGame.address);
};
export default func;
func.id = "deploy_encryptedBattleGame"; // id required to prevent reexecution
func.tags = ["EncryptedBattleGame"];
