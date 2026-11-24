# DESIGN.md — Mira (Estúdio de Reels)

Linguagem visual: azul-marinho e azul-elétrico, foco em segurança e confiança, com um toque divertido de creator (referência pedida: Stan Store). Sem fontes, logo ou textos copiados de terceiros.

## Cores
- Tinta/marinho `#0A1A44`, papel `#FFFFFF`, fundo `#F1F5FF`, linha `#D3DEF4`, texto secundário `#475A80`.
- Azul `#2F6BFF` = ação principal (sombra de botão `#1A47D6`). Azul suave `#E3EDFF` = seleção e avisos; azul claro `#CFE0FF` = destaque; texto azul `#1740BC`.
- Menta `#18D8A0` (fundo `#D7F8EC`, texto `#04694F`) só para segurança e "feito": selos, escudo, estados ok.
- Vermelho `#E5252A` só para erro.
- Faixa de cada tela e login: gradiente marinho → `#14349A` → azul, com padrão de pontos.

## Tipografia
- Títulos e números: Bricolage Grotesque Variable 800, tracking -.03em, entrelinha ~.98.
- Corpo, botões, rótulos: Plus Jakarta Sans Variable.
- Números, códigos, datas: Geist Mono Variable.
- Fontes auto-hospedadas via `@fontsource-variable` (nada de Google Fonts).

## Estrutura
- Barra de topo flutuante, branca translúcida, cantos de 18px: marca (escudo + nome), navegação em pílulas, saldo, estado do agente, sair.
- Cada tela abre com uma faixa azul de largura total (gradiente + pontos + formas girando de leve). O conteúdo vem em `.corpo` (máx. 1160px) sobre fundo azul-gelo, painéis brancos com 22px de raio.
- Mobile: barra estática, navegação rola na horizontal, colunas viram uma só.

## Segurança (tema central)
- `Logo`: escudo com check. `Selo`: pílula menta com escudo ("Vídeo só no seu computador"). `Escudo`: faixa menta com título e explicação, usada antes do envio do vídeo.
- Login mostra três selos: vídeo só no seu computador, cada conta vê só o que é seu, sem pedir senha do Instagram.

## Divertido / creator
- Botões gordinhos com sombra deslocada (pressionam ao clicar), números dos passos em quadrados arredondados girados -6°, formas inclinadas e sombras duras no formulário de login e na prévia 9:16.
- Textos curtos e diretos ("Bora criar o primeiro Reel?").

## Assinatura
Faixa de quatro pílulas: Pedido, Plano, Render, MP4. Feito = marinho, em andamento = azul com brilho passando, aguardando = cinza, erro = vermelho.

## Componentes
- Botões: pílula, 46px. Principal azul com sombra inferior; escuro marinho; secundário branco com contorno marinho. Desabilitado cinza-azulado.
- Campos: 48px, borda de 2px, foco azul com anel azul claro.
- Chips: ok = menta; andamento = azul suave; aguardando = cinza; erro = vermelho claro.
- Opção selecionada: fundo azul suave, borda azul e sombra inferior azul.

## Movimento
120–240ms, ease-out, só transform e opacidade. Botões sobem no hover e afundam no clique. `prefers-reduced-motion` desliga brilho, giro e entrada.

## Marca
"Mira" é nome provisório: muda numa constante (`MARCA` em `src/ui.jsx`).
