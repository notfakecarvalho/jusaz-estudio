import Link from "next/link";
import { listarVideos } from "@/lib/queries";
import { ROTULO_VIDEO, classeBadgeVideo, dataCurta } from "@/lib/format";

export default async function Videos() {
  const videos = await listarVideos();
  return (
    <>
      <div className="head">
        <div>
          <span className="lbl">Todos os vídeos</span>
          <h1>Vídeos</h1>
        </div>
      </div>
      <section className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              {["Data", "Roteiro", "Palavra", "Situação"].map((h) => (
                <th key={h} className="lbl" style={{ padding: "14px 20px", borderBottom: "1px solid var(--line)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {videos.map((v) => (
              <tr key={v.id}>
                <td style={{ padding: "14px 20px", borderTop: "1px solid var(--line)" }}>{dataCurta(v.scheduled_for)}</td>
                <td style={{ padding: "14px 20px", borderTop: "1px solid var(--line)" }}>
                  <Link href={`/videos/${v.id}`} style={{ fontWeight: 600 }}>{v.scripts?.title}</Link>
                </td>
                <td style={{ padding: "14px 20px", borderTop: "1px solid var(--line)" }}>{v.scripts?.keyword}</td>
                <td style={{ padding: "14px 20px", borderTop: "1px solid var(--line)" }}>
                  <span className={`badge ${classeBadgeVideo(v.status)}`}>{ROTULO_VIDEO[v.status]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
