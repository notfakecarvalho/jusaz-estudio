// Aparece na hora enquanto a página nova carrega, para o site não parecer travado.
export default function Carregando() {
  return (
    <div className="stack" aria-busy="true" aria-label="Carregando">
      <div className="skel" style={{ height: 44, width: 280 }} />
      <div className="stats">
        {[0, 1, 2, 3].map((i) => <div key={i} className="skel" style={{ height: 92 }} />)}
      </div>
      <div className="skel" style={{ height: 260 }} />
      <div className="skel" style={{ height: 180 }} />
    </div>
  );
}
