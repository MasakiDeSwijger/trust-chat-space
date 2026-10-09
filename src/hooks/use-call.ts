import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const ICE: RTCConfiguration = {
  iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }],
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

    const send = (payload: any) => channelRef.current?.send({ type: "broadcast", event: "signal", payload: { ...payload, from: myId } });

    const getPc = (peerId: string, name: string) => {
      if (pcs.current[peerId]) return pcs.current[peerId];
      const pc = new RTCPeerConnection(ICE);
      localRef.current?.getTracks().forEach((t) => pc.addTrack(t, localRef.current!));
      pc.onicecandidate = (e) => e.candidate && send({ type: "ice", to: peerId, candidate: e.candidate.toJSON() });
      pc.ontrack = (e) => setPeers((p) => ({ ...p, [peerId]: { id: peerId, name, stream: e.streams[0] } }));
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "closed") removePeer(peerId);
      };
      pcs.current[peerId] = pc;
      setPeers((p) => ({ ...p, [peerId]: p[peerId] ?? { id: peerId, name, stream: null } }));
      return pc;
    };

    const removePeer = (peerId: string) => {
      pcs.current[peerId]?.close();
      delete pcs.current[peerId];
      setPeers((p) => { const n = { ...p }; delete n[peerId]; return n; });
    };

    const callPeer = async (peerId: string, name: string) => {
      const pc = getPc(peerId, name);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      send({ type: "offer", to: peerId, name: me.display_name, sdp: offer });
    };

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: withVideo });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        localRef.current = stream;
        setLocal(stream);
      } catch {
        setError(withVideo ? "Camera/microphone access was blocked. Allow it in your browser to join." : "Microphone access was blocked. Allow it in your browser to join.");
        return;
      }

      const ch = supabase.channel(`call:${callKey}`, { config: { presence: { key: myId }, broadcast: { self: false } } });
      channelRef.current = ch;
      ch.on("broadcast", { event: "signal" }, async ({ payload }) => {
        if (payload.to !== myId) return;
        const from = payload.from as string;
        try {
          if (payload.type === "offer") {
            const pc = getPc(from, payload.name ?? "Guest");
            await pc.setRemoteDescription(payload.sdp);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            send({ type: "answer", to: from, sdp: answer });
          } else if (payload.type === "answer") {
            await pcs.current[from]?.setRemoteDescription(payload.sdp);
          } else if (payload.type === "ice") {
            await pcs.current[from]?.addIceCandidate(payload.candidate);
          }
        } catch (e) { console.error("signal error", e); }
      });
      ch.on("presence", { event: "join" }, ({ key, newPresences }) => {
        if (key === myId) return;
        const name = (newPresences[0] as any)?.name ?? "Guest";
        // Exactly one side starts the connection: the newcomer calls everyone already present.
        setPeers((p) => ({ ...p, [key]: p[key] ?? { id: key, name, stream: null } }));
      });
      ch.on("presence", { event: "leave" }, ({ key }) => removePeer(key));
      ch.subscribe(async (status) => {
        if (status !== "SUBSCRIBED") return;
        await ch.track({ name: me.display_name, at: Date.now() });
        // Call everyone who was here before us
        setTimeout(() => {
          const state = ch.presenceState() as Record<string, any[]>;
          for (const [id, metas] of Object.entries(state)) {
            if (id !== myId && !pcs.current[id]) callPeer(id, metas[0]?.name ?? "Guest");
          }
        }, 600);
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
        for (const pc of Object.values(pcs.current)) pc.addTrack(track, stream);
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
