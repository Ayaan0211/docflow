"use client";
import { api } from "../../api";

type OnDeltaHandler = (delta: any) => void;

export class DocRTC {
    private pc: RTCPeerConnection | null = null;
    private channel: RTCDataChannel | null = null;
    private documentId: number;
    private onDelta?: OnDeltaHandler;
    private peerId: string;

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
                                this.onDelta && this.onDelta({ snapshot: msg.content })
                                return;
                            }
                            if (msg.type === 'delta') {
                                if (!msg.delta) return;
                                if (msg.sender !== this.peerId) {
                                    this.onDelta && this.onDelta(msg.delta);
                                } else {
                                    return;
                                }
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
    console.log("Disconnected from document RTC");
}


    sendDelta(deltaObj: any): void {
        if(!this.channel || this.channel.readyState !== 'open') return;
        const payload = {
            sender: this.peerId,
            delta: deltaObj
        };
        this.channel.send(JSON.stringify(payload));
    }
}