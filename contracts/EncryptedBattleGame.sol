// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint8, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title Encrypted Battle Game
/// @notice Players register with an encrypted role and receive an encrypted attack power.
contract EncryptedBattleGame is SepoliaConfig {
    struct PlayerRecord {
        euint8 role;
        euint8 attackPower;
        bool registered;
    }

    struct PlayerCiphertexts {
        euint8 role;
        euint8 attackPower;
    }

    mapping(address => PlayerRecord) private _players;
    address[] private _playerIndex;

    event PlayerRegistered(address indexed player);
    event PlayerAccessRefreshed(address indexed player);

    /// @notice Register the sender with an encrypted role and random attack power.
    /// @param encryptedRole The encrypted role chosen by the player (1-4).
    /// @param inputProof The corresponding input proof.
    function registerPlayer(externalEuint8 encryptedRole, bytes calldata inputProof) external {
        PlayerRecord storage player = _players[msg.sender];
        require(!player.registered, "Player already registered");

        euint8 roleChoice = FHE.fromExternal(encryptedRole, inputProof);
        euint8 normalizedRole = _normalizeRole(roleChoice);

        player.role = normalizedRole;
        player.attackPower = _generateAttackPower();
        player.registered = true;

        FHE.allowThis(player.role);
        FHE.allow(player.role, msg.sender);
        FHE.allowThis(player.attackPower);
        FHE.allow(player.attackPower, msg.sender);

        _playerIndex.push(msg.sender);

        emit PlayerRegistered(msg.sender);
    }

    /// @notice Re-grant ciphertext access to the caller.
    function refreshMyAccess() external {
        PlayerRecord storage player = _players[msg.sender];
        require(player.registered, "Player not registered");

        FHE.allow(player.role, msg.sender);
        FHE.allow(player.attackPower, msg.sender);

        emit PlayerAccessRefreshed(msg.sender);
    }

    /// @notice Returns true if the player address is registered.
    /// @param player The address to check.
    function isRegistered(address player) external view returns (bool) {
        return _players[player].registered;
    }

    /// @notice Returns the encrypted role for a player.
    /// @param player The address whose role is queried.
    function getEncryptedRole(address player) external view returns (euint8) {
        PlayerRecord storage record = _players[player];
        require(record.registered, "Player not registered");

        return record.role;
    }

    /// @notice Returns the encrypted attack power for a player.
    /// @param player The address whose attack power is queried.
    function getEncryptedAttackPower(address player) external view returns (euint8) {
        PlayerRecord storage record = _players[player];
        require(record.registered, "Player not registered");

        return record.attackPower;
    }

    /// @notice Returns both encrypted values for a player.
    /// @param player The address being queried.
    function getPlayerCiphertexts(address player) external view returns (PlayerCiphertexts memory) {
        PlayerRecord storage record = _players[player];
        require(record.registered, "Player not registered");

        return PlayerCiphertexts({role: record.role, attackPower: record.attackPower});
    }

    /// @notice Returns the list of registered player addresses.
    function getRegisteredPlayers() external view returns (address[] memory) {
        return _playerIndex;
    }

    function _generateAttackPower() private returns (euint8) {
        euint8 raw = FHE.randEuint8();
        euint8 spread = FHE.rem(raw, 91);
        euint8 minimum = FHE.asEuint8(10);
        return FHE.add(spread, minimum);
    }

    function _normalizeRole(euint8 role) private returns (euint8) {
        euint8 zero = FHE.asEuint8(0);
        euint8 soldier = FHE.select(FHE.eq(role, FHE.asEuint8(1)), FHE.asEuint8(1), zero);
        euint8 general = FHE.select(FHE.eq(role, FHE.asEuint8(2)), FHE.asEuint8(2), soldier);
        euint8 knight = FHE.select(FHE.eq(role, FHE.asEuint8(3)), FHE.asEuint8(3), general);
        return FHE.select(FHE.eq(role, FHE.asEuint8(4)), FHE.asEuint8(4), knight);
    }
}
