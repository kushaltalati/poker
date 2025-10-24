import React from 'react';

function Pot({ total, maxBet }) {
    return (
        <div className="pot-display">
            <h2>Pot: ${total}</h2>
            <h3>Current Bet: ${maxBet}</h3>
        </div>
    );
}

export default Pot;