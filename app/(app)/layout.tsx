import { Nav } from "@/components/Nav";
import { sair } from "@/app/actions";
import { supabaseServer } from "@/lib/supabase/server";
import type { Connection } from "@/lib/types";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sb = await supabaseServer();
  const { data: worker } = await sb.from("connections").select("*").eq("kind", "render_worker").maybeSingle<Connection>();
  const { count: fila } = await sb
    .from("render_jobs")
    .select("id", { count: "exact", head: true })
    .in("status", ["queued", "running"]);
  // Online = o worker deu sinal de vida nos últimos 5 minutos.
  const online =
    worker?.status === "conectado" && !!worker.checked_at && Date.now() - new Date(worker.checked_at).getTime() < 5 * 60 * 1000;

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <div className="logo">Az</div>
          <div>
            <strong>JusAz</strong>
            <span>Estúdio de vídeos</span>
          </div>
        </div>
        <Nav />
        <div className="side-foot">
          <div className="mini">
            <span className="lbl">Worker de render</span>
            <span className="row" style={{ gap: 8, fontWeight: 600 }}>
              <span className="dotlive" style={{ background: online ? "var(--ok)" : "var(--line-2)" }} />
              {online ? "Online" : "Desligado"}
            </span>
            <span className="muted" style={{ fontSize: 12 }}>
              {fila ? `${fila} na fila de render` : "Fila vazia"}
            </span>
          </div>
          <form action={sair}>
            <button className="btn btn-s btn-sm" style={{ width: "100%" }}>Sair</button>
          </form>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
