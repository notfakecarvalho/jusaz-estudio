"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { anexarVideo } from "@/app/actions";

const LIMITE_MB = 50;

function duracaoDoVideo(arq: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(arq);
    const el = document.createElement("video");
    const fim = (d: number | null) => {
      URL.revokeObjectURL(url);
      resolve(d);
    };
    el.preload = "metadata";
    el.onloadedmetadata = () => fim(Number.isFinite(el.duration) ? el.duration : null);
    el.onerror = () => fim(null);
    setTimeout(() => fim(null), 8000);
    el.src = url;
  });
}

export function EnviarVideo({ videoId, quando, temVideo }: { videoId: string; quando: string; temVideo: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro" | "info"; texto: string } | null>(null);

  async function enviar(arq: File) {
    if (arq.type !== "video/mp4" && !/\.mp4$/i.test(arq.name)) {
      setMsg({ tipo: "erro", texto: "O arquivo precisa ser um MP4." });
      return;
    }
    if (arq.size > LIMITE_MB * 1024 * 1024) {
      setMsg({ tipo: "erro", texto: `O arquivo tem ${(arq.size / 1048576).toFixed(0)} MB; o limite é ${LIMITE_MB} MB.` });
      return;
    }
    setOcupado(true);
    setMsg({ tipo: "info", texto: "Enviando o vídeo… pode levar um minuto." });
    try {
      const duracao = await duracaoDoVideo(arq);
      const caminho = `${videoId}/reel-${Date.now()}.mp4`;
      const { error } = await supabaseBrowser().storage.from("videos").upload(caminho, arq, { contentType: "video/mp4", upsert: false });
      if (error) throw new Error(error.message);
      await anexarVideo(videoId, caminho, duracao);
      setMsg({ tipo: "ok", texto: `Vídeo no ar na plataforma. Posta automaticamente em ${quando}.` });
      router.refresh();
    } catch (e) {
      setMsg({ tipo: "erro", texto: `Não consegui enviar: ${(e as Error).message}` });
    } finally {
      setOcupado(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="stack">
      <p className="muted" style={{ fontSize: 14 }}>
        {temVideo ? "Trocar o vídeo por outro MP4 renderizado." : "Envie o MP4 renderizado."} Ele entra na agenda e posta sozinho em <b>{quando}</b>.
      </p>
      <div className="row wrap">
        <input
          ref={input}
          type="file"
          accept="video/mp4"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void enviar(f);
          }}
        />
        <button type="button" className="btn btn-p" disabled={ocupado} onClick={() => input.current?.click()}>
          {ocupado ? "Enviando…" : temVideo ? "Trocar vídeo" : "Enviar vídeo renderizado"}
        </button>
      </div>
      {msg && (
        <div className={`toast ${msg.tipo === "erro" ? "t-warn" : msg.tipo === "ok" ? "t-ok" : ""}`} role={msg.tipo === "erro" ? "alert" : "status"}>
          {msg.texto}
        </div>
      )}
    </div>
  );
}
