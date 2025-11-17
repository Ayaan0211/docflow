"use client";
import { api } from "../../api";
import Delta from 'quill-delta';

type OnDeltaHandler = (delta: any, version?: number) => void;

export class DocRTC {
    private pc: RTCPeerConnection | null = null;
    private channel: RTCDataChannel | null = null;
    private documentId: number;
    private onDelta?: OnDeltaHandler;
    private peerId: string;
    private serverVersion = 0;
    private pending: Delta | null = null;

    constructor(documentId: number, onDelta?: OnDeltaHandler) {
        this.documentId = documentId;
        this.onDelta = onDelta;
        this.peerId = crypto.randomUUID();
    }

    connect(): Promise<void> {
        return api.rtc.join(this.documentId)
            .then((offer) => {
                this.peerId = offer.peerId;
                const iceServers =
                    process.env.NODE_ENV === "production"
                        ? [
                            { urls: "stun:stun.l.google.com:19302" },
                            {
                            urls: process.env.NEXT_PUBLIC_TURN_URL!,
                            username: process.env.NEXT_PUBLIC_TURN_USERNAME!,
                            credential: process.env.NEXT_PUBLIC_TURN_PASSWORD!,
                            },
                        ]
                        : [{ urls: "stun:stun.l.google.com:19302" }];
                this.pc = new RTCPeerConnection({ iceServers });
                this.pc.ondatachannel = (event) => {
                    const channel = event.channel;
                    if (channel.label !== 'delta-sync') return;
                    this.channel = channel;
                    channel.onmessage = (e) => {
                        try {
                            const msg = JSON.parse(e.data);
                            if (msg.type === 'snapshot') {
                                const snapshot = new Delta(msg.content.ops);
                                this.serverVersion = msg.version ?? 0;
                                this.pending = null;
                                this.onDelta && this.onDelta(snapshot, this.serverVersion);
                                return;
                            }
                            if (msg.type === 'delta') {
                                if (!msg.delta) return;
                                let incoming = new Delta(msg.delta);
                                if (msg.sender === this.peerId) {
                                    this.pending = null;
                                    this.serverVersion = msg.version;
                                     return;
                                }
                                // transfrom remote ops against local ops
                                if (this.pending) incoming = incoming.transform(this.pending, true);
                                this.serverVersion = msg.version;
                                this.onDelta && this.onDelta(incoming, this.serverVersion);
                                if (this.pending) this.pending = this.pending.transform(incoming, false);
                            }
                        } catch (err) {
                            console.error("Invalid delta payload", err);
                        }
                    }
                };
                // set offer
                return this.pc.setRemoteDescription(offer);
            })
            .then(() => this.pc!.createAnswer())
            .then((answer) => {
                return this.pc!.setLocalDescription(answer)
                    .then(() => api.rtc.answer(this.documentId, this.pc!.localDescription!))
                    .then(() => { return; });
            })
            .catch((err) => {
                console.error("RTC connection failed", err);
            })
    }

    leave(): void {
    if (this.channel) {
        this.channel.close();
        this.channel = null;
    }
    if (this.pc) {
        this.pc.close();
        this.pc = null;
    }
}


    sendDelta(deltaObj: any): void {
        if(!this.channel || this.channel.readyState !== 'open') return;
        const d = new Delta(deltaObj);
        if (this.pending) {
            this.pending = this.pending.compose(d);
        } else { 
            this.pending = d;
        }

        const payload = {
            sender: this.peerId,
            delta: deltaObj,
            baseVersion: this.serverVersion
        };
        this.channel.send(JSON.stringify(payload));
    }
}