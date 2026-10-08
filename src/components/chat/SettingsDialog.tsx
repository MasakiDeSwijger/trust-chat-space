import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Settings, Camera, Bell, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar } from "./UserBadge";
import { THEMES, applyTheme, getStoredTheme, type ThemeId } from "@/lib/themes";
import { cn } from "@/lib/utils";

export function SettingsDialog({ me }: { me: any }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeId>("teal");
  const [name, setName] = useState(me.display_name);
  const [bio, setBio] = useState(me.bio ?? "");
  const [uploading, setUploading] = useState(false);
  const [notif, setNotif] = useState<string>("default");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTheme(getStoredTheme());
    if (typeof Notification !== "undefined") setNotif(Notification.permission);
  }, [open]);

  async function onAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image");
    if (file.size > 5 * 1024 * 1024) return toast.error("Max 5MB");
    setUploading(true);
    try {
      const path = `${me.id}/avatar-${Date.now()}.${file.name.split(".").pop() ?? "png"}`;
      const { error } = await supabase.storage.from("chat-uploads").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = await supabase.storage.from("chat-uploads").createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
      if (!data?.signedUrl) throw new Error("Upload failed");
      const { error: upErr } = await supabase.from("profiles").update({ avatar_url: data.signedUrl }).eq("id", me.id);
      if (upErr) throw upErr;
      toast.success("Profile picture updated");
      qc.invalidateQueries();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function saveProfile() {
    const { error } = await supabase.from("profiles").update({ display_name: name.trim() || me.display_name, bio: bio.trim() || null }).eq("id", me.id);
    if (error) return toast.error(error.message);
    toast.success("Profile saved");
    qc.invalidateQueries({ queryKey: ["my-profile"] });
  }

  async function enableNotifications() {
    if (typeof Notification === "undefined") return toast.error("Your browser doesn't support notifications");
    const p = await Notification.requestPermission();
    setNotif(p);
    if (p === "granted") toast.success("Notifications on");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground">
          <Settings className="h-4 w-4" /> Settings & themes
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Settings</DialogTitle></DialogHeader>

        <section className="flex items-center gap-4">
          <div className="relative">
            <Avatar profile={me} size={72} />
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground shadow"
              aria-label="Change profile picture"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onAvatar} />
          </div>
          <div className="flex-1 space-y-2">
            <div>
              <Label htmlFor="s_name">Display name</Label>
              <Input id="s_name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>
        </section>
        <div>
          <Label htmlFor="s_bio">Bio</Label>
          <Input id="s_bio" value={bio} maxLength={160} onChange={(e) => setBio(e.target.value)} placeholder="Tell people a little about you" />
        </div>
        <Button onClick={saveProfile} className="bg-brand text-primary-foreground">Save profile</Button>

        <section>
          <h3 className="mb-2 text-sm font-semibold">Theme</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => { applyTheme(t.id); setTheme(t.id); }}
                className={cn("rounded-lg border border-border p-2 text-left text-xs hover:bg-accent", theme === t.id && "ring-2 ring-primary")}
              >
                <div className="mb-1.5 flex h-6 overflow-hidden rounded">
                  {t.colors.map((c) => <span key={c} className="flex-1" style={{ background: c }} />)}
                </div>
                <div className="flex items-center justify-between font-medium">{t.name}{theme === t.id && <Check className="h-3 w-3" />}</div>
              </button>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-between rounded-lg border border-border p-3">
          <div className="flex items-center gap-2 text-sm"><Bell className="h-4 w-4" /> Desktop notifications</div>
          {notif === "granted" ? (
            <span className="text-xs text-verified">On</span>
          ) : (
            <Button size="sm" variant="outline" onClick={enableNotifications} disabled={notif === "denied"}>
              {notif === "denied" ? "Blocked in browser" : "Turn on"}
            </Button>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}
