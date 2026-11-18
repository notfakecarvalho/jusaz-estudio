"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [criar, setCriar] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "erro" | "ok"; texto: string } | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setMsg(null);
    const sb = supabaseBrowser();
    if (criar) {
      const { data, error } = await sb.auth.signUp({ email, password: senha });
      if (error) setMsg({ tipo: "erro", texto: error.message });
      else if (!data.session) setMsg({ tipo: "ok", texto: "Conta criada. Confirme pelo link que chegou no seu e-mail e volte para entrar." });
      else {
        router.push("/");
        router.refresh();
      }
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password: senha });
      if (error) setMsg({ tipo: "erro", texto: "E-mail ou senha incorretos." });
      else {
        router.push("/");
        router.refresh();
      }
    }
    setCarregando(false);
  }

  return (
    <div className="login">
      <form className="card" onSubmit={enviar}>
        <div className="brand" style={{ padding: 0 }}>
          <div className="logo">Az</div>
          <div>
            <strong>JusAz</strong>
            <span>Estúdio de vídeos</span>
          </div>
        </div>
        <h1 style={{ fontSize: 28 }}>{criar ? "Criar conta" : "Entrar"}</h1>
        <div className="fld">
          <label htmlFor="email">E-mail</label>
          <input id="email" className="inp" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="fld">
          <label htmlFor="senha">Senha</label>
          <input id="senha" className="inp" type="password" autoComplete={criar ? "new-password" : "current-password"} minLength={8} required value={senha} onChange={(e) => setSenha(e.target.value)} />
          {criar && <small>Mínimo de 8 caracteres.</small>}
        </div>
        {msg && <div className={`toast ${msg.tipo === "erro" ? "t-warn" : "t-ok"}`} role="alert">{msg.texto}</div>}
        <button className="btn btn-p" disabled={carregando}>{carregando ? "Aguarde…" : criar ? "Criar conta" : "Entrar"}</button>
        <button type="button" className="btn btn-s" onClick={() => { setCriar(!criar); setMsg(null); }}>
          {criar ? "Já tenho conta" : "Primeiro acesso"}
        </button>
      </form>
    </div>
  );
}
