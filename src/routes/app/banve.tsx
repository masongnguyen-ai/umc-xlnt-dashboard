import { createFileRoute } from "@tanstack/react-router";
import { CadDesk } from "@/components/cad-desk";
import { useAppStore } from "@/lib/store";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import type { Role } from "@/lib/types";

export const Route = createFileRoute("/app/banve")({
  validateSearch: (s: Record<string, unknown>) => ({
    tb: typeof s.tb === "string" ? s.tb : undefined,
  }),
  component: BanVePage,
});

function BanVePage() {
  const search = Route.useSearch();
  const user = useCurrentUser();
  const email = user?.primaryEmail ?? "";
  const users = useAppStore((s) => s.users);
  const role = (users.find((u) => u.Email.toLowerCase() === email.toLowerCase())?.Vai_tro ?? "CA_TRUC") as Role;
  return <CadDesk role={role} focusId={search.tb} />;
}
