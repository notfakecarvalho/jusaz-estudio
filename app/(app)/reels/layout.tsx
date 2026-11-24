import "@fontsource-variable/geist-mono";
import "./reels.css";
import { ReelsBar } from "@/components/reels/ReelsBar";

export default function ReelsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="ed">
      <ReelsBar />
      {children}
    </div>
  );
}
