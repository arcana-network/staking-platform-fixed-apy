// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");
const { n18 } = require("../test-old/helpers");

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  await hre.run("compile");

  const TOKEN_ADDRESS = "0xa9A146E56c57A89D3C1FC631Acb2D149c5DD0030";
  const STAKING_PLATFORM_DEEP = "0x3c353c3574b6FDc187b3834473711D308C3dBAE2";
  const STAKING_PLATFORM_MID = "0xA297343b0F0F75D2ce89C5C898Fb913C8195D405";
  const STAKING_PLATFORM_QUICK = "0x78CEaC3E8cDfb636BE196A4773Ca97e9496CC841";

  const Token = await hre.ethers.getContractFactory("Token");
  const TOKEN_SUPPLY = n18("10000000000000000000");
  let token;
  if (TOKEN_ADDRESS === "" || TOKEN_ADDRESS === undefined) {
    token = await Token.deploy(TOKEN_SUPPLY);
    await token.deployed();
  } else {
    token = await Token.attach(TOKEN_ADDRESS);
  }
  console.log("Token deployed to:", token.address);

  const STAKING_DURATION = 180;
  const LOCKING_DURATION_DEEP = 90;
  const LOCKING_DURATION_MID = 60;
  const LOCKING_DURATION_QUICK = 30;
  const DAYS_IN_YEAR = 360;

  // This calculated on early basis
  const APY_DEEP = 100;
  const APY_MID = 84;
  const APY_QUICK = 72;

  // Interest given as parameter in contract is per duration
  const INTEREST_DEEP = APY_DEEP * (STAKING_DURATION / DAYS_IN_YEAR);
  const INTEREST_MID = APY_MID * (STAKING_DURATION / DAYS_IN_YEAR);
  const INTEREST_QUICK = APY_QUICK * (STAKING_DURATION / DAYS_IN_YEAR);

  const StakingPlatform = await hre.ethers.getContractFactory(
    "StakingPlatform"
  );
  let deepPool;
  if (STAKING_PLATFORM_DEEP !== "") {
    deepPool = await StakingPlatform.attach(STAKING_PLATFORM_DEEP);
    console.log("Staking platform -- Deep Pool deployed to:", deepPool.address);
  } else {
    deepPool = await StakingPlatform.deploy(
      token.address,
      INTEREST_DEEP,
      STAKING_DURATION,
      LOCKING_DURATION_DEEP,
      hre.ethers.constants.MaxUint256
    );
    await deepPool.deployed();
    await deepPool.startStaking();
    await token.transfer(deepPool.address, n18("5000000"));
    console.log("Staking platform -- Deep Pool deployed to:", deepPool.address);
  }

  let midPool;
  if (STAKING_PLATFORM_MID !== "") {
    midPool = await StakingPlatform.attach(STAKING_PLATFORM_MID);
    console.log("Staking platform -- Mid Pool deployed to:", midPool.address);
  } else {
    midPool = await StakingPlatform.deploy(
      token.address,
      INTEREST_MID,
      STAKING_DURATION,
      LOCKING_DURATION_MID,
      hre.ethers.constants.MaxUint256
    );
    await midPool.deployed();
    await midPool.startStaking();
    await token.transfer(midPool.address, n18("42000000"));
    console.log("Staking platform -- Mid Pool deployed to:", midPool.address);
  }

  let quickPool;
  if (STAKING_PLATFORM_QUICK !== "") {
    quickPool = await StakingPlatform.attach(STAKING_PLATFORM_QUICK);
    console.log(
      "Staking platform -- Quick Pool deployed to:",
      quickPool.address
    );
  } else {
    quickPool = await StakingPlatform.deploy(
      token.address,
      INTEREST_QUICK,
      STAKING_DURATION,
      LOCKING_DURATION_QUICK,
      hre.ethers.constants.MaxUint256
    );
    await quickPool.deployed();
    await quickPool.startStaking();
    await token.transfer(quickPool.address, n18("40250000"));
    console.log(
      "Staking platform -- Quick Pool deployed to:",
      quickPool.address
    );
  }

  console.log("All contracts deployed successfully");

  console.log("Verifying contracts");
  await hre.run("verify:verify", {
    address: token.address,
    constructorArguments: [TOKEN_SUPPLY],
    contract: "contracts/token/Token.sol:Token",
  });

  await hre.run("verify:verify", {
    address: deepPool.address,
    constructorArguments: [
      token.address,
      INTEREST_DEEP,
      STAKING_DURATION,
      LOCKING_DURATION_DEEP,
      hre.ethers.constants.MaxUint256,
    ],
    // contract: "contracts/staking/StakingPlatform:StakingPlatform",
  });
  await hre.run("verify:verify", {
    address: midPool.address,
    constructorArguments: [
      token.address,
      INTEREST_MID,
      STAKING_DURATION,
      LOCKING_DURATION_MID,
      hre.ethers.constants.MaxUint256,
    ],
  });
  await hre.run("verify:verify", {
    address: quickPool.address,
    constructorArguments: [
      token.address,
      INTEREST_QUICK,
      STAKING_DURATION,
      LOCKING_DURATION_QUICK,
      hre.ethers.constants.MaxUint256,
    ],
  });
  console.log("Contracts verified");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
