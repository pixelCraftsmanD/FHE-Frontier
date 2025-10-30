import { useState } from 'react';
import { Header } from './Header';
import { RoleSelection } from './RoleSelection';
import { PlayerStatus } from './PlayerStatus';
import '../styles/GameApp.css';

type GameTab = 'join' | 'status';

export function GameApp() {
  const [activeTab, setActiveTab] = useState<GameTab>('join');

  return (
    <div className="game-app">
      <Header />
      <main className="game-main">
        <div className="game-panel">
          <nav className="game-tabs">
            <button
              type="button"
              className={`game-tab ${activeTab === 'join' ? 'active' : 'inactive'}`}
              onClick={() => setActiveTab('join')}
            >
              Join the Battle
            </button>
            <button
              type="button"
              className={`game-tab ${activeTab === 'status' ? 'active' : 'inactive'}`}
              onClick={() => setActiveTab('status')}
            >
              My Warrior
            </button>
          </nav>

          {activeTab === 'join' ? (
            <RoleSelection onRegistered={() => setActiveTab('status')} />
          ) : (
            <PlayerStatus onBackToSelection={() => setActiveTab('join')} />
          )}
        </div>
      </main>
    </div>
  );
}
