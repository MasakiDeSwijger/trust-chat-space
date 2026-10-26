import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const ICE: RTCConfiguration = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
    // Free public relay so calls connect across strict home/mobile networks
    { urls: ["turn:openrelay.metered.ca:80", "turn:openrelay.metered.ca:443", "turn:openrelay.metered.ca:443?transport=tcp"], username: "openrelayproject", credential: "openrelayproject" },
  ],
};

export type Peer = { id: string; name: string; stream: MediaStream | null };

/** Mesh WebRTC call. Signaling goes over a realtime broadcast channel per call key. */
export function useCall(callKey: string, me: { id: string; display_name: string } | undefined, withVideo: boolean) {
  const [local, setLocal] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<Record<string, Peer>>({});
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(!withVideo);
  const [sharing, setSharing] = useState(false);
  const pcs = useRef<Record<string, RTCPeerConnection>>({});
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const screenRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!me) return;
    let cancelled = false;
    const myId = me.id;
    const pendingIce: Record<string, RTCIceCandidateInit[]> = {};

    const send = (payload: any) => channelRef.current?.send({ type: "broadcast", event: "signal", payload: { ...payload, from: myId } });

    const removePeer = (peerId: string) => {
      pcs.current[peerId]?.close();
      delete pcs.current[peerId];
      delete pendingIce[peerId];
      setPeers((p) => { const n = { ...p }; delete n[peerId]; return n; });
    };

    const getPc = (peerId: string, name: string) => {
      if (pcs.current[peerId]) return pcs.current[peerId];
      const pc = new RTCPeerConnection(ICE);
      const ls = localRef.current;
      ls?.getTracks().forEach((t) => pc.addTrack(t, ls));
      // Always be able to receive audio+video even if we don't send video
      if (!ls?.getVideoTracks().length) pc.addTransceiver("video", { direction: "recvonly" });
      pc.onicecandidate = (e) => e.candidate && send({ type: "ice", to: peerId, candidate: e.candidate.toJSON() });
      pc.ontrack = (e) => {
        const stream = e.streams[0] ?? new MediaStream([e.track]);
        setPeers((p) => ({ ...p, [peerId]: { id: peerId, name, stream: new MediaStream(stream.getTracks()) } }));
        e.track.onunmute = () => setPeers((p) => p[peerId] ? { ...p, [peerId]: { ...p[peerId], stream: new MediaStream(stream.getTracks()) } } : p);
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed") removePeer(peerId);
      };
      pcs.current[peerId] = pc;
      setPeers((p) => ({ ...p, [peerId]: p[peerId] ?? { id: peerId, name, stream: null } }));
      return pc;
    };

    const flushIce = async (peerId: string) => {
      const pc = pcs.current[peerId];
      if (!pc?.remoteDescription) return;
      for (const c of pendingIce[peerId] ?? []) { try { await pc.addIceCandidate(c); } catch (e) { console.warn(e); } }
      pendingIce[peerId] = [];
    };

    const callPeer = async (peerId: string, name: string) => {
      const pc = getPc(peerId, name);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      send({ type: "offer", to: peerId, name: me.display_name, sdp: offer });
    };

    // Deterministic: the lower id always starts the connection, so both sides never offer at once.
    const connectAll = (ch: ReturnType<typeof supabase.channel>) => {
      const state = ch.presenceState() as Record<string, any[]>;
      for (const [id, metas] of Object.entries(state)) {
        if (id === myId || pcs.current[id]) continue;
        const name = metas[0]?.name ?? "Guest";
        if (myId < id) callPeer(id, name);
        else setPeers((p) => ({ ...p, [id]: p[id] ?? { id, name, stream: null } }));
      }
    };

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: withVideo });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        localRef.current = stream;
        setLocal(stream);
      } catch {
        if (withVideo) {
          try {
            const a = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (cancelled) { a.getTracks().forEach((t) => t.stop()); return; }
            localRef.current = a; setLocal(a); setCamOff(true);
            setError("Camera unavailable — joined with microphone only.");
          } catch { setError("Camera/microphone access was blocked. Allow it in your browser to join."); return; }
        } else { setError("Microphone access was blocked. Allow it in your browser to join."); return; }
      }

      const ch = supabase.channel(`call:${callKey}`, { config: { presence: { key: myId }, broadcast: { self: false, ack: false } } });
      channelRef.current = ch;
      ch.on("broadcast", { event: "signal" }, async ({ payload }) => {
        if (payload.to !== myId) return;
        const from = payload.from as string;
        try {
          if (payload.type === "offer") {
            const pc = getPc(from, payload.name ?? "Guest");
            await pc.setRemoteDescription(payload.sdp);
            await flushIce(from);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            send({ type: "answer", to: from, sdp: answer });
          } else if (payload.type === "answer") {
            const pc = pcs.current[from];
            if (pc && pc.signalingState === "have-local-offer") { await pc.setRemoteDescription(payload.sdp); await flushIce(from); }
          } else if (payload.type === "ice") {
            const pc = pcs.current[from];
            if (pc?.remoteDescription) await pc.addIceCandidate(payload.candidate);
            else (pendingIce[from] ??= []).push(payload.candidate);
          }
        } catch (e) { console.error("signal error", e); }
      });
      ch.on("presence", { event: "sync" }, () => connectAll(ch));
      ch.on("presence", { event: "leave" }, ({ key }) => removePeer(key));
      ch.subscribe(async (status) => {
        if (status !== "SUBSCRIBED") return;
        await ch.track({ name: me.display_name, at: Date.now() });
      });
    })();

    return () => {
      cancelled = true;
      Object.values(pcs.current).forEach((pc) => pc.close());
      pcs.current = {};
      localRef.current?.getTracks().forEach((t) => t.stop());
      screenRef.current?.getTracks().forEach((t) => t.stop());
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    };
  }, [callKey, me?.id, withVideo]);

  const toggleMute = useCallback(() => {
    const next = !muted;
    localRef.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next);
  }, [muted]);

  const toggleCam = useCallback(async () => {
    const stream = localRef.current;
    if (!stream) return;
    let track = stream.getVideoTracks()[0];
    if (!track) {
      try {
        const v = await navigator.mediaDevices.getUserMedia({ video: true });
        track = v.getVideoTracks()[0];
        stream.addTrack(track);
        for (const pc of Object.values(pcs.current)) {
          const tr = pc.getTransceivers().find((x) => x.receiver.track.kind === "video" && !x.sender.track);
          if (tr) { tr.direction = "sendrecv"; await tr.sender.replaceTrack(track); } else pc.addTrack(track, stream);
        }
        // renegotiate
        for (const [id, pc] of Object.entries(pcs.current)) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          channelRef.current?.send({ type: "broadcast", event: "signal", payload: { type: "offer", to: id, from: me?.id, name: me?.display_name, sdp: offer } });
        }
        setLocal(new MediaStream(stream.getTracks()));
        setCamOff(false);
      } catch { setError("Camera access was blocked."); }
      return;
    }
    track.enabled = camOff;
    setCamOff(!camOff);
  }, [camOff, me?.id, me?.display_name]);

  const toggleShare = useCallback(async () => {
    const camTrack = localRef.current?.getVideoTracks()[0] ?? null;
    const replace = (t: MediaStreamTrack | null) => {
      for (const pc of Object.values(pcs.current)) {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video" || (s.track === null && t));
        sender?.replaceTrack(t);
      }
    };
    if (sharing) {
      screenRef.current?.getTracks().forEach((t) => t.stop());
      screenRef.current = null;
      replace(camTrack);
      setSharing(false);
      return;
    }
    if (!camTrack) { setError("Turn your camera on once before sharing your screen."); return; }
    try {
      const scr = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenRef.current = scr;
      const t = scr.getVideoTracks()[0];
      replace(t);
      t.onended = () => { replace(localRef.current?.getVideoTracks()[0] ?? null); setSharing(false); };
      setSharing(true);
    } catch { /* user cancelled */ }
  }, [sharing]);

  return { local, peers: Object.values(peers), error, muted, camOff, sharing, toggleMute, toggleCam, toggleShare, screen: screenRef.current };
}
