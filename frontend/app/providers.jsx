"use client";

import { PaiseProvider } from "@/lib/store";

export default function Providers({ children }) {
  return <PaiseProvider>{children}</PaiseProvider>;
}
