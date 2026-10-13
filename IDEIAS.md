# Ideias para próximas versões

Sugestões levantadas em 12/10/2026 para deixar o Caderno de Quizzes mais didático e dinâmico. Ainda não foram implementadas; ficam aqui para serem retomadas.

## 1. Perguntas com imagem ou áudio
Permitir anexar uma imagem ou um áudio curto a cada pergunta. Exemplo: ouvir uma frase e escolher a forma verbal certa.
- Editor: campo para enviar o arquivo (Firebase Storage) ou colar um link.
- Ao vivo: a mídia aparece na tela do anfitrião; o áudio toca na sala.
- Cuidado: limite de tamanho e formatos leves (JPG/WebP, MP3).

## 2. Novos tipos de pergunta
- **Digitar a resposta** (com tolerância a acentos e maiúsculas).
- **Ordenar palavras** para formar a frase correta.
- **Sim/não rápido** (rodada relâmpago com tempo curto).

## 3. Modo equipes
Os alunos escolhem uma equipe ao entrar; a pontuação é somada (ou a média) por equipe, e o pódio mostra as equipes.

## 4. Histórico por aluno
Guardar o resultado de cada jogo por aluno para o professor acompanhar a evolução ao longo do tempo (gráfico de acertos por tema). Exige uma forma estável de identificar o aluno entre jogos (por exemplo, um código de turma + nome).

## 5. Gerar perguntas com IA
A partir de um tema e nível ("futuro do subjuntivo, B1"), gerar um rascunho de quiz com perguntas, opções, explicações e dicas, para o professor revisar antes de publicar. Como o site é estático, precisa de uma chave de API guardada fora do código público (por exemplo, numa Cloud Function do Firebase).
