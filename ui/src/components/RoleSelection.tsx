import { useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { Contract } from 'ethers';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { CONTRACT_ADDRESS, CONTRACT_ABI, ROLE_LABELS } from '../config/contracts';
import '../styles/RoleSelection.css';

type SubmissionState = 'idle' | 'encrypting' | 'confirming' | 'succeeded';

interface RoleSelectionProps {
  onRegistered: () => void;
}

const ROLES = [
  {
    id: 1,
    name: ROLE_LABELS[1],
    tagline: 'Resilient frontline guardian with balanced power.',
  },
  {
    id: 2,
    name: ROLE_LABELS[2],
    tagline: 'Strategic commander directing the flow of combat.',
  },
  {
    id: 3,
    name: ROLE_LABELS[3],
    tagline: 'Swift cavalry specialist striking with precision.',
  },
  {
    id: 4,
    name: ROLE_LABELS[4],
    tagline: 'Long-range marksman delivering devastating volleys.',
  },
];

export function RoleSelection({ onRegistered }: RoleSelectionProps) {
  const { address, isConnected } = useAccount();
  const { instance, isLoading, error } = useZamaInstance();
  const signerPromise = useEthersSigner();

  const [selectedRole, setSelectedRole] = useState<number | null>(null);
  const [submissionState, setSubmissionState] = useState<SubmissionState>('idle');
  const [feedback, setFeedback] = useState<string>('');

  const isBusy = submissionState === 'encrypting' || submissionState === 'confirming';

  const actionLabel = useMemo(() => {
    if (!isConnected) {
      return 'Connect wallet to continue';
    }

    if (isLoading) {
      return 'Preparing encryption tools...';
    }

    if (!selectedRole) {
      return 'Choose your warrior';
    }

    if (isBusy) {
      return submissionState === 'encrypting' ? 'Encrypting choice...' : 'Finalizing on-chain...';
    }

    return 'Register warrior';
  }, [isBusy, isConnected, isLoading, selectedRole, submissionState]);

  const canSubmit = Boolean(
    isConnected &&
      instance &&
      selectedRole &&
      signerPromise &&
      !isBusy &&
      submissionState !== 'succeeded'
  );

  const registerPlayer = async () => {
    if (!address || !instance || !selectedRole || !signerPromise) {
      return;
    }

    try {
      setSubmissionState('encrypting');
      setFeedback('Generating encrypted role selection...');

      const encryptedInput = await instance
        .createEncryptedInput(CONTRACT_ADDRESS, address)
        .add8(selectedRole)
        .encrypt();

      const signer = await signerPromise;
      if (!signer) {
        throw new Error('Wallet signer unavailable');
      }

      const gameContract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      setSubmissionState('confirming');
      setFeedback('Submitting encrypted warrior to the arena...');

      const tx = await gameContract.registerPlayer(encryptedInput.handles[0], encryptedInput.inputProof);
      await tx.wait();

      setSubmissionState('succeeded');
      setFeedback('Warrior registered! Attack power has been forged on-chain.');
      onRegistered();
    } catch (err) {
      console.error('Failed to register player:', err);
      setSubmissionState('idle');
      setFeedback(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    }
  };

  return (
    <section className="role-selection">
      <header className="role-header">
        <h2>Choose Your Warrior</h2>
        <p>Pick a role to enter the frontier. Your choice stays confidential thanks to homomorphic encryption.</p>
      </header>

      <div className="role-grid">
        {ROLES.map((role) => (
          <button
            type="button"
            key={role.id}
            className={`role-card ${selectedRole === role.id ? 'selected' : ''}`}
            onClick={() => setSelectedRole(role.id)}
            disabled={isBusy}
          >
            <span className="role-id">#{role.id}</span>
            <span className="role-name">{role.name}</span>
            <span className="role-tagline">{role.tagline}</span>
          </button>
        ))}
      </div>

      {error ? <p className="role-error">{error}</p> : null}
      {feedback ? <p className={`role-feedback ${submissionState === 'succeeded' ? 'success' : ''}`}>{feedback}</p> : null}

      <div className="role-actions">
        <button type="button" className="role-submit" onClick={registerPlayer} disabled={!canSubmit}>
          {actionLabel}
        </button>
      </div>

      <div className="role-hint">
        <p>
          Attack power is randomly forged between 10 and 100 once your warrior enters the chain. Only you can decrypt
          the final stats.
        </p>
      </div>
    </section>
  );
}
