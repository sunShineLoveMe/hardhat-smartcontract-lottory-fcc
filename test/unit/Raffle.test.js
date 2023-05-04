const { assert, expect } = require("chai");
const { getNamedAccounts, deployments, ethers, network } = require("hardhat");
const { developmentChains, networkConfig } = require("../../helper-hardhat-config");

!developmentChains.includes(network.name) ? 
    describe.skip : 
    describe("Raffle Unit test", async() => {
    let raffle, vrfCoordinatorV2Mock, raffleEntranceFee, deployer, interval
    const chainId = network.config.chainId

    beforeEach(async function () {
        deployer = (await getNamedAccounts()).deployer
        await deployments.fixture(["all"])
        raffle = await ethers.getContract("Raffle", deployer)
        vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
        raffleEntranceFee = await raffle.getEntranceFee()
        interval = await raffle.getInterval()
    })

    describe("constructor", async() => {
        it("initializes the raffle correctly", async() => {
            const raffleState = await raffle.getRaffleState()
            // const interval = await raffle.getInterval()
            assert.equal(raffleState.toString(), "0")
            assert.equal(interval.toString(), networkConfig[chainId]["interval"])
        })
    })

    describe("enterRaffle", async() => {
        it("reverts when you do not pay enough", async() => {
            await expect(raffle.enterRaffle()).to.be.revertedWith(
                "Raffle__NotEnoughETHEntered");
        })
        it("records players when they enter", async() => {
            await raffle.enterRaffle({value: raffleEntranceFee})
            const playerFromContract = await raffle.getPlayer(0)
            assert.equal(playerFromContract, deployer)
        })
        /**
         *  @test 测试RaffleEnter事件
         */
        it("emit event on enter", async() => {
            await expect(raffle.enterRaffle({value: raffleEntranceFee})).to.emit(
                raffle,
                "RaffleEnter"
            )
        })
        it("doesn't allow entrance when raffle is calculating", async() => {
            await raffle.enterRaffle({value: raffleEntranceFee})
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
            await network.provider.request({ method: "evm_mine", params: [] })
            await raffle.performUpkeep([])
            await expect(raffle.enterRaffle({value: raffleEntranceFee})).to.be.
                revertedWith("Raffle__NotOpen")
        })
        
    })

    /**
     * @dev callStatic方法是6版本之后引入的，可以在不发送交易的情况下读取和查询合约状况
     *  具体来说： callStatic方法会创建一个临时的消息调用，并执行指定的智能合约方法
     *  但是不会将交易广播到区块网络中，也不对合约的状态进行修改，它仅仅是读取和查询合约状态的一种方式   
     */
    describe("checkUpkeep", async() => {
        it("returns false if people have not send any ETH", async() => {
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
            await network.provider.request({ method: "evm_mine", params: [] })
            const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([])
            assert(!upkeepNeeded)
        })
        it("returns false if raffle is not open", async() => {
            await raffle.enterRaffle({value: raffleEntranceFee})
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
            await network.provider.request({ method: "evm_mine", params: [] })
            await raffle.performUpkeep([])
            const raffleState = await raffle.getRaffleState()
            const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([])
            assert.equal(raffleState.toString(), "1")
            assert.equal(upkeepNeeded, false)
        })

        it("returns false if enough time has not passed", async() => {
            await raffle.enterRaffle({value: raffleEntranceFee})
            await network.provider.send("evm_increaseTime", [interval.toNumber() - 1])
            await network.provider.request({ method: "evm_mine", params: [] })
            // 0x是 一个空字符串，在checkUpkeep方法中，我们不需要传入任何参数,因此我们可以传递一个空字符串作为占位符
            // 表示不传递任何参数
            const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x")
            assert(upkeepNeeded)
        })

        it("returns true if enough time has passed, has players, and is open", async() => {
            await raffle.enterRaffle({value: raffleEntranceFee})
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
            await network.provider.request({ method: "evm_mine", params: [] })
            const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x")
            assert(upkeepNeeded)
        })
    })

    describe("performUpkeep", function() {
        it("can only run if checkupkeep is true", async() => {
            await raffle.enterRaffle({ value: raffleEntranceFee })
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
            await network.provider.request({ method: "evm_mine", params: [] })
            const tx = await raffle.performUpkeep("0x") 
            assert(tx)
        })
        it("reverts if checkup is false", async() => {
            await expect(raffle.performUpkeep("0x")).to.be.revertedWith(
                "Raffle__UpkeepNotNeeded"
            )
        })
        it("updates the raffle state and emits a requestId", async() => {
            await raffle.enterRaffle({ value: raffleEntranceFee })
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
            await network.provider.request({ method: "evm_mine", params: [] })
            const txResponse = await raffle.performUpkeep("0x")
            const txReceipt = await txResponse.wait(1)
            const raffleState = await raffle.getRaffleState()
            const requestId = txReceipt.events[1].args.requestId
            assert(requestId.toNumber() > 0)
            assert.equal(raffleState.toString(), "1")
        })
    })
    describe("fulfillRandomWords", async() => {
        beforeEach(async () => {
            await raffle.enterRaffle({ value: raffleEntranceFee })
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
            await network.provider.request({ method: "evm_mine", params: [] })
        })
        it("can only be called after performUpkeep", async() => {
            await expect(
                vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address) // reverts if not fulfilled
            ).to.be.revertedWith("nonexistent request")
            await expect(
                vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address) // reverts if not fulfilled
            ).to.be.revertedWith("nonexistent request")
        })
        it("picks a winner, resets the lottory,and sends money", async() => {
            const additionalEntrants = 3
            const startingAccountIndex = 1
            const accounts = await ethers.getSigners()
            for(let i = startingAccountIndex; i < startingAccountIndex + additionalEntrants; i++) {
                const accountConnectedRaffle = raffle.connect(accounts[i])
                await accountConnectedRaffle.enterRaffle({ value: raffleEntranceFee })
            }
            const startingTimeStamp = await raffle.getLatestTimeStamp()

            await new Promise(async(resolve, reject) => {
                raffle.once("WinnerPicked", async() => {
                    console.log("found the event!")
                    try {
                        const recentWinner = await raffle.getRecentWinner()
                        
                        const raffleState = await raffle.getRaffleState()
                        const endingTimeStamp = await raffle.getLatestTimeStamp()
                        const numPlayers = await raffle.getNumberOfPlayers()
                        const winnerEndingBalance = await accounts[1].getBalance()
                        assert.equal(numPlayers.toString(), "0")
                        assert.equal(raffleState.toString(), "0")
                        assert(endingTimeStamp > startingTimeStamp)

                        assert.equal(winnerEndingBalance.toString(), winnerStartingBalance.add(
                            raffleEntranceFee.mul(additionalEntrants).add(raffleEntranceFee).toString()
                        ))
                    } catch (e) {
                        reject(e)
                    }
                    resolve()
                })
                const tx = await raffle.performUpkeep([])
                const txReceipt = await tx.wait(1)
                const winnerStartingBalance = await accounts[1].getBalance()
                await vrfCoordinatorV2Mock.fulfillRandomWords(
                    txReceipt.events[1].args.requestId, raffle.address)

            })
        })
    })
}) 