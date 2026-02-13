// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockDexPair {
    address public token0;
    address public token1;
    address public factory;

    constructor(address _token0, address _token1, address _factory) {
        token0 = _token0;
        token1 = _token1;
        factory = _factory;
    }
}
