# Agente local do Estúdio de Reels

Guarda os seus vídeos e faz o render no seu computador.

## Instalar
1. Instale o Node 20 ou mais novo (nodejs.org) e o ffmpeg (Mac: `brew install ffmpeg`).
2. Opcional, para legendas palavra por palavra: `pip install openai-whisper`.
3. Nesta pasta: `npm install` e depois `npm start`.
4. Na primeira vez, digite o e-mail e a senha da sua conta. Deixe a janela aberta enquanto edita.

Os vídeos ficam na pasta `~/Reels`. Só o texto do pedido e o andamento vão para a plataforma.

## Estilo "Interface animada (VSL)" (opcional)
Corta o vídeo pelo som, tira os vícios e monta telas animadas por cima, tudo no seu computador. O motor é o
[skill-reel](https://github.com/Felpborges/skill-reel) (versão fixa, baixada sozinha na primeira vez). Precisa de:

- ffmpeg e Google Chrome;
- `whisper-cli` (Mac: `brew install whisper-cpp`) e o modelo `ggml-large-v3-turbo.bin` (1,6 GB) em `~/.cache/whisper-cpp/` (ou defina `WHISPER_MODEL`);
- Python 3 com `numpy` e `opencv-python` (`pip install numpy opencv-python`; defina `VSL_PYTHON` se usar outro Python). `mediapipe` é opcional e melhora o rastreio da boca;
- no Windows, o bash do Git for Windows.

Ao abrir, o agente avisa se algo estiver faltando. A primeira renderização instala o HyperFrames (alguns minutos).
