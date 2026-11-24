# edita.ai: agente local

O edita.ai é uma plataforma só (app Next.js na raiz: landing, Reels, Estilos, Créditos, Agente local e o Estúdio JusAz para o administrador), com um login e um banco Supabase.

- `agent/`: agente local (Node 20+). Guarda os vídeos e faz o render no computador do usuário. Estilo simples e estilo "Interface animada (VSL)". O pacote para download fica em `public/agente.tgz`.
- `../supabase/functions/planejar-reel` e `planejar-edicao`: funções de IA que montam o plano de edição (precisam do segredo `ANTHROPIC_API_KEY`).
- `../app/(app)/reels/`: telas de Reels dentro do app.

Para regerar o pacote do agente: `tar --exclude=node_modules -czf public/agente.tgz -C reels agent` (na raiz do repositório).
