const clients = new Set();
export function registerRealtime(app) {
    app.get('/ws', { websocket: true }, (socket, request) => {
        const client = { socket };
        socket.on('message', (data) => {
            try {
                const msg = JSON.parse(data.toString());
                if (msg.type === 'subscribe' && msg.deviceIds) {
                    client.deviceFilter = msg.deviceIds;
                }
            }
            catch { }
        });
        socket.on('close', () => {
            clients.delete(client);
        });
        clients.add(client);
    });
}
export function broadcastPosition(position) {
    const msg = JSON.stringify({ type: 'position', data: position });
    for (const client of clients) {
        try {
            if (client.socket.readyState === 1) {
                client.socket.send(msg);
            }
        }
        catch {
            clients.delete(client);
        }
    }
}
//# sourceMappingURL=index.js.map