import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';

import PokerTable from '../components/PokerTable';

const PLAYER_ID_KEY = 'poker-player-id';

function RoomPage() {
    const { roomCode } = useParams();
    const socket = useSocket();

    const [room, setRoom] = useState(null);
    const [error, setError] = useState('');
    const [showLeaveMenu, setShowLeaveMenu] = useState(false);

    const [myPlayerId, setMyPlayerId] = useState(() => {
        return localStorage.getItem(PLAYER_ID_KEY);
    });

    // ✅ Stable handler functions to avoid re-binding
    const handleRoomUpdate = useCallback((roomData) => {
        setRoom(roomData);
        setError('');
    }, []);

    const handleErrors = useCallback((errorMessage) => {
        console.error('Server Error:', errorMessage);
        setError(errorMessage);
    }, []);

    const handlePlayerAssigned = useCallback((player) => {
        console.log('Server assigned us player:', player);
        localStorage.setItem(PLAYER_ID_KEY, player._id);
        setMyPlayerId(player._id);
    }, []);

    useEffect(() => {
        if (!socket) return;

        // ✅ Emit join only once when socket is ready
        socket.emit('room:join', { 
            roomCode: roomCode.toUpperCase(), 
            playerId: myPlayerId || null
        });

        // Register listeners
        socket.on('room:update', handleRoomUpdate);
        socket.on('player:assigned', handlePlayerAssigned);

        socket.on('error:room_not_found', handleErrors);
        socket.on('error:server', handleErrors);
        socket.on('error:not_your_turn', handleErrors);
        socket.on('error:invalid_raise', handleErrors);
        socket.on('error:insufficient_funds', handleErrors);
        socket.on('error:not_authorized', handleErrors);

        return () => {
            socket.off('room:update', handleRoomUpdate);
            socket.off('player:assigned', handlePlayerAssigned);

            socket.off('error:room_not_found', handleErrors);
            socket.off('error:server', handleErrors);
            socket.off('error:not_your_turn', handleErrors);
            socket.off('error:invalid_raise', handleErrors);
            socket.off('error:insufficient_funds', handleErrors);
            socket.off('error:not_authorized', handleErrors);
        };

    }, [socket, roomCode, myPlayerId, handleRoomUpdate, handleErrors, handlePlayerAssigned]);

    const leaveTemporarily = () => {
        console.log(joinAgain, myPlayerObj);
        if (!socket || !room) return;
        socket.emit('player:leave', { roomCode: room.code, mode: 'temporary' });
        setShowLeaveMenu(false);
    };

    const leavePermanently = () => {
        if (!socket || !room) return;
        socket.emit('player:leave', { roomCode: room.code, mode: 'permanent' });
        localStorage.removeItem(PLAYER_ID_KEY);
        setMyPlayerId(null);
        setShowLeaveMenu(false);
    };

    const joinAgain = () => {
        if (!socket || !room) return;
        socket.emit('player:joinagain', { roomCode: room.code });
    };

    if (!room) {
        return (
            <div className="loading-screen">
                <h2>Connecting to room {roomCode}...</h2>
                {error && <p className="error-message">{error}</p>}
            </div>
        );
    }

    const myPlayerObj = room.players?.find(p => p._id === myPlayerId);

    return (
        <div className="room-container">
            <header className="room-header">
                <Link to="/" className="btn-home">
                    &larr; Back to Home
                </Link>
                
                <div className="room-details">
                    <h1>{room.name}</h1>
                    <span>Join Code: <strong>{room.code}</strong></span>
                </div>

                {error && <div className="error-toast">{error}</div>}

                {myPlayerId && (
                    <div style={{ position: 'absolute', top: 15, right: 15, display: 'flex', gap: 8 }}>
                        <button className="btn-reset" onClick={() => setShowLeaveMenu(v => !v)}>
                            Leave
                        </button>
                        {showLeaveMenu && (
                            <div style={{
                                position: 'absolute', top: 40, right: 0, 
                                background: '#242424', border: '1px solid #444',
                                borderRadius: 8, padding: 10, zIndex: 1000
                            }}>
                                <div style={{ marginBottom: 8, fontWeight: 700 }}>Leave game</div>
                                <button className="btn-action btn-fold"
                                    style={{ width: '100%', marginBottom: 6 }}
                                    onClick={leavePermanently}>
                                    Leave Permanently
                                </button>
                                <button className="btn-action btn-raise"
                                    style={{ width: '100%' }}
                                    onClick={leaveTemporarily}>
                                    Leave Temporarily
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </header>

            <PokerTable
                players={room.players}
                pot={room.pot}
                maxBet={room.maxBet}
                currentTurnIndex={room.currentTurnIndex}
                roomCode={room.code}
                myPlayerId={myPlayerId}
                showCards={room.showCards}
                communityCards={room.communityCards}
                stage={room.stage}
                canSelectWinner={room.canSelectWinner}
                needJoin={!myPlayerId || !room.players.find(p => p._id === myPlayerId)}
            />

        </div>
    );
}

export default RoomPage;