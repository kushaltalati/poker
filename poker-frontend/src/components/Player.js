import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';

function Player({ player, style, isActive, isSelf, roomCode, maxBet }) {
    const [raiseAmount, setRaiseAmount] = useState(0);
    const [isRaising, setIsRaising] = useState(false);
    const socket = useSocket();

    useEffect(() => {
        setRaiseAmount(Math.max(maxBet * 2, 10));
    }, [maxBet]);
    
    const handleAction = (action) => {
        if (!socket) return;
        
        let amount = 0;
        if (action === 'raise') {
            amount = Number(raiseAmount);
            if (amount <= maxBet) {
                alert('Raise must be greater than the current max bet.');
                return;
            }
            if (amount - player.currentBet > player.balance) {
                alert('You do not have enough balance for this raise.');
                return;
            }
        }

        socket.emit('player:action', {
            roomCode,
            action,
            amount 
        });
        
        setIsRaising(false);
    };

    const onFold = () => {
        handleAction('fold');
    }
    
    const onCall = () => {
        handleAction('call');
    }

    const onRaiseClick = () => {
        setIsRaising(true);
    }

    const onConfirmRaise = () => {
        handleAction('raise');
    }

    const onCancelRaise = () => {
        setIsRaising(false);
    }

    const callAmount = maxBet - player.currentBet;

    let classNames = 'player-card';
    if (isActive) classNames += ' active';
    if (player.folded) classNames += ' folded';
    if (isSelf) classNames += ' self';

    return (
        <div className={classNames} style={style}>
            <div className="player-display">
                <div className="player-icon">{player.name[0]}</div>
                <div className="player-info">
                    <strong className="player-name">{player.name.split(' ')[0]}</strong>
                    <span className="player-balance">${player.balance}</span>
                </div>
            </div>

            {player.currentBet > 0 && (
                <span className="player-bet-chip">${player.currentBet}</span>
            )}

            {isActive && isSelf && !player.folded && (
                <div className="player-controls">
                    
                    {!isRaising && (
                        <>
                            <button onClick={onFold} className="btn-action btn-fold">Fold</button>
                            <button
                                onClick={onCall}
                                className="btn-action btn-call"
                                disabled={callAmount > player.balance && callAmount > 0} 
                            >
                                {callAmount === 0 ? 'Check' : `Call $${callAmount}`}
                            </button>
                            <button onClick={onRaiseClick} className="btn-action btn-raise">Raise</button>
                        </>
                    )}
                    
                    {isRaising && (
                        <div className="raise-group">
                            <span>$</span>
                            <input
                                type="number"
                                className="raise-input"
                                value={raiseAmount}
                                onChange={(e) => setRaiseAmount(e.target.value)}
                                min={maxBet * 2}
                                step="10"
                            />
                            <button onClick={onConfirmRaise} className="btn-action btn-raise">OK</button>
                            <button onClick={onCancelRaise} className="btn-action btn-cancel">X</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default Player;