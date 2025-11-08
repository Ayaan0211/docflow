"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";

export default function Root() {
  const router = useRouter();

  useEffect(() => {
    async function checkAuth() {
      try {
        const session = await api.auth.getSession();
        if (!session.isLoggedIn) {
          router.push("/login");
        } else {
          router.push("/home");
        }
      } catch {
        router.push("/login");
      }
    }

    checkAuth();
  }, [router]);
  return <>Loading..</>;
}
