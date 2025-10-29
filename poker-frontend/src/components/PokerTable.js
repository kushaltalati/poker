import React from 'react';
import Player from './Player';
import Pot from './Pot';
import CommunityCards from './CommunityCards';

function PokerTable({ 
    players, pot, maxBet, currentTurnIndex, roomCode, myPlayerId,
    showCards 
}) {
    
    const getPlayerStyle = (index, totalPlayers) => {
        const radius = 280;
        const angle = (index / totalPlayers) * 2 * Math.PI - (Math.PI / 2);
        
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;

        return {
            transform: `translate(${x}px, ${y}px)`
        };
    };

    return (
        <div className="poker-table-container">
            <div className="poker-table">
                
                {showCards ? (
                    <CommunityCards />
                ) : (
                    <Pot total={pot} maxBet={maxBet} />
                )}

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
            </div>
        </div>
    );
}

export default PokerTable;