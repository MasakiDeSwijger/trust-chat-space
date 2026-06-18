import { useQuery } from "@tanstack/react-query";
import { getCurrentProfile } from "@/lib/chat-api";

export function useMyProfile() {
  return useQuery({
    queryKey: ["my-profile"],
    queryFn: getCurrentProfile,
    staleTime: 30_000,
  });
}
