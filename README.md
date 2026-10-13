# Caderno de Quizzes

Quizzes para a sala de aula, no estilo Kahoot. Os alunos jogam sozinhos ou entram em um jogo ao vivo com **PIN ou QR, sem conta**. O professor gerencia tudo pelo mesmo site.

- Jogo individual com cronômetro, pontos por rapidez, sequências, sons e tabela de pontuações
- Jogo ao vivo: o anfitrião mostra o PIN e o QR, os alunos respondem pelo celular e no final aparece o pódio
- Avatares, editor de quizzes, importação e exportação em JSON e painel de gestão (tempos, pontos, bônus)
- Funciona no celular e no computador

O site é estático (GitHub Pages) e guarda os dados no **Firebase** (Firestore + Authentication), no plano gratuito.

---

## Configuração (cerca de 10 minutos, uma vez só)

### 1. Criar o projeto no Firebase
1. Abra <https://console.firebase.google.com> e clique em **Criar projeto**. Dê um nome (por exemplo `caderno-quizzes`). O Google Analytics não é necessário.
2. No menu à esquerda: **Criação → Firestore Database → Criar banco de dados**. Escolha uma localização próxima e comece no **modo de produção**.
3. **Criação → Authentication → Vamos começar**. Na aba **Método de login**, ative:
   - **Anônimo** (é assim que os alunos entram, sem conta)
   - **Google** (é assim que você entra como gestor)
4. Ainda em Authentication, na aba **Configurações → Domínios autorizados**, adicione `sebastianmx-dev.github.io`.

### 2. Conectar o site ao projeto
1. Na engrenagem **Configurações do projeto → Geral → Seus apps**, clique no ícone **`</>`** (Web), dê um nome e registre o app (não precisa do Firebase Hosting).
2. Copie o bloco `firebaseConfig` que aparece.
3. No GitHub, abra o arquivo **`firebase-config.js`**, clique no lápis (editar) e troque os valores pelos seus. Salve com **Commit changes**.

### 3. Regras de segurança
1. No Firebase: **Firestore Database → Regras**.
2. Apague o conteúdo e cole tudo o que está em **[`firestore.rules`](firestore.rules)**. Clique em **Publicar**.

### 4. Dar permissão de gestor
1. **Firestore Database → Dados → Iniciar coleção**. ID da coleção: `admins`.
2. ID do documento: **o seu e-mail do Google, exatamente como você usa para entrar**. Adicione um campo qualquer (por exemplo `ativo`, tipo `boolean`, valor `true`) e salve.
3. Para adicionar outro professor, crie outro documento com o e-mail dele.

Os e-mails dos gestores ficam só no seu banco de dados e não aparecem no código público.

### 5. Primeiro uso
1. Abra o site e, no fim da página, clique em **Entrar como gestor**.
2. Com a biblioteca vazia, clique em **Carregar quizzes iniciais** para importar os quizzes de exemplo (`data/quizzes.json`).
3. Quando os quizzes iniciais forem atualizados no GitHub, use **Gestão → Quizzes iniciais → Comparar** para trazer as mudanças.

---

## Como jogar ao vivo
1. Como gestor, clique em **Ao vivo** em um quiz. Projete a tela com o PIN e o QR.
2. Os alunos leem o QR com a câmera do celular (ou abrem o site e digitam o PIN), escrevem o nome, escolhem um avatar e entram.
3. Clique em **Começar**. A resposta aparece quando todos respondem ou quando o tempo acaba.

## Jogo por equipes
Na sala de espera do jogo ao vivo, escolha **Modo de jogo → Equipes**:
- **Número de equipes**: de 2 a 6 (Vermelha ▲, Azul ◆, Amarela ●, Verde ■, Roxa e Turquesa).
- **Como formar**: *Distribuir automaticamente* (equilibra o número de alunos por equipe) ou *Os alunos escolhem* (cada aluno escolhe ao entrar e pode trocar enquanto o jogo não começa).
- O botão **Embaralhar equipes** redistribui todos os alunos ao acaso.

A pontuação de cada equipe é a **média** dos pontos dos integrantes, para que equipes maiores não tenham vantagem. A classificação, o pódio e o relatório (com o CSV) mostram as equipes, além dos destaques individuais; no celular, cada aluno vê a sua equipe e a posição dela.

