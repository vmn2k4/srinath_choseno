"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import HomePage from "./HomePage";

export default function HomePageClient() {
  const { session, profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (session) {
      if (profile?.role === "admin") {
        router.replace("/admin");
      } else {
        router.replace("/feed");
      }
    }
  }, [session, profile?.role, router]);

  // Show landing page only for non-authenticated users
  if (session) {
    return null; // Will redirect
  }

  return <HomePage />;
}
