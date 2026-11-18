import { supabaseServer } from "@/lib/supabase/server";
import { listarRoteiros } from "@/lib/queries";
import type { Connection } from "@/lib/types";

const TXT = {
  conectado: { cls: "b-ok", t: "Conectado" },
  desconectado: { cls: "b-wait", t: "Não conectado" },
  atencao: { cls: "b-warn", t: "Precisa de atenção" },
} as const;

function Icone({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--ink)", color: "var(--yellow)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
    </div>
  );
}

function Cabeca({ icone, titulo, sub, c }: { icone: React.ReactNode; titulo: string; sub: string; c?: Connection }) {
  const st = TXT[c?.status ?? "desconectado"];
  return (
    <div className="row" style={{ gap: 14 }}>
      <Icone>{icone}</Icone>
      <div style={{ flex: 1 }}>
        <h3 style={{ fontSize: 19 }}>{titulo}</h3>
        <span className="muted" style={{ fontSize: 13 }}>{sub}</span>
      </div>
      <span className={`badge ${st.cls}`}>{st.t}</span>
    </div>
  );
}

export default async function Conexoes() {
  const sb = await supabaseServer();
  const { data } = await sb.from("connections").select("*").returns<Connection[]>();
  const c = (k: string) => data?.find((x) => x.kind === k);
  const roteiros = await listarRoteiros();

  return (
    <>
      <div className="head">
        <div>
          <span className="lbl">Serviços ligados ao estúdio</span>
          <h1>Conexões</h1>
        </div>
      </div>
      <div className="grid2">
        <section className="card stack">
          <Cabeca c={c("elevenlabs")} titulo="ElevenLabs" sub="Locução dos vídeos" icone={<path d="M5 9v6M9 6v12M13 4v16M17 8v8M21 10v4" />} />
          <div>
            <div className="meta"><span>Voz</span><b>{c("elevenlabs")?.label ?? "George"}</b></div>
            <div className="meta"><span>Chave</span><b>Guardada no servidor (segredo ELEVENLABS_API_KEY)</b></div>
          </div>
        </section>

        <section className="card stack">
          <Cabeca c={c("instagram")} titulo="Instagram" sub="Postagem dos Reels" icone={<><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /></>} />
          <p className="muted">A conta precisa ser profissional e pública, e estar como Testador do Instagram no app da Meta. O token fica nos segredos do servidor, nunca nesta tela.</p>
          <div>
            <div className="meta"><span>Conta</span><b>{c("instagram")?.label ?? "@jusaz_br"}</b></div>
            <div className="meta"><span>Segredos</span><b>IG_ACCESS_TOKEN e IG_USER_ID</b></div>
            <div className="meta"><span>Renovação do token</span><b>A cada 60 dias</b></div>
          </div>
        </section>

        <section className="card stack">
          <Cabeca c={c("manychat")} titulo="ManyChat" sub="Comentário vira mensagem com o link" icone={<path d="M4 5h16v10H9l-5 4z" />} />
          <p className="muted">A automação roda dentro do ManyChat. Aqui ficam só as palavras, para legenda e roteiro baterem com o gatilho.</p>
          <div>
            {roteiros.slice(0, 5).map((r) => (
              <div key={r.id} className="meta"><span>{r.title}</span><b>{r.keyword}</b></div>
            ))}
          </div>
        </section>

        <section className="card stack">
          <Cabeca c={c("supabase")} titulo="Supabase" sub="Banco, login e arquivos dos vídeos" icone={<><ellipse cx="12" cy="6" rx="8" ry="3" /><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6" /></>} />
          <div>
            <div className="meta"><span>Projeto</span><b>jusaz-estudio</b></div>
            <div className="meta"><span>Pasta de vídeos</span><b>videos (pública)</b></div>
            <div className="meta"><span>Login</span><b>E-mail e senha</b></div>
          </div>
        </section>

        <section className="card stack" style={{ gridColumn: "1 / -1" }}>
          <Cabeca c={c("render_worker")} titulo="Worker de render" sub="Máquina que desenha o vídeo 3D. A Vercel não consegue, então ele roda à parte." icone={<><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>} />
          <div className="grid2" style={{ columnGap: 32 }}>
            <div className="meta"><span>Programas</span><b>Chrome + ffmpeg</b></div>
            <div className="meta"><span>Tempo por vídeo (sem placa de vídeo)</span><b>cerca de 1h20</b></div>
          </div>
        </section>
      </div>
    </>
  );
}
