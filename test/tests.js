const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("StakingPlatform", function () {
  let deployer, user;
  let stakingPlatform, token;
  const initialSupply = ethers.utils.parseEther(String(10 ** 9));
  const depositAmount = ethers.utils.parseEther("1000");
  const fixedAPY = 50; // 10% APY
  const durationInDays = 180;
  const lockDurationInDays = 90;
  const residualBalanceLockDurationInDays = 90;
  const maxAmountStaked = ethers.constants.MaxUint256;

  beforeEach(async function () {
    [deployer, user, user2] = await ethers.getSigners();

    // Deploy your ERC20 token and the StakingPlatform contracts here
    const Token = await ethers.getContractFactory("Token", deployer);
    token = await Token.deploy(initialSupply);

    const StakingPlatform = await ethers.getContractFactory(
      "StakingPlatform",
      deployer
    );
    stakingPlatform = await StakingPlatform.deploy(
      token.address,
      fixedAPY,
      durationInDays,
      lockDurationInDays,
      maxAmountStaked
    );

    // Transfer tokens to the user for testing
    await token.transfer(user.address, depositAmount.mul(3));
    // Transfer tokens to the staking platform for reward distribution
    await token.transfer(stakingPlatform.address, depositAmount);
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await stakingPlatform.owner()).to.equal(deployer.address);
    });

    it("Should set the right parameters", async function () {
      expect(await stakingPlatform.token()).to.equal(token.address);
      expect(await stakingPlatform.fixedAPY()).to.equal(fixedAPY);

      expect(await stakingPlatform.token()).to.equal(token.address);
      expect(await stakingPlatform.fixedAPY()).to.equal(fixedAPY);

      // Check for stakingDuration parameter
      const expectedStakingDuration = durationInDays * 24 * 60 * 60; // Convert days to seconds
      expect(await stakingPlatform.stakingDuration()).to.equal(
        expectedStakingDuration
      );

      // Check for lockupDuration parameter
      const expectedLockupDuration = lockDurationInDays * 24 * 60 * 60; // Convert days to seconds
      expect(await stakingPlatform.lockupDuration()).to.equal(
        expectedLockupDuration
      );

      // Check for stakingMax parameter
      expect(await stakingPlatform.stakingMax()).to.equal(maxAmountStaked);
    });
  });

  describe("Staking", function () {
    it("Should allow users to deposit tokens", async function () {
      // Record the initial total staked amount and user balance
      const initialTotalStaked = await stakingPlatform.totalDeposited();
      const initialUserBalance = await token.balanceOf(user.address);
      const initialContractBalance = await token.balanceOf(
        stakingPlatform.address
      );

      // User approves and deposits tokens to the staking platform
      await token.connect(user).approve(stakingPlatform.address, depositAmount);
      await stakingPlatform.connect(user).deposit(depositAmount);

      // Check if the amount staked by the user is correct
      expect(await stakingPlatform.amountStaked(user.address)).to.equal(
        depositAmount
      );

      // Verify the total staked amount on the contract is updated correctly
      expect(await stakingPlatform.totalDeposited()).to.equal(
        initialTotalStaked.add(depositAmount)
      );

      // Ensure the user's token balance decreased by the deposit amount
      expect(await token.balanceOf(user.address)).to.equal(
        initialUserBalance.sub(depositAmount)
      );

      // Ensure the contract's token balance increased by the deposit amount
      expect(await token.balanceOf(stakingPlatform.address)).to.equal(
        initialContractBalance.add(depositAmount)
      );
    });

    it("Should allow users to deposit tokens twice", async function () {
      await stakingPlatform.connect(deployer).startStaking();
      // User approves and deposits tokens to the staking platform
      await token.connect(user).approve(stakingPlatform.address, depositAmount);
      await stakingPlatform.connect(user).deposit(depositAmount);

      // Check if the user's startTime is updated correctly
      const blockTimestamp = (await ethers.provider.getBlock("latest"))
        .timestamp;

      // Deposit again after 10 days
      await ethers.provider.send("evm_increaseTime", [10 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine");

      // Record the initial total staked amount and user balance
      const initialTotalStaked = await stakingPlatform.totalDeposited();
      const initialUserBalance = await token.balanceOf(user.address);
      const initialContractBalance = await token.balanceOf(
        stakingPlatform.address
      );

      // User approves and deposits tokens to the staking platform
      await token.connect(user).approve(stakingPlatform.address, depositAmount);
      await stakingPlatform.connect(user).deposit(depositAmount);

      // Check if the amount staked by the user is correct
      expect(await stakingPlatform.amountStaked(user.address)).to.equal(
        depositAmount.mul(2)
      );

      // Verify the total staked amount on the contract is updated correctly
      expect(await stakingPlatform.totalDeposited()).to.equal(
        initialTotalStaked.add(depositAmount)
      );

      // Ensure the user's token balance decreased by the deposit amount
      expect(await token.balanceOf(user.address)).to.equal(
        initialUserBalance.sub(depositAmount)
      );

      // Ensure the contract's token balance increased by the deposit amount
      expect(await token.balanceOf(stakingPlatform.address)).to.equal(
        initialContractBalance.add(depositAmount)
      );

      expect(
        await stakingPlatform.getUserLockUpStartTime(user.address)
      ).to.equal(blockTimestamp);
    });

    it("Should allow users to deposit tokens thrice", async function () {
      await stakingPlatform.connect(deployer).startStaking();
      // User approves and deposits tokens to the staking platform
      await token.connect(user).approve(stakingPlatform.address, depositAmount);
      await stakingPlatform.connect(user).deposit(depositAmount);

      // Check if the user's startTime is updated correctly
      const blockTimestamp = (await ethers.provider.getBlock("latest"))
        .timestamp;

      // Deposit again after 10 days
      await ethers.provider.send("evm_increaseTime", [10 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine");

      await token.connect(user).approve(stakingPlatform.address, depositAmount);
      await stakingPlatform.connect(user).deposit(depositAmount);

      // Deposit again after 9 days
      await ethers.provider.send("evm_increaseTime", [9 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine");

      // Record the initial total staked amount and user balance
      const initialTotalStaked = await stakingPlatform.totalDeposited();
      const initialUserBalance = await token.balanceOf(user.address);
      const initialContractBalance = await token.balanceOf(
        stakingPlatform.address
      );

      // User approves and deposits tokens to the staking platform
      await token.connect(user).approve(stakingPlatform.address, depositAmount);
      await stakingPlatform.connect(user).deposit(depositAmount);

      // Check if the amount staked by the user is correct
      expect(await stakingPlatform.amountStaked(user.address)).to.equal(
        depositAmount.mul(3)
      );

      // Verify the total staked amount on the contract is updated correctly
      expect(await stakingPlatform.totalDeposited()).to.equal(
        initialTotalStaked.add(depositAmount)
      );

      // Ensure the user's token balance decreased by the deposit amount
      expect(await token.balanceOf(user.address)).to.equal(
        initialUserBalance.sub(depositAmount)
      );

      // Ensure the contract's token balance increased by the deposit amount
      expect(await token.balanceOf(stakingPlatform.address)).to.equal(
        initialContractBalance.add(depositAmount)
      );

      expect(
        await stakingPlatform.getUserLockUpStartTime(user.address)
      ).to.equal(blockTimestamp);
    });

    it("Check startTime", async function () {
      await stakingPlatform.startStaking();
      // deposit
      await token.connect(user).approve(stakingPlatform.address, depositAmount);
      let tx = await stakingPlatform.connect(user).deposit(depositAmount);
      let blockTimestamp = (await ethers.provider.getBlock(tx.blockNumber))
        .timestamp;
      expect(
        await stakingPlatform.getUserLockUpStartTime(user.address)
      ).to.equal(blockTimestamp);
    });

    it("Should allow the owner to start staking", async function () {
      // Owner starts the staking period
      await stakingPlatform.startStaking();
      const blockTimestamp = (await ethers.provider.getBlock("latest"))
        .timestamp;

      // Check if the startPeriod, lockupPeriod, and endPeriod are set correctly
      expect(await stakingPlatform.startPeriod()).to.equal(blockTimestamp);
      expect(await stakingPlatform.lockupPeriod()).to.equal(
        blockTimestamp + lockDurationInDays * 24 * 60 * 60
      );
      expect(await stakingPlatform.endPeriod()).to.equal(
        blockTimestamp + durationInDays * 24 * 60 * 60
      );
    });

    it("Should allow users to claim rewards correctly", async function () {
      const initialUserBalance = await token
        .connect(user)
        .balanceOf(user.address);
      // User approves and deposits tokens into the staking platform
      await token.connect(user).approve(stakingPlatform.address, depositAmount);
      await stakingPlatform.connect(user).deposit(depositAmount);

      // Start staking period
      await stakingPlatform.connect(deployer).startStaking();

      // Simulate time passing to accumulate rewards
      const timeToPass = lockDurationInDays * 24 * 60 * 60;
      await ethers.provider.send("evm_increaseTime", [timeToPass]);
      await ethers.provider.send("evm_mine"); // This command forces the EVM to mine another block
      const startPeriod = await stakingPlatform.startPeriod();
      const endPeriod = await stakingPlatform.endPeriod();
      // Calculate expected rewards
      // This is a simplified version; your actual calculation will depend on your contract's logic
      const expectedRewards = depositAmount
        .mul(fixedAPY)
        .div(100)
        .mul(timeToPass)
        .div(endPeriod - startPeriod);

      // console.log("expectedRewards", ethers.utils.formatEther(expectedRewards));

      // User claims rewards
      await stakingPlatform.connect(user).claimRewards();

      // Check if the rewards were transferred to the user's account
      const finalUserBalance = await token.balanceOf(user.address);
      // Assuming the user had no other token transactions, the final balance should be the initial deposit minus the stake, plus the rewards
      // Since this test does not account for the exact reward mechanism or token transfers, replace `initialUserBalance` and `depositAmount`
      // with the correct logic for your test setup.
      expect(finalUserBalance).to.be.closeTo(
        initialUserBalance.sub(depositAmount).add(expectedRewards),
        ethers.utils.parseEther("0.01")
      );

      // Check if the rewardsToClaim for the user is reset to 0
      const rewardsAfterClaim = await stakingPlatform.rewardOf(user.address);
      expect(rewardsAfterClaim).to.equal(0);
    });
  });

  describe("Withdraw:", () => {
    it("Should allow users to withdraw their stake after the lockup period ends", async function () {
      // User deposits tokens
      await token.connect(user).approve(stakingPlatform.address, depositAmount);
      await stakingPlatform.connect(user).deposit(depositAmount);

      // Start staking period
      await stakingPlatform.connect(deployer).startStaking();

      // Simulate time passing beyond the lockup period
      const timeToPass = lockDurationInDays * 24 * 60 * 60 + 1; // Lockup period plus one second
      await ethers.provider.send("evm_increaseTime", [timeToPass]);
      await ethers.provider.send("evm_mine");

      // Record balances before withdrawal
      const initialUserBalance = await token.balanceOf(user.address);
      const initialContractBalance = await token.balanceOf(
        stakingPlatform.address
      );
      const initialTotalStaked = await stakingPlatform.totalDeposited();

      const rewardsToClaim = await stakingPlatform.rewardOf(user.address);

      // User withdraws their stake
      await stakingPlatform.connect(user).withdraw(depositAmount);

      // Ensure user's token balance increased by the withdrawn amount
      const finalUserBalance = await token.balanceOf(user.address);
      expect(finalUserBalance).to.equal(
        initialUserBalance.add(depositAmount).add(rewardsToClaim)
      );

      // Ensure the contract's token balance decreased by the withdrawn amount
      const finalContractBalance = await token.balanceOf(
        stakingPlatform.address
      );
      expect(finalContractBalance).to.equal(
        initialContractBalance.sub(depositAmount).sub(rewardsToClaim)
      );

      // Verify the total staked amount on the contract is updated correctly
      const finalTotalStaked = await stakingPlatform.totalDeposited();
      expect(finalTotalStaked).to.equal(initialTotalStaked.sub(depositAmount));

      // Check that the user's staked amount is reset to 0
      const userStakedAmount = await stakingPlatform.amountStaked(user.address);
      expect(userStakedAmount).to.equal(0);
    });

    it("Should allow users to withdraw their stake and rewards after the staking period ends but before their lockup period", async function () {
      // Start staking period
      await stakingPlatform.connect(deployer).startStaking();
      // User deposits tokens 2 days before the staking period ends
      let time = (durationInDays - 2) * 24 * 60 * 60; // 2 days before the staking period ends
      await ethers.provider.send("evm_increaseTime", [time]);
      await ethers.provider.send("evm_mine");

      await token.connect(user).approve(stakingPlatform.address, depositAmount);
      await stakingPlatform.connect(user).deposit(depositAmount);

      // Simulate time passing 2 days after the deposit
      let timeToPass = 2 * 24 * 60 * 60 + 1; // 2 days after the deposit
      await ethers.provider.send("evm_increaseTime", [timeToPass]);
      await ethers.provider.send("evm_mine");

      // Record balances before withdrawal
      const initialUserBalance = await token.balanceOf(user.address);
      const initialContractBalance = await token.balanceOf(
        stakingPlatform.address
      );
      const initialTotalStaked = await stakingPlatform.totalDeposited();

      const rewardsToClaim = await stakingPlatform.rewardOf(user.address);

      // User withdraws their stake
      await stakingPlatform.connect(user).withdraw(depositAmount);

      // Ensure user's token balance increased by the withdrawn amount
      const finalUserBalance = await token.balanceOf(user.address);
      expect(finalUserBalance).to.equal(
        initialUserBalance.add(depositAmount).add(rewardsToClaim)
      );

      // Ensure the contract's token balance decreased by the withdrawn amount
      const finalContractBalance = await token.balanceOf(
        stakingPlatform.address
      );
      expect(finalContractBalance).to.equal(
        initialContractBalance.sub(depositAmount).sub(rewardsToClaim)
      );

      // Verify the total staked amount on the contract is updated correctly
      const finalTotalStaked = await stakingPlatform.totalDeposited();
      expect(finalTotalStaked).to.equal(initialTotalStaked.sub(depositAmount));

      // Check that the user's staked amount is reset to 0
      const userStakedAmount = await stakingPlatform.amountStaked(user.address);
      expect(userStakedAmount).to.equal(0);

      expect(await stakingPlatform.rewardOf(user.address)).to.equal(0);

      // check userLockUpStartTime
      expect(
        await stakingPlatform.getUserLockUpStartTime(user.address)
      ).to.equal(ethers.constants.MaxUint256);
    });

    it("Withdraw partial stake", async function () {
      // start staking
      await stakingPlatform.connect(deployer).startStaking();
      // deposit
      await token.connect(user).approve(stakingPlatform.address, depositAmount);
      await stakingPlatform.connect(user).deposit(depositAmount);

      // record block timestamp
      const blockTimestamp = (await ethers.provider.getBlock("latest"))
        .timestamp;

      // simulate time passing
      let timeToPass = lockDurationInDays * 24 * 60 * 60;
      await ethers.provider.send("evm_increaseTime", [timeToPass]);
      await ethers.provider.send("evm_mine");
      // record balances before withdrawal
      const initialUserBalance = await token.balanceOf(user.address);
      const initialContractBalance = await token.balanceOf(
        stakingPlatform.address
      );
      const initialTotalStaked = await stakingPlatform.totalDeposited();
      const rewardsToClaim = await stakingPlatform.rewardOf(user.address);

      // withdraw partial stake
      await stakingPlatform.connect(user).withdraw(depositAmount.div(2));

      // ensure user's token balance increased by the withdrawn amount
      const finalUserBalance = await token.balanceOf(user.address);
      expect(finalUserBalance).to.equal(
        initialUserBalance.add(depositAmount.div(2)).add(rewardsToClaim)
      );

      // ensure the contract's token balance decreased by the withdrawn amount
      const finalContractBalance = await token.balanceOf(
        stakingPlatform.address
      );
      expect(finalContractBalance).to.equal(
        initialContractBalance.sub(depositAmount.div(2)).sub(rewardsToClaim)
      );

      // verify the total staked amount on the contract is updated correctly
      const finalTotalStaked = await stakingPlatform.totalDeposited();
      expect(finalTotalStaked).to.equal(
        initialTotalStaked.sub(depositAmount.div(2))
      );

      // check that the user's staked amount is updated correctly
      const userStakedAmount = await stakingPlatform.amountStaked(user.address);
      expect(userStakedAmount).to.equal(depositAmount.div(2));

      // userStartTime should not be updated
      expect(
        await stakingPlatform.getUserLockUpStartTime(user.address)
      ).to.equal(blockTimestamp);
    });

    it("Test withdraw all stake", async function () {
      // deposit
      await token.connect(user).approve(stakingPlatform.address, depositAmount);
      await stakingPlatform.connect(user).deposit(depositAmount);

      // start staking
      await stakingPlatform.connect(deployer).startStaking();

      // simulate time passing
      let timeToPass = lockDurationInDays * 24 * 60 * 60;
      await ethers.provider.send("evm_increaseTime", [timeToPass]);
      await ethers.provider.send("evm_mine");

      // record balances before withdrawal
      const initialUserBalance = await token.balanceOf(user.address);
      const initialContractBalance = await token.balanceOf(
        stakingPlatform.address
      );
      const rewardsToClaim = await stakingPlatform.rewardOf(user.address);

      // withdraw all stake
      await stakingPlatform.connect(user).withdrawAll();

      // ensure user's token balance increased by the withdrawn amount
      const finalUserBalance = await token.balanceOf(user.address);
      expect(finalUserBalance).to.equal(
        initialUserBalance.add(depositAmount).add(rewardsToClaim)
      );

      // ensure the contract's token balance decreased by the withdrawn amount
      const finalContractBalance = await token.balanceOf(
        stakingPlatform.address
      );
      expect(finalContractBalance).to.equal(
        initialContractBalance.sub(depositAmount).sub(rewardsToClaim)
      );

      // check that the user's staked amount is reset to 0
      const userStakedAmount = await stakingPlatform.amountStaked(user.address);
      expect(userStakedAmount).to.equal(0);

      // check that the user's reward is reset to 0
      expect(await stakingPlatform.rewardOf(user.address)).to.equal(0);

      // check if userLockupStartTime is set to staking
      expect(
        await stakingPlatform.getUserLockUpStartTime(user.address)
      ).to.equal(ethers.constants.MaxUint256);
    });

    it("Should allow withdraw after staking twice and lockup period should be set as per the first deposit", async function () {
      // start staking
      await stakingPlatform.connect(deployer).startStaking();

      // deposit
      await token.connect(user).approve(stakingPlatform.address, depositAmount);
      await stakingPlatform.connect(user).deposit(depositAmount);

      // record block timestamp
      const blockTimestamp = (await ethers.provider.getBlock("latest"))
        .timestamp;

      // simulate time passing
      let timeToPass = [lockDurationInDays - 10] * 24 * 60 * 60;
      await ethers.provider.send("evm_increaseTime", [timeToPass]);
      await ethers.provider.send("evm_mine");

      // deposit again
      await token.connect(user).approve(stakingPlatform.address, depositAmount);
      await stakingPlatform.connect(user).deposit(depositAmount);

      // simulate time passing
      timeToPass = 10 * 24 * 60 * 60;
      await ethers.provider.send("evm_increaseTime", [timeToPass]);
      await ethers.provider.send("evm_mine");

      // record balances before withdrawal
      const initialUserBalance = await token.balanceOf(user.address);
      const initialContractBalance = await token.balanceOf(
        stakingPlatform.address
      );
      const initialTotalStaked = await stakingPlatform.totalDeposited();
      const rewardsToClaim = await stakingPlatform.rewardOf(user.address);

      // withdraw all stake
      await stakingPlatform.connect(user).withdrawAll();

      // ensure user's token balance increased by the withdrawn amount
      const finalUserBalance = await token.balanceOf(user.address);
      expect(finalUserBalance).to.equal(
        initialUserBalance.add(depositAmount.mul(2)).add(rewardsToClaim)
      );

      // ensure the contract's token balance decreased by the withdrawn amount
      const finalContractBalance = await token.balanceOf(
        stakingPlatform.address
      );

      expect(finalContractBalance).to.equal(
        initialContractBalance.sub(depositAmount.mul(2)).sub(rewardsToClaim)
      );

      // verify the total staked amount on the contract is updated correctly
      const finalTotalStaked = await stakingPlatform.totalDeposited();
      expect(finalTotalStaked).to.equal(initialTotalStaked.sub(depositAmount.mul(2)));

      // check that the user's staked amount is reset to 0
      const userStakedAmount = await stakingPlatform.amountStaked(user.address);
      expect(userStakedAmount).to.equal(0);

      // check that the user's reward is reset to 0
      expect(await stakingPlatform.rewardOf(user.address)).to.equal(0);

      // check if userLockupStartTime is set to uint256 max
      expect(
        await stakingPlatform.getUserLockUpStartTime(user.address)
      ).to.equal(ethers.constants.MaxUint256);
    });
  });

  describe("Owner editing parameters", () => {
    it("setMaxStakingPerUser", async () => {
      const newMaxAmountStaked = ethers.utils.parseEther(30_000_000 + "");
      await stakingPlatform
        .connect(deployer)
        .setMaxStakingPerUser(newMaxAmountStaked);
      expect(await stakingPlatform.maxStakingPerUser()).to.equal(
        newMaxAmountStaked
      );
    });

    it("setStakingMax", async () => {
      const newMaxAmountStaked = ethers.utils.parseEther(30_000_000 + "");
      await stakingPlatform.connect(deployer).setStakingMax(newMaxAmountStaked);
      expect(await stakingPlatform.stakingMax()).to.equal(newMaxAmountStaked);
    });

    it("setLockupDuration", async () => {
      const newLockupDuration = 20;
      await stakingPlatform
        .connect(deployer)
        .setLockupDuration(newLockupDuration);
      expect(await stakingPlatform.lockupDuration()).to.equal(
        newLockupDuration * 24 * 60 * 60
      );
    });

    it("pause the contract", async () => {
      await stakingPlatform.connect(deployer).pause();
      expect(await stakingPlatform.paused()).to.be.true;
    });

    it("unpause the contract", async () => {
      await stakingPlatform.connect(deployer).pause();
      await stakingPlatform.connect(deployer).unpause();
      expect(await stakingPlatform.paused()).to.be.false;
    });
  });

  describe("Paused state", () => {
    it("Should not allow staking when paused", async () => {
      await stakingPlatform.connect(deployer).pause();
      await expect(
        stakingPlatform.connect(user).deposit(depositAmount)
      ).to.be.revertedWith("Pausable: paused");
    });

    it("Should not allow withdrawing when paused", async () => {
      await token.connect(user).approve(stakingPlatform.address, depositAmount);
      await stakingPlatform.connect(user).deposit(depositAmount);

      await stakingPlatform.connect(deployer).pause();
      await expect(
        stakingPlatform.connect(user).withdraw(depositAmount)
      ).to.be.revertedWith("Pausable: paused");
    });

    it("Should not allow claiming rewards when paused", async () => {
      await token.connect(user).approve(stakingPlatform.address, depositAmount);
      await stakingPlatform.connect(user).deposit(depositAmount);

      await stakingPlatform.connect(deployer).startStaking();

      await stakingPlatform.connect(deployer).pause();
      await expect(
        stakingPlatform.connect(user).claimRewards()
      ).to.be.revertedWith("Pausable: paused");
    });

    it("Should not allow the owner to start staking when paused", async () => {
      await stakingPlatform.connect(deployer).pause();
      await expect(
        stakingPlatform.connect(deployer).startStaking()
      ).to.be.revertedWith("Pausable: paused");
    });

    it("Should not allow the owner to change parameters when paused", async () => {
      await stakingPlatform.connect(deployer).pause();
      await expect(
        stakingPlatform.connect(deployer).setMaxStakingPerUser(depositAmount)
      ).to.be.revertedWith("Pausable: paused");
    });
  });

  describe("Deposit limit", () => {
    it("Should not allow users to deposit more than the max staking per user", async () => {
      // lower the max staking per user to avoid the deposit amount exceeding the limit
      await stakingPlatform
        .connect(deployer)
        .setMaxStakingPerUser(depositAmount);
      const invalidAmount = (await stakingPlatform.maxStakingPerUser()).add(1); // Deposit amount exceeds the max staking per user
      await token.approve(stakingPlatform.address, invalidAmount);
      await expect(stakingPlatform.deposit(invalidAmount)).to.be.revertedWith(
        "Stake exceeds user's limit"
      );
    });

    it("Should not allow users to deposit more than the staking max", async () => {
      // lower the staking max to avoid the deposit amount exceeding the limit
      await stakingPlatform.connect(deployer).setStakingMax(depositAmount);
      const invalidAmount = (await stakingPlatform.stakingMax()).add(1); // Deposit amount exceeds the staking max
      await token.approve(stakingPlatform.address, invalidAmount);
      await expect(stakingPlatform.deposit(invalidAmount)).to.be.revertedWith(
        "Amount staked exceeds MaxStake"
      );
    });
  });

  describe("withdrawResidualBalance", () => {
    it("Should allow the owner to withdraw the residual balance", async () => {
      const initialContractBalance = await token.balanceOf(
        stakingPlatform.address
      );
      const initialOwnerBalance = await token.balanceOf(deployer.address);
      const amountToWithdraw = ethers.utils.parseEther("1000");
      await token.transfer(stakingPlatform.address, amountToWithdraw);
      await stakingPlatform.connect(deployer).withdrawResidualBalance();
      const finalContractBalance = await token.balanceOf(
        stakingPlatform.address
      );
      const finalOwnerBalance = await token.balanceOf(deployer.address);
      expect(finalContractBalance).to.equal(ethers.constants.Zero);
      expect(finalOwnerBalance).to.equal(
        initialOwnerBalance.add(amountToWithdraw)
      );
    });

    it("Should allow users to withdraw their stake after owner withdraws the residual balance", async () => {
      // User deposits tokens
      await token.connect(user).approve(stakingPlatform.address, depositAmount);
      await stakingPlatform.connect(user).deposit(depositAmount);

      // Start staking period
      await stakingPlatform.connect(deployer).startStaking();

      // Simulate time passing beyond the lockup period
      const timeToPass =
        (durationInDays + residualBalanceLockDurationInDays) * 24 * 60 * 60 + 1; // Lockup period plus one second
      await ethers.provider.send("evm_increaseTime", [timeToPass]);
      await ethers.provider.send("evm_mine");

      // Record balances before withdrawal
      const initialUserBalance = await token.balanceOf(user.address);
      const initialContractBalance = await token.balanceOf(
        stakingPlatform.address
      );
      const initialTotalStaked = await stakingPlatform.totalDeposited();

      // Owner withdraws the residual balance
      await token.transfer(stakingPlatform.address, depositAmount);
      await stakingPlatform.connect(deployer).withdrawResidualBalance();

      // transfer more tokens to the contract
      await token.transfer(stakingPlatform.address, depositAmount);

      const rewardsToClaim = await stakingPlatform.rewardOf(user.address);
      // User withdraws their stake
      await stakingPlatform.connect(user).withdraw(depositAmount);

      // Ensure user's token balance increased by the withdrawn amount
      const finalUserBalance = await token.balanceOf(user.address);
      expect(finalUserBalance).to.equal(
        initialUserBalance.add(depositAmount).add(rewardsToClaim)
      );

      // Ensure the contract's token balance decreased by the withdrawn amount
      const finalContractBalance = await token.balanceOf(
        stakingPlatform.address
      );
      expect(finalContractBalance).to.equal(
        initialContractBalance.sub(depositAmount).sub(rewardsToClaim)
      );

      // Verify the total staked amount on the contract is updated correctly
      const finalTotalStaked = await stakingPlatform.totalDeposited();
      expect(finalTotalStaked).to.equal(initialTotalStaked.sub(depositAmount));

      // Check that the user's staked amount is reset to 0
      const userStakedAmount = await stakingPlatform.amountStaked(user.address);
      expect(userStakedAmount).to.equal(0);
    });
  });

  describe("Withdraw Bypass:", () => {
    it("Should not bypasss the lockupDuration check and withdraw the amount after staking is started", async function () {
      // User deposits tokens
      await token.connect(user).approve(stakingPlatform.address, depositAmount);
      await stakingPlatform.connect(user).deposit(depositAmount);
      const blockTimestamp = (await ethers.provider.getBlock("latest"))
        .timestamp;
      // Start staking period
      await stakingPlatform.connect(deployer).startStaking();
      // Fast forward to 8 days
      const timeToPass = 8 * 24 * 60 * 60;
      await ethers.provider.send("evm_increaseTime", [timeToPass]);
      await ethers.provider.send("evm_mine");
      const blockTimestampAfter = (await ethers.provider.getBlock("latest"))
        .timestamp;
      // Record balances before withdrawal
      const initialUserBalance = await token.balanceOf(user.address);
      const rewardsToClaim = await stakingPlatform.rewardOf(user.address);
      // User withdraws their stake
      await expect(
        stakingPlatform.connect(user).withdraw(depositAmount)
      ).to.revertedWith("No withdraw until lockup ends");
      // Ensure user's token balance increased by the withdrawn amount
      const finalUserBalance = await token.balanceOf(user.address);
      expect(finalUserBalance).to.equal(initialUserBalance);
    });
  });

  describe("Ownership features", function () {
    it("should propose a new owner", async function () {
      await stakingPlatform.transferOwnership(user.address);
      expect(await stakingPlatform.pendingOwner()).to.equal(user.address);
    });

    it("should accept ownership by new owner", async function () {
      await stakingPlatform.transferOwnership(user.address);
      await stakingPlatform.connect(user).acceptOwnership();
      expect(await stakingPlatform.owner()).to.equal(user.address);
    });

    it("should prevent non-proposed owners from accepting ownership", async function () {
      await stakingPlatform.transferOwnership(user.address);
      await expect(stakingPlatform.connect(user2).acceptOwnership()).to.be
        .reverted;
    });
  });
});
