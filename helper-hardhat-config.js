const { ethers } = require("hardhat");

const networkConfig = {
    11155111: {
        name: "sepolia",
        vrfCoordinatorV2: "0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625",
        entranceFee: ethers.utils.parseEther("0.01"),
        // gasLane 是指 Chainlink Keeper 用来观察和控制链上交易的一个参数。
        // 它可以帮助我们在交易拥堵或网络拥塞时调整交易费用，以便更好地保证链上任务的执行效率和可靠性
        // 30gwei
        gasLane: "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c",
        subScriptionId: "1638",
        callbackGasLimit: "500000",
        interval: "30"
    },
    31337: {
        name: "hardhat",
        entranceFee: ethers.utils.parseEther("0.01"),
        gasLane: "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c",
        callbackGasLimit: "5000000",
        interval: "30"
    }
}

const developmentChains = ["hardhat", "localhost"];

module.exports = {
    networkConfig,
    developmentChains,
}