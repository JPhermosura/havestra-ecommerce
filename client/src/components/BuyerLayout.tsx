import React, { PropsWithChildren } from "react";

export default function BuyerLayout({ children }: PropsWithChildren): React.ReactNode {
  return (
    <div className="min-h-screen w-full bg-slate-50">
      <main className="w-full">
        {children}
      </main>
    </div>
  );
}
