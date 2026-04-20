import { io } from 'socket.io-client';

let socket = null;

/**
 * Returns a singleton Socket.io instance authenticated with the given token.
 * Call disconnect() before calling this again with a different token.
 */
export function getSocket(accessToken) {
  if (!socket) {
    socket = io('/', {             // same origin — proxied by Vite in dev
      auth: { token: accessToken },
      transports: ['websocket'],
      reconnectionAttempts: 5,
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
