# Estúdio JusAz

Um vídeo por dia, do roteiro ao Instagram.

- **App**: Next.js (pasta `app/`), hospedado na Vercel.
- **Banco, login e arquivos**: Supabase (projeto `jusaz-estudio`).
- **Automação**: funções `automacao` e `worker` em `supabase/functions/` (rodam no Supabase).
- **Render 3D**: roda à parte (worker), porque a Vercel não aguenta renderizar vídeo.

Variáveis do app: veja `.env.example`. Segredos (Instagram, ElevenLabs) ficam só nos segredos das funções do Supabase.
