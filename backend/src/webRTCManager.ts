import { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } from "@koush/wrtc";
import Delta from 'quill-delta';
import { pool } from './app';
import { randomUUID } from "crypto";
import isEqual from "lodash.isequal";

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
    ops: Delta[];
    version: number;
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
                        ops: [],
                        version: 0
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
                urls: process.env.TURN_URL,
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
            content: room.docState,
            version: room.version
        }));
    };

    channel.onmessage = (event: any) => {
        const msg = JSON.parse(event.data);
        const { sender, delta, baseVersion } = msg;
        const room = rooms[documentId];
        if (!room) return;
        
        let incoming = new Delta(delta);
        const start = Math.max(0, Math.min(baseVersion ?? 0, room.ops.length));
        for (let i = start; i < room.ops.length; i++) {
            incoming = room.ops[i].transform(incoming, false);
        }
        // apply transformed delta
        room.docState = room.docState.compose(incoming);
        room.ops.push(incoming)
        room.version++;
        for (const p of room.peers) {
            if (p.dataChannel?.readyState !== "open") continue;
            p.dataChannel.send(JSON.stringify({ 
                type: 'delta', 
                sender, 
                delta: incoming, 
                version: room.version
            }));
        }
    };
}

export function leaveRoom(documentId: number, userId: number) {
    const room = rooms[documentId];
    if (!room) return;
    const peer = room.peers.find(p => p.userId === userId);
    if (peer) {
        try { 
            peer.dataChannel?.close();
        } catch {}
        try {
            peer.peer?.close();
        } catch {}
    }
    room.peers = room.peers.filter(p => p.userId !== userId);
    if (room.peers.length > 0) return;
    const finalState = JSON.stringify(room.docState);
    // grab old document that's saved
    pool.query(`
        SELECT content
        FROM documents
        WHERE document_id = $1
        `, [documentId], (err, contentRow) => {
            if (err) {
                console.error("Error fetching on room closure for: ", documentId);
                delete rooms[documentId];
                console.log("Room deleted with document id: ", documentId);
                return;
            }
            if (contentRow.rows.length === 0) {
                console.error("Error fetching content last saved for: ", documentId);
                delete rooms[documentId];
                console.log("Room deleted with document id: ", documentId);
                return;
            }
            const oldContent = contentRow.rows[0].content;
            const oldDelta = new Delta(oldContent).ops;
            const newDelta = new Delta(room.docState).ops;
            if (isEqual(oldDelta, newDelta)) {
                delete rooms[documentId]
                return;
            }
            // we save old content
            pool.query(`
                INSERT INTO document_versions(document_id, edited_by, content)
                VALUES ($1, $2, $3)
                `, [documentId, userId, oldContent], (err) => {
                if (err) {
                    console.error("Error inserting into version hisotry for: ", documentId);
                    delete rooms[documentId];
                    console.log("Room deleted with document id: ", documentId);
                    return;
                }
                // save content from current session
                pool.query(`
                    UPDATE documents
                    SET content = $1, last_modified = CURRENT_TIMESTAMP
                    WHERE document_id = $2
                    `, [finalState, documentId], (err) => {
                    if (err) console.error("Error saving document: ", documentId);
                    delete rooms[documentId];
                    console.log("Room deleted with document id: ", documentId);
                    return;
                    });
                });
        });
}
