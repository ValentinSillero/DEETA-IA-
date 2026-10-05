"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button type="button" onClick={signOut} className="sign-out-button" disabled={pending}>
      <LogOut className="size-5" aria-hidden="true" />
      <span>{pending ? "Saliendo…" : "Cerrar sesión"}</span>
    </button>
  );
}
