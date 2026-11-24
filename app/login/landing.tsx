"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import "./landing.css";

const MARCA = "edita.ai";

const IC: Record<string, string[]> = {
  shieldCheck: ["M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z", "m9 12 2 2 4-4"],
  chevron: ["m9 18 6-6-6-6"],
  check: ["M20 6 9 17l-5-5"],
  x: ["M18 6 6 18M6 6l12 12"],
  lock: ["M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z", "M7 11V7a5 5 0 0 1 10 0v4"],
  circleCheck: ["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", "m9 12 2 2 4-4"],
  circle: ["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"],
  spinner: ["M21 12a9 9 0 1 1-6.219-8.56"],
  film: ["M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z", "M7 3v18M17 3v18M3 7.5h4M3 12h18M3 16.5h4M17 7.5h4M17 16.5h4"],
  layers: ["m12 2 10 5-10 5L2 7z", "m2 17 10 5 10-5", "m2 12 10 5 10-5"],
  monitor: ["M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z", "M8 21h8M12 17v4"],
  upload: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"],
  clock: ["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", "M12 6v6l4 2"],
};

function I({ n, s = 18, className }: { n: string; s?: number; className?: string }) {
  return (
    <svg className={className} width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {IC[n].map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

function Marca() {
  return (
    <div className="lp-marca">
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M16 2.5 5 6.6v8.2c0 6.6 4.5 11.6 11 14.7 6.5-3.1 11-8.1 11-14.7V6.6z" fill="#635BFF" stroke="#0A2540" strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M13 11.2v9.6l8-4.8z" fill="#fff" />
      </svg>
      <span>{MARCA.toLowerCase()}</span>
    </div>
  );
}

function Barras({ estados }: { estados: string[] }) {
  return <div className="lp-bars" aria-hidden="true">{estados.map((e, i) => <div key={i} className={"b " + e}><i /></div>)}</div>;
}

type Modo = "entrar" | "criar";

function Acesso({ modo, setModo, fechar }: { modo: Modo; setModo: (m: Modo) => void; fechar: () => void }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [msg, setMsg] = useState<{ tipo: "erro" | "ok"; texto: string } | null>(null);
  const [carregando, setCarregando] = useState(false);
  const ref = useRef<HTMLFormElement>(null);
  const criar = modo === "criar";

  useEffect(() => {
    const f = (e: KeyboardEvent) => { if (e.key === "Escape") fechar(); };
    addEventListener("keydown", f);
    const t = setTimeout(() => ref.current?.querySelector("input")?.focus(), 50);
    const ov = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { removeEventListener("keydown", f); clearTimeout(t); document.body.style.overflow = ov; };
  }, [fechar]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setMsg(null);
    const sb = supabaseBrowser();
    if (criar) {
      const { data, error } = await sb.auth.signUp({ email, password: senha });
      if (error) setMsg({ tipo: "erro", texto: error.message });
      else if (!data.session) setMsg({ tipo: "ok", texto: "Conta criada. Confirme pelo link que chegou no seu e-mail e volte para entrar." });
      else { router.push("/"); router.refresh(); }
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password: senha });
      if (error) setMsg({ tipo: "erro", texto: "E-mail ou senha incorretos." });
      else { router.push("/"); router.refresh(); }
    }
    setCarregando(false);
  }

  return (
    <div className="lp-modal" onMouseDown={(e) => { if (e.target === e.currentTarget) fechar(); }}>
      <form ref={ref} onSubmit={enviar} role="dialog" aria-modal="true" aria-label={criar ? "Criar conta" : "Entrar"}>
        <button type="button" className="fechar" onClick={fechar} aria-label="Fechar"><I n="x" /></button>
        <Marca />
        <h2>{criar ? "Crie sua conta" : "Entre na sua conta"}</h2>
        <p className="sub">{criar ? "Leva menos de um minuto." : "Bem-vindo de volta."}</p>
        <div className="fld">
          <label htmlFor="lp-email">E-mail</label>
          <input id="lp-email" className="inp" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="fld">
          <label htmlFor="lp-senha">Senha</label>
          <input id="lp-senha" className="inp" type="password" autoComplete={criar ? "new-password" : "current-password"} minLength={8} required value={senha} onChange={(e) => setSenha(e.target.value)} />
          {criar && <small>Mínimo de 8 caracteres.</small>}
        </div>
        {msg && <div className={msg.tipo === "erro" ? "lp-erro" : "lp-ok"} role="alert">{msg.texto}</div>}
        <button className="lp-btn cheio" style={{ height: 46 }} disabled={carregando}>{carregando ? "Aguarde…" : criar ? "Criar conta" : "Entrar"}</button>
        <p className="priv"><I n="lock" s={14} />Seu vídeo fica no seu computador. Nunca pedimos a senha do Instagram.</p>
        <p className="troca">{criar ? "Já tem conta?" : "Ainda não tem conta?"}<button type="button" onClick={() => { setModo(criar ? "entrar" : "criar"); setMsg(null); }}>{criar ? "Entrar" : "Criar conta"}</button></p>
      </form>
    </div>
  );
}

const RECURSOS: [string, string, string, boolean][] = [
  ["film", "Edição pronta a partir de um pedido", "Envie o Reel, uma referência e o áudio. A plataforma monta cortes, legendas e motions e entrega um MP4 vertical.", true],
  ["layers", "Biblioteca de estilos", "Escolha um estilo da biblioteca ou importe os seus prompts de motion e reutilize quando quiser.", true],
  ["monitor", "Interface animada (VSL)", "Corte pelo som, telas animadas e legendas dinâmicas, com o render rodando no seu computador.", false],
  ["upload", "Referência de Reel", "Aponte um Reel que você admira e peça uma edição no mesmo ritmo.", false],
  ["clock", "Acompanhe cada etapa", "Pedido, plano, render e MP4 com andamento em tempo real e ajustes depois de pronto.", false],
];
const PASSOS = [
  ["Envie o seu Reel", "Escolha o vídeo no computador, cole a referência, defina o áudio e o estilo da edição."],
  ["Receba o plano de edição", "A plataforma analisa o pedido e monta cortes, legendas e animações. Você acompanha tudo e pede ajustes."],
  ["Baixe o MP4 final", "O render roda no seu computador e o arquivo volta direto para a sua pasta, pronto para postar."],
];
const SEGURANCA = [
  ["Seu vídeo não sai do seu computador", "O arquivo original e o Reel pronto ficam na sua pasta. Só o texto do pedido e o andamento passam pela plataforma."],
  ["Cada conta vê só o que é seu", "Projetos, pedidos e créditos são isolados por conta, com regras de acesso aplicadas no banco de dados."],
  ["Sem senha do Instagram", "Nunca pedimos login de redes sociais. Você posta o MP4 onde e quando quiser."],
  ["Conexão protegida", "Todo o tráfego entre o navegador e a plataforma usa HTTPS."],
];

export default function Landing() {
  const [modo, setModo] = useState<Modo | null>(null);
  const abrir = (m: Modo) => () => setModo(m);
  const fechar = useCallback(() => setModo(null), []);
  const ano = new Date().getFullYear();
  return (
    <div className="lp">
      <div className="lp-aviso">Novo: estilo Interface animada (VSL) disponível.<a href="#recursos">Saiba mais</a></div>
      <nav className="lp-nav" aria-label="Principal">
        <div className="in">
          <Marca />
          <div className="lp-links">
            <a href="#recursos">Produto</a><a href="#como">Como funciona</a><a href="#seguranca">Segurança</a><a href="#comece">Preços</a>
          </div>
          <div className="lp-dir">
            <button className="txt" onClick={abrir("entrar")}>Entrar</button>
            <button className="lp-btn" onClick={abrir("criar")}>Comece já</button>
          </div>
        </div>
      </nav>
      <header className="lp-hero">
        <div className="lp-faixa" aria-hidden="true" /><div className="lp-faixa b" aria-hidden="true" />
        <div className="lp-wrap">
          <div>
            <h1>Edição de Reels <em>profissional</em>, com o seu vídeo sempre no seu computador.</h1>
            <p className="sub">Envie o Reel, a referência e o áudio. A plataforma monta a edição, o render roda na sua máquina e o MP4 final volta para a sua pasta.</p>
            <div className="lp-cta">
              <button className="lp-btn" onClick={abrir("criar")}>Comece já<I n="chevron" s={16} /></button>
              <a className="lp-btn sec" href="#como">Ver como funciona</a>
            </div>
            <div className="lp-nota"><span><I n="shieldCheck" s={16} />Vídeo só no seu computador</span><span><I n="shieldCheck" s={16} />Sem senha do Instagram</span></div>
          </div>
          <div className="lp-prod" aria-hidden="true">
            <div className="lp-fone"><div className="onda" /><div className="leg">Seu <mark>Reel</mark>,<br />editado.</div><Barras estados={["ok", "ok", "run", "wait"]} /></div>
            <div className="lp-card a">
              <h4>Pedido #1042<span className="lp-chip">Em andamento</span></h4>
              <ul>
                <li className="ok"><I n="circleCheck" />Pedido recebido<small>00:02</small></li>
                <li className="ok"><I n="circleCheck" />Plano de edição<small>00:41</small></li>
                <li className="run"><I n="spinner" className="lp-giro" />Render no seu computador<small>68%</small></li>
                <li className="wait"><I n="circle" />MP4 na sua pasta</li>
              </ul>
            </div>
            <div className="lp-card b"><span className="ic"><I n="lock" /></span><div><b>Arquivo local</b><span>Nada de upload do vídeo</span></div></div>
          </div>
        </div>
      </header>
      <div className="lp-faixa-cap"><div className="lp-wrap">
        <span><I n="check" s={16} />Cortes automáticos</span><span><I n="check" s={16} />Legendas e motions</span><span><I n="check" s={16} />MP4 vertical 9:16</span><span><I n="check" s={16} />Render local</span><span><I n="check" s={16} />Ajustes depois de pronto</span>
      </div></div>
      <section className="lp-sec" id="recursos"><div className="lp-wrap">
        <span className="lp-eyebrow">Produto</span>
        <h2>Tudo o que você precisa para editar Reels em escala</h2>
        <p className="lead">Do pedido ao arquivo final, cada etapa acontece num só lugar, com a privacidade de manter o vídeo na sua máquina.</p>
        <div className="lp-bento">{RECURSOS.map(([ic, t, d, g]) => <article key={t} className={"lp-tile" + (g ? " g" : "")}><span className="ic"><I n={ic} s={20} /></span><h3>{t}</h3><p>{d}</p></article>)}</div>
      </div></section>
      <section className="lp-sec cinza" id="como"><div className="lp-wrap">
        <span className="lp-eyebrow">Como funciona</span>
        <h2>Do pedido ao MP4 em três passos</h2>
        <ol className="lp-passos">{PASSOS.map(([t, d]) => <li key={t}><h3>{t}</h3><p>{d}</p></li>)}</ol>
      </div></section>
      <section className="lp-sec lp-seg" id="seguranca"><div className="lp-wrap">
        <span className="lp-eyebrow">Segurança</span>
        <h2>Feita para proteger o seu conteúdo</h2>
        <p className="lead">Seu material é o seu ativo. Por isso a plataforma foi desenhada para que ele nunca saia do seu controle.</p>
        <div className="lp-seg-grid">{SEGURANCA.map(([t, d]) => <article key={t} className="lp-seg-item"><span className="ic"><I n="shieldCheck" s={20} /></span><div><h3>{t}</h3><p>{d}</p></div></article>)}</div>
      </div></section>
      <section className="lp-sec" id="comece"><div className="lp-wrap">
        <span className="lp-eyebrow">Preços</span>
        <h2>Pague só pelo que usar</h2>
        <p className="lead">Cada edição consome créditos. Você vê o custo antes de enviar e, se algo falhar, os créditos voltam para a sua conta.</p>
        <div className="lp-nums" style={{ marginTop: 40 }}>
          <div className="lp-num"><b>0</b><span>vídeos enviados para a nuvem: o render e os arquivos ficam com você.</span></div>
          <div className="lp-num"><b>4</b><span>etapas acompanhadas em tempo real, do pedido ao MP4.</span></div>
          <div className="lp-num"><b>9:16</b><span>MP4 vertical pronto para Reels, Shorts e TikTok.</span></div>
        </div>
      </div></section>
      <section className="lp-fim"><div className="lp-wrap">
        <h2>Tudo pronto para começar?</h2>
        <p>Crie sua conta e envie o primeiro Reel hoje.</p>
        <div className="lp-cta"><button className="lp-btn" onClick={abrir("criar")}>Comece já</button><button className="lp-btn sec" onClick={abrir("entrar")}>Entrar</button></div>
      </div></section>
      <footer className="lp-rodape"><div className="lp-wrap">
        <div className="cols">
          <div><Marca /><p style={{ marginTop: 12, maxWidth: "30ch" }}>Edição de Reels com o seu vídeo sempre no seu computador.</p></div>
          <div><h5>Produto</h5><ul><li><a href="#recursos">Recursos</a></li><li><a href="#como">Como funciona</a></li><li><a href="#comece">Preços</a></li></ul></div>
          <div><h5>Segurança</h5><ul><li><a href="#seguranca">Privacidade</a></li><li><a href="#seguranca">Proteção de dados</a></li></ul></div>
          <div><h5>Conta</h5><ul><li><button className="txt-link" onClick={abrir("entrar")}>Entrar</button></li><li><button className="txt-link" onClick={abrir("criar")}>Criar conta</button></li></ul></div>
        </div>
        <div className="fim"><span>© {ano} {MARCA}</span><span>Brasil (Português)</span></div>
      </div></footer>
      {modo && <Acesso modo={modo} setModo={setModo} fechar={fechar} />}
    </div>
  );
}
