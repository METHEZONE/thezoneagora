import { AppHeader } from "@/components/AppHeader";
export default function VaultLayout({ children }: { children: React.ReactNode }) {
  return <><AppHeader />{children}</>;
}
