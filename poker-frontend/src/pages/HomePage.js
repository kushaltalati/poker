import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// !! IMPORTANT: Change to your IP (e.g., 'http://192.168.1.10:5001/api') 
// for testing on other devices.
const API_URL = 'http://localhost:5001/api';

function HomePage() {
    const [roomName, setRoomName] = useState('');
    const [roomCode, setRoomCode] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleCreateRoom = async (e) => {
        e.preventDefault();
        setError('');
        if (!roomName) {
            setError('Please enter a room name.');
            return;
        }
        try {
            const res = await fetch(`${API_URL}/rooms`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: roomName }),
            });
            if (!res.ok) throw new Error('Failed to create room.');
            const newRoom = await res.json();
            navigate(`/room/${newRoom.code}`);
        } catch (err) {
            setError(err.message);
        }
    };

    const handleJoinRoom = async (e) => {
        e.preventDefault();
        setError('');
        if (!roomCode) {
            setError('Please enter a room code.');
            return;
        }
        try {
            const res = await fetch(`${API_URL}/rooms/${roomCode.toUpperCase()}`);
            if (!res.ok) throw new Error('Room not found.');
            
            navigate(`/room/${roomCode.toUpperCase()}`);
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="home-container">
            <h1>Poker Balance Manager</h1>
            {error && <p className="error-message">{error}</p>}

            <form onSubmit={handleCreateRoom} className="home-form">
                <h2>Create a New Room</h2>
                <input
                    type="text"
                    placeholder="Enter Room Name"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                />
                <button type="submit">Create Room</button>
            </form>

            <div className="divider">OR</div>

            <form onSubmit={handleJoinRoom} className="home-form">
                <h2>Join an Existing Room</h2>
                <input
                    type="text"
                    placeholder="Enter Room Code"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value)}
                />
                <button type="submit">Join Room</button>
            </form>
        </div>
    );
}

export default HomePage;