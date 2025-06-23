// Sources flattened with hardhat v2.22.17 https://hardhat.org

// SPDX-License-Identifier: MIT

// File @openzeppelin/contracts/utils/Context.sol@v5.1.0

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.1) (utils/Context.sol)

pragma solidity ^0.8.0;

/**
 * @dev Provides information about the current execution context, including the
 * sender of the transaction and its data. While these are generally available
 * via msg.sender and msg.data, they should not be accessed in such a direct
 * manner, since when dealing with meta-transactions the account sending and
 * paying for execution may not be the actual sender (as far as an application
 * is concerned).
 *
 * This contract is only required for intermediate, library-like contracts.
 */
abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }

    function _contextSuffixLength() internal view virtual returns (uint256) {
        return 0;
    }
}


// File @openzeppelin/contracts/access/Ownable.sol@v5.1.0

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.0) (access/Ownable.sol)

pragma solidity ^0.8.0;

/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * The initial owner is set to the address provided by the deployer. This can
 * later be changed with {transferOwnership}.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be applied to your functions to restrict their use to
 * the owner.
 */
abstract contract Ownable is Context {
    address private _owner;

    /**
     * @dev The caller account is not authorized to perform an operation.
     */
    error OwnableUnauthorizedAccount(address account);

    /**
     * @dev The owner is not a valid owner account. (eg. `address(0)`)
     */
    error OwnableInvalidOwner(address owner);

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the address provided by the deployer as the initial owner.
     */
    constructor(address initialOwner) {
        if (initialOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(initialOwner);
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view virtual returns (address) {
        return _owner;
    }

    /**
     * @dev Throws if the sender is not the owner.
     */
    function _checkOwner() internal view virtual {
        if (owner() != _msgSender()) {
            revert OwnableUnauthorizedAccount(_msgSender());
        }
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby disabling any functionality that is only available to the owner.
     */
    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public virtual onlyOwner {
        if (newOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(newOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Internal function without access restriction.
     */
    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}


// File @openzeppelin/contracts/security/ReentrancyGuard.sol@v5.1.0

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.1.0) (utils/ReentrancyGuard.sol)

pragma solidity ^0.8.0;

/**
 * @dev Contract module that helps prevent reentrant calls to a function.
 *
 * Inheriting from `ReentrancyGuard` will make the {nonReentrant} modifier
 * available, which can be applied to functions to make sure there are no nested
 * (reentrant) calls to them.
 *
 * Note that because there is a single `nonReentrant` guard, functions marked as
 * `nonReentrant` may not call one another. This can be worked around by making
 * those functions `private`, and then adding `external` `nonReentrant` entry
 * points to them.
 *
 * TIP: If EIP-1153 (transient storage) is available on the chain you're deploying at,
 * consider using {ReentrancyGuardTransient} instead.
 *
 * TIP: If you would like to learn more about reentrancy and alternative ways
 * to protect against it, check out our blog post
 * https://blog.openzeppelin.com/reentrancy-after-istanbul/[Reentrancy After Istanbul].
 */
abstract contract ReentrancyGuard {
    // Booleans are more expensive than uint256 or any type that takes up a full
    // word because each write operation emits an extra SLOAD to first read the
    // slot's contents, replace the bits taken up by the boolean, and then write
    // back. This is the compiler's defense against contract upgrades and
    // pointer aliasing, and it cannot be disabled.

    // The values being non-zero value makes deployment a bit more expensive,
    // but in exchange the refund on every call to nonReentrant will be lower in
    // amount. Since refunds are capped to a percentage of the total
    // transaction's gas, it is best to keep them low in cases like this one, to
    // increase the likelihood of the full refund coming into effect.
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;

    uint256 private _status;

    /**
     * @dev Unauthorized reentrant call.
     */
    error ReentrancyGuardReentrantCall();

    constructor() {
        _status = NOT_ENTERED;
    }

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     * Calling a `nonReentrant` function from another `nonReentrant`
     * function is not supported. It is possible to prevent this from happening
     * by making the `nonReentrant` function external, and making it call a
     * `private` function that does the actual work.
     */
    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    function _nonReentrantBefore() private {
        // On the first call to nonReentrant, _status will be NOT_ENTERED
        if (_status == ENTERED) {
            revert ReentrancyGuardReentrantCall();
        }

        // Any calls to nonReentrant after this point will fail
        _status = ENTERED;
    }

    function _nonReentrantAfter() private {
        // By storing the original value once again, a refund is triggered (see
        // https://eips.ethereum.org/EIPS/eip-2200)
        _status = NOT_ENTERED;
    }

    /**
     * @dev Returns true if the reentrancy guard is currently set to "entered", which indicates there is a
     * `nonReentrant` function in the call stack.
     */
    function _reentrancyGuardEntered() internal view returns (bool) {
        return _status == ENTERED;
    }
}


// File contracts/VIBE.sol

// Original license: SPDX_License_Identifier: MIT
pragma solidity ^0.8.0;


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