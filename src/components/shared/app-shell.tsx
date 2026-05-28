import Link from "next/link";
import { NAV_ITEMS } from "@/lib/constants";

export function AppShell({ title, children }: { title: string; children: React.ReactNode }) {
  return <main className="mx-auto max-w-6xl p-4 md:p-6"><header className="mb-6"><h1 className="text-2xl font-bold">{title}</h1><nav className="mt-3 flex gap-2 flex-wrap">{NAV_ITEMS.map(n=><Link key={n.href} href={n.href} className="rounded-lg bg-white px-3 py-2 text-sm shadow">{n.label}</Link>)}</nav></header>{children}</main>;
}
