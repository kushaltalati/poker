import React, { useMemo, useState } from 'react';
import Player from './Player';
import Pot from './Pot';
import CommunityCards from './CommunityCards';
import { useSocket } from '../context/SocketContext';
import AddPlayerForm from './AddPlayerForm';

function PokerTable({ 
    players, pot, maxBet, currentTurnIndex, roomCode, myPlayerId,
    showCards, communityCards, stage, canSelectWinner,
    needJoin
}) {
    const socket = useSocket();
    const [selectedWinners, setSelectedWinners] = useState([]);
    
    const getPlayerStyle = (index, totalPlayers) => {
        const radius = 250;
        const angle = (index / totalPlayers) * 2 * Math.PI - (Math.PI / 2);
        
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;

        return {
            transform: `translate(${x}px, ${y}px)`
        };
    };

    const activePlayers = useMemo(() => players || [], [players]);

    const toggleWinner = (id) => {
        setSelectedWinners(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const distributePot = () => {
        if (!socket) return;
        if (selectedWinners.length === 0) return;
        socket.emit('round:award', { roomCode, winnerIds: selectedWinners });
        setSelectedWinners([]);
    };

    const shouldShowCommunity = (stage && stage !== 'preflop') || (communityCards && communityCards.length > 0) || showCards;

    return (
        <div className="poker-table-container">
            <div className="poker-table">
                
                <div className="table-center" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                    {stage && (
                        <div className="stage-badge">
                            {stage === 'preflop' && 'Pre-Flop'}
                            {stage === 'flop' && 'Flop'}
                            {stage === 'turn' && 'Turn'}
                            {stage === 'river' && 'River'}
                            {stage === 'showdown' && 'Showdown'}
                        </div>
                    )}
                    {shouldShowCommunity && (
                        <div className="cards-row">
                            <CommunityCards communityCards={communityCards} stage={stage} />
                        </div>
                    )}
                    <div className="pot-row">
                        <Pot total={pot} maxBet={maxBet} />
                    </div>
                </div>

                <div className="player-circle">
                    {players.map((player, index) => (
                        <Player
                            key={player._id}
                            player={player}
                            style={getPlayerStyle(index, players.length)}
                            isActive={index === currentTurnIndex}
                            isSelf={player._id === myPlayerId}
                            roomCode={roomCode}
                            maxBet={maxBet}
                        />
                    ))}
                </div>

                {canSelectWinner && (
                    <div className="winner-overlay">
                        <div className="winner-panel">
                            <div className="winner-title">Select winner(s) to distribute pot</div>
                            <div className="winner-list">
                                {activePlayers.map(p => (
                                    <label key={p._id} className={`winner-chip ${selectedWinners.includes(p._id) ? 'selected' : ''}`}>
                                        <input type="checkbox" checked={selectedWinners.includes(p._id)} onChange={() => toggleWinner(p._id)} />
                                        <span className="winner-name">{p.name}</span>
                                        <span className="winner-balance">₹{p.balance}</span>
                                    </label>
                                ))}
                            </div>
                            <div className="winner-actions">
                                <button onClick={distributePot} className="btn-action btn-call">Distribute Pot</button>
                            </div>
                        </div>
                    </div>
                )}

                {needJoin && (
                    <div className="join-overlay">
                        <div className="join-panel">
                            <div className="winner-title">Join the table</div>
                            <AddPlayerForm roomCode={roomCode} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default PokerTable;