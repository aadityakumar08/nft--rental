// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract VIBE is Ownable, ReentrancyGuard {
    uint256 public gameCounter;
    uint256 public constant CREATOR_FEE = 5; // 5% fee

    struct Game {
        address gameCreator;
        uint256 budget;
        bool isEnded;
        uint256 feeCollected;
    }

    mapping(uint256 => Game) public games;

    event GameCreated(uint256 indexed gameId, address indexed creator, uint256 budget);
    event GameEnded(uint256 indexed gameId, uint256 rewardsDistributed, uint256 refunded);
    event RewardDistributed(uint256 indexed gameId, address indexed player, uint256 amount);
    event FeeWithdrawn(uint256 indexed gameId, uint256 amount);

    constructor(address initialOwner) 
        Ownable(initialOwner)
        ReentrancyGuard() 
    {}

    function createGame() external payable nonReentrant returns (uint256) {
        require(msg.value > 0, "Budget must be greater than 0");
        
        // Increment game counter
        gameCounter++;

        // Create new game
        games[gameCounter] = Game({
            gameCreator: msg.sender,
            budget: msg.value,
            isEnded: false,
            feeCollected: 0
        });

        emit GameCreated(gameCounter, msg.sender, msg.value);
        return gameCounter;
    }

    function endGame(
        uint256 _gameId,
        address[] calldata _players,
        uint256[] calldata _rewards
    ) external nonReentrant {
        Game storage game = games[_gameId];
        
        require(msg.sender == game.gameCreator, "Only game creator can end game");
        require(!game.isEnded, "Game already ended");
        require(_players.length == _rewards.length, "Arrays length mismatch");
        require(_players.length > 0, "No players provided");
        
        uint256 totalRewards = 0;
        for (uint256 i = 0; i < _rewards.length; i++) {
            totalRewards += _rewards[i];
        }
        
        require(totalRewards <= game.budget, "Rewards exceed budget");

        // Calculate and store fee
        uint256 fee = (game.budget * CREATOR_FEE) / 100;
        game.feeCollected = fee;
        
        // Distribute rewards
        for (uint256 i = 0; i < _players.length; i++) {
            require(_players[i] != address(0), "Invalid player address");
            (bool success, ) = _players[i].call{value: _rewards[i]}("");
            require(success, "Reward transfer failed");
            emit RewardDistributed(_gameId, _players[i], _rewards[i]);
        }

        // Refund surplus tokens to game creator
        uint256 surplus = game.budget - totalRewards - fee;
        if (surplus > 0) {
            (bool success, ) = game.gameCreator.call{value: surplus}("");
            require(success, "Surplus refund failed");
        }

        game.isEnded = true;
        
        emit GameEnded(_gameId, totalRewards, surplus);
    }

    function withdrawFee(uint256 _gameId) external onlyOwner nonReentrant {
        Game storage game = games[_gameId];
        require(game.isEnded, "Game not ended");
        require(game.feeCollected > 0, "No fee to collect");

        uint256 feeAmount = game.feeCollected;
        game.feeCollected = 0;

        (bool success, ) = owner().call{value: feeAmount}("");
        require(success, "Fee transfer failed");
        
        emit FeeWithdrawn(_gameId, feeAmount);
    }

    function getGameDetails(uint256 _gameId) external view returns (
        address creator,
        uint256 budget,
        bool isEnded,
        uint256 feeCollected
    ) {
        Game storage game = games[_gameId];
        return (
            game.gameCreator,
            game.budget,
            game.isEnded,
            game.feeCollected
        );
    }

    // Function to check contract's balance
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // Required for contract to receive native tokens
    receive() external payable {}
}