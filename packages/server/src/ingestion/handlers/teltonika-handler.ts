import net from 'net';
import type { IngestedPosition } from '@fleetoss/core';
import { extractImei, parseCodec8 } from '../protocols/teltonika.js';

export function teltonikaHandler(socket: net.Socket, ingest: (data: IngestedPosition, protocol: string) => Promise<void>) {
  let buffer = Buffer.alloc(0);
  let imei = '';
  let awaitingImei = true;
  let expectingData = false;
  let dataLength = 0;

  socket.on('data', async (chunk: Buffer) => {
    if (awaitingImei) {
      // First data from Teltonika device is the IMEI (15 ASCII digits)
      const extracted = extractImei(chunk);
      if (extracted) {
        imei = extracted;
        awaitingImei = false;
        // Respond with 1 (accept)
        socket.write(Buffer.from([0x01]));
        console.log('[Teltonika] IMEI:', imei);
      }
      return;
    }

    if (!expectingData) {
      // After IMEI acknowledgment, device sends the data length (4 bytes)
      if (chunk.length >= 4) {
        dataLength = chunk.readUInt32BE(0);
        expectingData = true;
        buffer = chunk.slice(4);
        console.log('[Teltonika] Expecting', dataLength, 'bytes of data');
      }
      return;
    }

    // Accumulate data until we have the full expected amount
    buffer = Buffer.concat([buffer, chunk]);
    if (buffer.length < dataLength) return;

    // We have the full packet — parse it
    const positions = parseCodec8(buffer, imei);
    console.log('[Teltonika] Parsed', positions.length, 'positions');

    for (const position of positions) {
      try {
        await ingest(position, 'teltonika');
      } catch (err) {
        console.error('[Teltonika] Ingest error:', err);
      }
    }

    // Respond with number of positions saved (1 byte)
    socket.write(Buffer.from([positions.length]));
    console.log('[Teltonika] Responded with', positions.length);

    // Reset for next packet
    expectingData = false;
    buffer = Buffer.alloc(0);
  });

  socket.on('error', () => {});
}
