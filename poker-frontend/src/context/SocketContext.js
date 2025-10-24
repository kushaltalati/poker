import React, { createContext, useContext, useMemo } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

export const useSocket = () => {
    return useContext(SocketContext);
};

// URL of your backend server
// !! IMPORTANT: Change to your IP (e.g., 'http://192.168.1.10:5001') 
// for testing on other devices on your Wi-Fi.
const SERVER_URL = 'http://localhost:5001';

export const SocketProvider = ({ children }) => {
    const socket = useMemo(() => io(SERVER_URL), []);

    return (
        <SocketContext.Provider value={socket}>
            {children}
        </SocketContext.Provider>
    );
};