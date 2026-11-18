import { supabaseServer } from "@/lib/supabase/server";
import { listarRoteiros } from "@/lib/queries";
import { atualizarTiktok, conectarTiktok, desconectarTiktok, testarInstagram } from "@/app/actions";
import { FormChave } from "@/components/FormChave";
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

export default async function Conexoes({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { ok, erro } = await searchParams;
  const sb = await supabaseServer();
  const { data } = await sb.from("connections").select("*").returns<Connection[]>();
  const c = (k: string) => data?.find((x) => x.kind === k);
  const roteiros = await listarRoteiros();

  type Chave = { nome: string; origem: "painel" | "servidor" | null; atualizado_em: string | null };
  const { data: st } = await sb.functions.invoke("segredos", { body: { acao: "status" } });
  const chaves = (st?.chaves ?? []) as Chave[];
  const k = (nome: string) => chaves.find((x) => x.nome === nome);
  const igTipo = typeof st?.ig_tipo === "string" ? st.ig_tipo : null;
  const igId = typeof st?.ig_user_id === "string" ? st.ig_user_id : null;

  return (
    <>
      <div className="head">
        <div>
          <span className="lbl">Serviços ligados ao estúdio</span>
          <h1>Conexões</h1>
        </div>
      </div>
      {ok && <div className="toast t-ok" role="status">{ok}</div>}
      {erro && <div className="toast t-warn" role="alert">{erro}</div>}
      <div className="grid2">
        <section className="card stack">
          <Cabeca c={c("elevenlabs")} titulo="ElevenLabs" sub="Locução dos vídeos" icone={<path d="M5 9v6M9 6v12M13 4v16M17 8v8M21 10v4" />} />
          <div>
            <div className="meta"><span>Voz</span><b>{c("elevenlabs")?.label ?? "George"}</b></div>
          </div>
          <FormChave nome="ELEVENLABS_API_KEY" rotulo="Chave do ElevenLabs" origem={k("ELEVENLABS_API_KEY")?.origem ?? null} atualizadoEm={k("ELEVENLABS_API_KEY")?.atualizado_em}
            ajuda="Crie em elevenlabs.io, em Developers, API Keys." />
        </section>

        <section className="card stack">
          <Cabeca c={c("instagram")} titulo="Instagram" sub="Postagem dos Reels" icone={<><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /></>} />
          <p className="muted">A conta precisa ser profissional e estar ligada ao app da Meta. O token é guardado criptografado no servidor e nunca volta para esta tela. Ao salvar, o estúdio testa o token no Instagram e só troca se ele funcionar.</p>
          <div>
            <div className="meta"><span>Conta</span><b>{c("instagram")?.label ?? "@jusaz_br"}</b></div>
            <div className="meta"><span>Tipo de token</span><b>{igTipo ?? "Nenhum token salvo"}</b></div>
            <div className="meta"><span>ID da conta</span><b>{igId ?? "Não informado"}</b></div>
          </div>
          {typeof c("instagram")?.meta?.erro === "string" && <div className="toast t-warn" role="alert">{String(c("instagram")?.meta?.erro)}</div>}
          {typeof c("instagram")?.meta?.aviso === "string" && <div className="toast t-warn" role="status">{String(c("instagram")?.meta?.aviso)}</div>}
          <FormChave nome="IG_ACCESS_TOKEN" rotulo="Token do Instagram" origem={k("IG_ACCESS_TOKEN")?.origem ?? null} atualizadoEm={k("IG_ACCESS_TOKEN")?.atualizado_em}
            ajuda="Gere no Meta for Developers (usuário do sistema) com instagram_manage_insights, instagram_content_publish, comentários e mensagens." />
          <FormChave nome="IG_USER_ID" rotulo="ID da conta do Instagram" secreto={false} valorAtual={igId} origem={k("IG_USER_ID")?.origem ?? null} atualizadoEm={k("IG_USER_ID")?.atualizado_em}
            ajuda="Número da conta profissional, não o @." />
          <form action={testarInstagram}><button className="btn btn-s btn-sm">Testar conexão</button></form>
        </section>

        <section className="card stack">
          <Cabeca c={c("tiktok")} titulo="TikTok" sub="Métricas e rascunho diário do vídeo" icone={<path d="M14 4v10.5a3.5 3.5 0 1 1-3.5-3.5M14 4c.4 2.4 2 4 4.5 4.2" />} />
          <p className="muted">O estúdio manda o vídeo pronto para a caixa de entrada do seu TikTok no horário da postagem. Você abre o app, cola a legenda e toca em publicar. As métricas aparecem na aba Insights.</p>
          <div>
            <div className="meta"><span>Conta</span><b>{c("tiktok")?.status === "conectado" ? (c("tiktok")?.label ?? "Conectada") : "Nenhuma conta conectada"}</b></div>
            <div className="meta"><span>Permissões</span><b>Perfil, estatísticas, vídeos e envio de rascunho</b></div>
          </div>
          {typeof c("tiktok")?.meta?.erro === "string" && <div className="toast t-warn" role="alert">{String(c("tiktok")?.meta?.erro)}</div>}
          <FormChave nome="TIKTOK_CLIENT_SECRET" rotulo="Client Secret do TikTok" origem={k("TIKTOK_CLIENT_SECRET")?.origem ?? null} atualizadoEm={k("TIKTOK_CLIENT_SECRET")?.atualizado_em}
            ajuda="Está no TikTok for Developers, no seu app. Depois de trocar, clique em Conectar de novo." />
          <div className="row wrap">
            <form action={conectarTiktok}><button className="btn btn-p btn-sm">{c("tiktok")?.status === "conectado" ? "Conectar de novo" : "Conectar TikTok"}</button></form>
            {c("tiktok")?.status === "conectado" && (
              <>
                <form action={atualizarTiktok}><button className="btn btn-s btn-sm">Atualizar agora</button></form>
                <form action={desconectarTiktok}><button className="btn btn-s btn-sm">Desconectar</button></form>
              </>
            )}
          </div>
        </section>

        <section className="card stack">
          <Cabeca c={c("manychat")} titulo="ManyChat" sub="Comentário vira mensagem com o link" icone={<path d="M4 5h16v10H9l-5 4z" />} />
          <p className="muted">Opcional. O funil de comentários agora roda dentro do estúdio, no menu Funil. Se você mantiver o ManyChat, as palavras abaixo precisam bater com as dele.</p>
          <div>
            {roteiros.slice(0, 5).map((r) => (
              <div key={r.id} className="meta"><span>{r.title}</span><b>{r.keyword}</b></div>
            ))}
          </div>
        </section>

        <section className="card stack">
          <div className="row" style={{ gap: 14 }}>
            <Icone><path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z" /></Icone>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 19 }}>Anthropic</h3>
              <span className="muted" style={{ fontSize: 13 }}>Opcional: botão Gerar ideias</span>
            </div>
            <span className={`badge ${k("ANTHROPIC_API_KEY")?.origem ? "b-ok" : "b-wait"}`}>{k("ANTHROPIC_API_KEY")?.origem ? "Chave salva" : "Sem chave"}</span>
          </div>
          <FormChave nome="ANTHROPIC_API_KEY" rotulo="Chave da Anthropic" origem={k("ANTHROPIC_API_KEY")?.origem ?? null} atualizadoEm={k("ANTHROPIC_API_KEY")?.atualizado_em}
            ajuda="Crie em console.anthropic.com, em API Keys." />
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
