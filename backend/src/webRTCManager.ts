import { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } from "@koush/wrtc";
import Delta from 'quill-delta';
import { pool } from './app';

(global as any).RTCPeerConnection = RTCPeerConnection;
(global as any).RTCSessionDescription = RTCSessionDescription;
(global as any).RTCIceCandidate = RTCIceCandidate;

type UserSession = {
    userId: number;
    peer: any;
    dataChannel: any;
}

interface Room {
    documentId: number;
    peers: UserSession[];
    docState: Delta;
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
                    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
                    rooms[documentId] = {
                        documentId,
                        peers: [],
                        docState: new Delta(parsed)
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

function createPeer(documentId: number, userId: number, cb: (offer: string) => void) {
    const peer = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    const channel = peer.createDataChannel('delta-sync');

    peer.onicecandidate = (event: any) => {
        if (!exports.rooms[documentId]) {
            exports.rooms[documentId] = { peers: [], docState: null, documentId };
        }
        if (!event.candidate) {
            // Final candidate (done gathering)
            exports.rooms[documentId].peers.push({ userId, peer, dataChannel: channel });
            cb(peer.localDescription.sdp);
        }
    };

    peer.createOffer()
        .then((offer: any) => peer.setLocalDescription(offer))
        .catch((err: unknown) => console.error("Error creating or setting local description:", String(err)));
    
    channel.onmessage = (event: any) => {
        const delta = new Delta(JSON.parse(event.data));
        const room = rooms[documentId];
        if (!room?.docState) return;
        // merge into master doc state
        room.docState = room.docState.compose(delta);
        for (const p of room.peers) {
            if (p.userId !== userId && p.dataChannel?.readyState === "open") {
                try {
                    p.dataChannel.send(JSON.stringify(delta));
                } catch (err) {
                    console.error("Broadcast error: ", err);
                }
            }
        }
    }
}

// To optimize saves, we will only save the db once all the people in the room leave
export function leaveRoom(documentId: number, userId: number) {
    const room = rooms[documentId];
    if (!room) return;
    room.peers = room.peers.filter(p => p.userId !== userId);
    if (room.peers.length === 0) {
        const finalContent = JSON.stringify(room.docState);
        // save old version into version history
        pool.query(`
            SELECT content
            FROM documents
            WHERE document_id = $1
            `, [documentId], (err, contentRow) => {
                const cleanup = () => {
                    for (const p of room.peers) {
                        p.dataChannel?.close();
                        p.peer?.close();
                    }
                    delete rooms[documentId];
                };
                if (err || contentRow.rows.length === 0) {
                    console.error("Error fetching current document:", err);
                    cleanup();
                    return;
                }
                const content = contentRow.rows[0].content;
                if (JSON.stringify(content) !== finalContent) {
                    pool.query(`
                    INSERT INTO document_versions(document_id, edited_by, content)
                    VALUES ($1, $2, $3)
                    `, [documentId, userId, content], (err, contentRow) => {
                        if (err) {
                            console.error("Error saving version:", err);
                            cleanup();
                            return;
                        }
                        // put delta version as current version
                        pool.query(`
                            UPDATE documents
                            SET content = $1, last_modified = CURRENT_TIMESTAMP
                            WHERE document_id = $2
                            `, [finalContent, documentId], (err) => {
                                if (err) console.error("Error updating document:", err)
                                cleanup();
                            });
                    });
                } else {
                    cleanup();
                }
            });
    }
}