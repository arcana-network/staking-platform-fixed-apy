// SPDX-License-Identifier: MIT
pragma solidity =0.8.23;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Token is ERC20 {
    constructor(uint initialSupply) ERC20("Arcana Staking Test", "XARST") {
        _mint(msg.sender, initialSupply);
    }
}
