// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * FUNKY RAVE (FUNKY)
 * - Initial supply: 30,000,000,000
 * - 18 decimals
 * - Fee on "purchases" only: when tokens are sent FROM a registered DEX address to a buyer.
 * - Configurable fee %, fee recipient, DEX list, and admin list.
 *
 * Requires OpenZeppelin ^5.0:
 *   forge install OpenZeppelin/openzeppelin-contracts@v5.0.2
 * or npm:
 *   npm i @openzeppelin/contracts@^5
 */

import {ERC20} from "./ERC20.sol";

contract FunkyRave is ERC20 {
    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/
    event FeePercentageUpdated(uint16 oldFeePercent, uint16 newFeePercent);
    event HoldingDateUpdated(address indexed user, uint16 oldHoldingDate, uint16 newHoldingDate);
    event FeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);
    event DexAdded(address indexed dex);
    event DexRemoved(address indexed dex);
    event AdminAdded(address indexed admin);
    event AdminRemoved(address indexed admin);

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/
    error NotAdmin();
    error InvalidAddress();
    error FeeTooHigh();
    error DexAlreadyRegistered();
    error DexNotRegistered();
    error AdminAlreadyRegistered();
    error AdminNotRegistered();
    error CannotRemoveLastAdmin();

    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/
    // Percent in whole percent units (e.g., 10 = 10%)
    mapping(uint16 => uint16) public feePercent; // default 10%
    mapping(address => uint16) public holdingDate; // default 10%
    address public feeRecipient;

    mapping(address => bool) public isDex;   // DEX allowlist
    mapping(address => bool) public isAdmin; // Admin allowlist
    uint256 private adminCount;

    /*//////////////////////////////////////////////////////////////
                                MODIFIERS
    //////////////////////////////////////////////////////////////*/
    modifier onlyAdmin() {
        if (!isAdmin[msg.sender]) revert NotAdmin();
        _;
    }

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/
    constructor(address initialAdmin, address initialFeeRecipient)
        ERC20("FUNKY RAVE", "FUNKY")
    {
        if (initialAdmin == address(0) || initialFeeRecipient == address(0)) {
            revert InvalidAddress();
        }

        // Set default fee = 10%
        feePercent[0] = 250;
        feePercent[30] = 200;
        feePercent[180] = 150;
        feePercent[360] = 100;
        feePercent[720] = 50;
        feeRecipient = initialFeeRecipient;

        // Initialize admin set
        isAdmin[initialAdmin] = true;
        adminCount = 1;
        emit AdminAdded(initialAdmin);

        // Mint initial supply: 30,000,000,000 * 10^18
        _mint(initialAdmin, 30_000_000_000e18);
    }

    /*//////////////////////////////////////////////////////////////
                          ADMIN MANAGEMENT
    //////////////////////////////////////////////////////////////*/
    function add_admin(address newAdmin) external onlyAdmin {
        if (newAdmin == address(0)) revert InvalidAddress();
        if (isAdmin[newAdmin]) revert AdminAlreadyRegistered();
        isAdmin[newAdmin] = true;
        adminCount += 1;
        emit AdminAdded(newAdmin);
    }

    function remove_admin(address adminToRemove) external onlyAdmin {
        if (!isAdmin[adminToRemove]) revert AdminNotRegistered();
        if (adminCount == 1) revert CannotRemoveLastAdmin(); // always keep >=1
        isAdmin[adminToRemove] = false;
        adminCount -= 1;
        emit AdminRemoved(adminToRemove);
    }

    /*//////////////////////////////////////////////////////////////
                           FEE CONFIGURATION
    //////////////////////////////////////////////////////////////*/
    /// @notice Update the fee percentage (0–1000)
    /// @dev Maps to: update_fee_percentage(_holdingDate, new_fee)
    function update_fee_percentage(uint16 _holdingDate, uint16 _newFeePercent) external onlyAdmin {
        if (_newFeePercent > 1000) revert FeeTooHigh();
        uint16 old = feePercent[_holdingDate];
        feePercent[_holdingDate] = _newFeePercent;
        emit FeePercentageUpdated(old, _newFeePercent);
    }

    /// @notice Update the holding date
    /// @dev Maps to: update_holding_date(holder, hold_date)
    function update_holding_date(address user, uint16 _holdingDate) external onlyAdmin {
        if (user == address(0)) revert InvalidAddress();
        uint16 old = holdingDate[user];
        holdingDate[user] = _holdingDate;
        emit HoldingDateUpdated(user, old, _holdingDate);
    }

    /// @notice Update the fee recipient address
    /// @dev Maps to: update_fee_recipient(new_recipient)
    function update_fee_recipient(address newRecipient) external onlyAdmin {
        if (newRecipient == address(0)) revert InvalidAddress();
        address old = feeRecipient;
        feeRecipient = newRecipient;
        emit FeeRecipientUpdated(old, newRecipient);
    }

    /*//////////////////////////////////////////////////////////////
                           DEX LIST MANAGEMENT
    //////////////////////////////////////////////////////////////*/
    /// @dev Maps to: add_dex(dex_address)
    function add_dex(address dex) external onlyAdmin {
        if (dex == address(0)) revert InvalidAddress();
        if (isDex[dex]) revert DexAlreadyRegistered();
        isDex[dex] = true;
        emit DexAdded(dex);
    }

    /// @dev Maps to: remove_dex(dex_address)
    function remove_dex(address dex) external onlyAdmin {
        if (!isDex[dex]) revert DexNotRegistered();
        isDex[dex] = false;
        emit DexRemoved(dex);
    }

    /*//////////////////////////////////////////////////////////////
                           TRANSFER LOGIC (FEE)
    //////////////////////////////////////////////////////////////*/
    /**
     * Fee applies ONLY when tokens are sent FROM a registered DEX address (a buy).
     * No fee for wallet-to-wallet transfers or sells (to a DEX).
     *
     * Implementation uses ERC20's internal _update hook (OZ v5).
     */
    function _update(address from, address to, uint256 amount) internal override {
        // Minting or burning: bypass fee logic
        if (from == address(0) || to == address(0)) {
            super._update(from, to, amount);
            return;
        }

        // Apply fee only if the sender (source of tokens) is a registered DEX.
        if (isDex[to] && feePercent[holdingDate[msg.sender]] > 0 && feeRecipient != address(0)) {
            uint256 fee = (amount * feePercent[holdingDate[msg.sender]]) / 1000;
            if (fee > 0) {
                // Transfer fee to feeRecipient
                super._update(from, feeRecipient, fee);
                // Transfer net to buyer
                super._update(from, to, amount - fee);
                return;
            }
        }

        // Otherwise, normal transfer
        super._update(from, to, amount);
    }
}