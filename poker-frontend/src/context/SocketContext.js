import React, { createContext, useContext, useMemo } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

export const useSocket = () => {
    return useContext(SocketContext);
};

const SERVER_URL = process.env.REACT_APP_SOCKET_URL;

export const SocketProvider = ({ children }) => {
    const socket = useMemo(() => io(SERVER_URL), []);

    return (
        <SocketContext.Provider value={socket}>
            {children}
        </SocketContext.Provider>
    );
};