import React from 'react';

function CommunityCards({ communityCards = [], stage }) {
    const flop = communityCards.slice(0, 3);
    const turn = communityCards.slice(3, 4);
    const river = communityCards.slice(4, 5);

    return (
        <div className="community-cards-container">
            <div className="card-group">
                <span className="card-group-label">Flop</span>
                {flop.map((_, idx) => (
                    <div key={`flop-${idx}`} className="card-back" style={{ animationDelay: `${idx * 0.1}s` }}></div>
                ))}
            </div>
            
            <div className="card-group">
                <span className="card-group-label">Turn</span>
                {turn.map((_, idx) => (
                    <div key={`turn-${idx}`} className="card-back" style={{ animationDelay: '0.3s' }}></div>
                ))}
            </div>

            <div className="card-group">
                <span className="card-group-label">River</span>
                {river.map((_, idx) => (
                    <div key={`river-${idx}`} className="card-back" style={{ animationDelay: '0.4s' }}></div>
                ))}
            </div>
        </div>
    );
}

export default CommunityCards;