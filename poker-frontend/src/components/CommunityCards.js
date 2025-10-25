import React from 'react';

function CommunityCards() {
    return (
        <div className="community-cards-container">
            <div className="card-group">
                <span className="card-group-label">Flop</span>
                <div className="card-back" style={{ animationDelay: '0s' }}></div>
                <div className="card-back" style={{ animationDelay: '0.1s' }}></div>
                <div className="card-back" style={{ animationDelay: '0.2s' }}></div>
            </div>
            
            <div className="card-group">
                <span className="card-group-label">Turn</span>
                <div className="card-back" style={{ animationDelay: '0.3s' }}></div>
            </div>

            <div className="card-group">
                <span className="card-group-label">River</span>
                <div className="card-back" style={{ animationDelay: '0.4s' }}></div>
            </div>
        </div>
    );
}

export default CommunityCards;