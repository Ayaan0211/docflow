import { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } from "@koush/wrtc";
import Delta from 'quill-delta';
import { pool } from './app';
import { randomUUID } from "crypto";

(global as any).RTCPeerConnection = RTCPeerConnection;
(global as any).RTCSessionDescription = RTCSessionDescription;
(global as any).RTCIceCandidate = RTCIceCandidate;

type UserSession = {
    userId: number;
    peerId: string;
    peer: any;
    dataChannel: any;
}

interface Room {
    documentId: number;
    peers: UserSession[];
    docState: Delta;
    createdAt: number;
    lastActiveAt: number;
}

export const rooms: Record<number, Room> = {};

export function joinRoom(documentId: number, userId: number, cb: (offer: string) => void) {
    if (!rooms[documentId]) {
        pool.query(`
            SELECT content from documents WHERE document_id = $1
            `, [documentId], (err, contentRow) => {
                if (err || contentRow.rows.length === 0) return cb('');
                try {
                    const raw = contentRow.rows[0].content;
                    let parsed: any;
                    if (!raw) {
                        parsed = { ops: [] };
                    } else if (typeof raw === "string") {
                        parsed = JSON.parse(raw);
                    } else if (typeof raw === "object") {
                        parsed = raw;
                    } else {
                        parsed = { ops: [] };
                    }
                    if (!parsed.ops || !Array.isArray(parsed.ops)) {
                        console.warn(`Document ${documentId} had invalid ops, resetting`);
                        parsed = { ops: [] };
                    }
                    rooms[documentId] = {
                        documentId,
                        peers: [],
                        docState: new Delta(parsed),
                        createdAt: Date.now(),
                        lastActiveAt: Date.now()
                    };
                } catch (parseError) {
                    console.error("Error initializing Delta for document", documentId, parseError);
                    return cb('');
                }
                createPeer(documentId, userId, cb);
            });
    } else {
        createPeer(documentId, userId, cb);
    }
}

function createPeer(documentId: number, userId: number, cb: (offer: any) => void) {
    const peerId = randomUUID();
    const iceServers =
        process.env.NODE_ENV === "prod"
            ? [
                { urls: "stun:stun.l.google.com:19302" },
                {
                urls: process.env.TURN_URL || "turn:turnserver:3478",
                username: process.env.TURN_USERNAME,
                credential: process.env.TURN_PASSWORD,
                },
            ]
            : [
                // local/dev mode — STUN only
                { urls: "stun:stun.l.google.com:19302" },
            ];
    const peer = new RTCPeerConnection({ iceServers });

    const channel = peer.createDataChannel('delta-sync');

    let finished = false;

    function finish() {
        if (finished) return; // prevent multiple sends
        finished = true;

        const offer = peer.localDescription;
        if (offer) {
            if (!rooms[documentId]) {
                console.warn(`⚠️ Room ${documentId} no longer exists when finish() ran`);
                return;
            }

            const existing = rooms[documentId].peers.find(p => p.userId === userId);

            if (existing) {
            try {
                existing.dataChannel?.close();
                existing.peer?.close();
            } catch {}
            rooms[documentId].peers = rooms[documentId].peers.filter(p => p.userId !== userId);
            }
            rooms[documentId].peers.push({ userId, peerId, peer, dataChannel: channel });
            cb({
                type: offer.type,
                sdp: offer.sdp,
                peerId
            });
        } else {
            cb('');
        }
    }

    peer.onicegatheringstatechange = () => {
        if (peer.iceGatheringState === 'complete') finish();
    };

    peer.onicecandidate = (event: any) => {
        if (!event.candidate && peer.iceGatheringState === 'complete') finish();
    };

    setTimeout(finish, 2000);

    peer.createOffer()
        .then((offer: any) => peer.setLocalDescription(offer))
        .catch((err: unknown) => {
            console.error("Error creating offer:", String(err));
            cb('');
        });
    
    channel.onopen = () => {
        const room = rooms[documentId];
        if (!room) return;
        // send a snapshot with the authoritative state
        channel.send(JSON.stringify({
            type: 'snapshot',
            content: room.docState
        }));
    };

    channel.onmessage = (event: any) => {
        const msg = JSON.parse(event.data);
        const { sender, delta } = msg;
        const room = rooms[documentId];
        try {
            const d = new Delta(delta);
            room.docState = room.docState.compose(d);
            room.lastActiveAt = Date.now();
        } catch (err) {
            console.error(`Failed to apply delta to doc ${documentId}:`, err);
        }
        if (!room) return;
        for (const p of room.peers) {
            if (p.peerId !== sender && p.userId !== userId && p.dataChannel?.readyState === "open") {
            p.dataChannel.send(JSON.stringify({ type: 'delta', sender: peerId, delta }));
            }
        }
    };

}
