"use client";
import { api } from "../../api";
import Delta from 'quill-delta';

type OnDeltaHandler = (delta: any, isSnapshot: boolean, version?: number) => void;

export class DocRTC {
    private pc: RTCPeerConnection | null = null;
    private channel: RTCDataChannel | null = null;
    private documentId: number;
    private onDelta?: OnDeltaHandler;
    private peerId: string;
    // last known server version we've integrated
    private serverVersion = 0;
    // queued local ops while inflight is outstanding
    private pending: Delta | null = null;
    // op we've sent, awaiting ack
    private inflight: Delta | null = null;

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
                                this.inflight = null;
                                this.onDelta && this.onDelta(snapshot, true, this.serverVersion);
                                return;
                            }
                            if (msg.type === 'delta') {
                                if (!msg.delta) return;
                                // ack for our own inflight op
                                if (msg.sender === this.peerId) {
                                    this.inflight = null;
                                    this.serverVersion = msg.version;
                                    if (this.pending && this.channel && this.channel.readyState === "open") {
                                        const toSend = this.pending;
                                        this.pending = null;
                                        this.sendToServer(toSend);
                                    }
                                    return;
                                }
                                // this is the remote op from another use, we have to use OT against inflight + pending
                                let incoming = new Delta(msg.delta);
                                if (this.inflight) {
                                    const incomingPrime = this.inflight.transform(incoming, true);
                                    const inflightPrime = incoming.transform(this.inflight, false);
                                    incoming = incomingPrime;
                                    this.inflight = inflightPrime;
                                }

                                if (this.pending) {
                                    const incomingPrime = this.pending.transform(incoming, true);
                                    const pendingPrime = incoming.transform(this.pending, false);
                                    incoming = incomingPrime;
                                    this.pending = pendingPrime;
                                }

                                this.serverVersion = msg.version;
                                this.onDelta?.(incoming, false, this.serverVersion);
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
        let d = new Delta(deltaObj);
        if (!this.inflight) {
            this.inflight = d;
            this.sendToServer(d);
            return;
        }
        this.pending = this.pending ? this.pending.compose(d) : d;
    }

    private sendToServer(delta: Delta) {
        if (!this.channel || this.channel.readyState !== "open") return;
        const payload = {
            sender: this.peerId,
            delta,
            baseVersion: this.serverVersion
        };
        this.channel.send(JSON.stringify(payload));
    }
}