## Recursos didáticos
- **Dica por pergunta**: no editor, cada pergunta pode ter uma dica opcional. O aluno pode abri-la durante a pergunta (no jogo individual e no celular, ao vivo); se acertar, ganha metade dos pontos.
- **Modo treino**: na entrada do jogo individual, marque “Modo treino” para jogar sem cronômetro, com explicação em todas as perguntas e sem enviar a pontuação para a tabela.
- **Treinar os erros**: no fim do jogo individual, o botão repete só as perguntas que o aluno errou, em modo treino.
- **Relatório da turma**: no fim do jogo ao vivo, o anfitrião vê o acerto de cada pergunta (as abaixo de 50% aparecem com “Rever”), as dicas usadas e o desempenho de cada aluno, e pode baixar tudo em CSV (abre no Excel ou no Google Planilhas).
- **Duplicar quiz**: em Gestão, cria uma cópia oculta para você ajustar antes de mostrar aos alunos.

No JSON de importação, a dica é o campo `"hint"` de cada pergunta.

## Imagens e áudio nas perguntas
No editor, cada pergunta pode ter **uma imagem ou um áudio**:
- **Enviar imagem**: a página reduz e comprime a imagem automaticamente (até 1280 px).
- **Enviar áudio**: MP3, M4A, OGG ou WAV de até 700 KB (cerca de 45 s em MP3).
- **Gravar áudio**: grava pelo microfone, até 60 s (útil para ditados e pronúncia).
- **Colar link**: usa uma imagem ou um áudio que já está na internet (endereço `https://`).

No jogo, a imagem aparece na tela do anfitrião e no celular dos alunos. O áudio toca sozinho no início da pergunta (jogo individual e tela do anfitrião), abaixando a música, e pode ser ouvido de novo pelo botão **Ouvir áudio**. Para imagens, preencha a descrição: ela é lida por leitores de tela.

Os arquivos ficam no próprio Firestore (coleções `media` e `mediaIndex`), porque o Firebase Storage exige o plano pago. Em **Gestão → Jogos ao vivo**, o botão **Excluir mídias sem uso** apaga arquivos que não estão mais em nenhuma pergunta.

> Depois desta atualização, copie de novo o arquivo `firestore.rules` para o console do Firebase (Firestore → Regras → Publicar), porque ele ganhou as regras de mídia.

## Música
As músicas ficam na pasta `audio/` e mudam conforme o momento do jogo: **sala de espera**, **perguntas** (acelera nos últimos 5 segundos) e **pódio**. Em **Gestão → Regras do jogo → Música** você escolhe, para cada momento, uma faixa específica, uma aleatória, a música gerada pelo navegador (só nas perguntas) ou nenhuma, e pode ouvir antes de salvar. No jogo ao vivo, a música toca só na tela do anfitrião.

Para adicionar uma faixa, coloque o MP3 em `audio/` e acrescente uma linha na lista `TRACKS` no início de `app.js`.

### Créditos das músicas
Faixas da [Pixabay](https://pixabay.com/music/), sob a [Licença de Conteúdo da Pixabay](https://pixabay.com/service/license-summary/) (uso gratuito, sem atribuição obrigatória):

| Momento | Faixa | Autor |
|---|---|---|
| Sala de espera | Playdate | Geoff Harvey |
| Sala de espera | Funny Cartoon Music | Hitslab |
| Sala de espera | Cartoon Music | TataMusic |
| Perguntas | Cartoon Run | Elisaveta Stoycheva |
| Perguntas | Cartoon Music | Maksym Malko |
| Perguntas | Funny Music | AndriiH |
| Perguntas | Cartoon Music | Starostin |
| Pódio | Nomination Victory | Hitslab |
| Pódio | Winner Champions | MFCC |

## Arquivos
| Arquivo | Para que serve |
|---|---|
| `index.html` | Página e estilos |
| `app.js` | Toda a lógica: biblioteca, jogo, editor, gestão e jogo ao vivo |
| `backend-firebase.js` | Conexão com o Firestore e com o login (anônimo e Google) |
| `firebase-config.js` | A configuração do seu projeto Firebase |
| `firestore.rules` | Regras de segurança para colar no console do Firebase |
| `data/quizzes.json` | Quizzes iniciais |
| `audio/` | Músicas (MP3, 96 kbps, volume normalizado) |

## Próximos passos
As ideias para próximas versões estão em [`IDEIAS.md`](IDEIAS.md).

## Limites do plano gratuito
O plano Spark do Firebase inclui 50.000 leituras e 20.000 gravações por dia, o suficiente para várias turmas por dia. Em **Gestão** há um botão para excluir jogos ao vivo encerrados e manter o banco de dados leve.
