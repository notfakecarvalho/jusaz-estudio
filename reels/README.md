# Mira: estúdio de Reels

Plataforma multiusuário de edição de Reels. O vídeo fica no computador de cada usuário (agente local com ffmpeg e render); a nuvem guarda só texto, andamento e créditos.

- `web/`: site (Vite + React) com landing, pedidos, estilos, créditos e página do agente. Publicado como site estático (`npm install && npm run build`, saída em `dist/`).
- `agent/`: agente local (Node 20+). Estilo simples e estilo "Interface animada (VSL)".
- `../supabase/functions/planejar-reel`: função que monta o plano de edição.

Não altera o app Next.js do Estúdio JusAz (pastas `app/`, `components/`, `lib/`) nem as funções existentes em `supabase/functions/`.
