"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePaise } from "@/lib/store";
import AskSheet from "./AskSheet";
import PageMotion from "./PageMotion";
import Sidebar from "./Sidebar";
import TabBar from "./TabBar";

// One shell, two structures. Below 900px it's the design's 430px column with
// a bottom tab bar; above, a fixed sidebar and a wide content column. The
// screens inside don't know the difference.
//
// `tabBar` is the phone-only bottom bar: Settings is reached from the avatar
// on phone and from the sidebar on desktop, so it takes the sidebar without
// the bar.
//
// It is also the gate. Every screen that shows money is inside this component,
// so this is the one place that has to know whether there is a session — the
// screens themselves never check. `auth === "unknown"` is the frame or two
// before the stored token has been checked; rendering nothing there is what
// keeps a signed-in reload from flashing the sign-in screen on its way back.
export default function AppShell({ children, tabBar = false }) {
  const { askOpen, auth } = usePaise();
  const router = useRouter();

  useEffect(() => {
    if (auth === "anon") router.replace("/login");
  }, [auth, router]);

  if (auth !== "authed") return null;

  return (
    <div className="app-canvas">
      <Sidebar />
      <div className={`phone${tabBar ? " phone--with-nav" : ""}`}>
        <PageMotion>{children}</PageMotion>
        {tabBar && <TabBar />}
      </div>
      {askOpen && <AskSheet />}
    </div>
  );
}
