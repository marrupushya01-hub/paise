"use client";

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
export default function AppShell({ children, tabBar = false }) {
  const { askOpen } = usePaise();

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
