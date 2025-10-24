import React, { useState } from 'react';
import { useSocket } from '../context/SocketContext';

function AddPlayerForm({ roomCode }) {
    const [name, setName] = useState('');
    const [balance, setBalance] = useState(1000);
    const socket = useSocket();

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name || balance <= 0) {
            alert('Please enter a valid name and starting balance.');
            return;
        }
        
        socket.emit('player:add', { 
            roomCode, 
            playerName: name, 
            balance: Number(balance) 
        });
    };

    return (
        <form onSubmit={handleSubmit} className="add-player-form">
            <h3>Join the Game</h3>
            <input
                type="text"
                placeholder="Enter Your Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
            />
            <input
                type="number"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
            />
            <button type="submit">Join</button>
        </form>
    );
}

export default AddPlayerForm;