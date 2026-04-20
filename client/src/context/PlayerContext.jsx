import { createContext, useContext, useState } from 'react';

const PlayerContext = createContext(null);

export function PlayerProvider({ children }) {
  const [player, setPlayer] = useState(null);
  // player = { token, pairNumber, player1Name, player2Name, sessionId, sessionName, sessionToken }

  const joinAsPlayer = (data) => setPlayer(data);
  const leaveSession = () => setPlayer(null);

  // Fetch wrapper for player token
  const playerFetch = async (url, options = {}) => {
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
        Authorization: `Bearer ${player?.token}`,
      },
    });
  };

  return (
    <PlayerContext.Provider value={{ player, joinAsPlayer, leaveSession, playerFetch }}>
      {children}
    </PlayerContext.Provider>
  );
}

export const usePlayer = () => useContext(PlayerContext);
