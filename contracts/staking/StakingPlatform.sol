// SPDX-License-Identifier: MIT
pragma solidity =0.8.23;

import "./IStakingPlatform.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/// @author RetreebInc
/// @title Staking Platform with fixed APY and lockup
contract StakingPlatform is IStakingPlatform, Ownable, Pausable {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;

    uint8 public immutable fixedAPY;

    uint public immutable stakingDuration;
    uint public lockupDuration;
    uint public stakingMax;
    uint public maxStakingPerUser;

    uint public startPeriod;
    uint public lockupPeriod;
    uint public endPeriod;

    uint private _totalStaked;
    uint internal _precision = 1E6;

    mapping(address => uint) public staked;
    mapping(address => uint) private _rewardsToClaim;
    mapping(address => uint) private _userStartTime;

    /**
     * @notice constructor contains all the parameters of the staking platform
     * @dev all parameters are immutable
     */
    constructor(
        address _token,
        uint8 _fixedAPY,
        uint _durationInDays,
        uint _lockDurationInDays,
        uint _maxAmountStaked
    ) {
        stakingDuration = _durationInDays * 1 days;
        lockupDuration = _lockDurationInDays * 1 days;
        token = IERC20(_token);
        fixedAPY = _fixedAPY;
        stakingMax = _maxAmountStaked;
        maxStakingPerUser = uint256(2 ** 256 - 1);
    }

    /**
     * @notice function that start the staking
     * @dev set `startPeriod` to the current current `block.timestamp`
     * set `lockupPeriod` which is `block.timestamp` + `lockupDuration`
     * and `endPeriod` which is `startPeriod` + `stakingDuration`
     */
    function startStaking() external override onlyOwner whenNotPaused {
        require(startPeriod == 0, "Staking has already started");
        startPeriod = block.timestamp;
        lockupPeriod = block.timestamp + lockupDuration;
        endPeriod = block.timestamp + stakingDuration;
        emit StartStaking(startPeriod, lockupDuration, endPeriod);
    }

    /**
     * @notice function that allows a user to deposit tokens
     * @dev user must first approve the amount to deposit before calling this function,
     * cannot exceed the `maxAmountStaked`
     * @param amount, the amount to be deposited
     * @dev `endPeriod` to equal 0 (Staking didn't started yet),
     * or `endPeriod` more than current `block.timestamp` (staking not finished yet)
     * @dev `totalStaked + amount` must be less than `stakingMax`
     * @dev that the amount deposited should greater than 0
     */
    function deposit(uint amount) external override whenNotPaused {
        require(
            endPeriod == 0 || endPeriod > block.timestamp,
            "Staking period ended"
        );
        require(
            _totalStaked + amount <= stakingMax,
            "Amount staked exceeds MaxStake"
        );
        require(amount > 0, "Amount must be greater than 0");
        require(
            staked[_msgSender()] + amount <= maxStakingPerUser,
            "Amount staked exceeds MaxStakePerUser"
        );

        if (_userStartTime[_msgSender()] == 0) {
            _userStartTime[_msgSender()] = block.timestamp;
        }

        _updateRewards();

        staked[_msgSender()] += amount;
        _totalStaked += amount;
        token.safeTransferFrom(_msgSender(), address(this), amount);
        emit Deposit(_msgSender(), amount);
    }

    /**
     * @notice function that allows a user to withdraw its initial deposit
     * @param amount, amount to withdraw
     * @dev `block.timestamp` must be higher than `lockupPeriod` (lockupPeriod finished)
     * @dev `amount` must be higher than `0`
     * @dev `amount` must be lower or equal to the amount staked
     * withdraw reset all states variable for the `msg.sender` to 0, and claim rewards
     * if rewards to claim
     */
    function withdraw(uint amount) external override whenNotPaused {
        uint startTime = _getStartTime(_msgSender());
        require(
            block.timestamp > endPeriod ||
                (block.timestamp - startTime) >= lockupDuration,
            "No withdraw until lockup ends"
        );
        require(amount > 0, "Amount must be greater than 0");
        require(
            amount <= staked[_msgSender()],
            "Amount higher than stakedAmount"
        );

        _updateRewards();
        if (_rewardsToClaim[_msgSender()] > 0) {
            _claimRewards();
        }
        _totalStaked -= amount;
        staked[_msgSender()] -= amount;
        token.safeTransfer(_msgSender(), amount);
        emit Withdraw(_msgSender(), amount);
    }

    /**
     * @notice function that allows a user to withdraw its initial deposit
     * @dev must be called only when `block.timestamp` >= `lockupPeriod`
     * @dev `block.timestamp` higher than `lockupPeriod` (lockupPeriod finished)
     * withdraw reset all states variable for the `msg.sender` to 0, and claim rewards
     * if rewards to claim
     */
    function withdrawAll() external override whenNotPaused {
        uint startTime = _getStartTime(_msgSender());
        require(
            block.timestamp > endPeriod ||
                (block.timestamp - startTime) >= lockupDuration,
            "No withdraw until lockup ends"
        );
        _updateRewards();
        if (_rewardsToClaim[_msgSender()] > 0) {
            _claimRewards();
        }

        _userStartTime[_msgSender()] = 0;
        _totalStaked -= staked[_msgSender()];
        uint stakedBalance = staked[_msgSender()];
        staked[_msgSender()] = 0;
        token.safeTransfer(_msgSender(), stakedBalance);

        emit Withdraw(_msgSender(), stakedBalance);
    }

    /**
     * @notice claim all remaining balance on the contract
     * Residual balance is all the remaining tokens that have not been distributed
     * (e.g, in case the number of stakeholders is not sufficient)
     * @dev Can only be called one year after the end of the staking period
     * Cannot claim initial stakeholders deposit
     */
    function withdrawResidualBalance() external onlyOwner whenNotPaused {
        require(
            block.timestamp >= endPeriod + (15 * 1 days),
            "Withdraw 15 days after endPeriod"
        );

        uint balance = token.balanceOf(address(this));
        uint residualBalance = balance - (_totalStaked);
        require(residualBalance > 0, "No residual Balance to withdraw");
        token.safeTransfer(owner(), residualBalance);
    }

    /**
     * @notice function that returns the amount of total Staked tokens
     * for a specific user
     * @param stakeHolder, address of the user to check
     * @return uint amount of the total deposited Tokens by the caller
     */
    function amountStaked(
        address stakeHolder
    ) external view override returns (uint) {
        return staked[stakeHolder];
    }

    /**
     * @notice function that returns the amount of total Staked tokens
     * on the smart contract
     * @return uint amount of the total deposited Tokens
     */
    function totalDeposited() external view override returns (uint) {
        return _totalStaked;
    }

    /**
     * @notice function that returns the amount of pending rewards
     * that can be claimed by the user
     * @param stakeHolder, address of the user to be checked
     * @return uint amount of claimable rewards
     */
    function rewardOf(
        address stakeHolder
    ) external view override returns (uint) {
        return _calculateRewards(stakeHolder);
    }

    /**
     * @notice function that claims pending rewards
     * @dev transfer the pending rewards to the `msg.sender`
     */
    function claimRewards() external override whenNotPaused {
        _claimRewards();
    }

    /**
     * @notice calculate rewards based on the `fixedAPY`, `_percentageTimeRemaining()`
     * @dev the higher is the precision and the more the time remaining will be precise
     * @param stakeHolder, address of the user to be checked
     * @return uint amount of claimable tokens of the specified address
     */
    function _calculateRewards(
        address stakeHolder
    ) internal view returns (uint) {
        if (startPeriod == 0 || staked[stakeHolder] == 0) {
            return 0;
        }

        return
            (((staked[stakeHolder] * fixedAPY) *
                _percentageTimeRemaining(stakeHolder)) / (_precision * 100)) +
            _rewardsToClaim[stakeHolder];
    }

    /**
     * @notice function that returns the startPeriod of the staking
     * @param stakeHolder address of the user to be checked
     */
    function _getStartTime(address stakeHolder) internal view returns (uint) {
        bool early = startPeriod > _userStartTime[stakeHolder];
        uint startTime;
        if (endPeriod > block.timestamp) {
            startTime = early ? startPeriod : _userStartTime[stakeHolder];
            return startTime;
        }
        startTime = early
            ? 0
            : stakingDuration - (endPeriod - _userStartTime[stakeHolder]);
        return startTime;
    }

    /**
     * @notice function that returns the remaining time in seconds of the staking period
     * @dev the higher is the precision and the more the time remaining will be precise
     * @param stakeHolder, address of the user to be checked
     * @return uint percentage of time remaining * precision
     */
    function _percentageTimeRemaining(
        address stakeHolder
    ) internal view returns (uint) {
        uint startTime = _getStartTime(stakeHolder);
        if (endPeriod > block.timestamp) {
            uint timeRemaining = stakingDuration -
                (block.timestamp - startTime);
            return
                (_precision * (stakingDuration - timeRemaining)) /
                stakingDuration;
        }
        return (_precision * (stakingDuration - startTime)) / stakingDuration;
    }

    /**
     * @notice internal function that claims pending rewards
     * @dev transfer the pending rewards to the user address
     */
    function _claimRewards() private {
        _updateRewards();

        uint rewardsToClaim = _rewardsToClaim[_msgSender()];
        require(rewardsToClaim > 0, "Nothing to claim");

        _rewardsToClaim[_msgSender()] = 0;
        token.safeTransfer(_msgSender(), rewardsToClaim);
        emit Claim(_msgSender(), rewardsToClaim);
    }

    /**
     * @notice function that update pending rewards
     * and shift them to rewardsToClaim
     * @dev update rewards claimable
     * and check the time spent since deposit for the `msg.sender`
     */
    function _updateRewards() private {
        _rewardsToClaim[_msgSender()] = _calculateRewards(_msgSender());
        _userStartTime[_msgSender()] = (block.timestamp >= endPeriod)
            ? endPeriod
            : block.timestamp;
    }

    /**
     * @notice function that allows the owner to change the max amount staked per user
     * @param _maxAmountStaked, the new max amount staked per user
     */
    function setMaxStakingPerUser(
        uint _maxAmountStaked
    ) external onlyOwner whenNotPaused {
        maxStakingPerUser = _maxAmountStaked;
    }

    /**
     * @notice function that allows the owner to change the max amount staked
     * @param _stakingMax, the new max amount staked
     */
    function setStakingMax(uint _stakingMax) external onlyOwner whenNotPaused {
        stakingMax = _stakingMax;
    }

    /**
     * @notice function that allows the owner to change the lockup duration
     * @param _lockupDurationInDays, the new lockup duration in days
     */
    function setLockupDuration(
        uint _lockupDurationInDays
    ) external onlyOwner whenNotPaused {
        lockupDuration = _lockupDurationInDays * 1 days;
    }

    /**
     * @dev pause the contract
     * @dev only the owner can pause the contract
     */
    function pause() public onlyOwner {
        _pause();
    }

    /**
     * @dev unpause the contract
     * @dev only the owner can unpause the contract
     */
    function unpause() public onlyOwner {
        _unpause();
    }

    /**
     * @dev function to get startTime of the user
     */
    function getUserStartTime(address user) external view returns (uint) {
        return _userStartTime[user];
    }
}
