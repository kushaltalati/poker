import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';

import PokerTable from '../components/PokerTable';
import AddPlayerForm from '../components/AddPlayerForm';

const PLAYER_ID_KEY = 'poker-player-id';

function RoomPage() {
    const { roomCode } = useParams();
    const socket = useSocket();
    const [room, setRoom] = useState(null);
    const [error, setError] = useState('');
    
    const [myPlayerId, setMyPlayerId] = useState(() => {
        return localStorage.getItem(PLAYER_ID_KEY);
    });

    useEffect(() => {
        if (!socket) return;

        const handleRoomUpdate = (roomData) => {
            setRoom(roomData);
            setError(''); 
        };
        
        const handleErrors = (errorMessage) => {
            console.error('Server Error:', errorMessage);
            setError(errorMessage);
        };
        
        const handlePlayerAssigned = (player) => {
            console.log('Server assigned us player:', player);
            localStorage.setItem(PLAYER_ID_KEY, player._id);
            setMyPlayerId(player._id);
        };

        socket.emit('room:join', { 
            roomCode: roomCode.toUpperCase(), 
            playerId: myPlayerId 
        });

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
    }, [socket, roomCode, myPlayerId]);

    const handleResetRound = () => {
        if (window.confirm("Show cards and end the round?")) {
            socket.emit('round:reset', { roomCode });
        }
    };

    if (!room) {
        return <div className="loading-screen">
            <h2>Connecting to room {roomCode}...</h2>
            {error && <p className="error-message">{error}</p>}
        </div>;
    }

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
                <button onClick={handleResetRound} className="btn-reset">
                    End Round
                </button>
            </header>

            <PokerTable
                players={room.players}
                pot={room.pot}
                maxBet={room.maxBet}
                currentTurnIndex={room.currentTurnIndex}
                roomCode={room.code}
                myPlayerId={myPlayerId}
                showCards={room.showCards}
            />

            {!myPlayerId && <AddPlayerForm roomCode={room.code} />}
            
            {myPlayerId && !room.players.find(p => p._id === myPlayerId) &&
                 <AddPlayerForm roomCode={room.code} />
            }
        </div>
    );
}

export default RoomPage;