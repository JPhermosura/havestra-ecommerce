import React, { PropsWithChildren } from "react";

export default function BuyerLayout({
  children,
}: PropsWithChildren): React.ReactNode {
  return (
    <div className="min-h-dvh w-full bg-[#F7F9F5]">
      <main className="w-full pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </main>
    </div>
  );
}
