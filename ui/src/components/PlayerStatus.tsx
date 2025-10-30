import { useMemo, useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { Contract } from 'ethers';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { CONTRACT_ADDRESS, CONTRACT_ABI, ROLE_LABELS } from '../config/contracts';
import '../styles/PlayerStatus.css';

interface PlayerStatusProps {
  onBackToSelection: () => void;
}

type DecryptedPlayer = {
  roleId: number;
  roleName: string;
  attackPower: number;
};

export function PlayerStatus({ onBackToSelection }: PlayerStatusProps) {
  const { address, isConnected } = useAccount();
  const { instance } = useZamaInstance();
  const signerPromise = useEthersSigner();

  const [decrypting, setDecrypting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<string>('');
  const [decrypted, setDecrypted] = useState<DecryptedPlayer | null>(null);

  const { data: isRegisteredData, refetch: refetchRegistered } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'isRegistered',
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(address),
    },
  });

  const isRegistered = Boolean(isRegisteredData);

  const { data: ciphertextData, refetch: refetchCiphertexts } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getPlayerCiphertexts',
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(address && isRegistered),
    },
  });

  const ciphertexts = useMemo(() => {
    if (!ciphertextData) {
      return null;
    }
    const tuple = ciphertextData as unknown as { role: string; attackPower: string };
    return tuple;
  }, [ciphertextData]);

  const decryptStats = async () => {
    if (!address || !instance || !ciphertexts || !signerPromise) {
      return;
    }

    try {
      setDecrypting(true);
      setFeedback('Authorizing decryption request...');

      const keypair = instance.generateKeypair();
      const handleContractPairs = [
        { handle: ciphertexts.role, contractAddress: CONTRACT_ADDRESS },
        { handle: ciphertexts.attackPower, contractAddress: CONTRACT_ADDRESS },
      ];

      const startTimestamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '10';
      const contractAddresses = [CONTRACT_ADDRESS];

      const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimestamp, durationDays);

      const signer = await signerPromise;
      if (!signer) {
        throw new Error('Wallet signer unavailable');
      }

      const signature = await signer.signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
        eip712.message,
      );

      setFeedback('Decrypting encrypted warrior stats...');

      const result = await instance.userDecrypt(
        handleContractPairs,
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        contractAddresses,
        address,
        startTimestamp,
        durationDays,
      );

      const roleId = Number(result[ciphertexts.role] ?? 0);
      const attackPower = Number(result[ciphertexts.attackPower] ?? 0);

      setDecrypted({
        roleId,
        roleName: ROLE_LABELS[roleId as keyof typeof ROLE_LABELS] ?? 'Unknown',
        attackPower,
      });
      setFeedback('Successfully decrypted your warrior.');
    } catch (err) {
      console.error('Failed to decrypt ciphertexts:', err);
      setFeedback(err instanceof Error ? err.message : 'Decryption failed. Please try again.');
    } finally {
      setDecrypting(false);
    }
  };

  const refreshAccess = async () => {
    if (!address || !signerPromise) {
      return;
    }

    try {
      setRefreshing(true);
      setFeedback('Re-granting access to your ciphertexts...');

      const signer = await signerPromise;
      if (!signer) {
        throw new Error('Wallet signer unavailable');
      }

      const gameContract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await gameContract.refreshMyAccess();
      await tx.wait();

      setFeedback('Access refreshed. You can decrypt again if needed.');
    } catch (err) {
      console.error('Failed to refresh access:', err);
      setFeedback(err instanceof Error ? err.message : 'Failed to refresh access.');
    } finally {
      setRefreshing(false);
    }
  };

  const resetView = () => {
    setDecrypted(null);
    setFeedback('');
    onBackToSelection();
  };

  if (!isConnected) {
    return (
      <section className="player-status">
        <div className="player-card">
          <h3>Connect to view your warrior</h3>
          <p>Use the connect button in the header to link your wallet.</p>
        </div>
      </section>
    );
  }

  if (!isRegistered) {
    return (
      <section className="player-status">
        <div className="player-card">
          <h3>No warrior found</h3>
          <p>You have not registered a warrior yet. Choose a role to join the battle.</p>
          <button type="button" className="player-secondary" onClick={onBackToSelection}>
            Create my warrior
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="player-status">
      <div className="player-card">
        <header className="player-header">
          <div>
            <h3>Encrypted Warrior Profile</h3>
            <p>Your role and attack power remain hidden until you decrypt them locally.</p>
          </div>
          <button type="button" className="player-secondary" onClick={refreshAccess} disabled={refreshing}>
            {refreshing ? 'Refreshing...' : 'Refresh access'}
          </button>
        </header>

        <div className="player-details">
          <div className="player-row">
            <span className="player-label">Registered address</span>
            <span className="player-value">{address}</span>
          </div>
          <div className="player-row">
            <span className="player-label">Role ciphertext</span>
            <span className="player-value monospace">{ciphertexts?.role}</span>
          </div>
          <div className="player-row">
            <span className="player-label">Attack power ciphertext</span>
            <span className="player-value monospace">{ciphertexts?.attackPower}</span>
          </div>
        </div>

        {feedback ? <p className="player-feedback">{feedback}</p> : null}

        {decrypted ? (
          <div className="player-decrypted">
            <div className="player-stat">
              <span className="player-label">Role</span>
              <span className="player-value highlighted">
                {decrypted.roleName} <span className="dimmed">(#{decrypted.roleId})</span>
              </span>
            </div>
            <div className="player-stat">
              <span className="player-label">Attack power</span>
              <span className="player-value highlighted">{decrypted.attackPower}</span>
            </div>
            <button type="button" className="player-secondary" onClick={() => setDecrypted(null)}>
              Hide decrypted stats
            </button>
          </div>
        ) : (
          <div className="player-actions">
            <button type="button" className="player-primary" onClick={decryptStats} disabled={decrypting}>
              {decrypting ? 'Decrypting...' : 'Decrypt my stats'}
            </button>
            <button type="button" className="player-secondary" onClick={resetView}>
              Forge a new warrior
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
