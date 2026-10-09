import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { searchUsers } from "@/lib/chat-api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "./UserBadge";

export function AddMemberButton({ roomId }: { roomId: string }) {
  const [q, setQ] = useState("");
  const { data: results = [] } = useQuery({ queryKey: ["add-member-search", q], queryFn: () => searchUsers(q), enabled: q.trim().length > 0 });

  async function add(userId: string, name: string) {
    const { error } = await supabase.rpc("add_group_member", { _room_id: roomId, _user_id: userId });
    if (error) toast.error(error.message); else toast.success(`${name} added to the group`);
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><UserPlus className="mr-1.5 h-4 w-4" /> Add people</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add people to this group</DialogTitle></DialogHeader>
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or #ID" />
        <div className="max-h-72 space-y-1 overflow-y-auto scrollbar-thin">
          {results.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2 rounded-md p-2 hover:bg-accent">
              <div className="flex min-w-0 items-center gap-2">
                <Avatar profile={p} size={30} />
                <div className="min-w-0 truncate text-sm">{p.display_name} <span className="text-xs text-muted-foreground">{p.short_id}</span></div>
              </div>
              <Button size="sm" onClick={() => add(p.id, p.display_name)}>Add</Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
