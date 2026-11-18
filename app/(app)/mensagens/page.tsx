import Link from "next/link";
import { AutoRefresh } from "@/components/AutoRefresh";
import { enviarMensagem } from "@/app/actions";
import { haQuanto } from "@/lib/format";
import { supabaseServer } from "@/lib/supabase/server";
import type { IgMessage, IgThread } from "@/lib/types";

export default async function Mensagens({ searchParams }: { searchParams: Promise<{ c?: string; erro?: string }> }) {
  const { c, erro } = await searchParams;
  const sb = await supabaseServer();
  if (c) await sb.from("ig_threads").update({ unread: false }).eq("id", c);
  const { data: threads } = await sb
    .from("ig_threads").select("*").order("last_message_at", { ascending: false, nullsFirst: false }).returns<IgThread[]>();
  const lista = threads ?? [];
  const atual = lista.find((t) => t.id === c) ?? lista[0];
  const { data: msgs } = atual
    ? await sb.from("ig_messages").select("*").eq("thread_id", atual.id).order("created_at").returns<IgMessage[]>()
    : { data: [] as IgMessage[] };
  const novas = lista.filter((t) => t.unread && t.id !== atual?.id).length;

  return (
    <>
      <AutoRefresh segundos={20} />
      <div className="head">
        <div>
          <span className="lbl">{novas ? `${novas} com mensagem nova` : "Conversas do direct"}</span>
          <h1>Mensagens</h1>
        </div>
      </div>
      {erro && <div className="toast t-warn" role="alert">{erro}</div>}

      {lista.length === 0 ? (
        <div className="card stack">
          <h3 style={{ fontSize: 19 }}>Nenhuma conversa ainda</h3>
          <p className="muted">Quando alguém responder a mensagem do funil ou escrever no direct, a conversa aparece aqui e você responde sem sair do estúdio.</p>
        </div>
      ) : (
        <div className="grid-main" style={{ gridTemplateColumns: "minmax(0,320px) minmax(0,1fr)" }}>
          <nav className="stack" style={{ gap: 10 }} aria-label="Conversas">
            {lista.map((t) => (
              <Link key={t.id} href={`/mensagens?c=${t.id}`} className={`listitem ${t.id === atual?.id ? "on" : ""}`}>
                <span className="row" style={{ justifyContent: "space-between" }}>
                  <strong>@{t.participant_username ?? "alguém"}</strong>
                  {t.unread && t.id !== atual?.id && <span className="dotnew" aria-label="mensagem nova" />}
                </span>
                <span className="muted" style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.last_text ?? ""}</span>
                <span className="muted" style={{ fontSize: 12 }}>{haQuanto(t.last_message_at)}</span>
              </Link>
            ))}
          </nav>

          {atual && (
            <section className="card stack">
              <h3 style={{ fontSize: 19 }}>@{atual.participant_username ?? "alguém"}</h3>
              <div className="chat">
                {(msgs ?? []).map((m) => (
                  <div key={m.id} className={`bub ${m.direction}`}>
                    {m.text}
                    <small>{new Date(m.created_at).toLocaleString("pt-BR", { timeZone: "America/Maceio", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</small>
                  </div>
                ))}
              </div>
              <form action={enviarMensagem} className="stack">
                <input type="hidden" name="thread_id" value={atual.id} />
                <textarea name="texto" className="inp" style={{ minHeight: 72 }} placeholder="Escreva sua resposta" aria-label="Resposta" />
                <div className="row wrap" style={{ justifyContent: "space-between" }}>
                  <span className="muted" style={{ fontSize: 12 }}>O Instagram só deixa responder até 24 horas depois da última mensagem da pessoa.</span>
                  <button className="btn btn-p btn-sm">Enviar</button>
                </div>
              </form>
            </section>
          )}
        </div>
      )}
    </>
  );
}
