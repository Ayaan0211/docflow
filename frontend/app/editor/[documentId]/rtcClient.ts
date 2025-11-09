"use client";
import { off } from "process";
import { api } from "../../api";

type OnDeltaHandler = (delta: any) => void;

export class DocRTC {
    private pc: RTCPeerConnection | null = null;
    private channel: RTCDataChannel | null = null;
    private documentId: number;
    private onDelta?: OnDeltaHandler;

    constructor(documentId: number, onDelta?: OnDeltaHandler) {
        this.documentId = documentId;
        this.onDelta = onDelta;
    }

    connect(): Promise<void> {
        return api.rtc.join(this.documentId)
            .then(({ offer }) => {
                this.pc = new RTCPeerConnection({
                    iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }]
                });
                this.pc.ondatachannel = (event) => {
                    const channel = event.channel;
                    if (channel.label !== 'delta-sync') return;
                    this.channel = channel;
                    channel.onmessage = (e) => {
                        try  {
                            const delta = JSON.parse(e.data);
                            this.onDelta && this.onDelta(delta);
                        } catch (err) {
                            console.error("Invalid delta payload", err);
                        }
                    }
                };
                // set offer
                return this.pc.setRemoteDescription({ type: 'offer', sdp: offer});
            })
            .then(() => this.pc!.createAnswer())
            .then((answer) => {
                return this.pc!.setLocalDescription(answer)
                    .then(() => api.rtc.answer(this.documentId, answer.sdp!))
                    .then(() => { return; });
            })
            .catch((err) => {
                console.error("RTC connection failed", err);
            })
    }

    sendDelta(deltaObj: any): void {
        if(!this.channel || this.channel.readyState !== `open`) return;
        this.channel.send(JSON.stringify(deltaObj));
    }

    leave(): Promise<void> {
        return api.rtc.leave(this.documentId)
            .then(() => { return; })
            .catch((err) => console.warn("RTC leave failed", err))
            .finally(() => {
                this.channel && this.channel.close();
                this.pc && this.pc.close();
                this.pc = null;
                this.channel = null;
            });
    }
}