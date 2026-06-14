import { listDevices, getDeviceById } from '../../db/repositories/device.js';
export function registerDeviceRoutes(app) {
    app.get('/api/devices', async (_request, reply) => {
        const devices = await listDevices();
        return reply.send(devices);
    });
    app.get('/api/devices/:id', async (request, reply) => {
        const device = await getDeviceById(request.params.id);
        if (!device)
            return reply.code(404).send({ error: 'Device not found' });
        return reply.send(device);
    });
}
//# sourceMappingURL=devices.js.map