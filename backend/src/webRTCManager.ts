import PeerConnection from 'webrtc-datachannel';
import Delta from 'quill-delta';
import { pool } from './app';

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
                rooms[documentId] = {
                    documentId,
                    peers: [],
                    docState: new Delta(contentRow.rows[0].content)
                };
                createPeer(documentId, userId, cb);
            });
    } else {
        createPeer(documentId, userId, cb);
    }
}

function createPeer(documentId: number, userId: number, cb: (offer: string) => void) {
    const peer = new PeerConnection();
    const channel = peer.createChannel('delta-sync');

    peer.createOffer()
        .then((offer: any) => {
            peer.setOffer(offer);
            rooms[documentId].peers.push({ userId, peer, dataChannel: channel})
            cb(offer.sdp);
        }
    );
    
    channel.onmessage = (event: any) => {
        const delta = new Delta(JSON.parse(event.data));
        const room = rooms[documentId];
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
                if (err || contentRow.rows.length === 0) {
                    console.error("Error fetching current document:", err);
                    delete rooms[documentId];
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
                            delete rooms[documentId];
                            return;
                        }
                        // put delta version as current version
                        pool.query(`
                            UPDATE documents
                            SET content = $1, last_modified = CURRENT_TIMESTAMP
                            WHERE document_id = $2
                            `, [finalContent, documentId], (err) => {
                                if (err) {
                                    console.error("Error updating document:", err);
                                    delete rooms[documentId]
                                }
                                delete rooms[documentId]
                            });
                    });
                } else {
                    delete rooms[documentId]
                }
            });
    }
}