import type { Video, RenderJob } from "@/lib/types";

const ETAPAS = [
  { nome: "Roteiro", sub: "Aprovado" },
  { nome: "Voz", sub: "ElevenLabs" },
  { nome: "Render 3D", sub: "Vídeo vertical" },
  { nome: "Música e mixagem", sub: "−14 LUFS" },
  { nome: "Postar", sub: "Instagram" },
];

function etapaAtual(status: Video["status"]) {
  switch (status) {
    case "na_fila":
    case "voz":
      return 1;
    case "render":
      return 2;
    case "mixagem":
      return 3;
    case "pronto":
      return 4;
    case "postado":
      return 5;
    default:
      return 1;
  }
}

export function Pipeline({ video, job, quando }: { video: Pick<Video, "status" | "progress">; job?: RenderJob | null; quando?: string }) {
  const idx = etapaAtual(video.status);
  const erro = video.status === "erro";
  const pct = job && job.total_frames > 0 ? Math.round((job.frame / job.total_frames) * 100) : video.progress;
  return (
    <div className="stack">
      <div className="steps">
        {ETAPAS.map((e, i) => {
          const done = i < idx;
          const now = i === idx && video.status !== "postado";
          const cls = done ? "done" : erro && now ? "err" : now ? "now" : "";
          let sub = e.sub;
          if (i === 2 && video.status === "render" && job?.total_frames)
            sub = `quadro ${job.frame.toLocaleString("pt-BR")} de ${job.total_frames.toLocaleString("pt-BR")}`;
          if (i === 4 && quando) sub = quando;
          return (
            <div key={e.nome} className={`st ${cls}`}>
              <div className="dot">{done ? "✓" : erro && now ? "!" : i + 1}</div>
              <b>{e.nome}</b>
              <span>{sub}</span>
            </div>
          );
        })}
      </div>
      {video.status === "render" && (
        <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Render ${pct}%`}>
          <i style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}
