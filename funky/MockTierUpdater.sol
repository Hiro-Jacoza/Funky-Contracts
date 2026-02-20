// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IFunkyTierTarget {
    function update_holding_date(address user, uint16 _holdingDate, bytes32 reasonCode, bytes32 batchId) external;
}

contract MockTierUpdater {
    function updateHoldingDate(
        address token,
        address user,
        uint16 holdingDate,
        bytes32 reasonCode,
        bytes32 batchId
    ) external {
        IFunkyTierTarget(token).update_holding_date(user, holdingDate, reasonCode, batchId);
    }
}
