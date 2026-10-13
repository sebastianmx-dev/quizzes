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

## Arquivos
| Arquivo | Para que serve |
|---|---|
| `index.html` | Página e estilos |
| `app.js` | Toda a lógica: biblioteca, jogo, editor, gestão e jogo ao vivo |
| `backend-firebase.js` | Conexão com o Firestore e com o login (anônimo e Google) |
| `firebase-config.js` | A configuração do seu projeto Firebase |
| `firestore.rules` | Regras de segurança para colar no console do Firebase |
| `data/quizzes.json` | Quizzes iniciais |

## Limites do plano gratuito
O plano Spark do Firebase inclui 50.000 leituras e 20.000 gravações por dia, o suficiente para várias turmas por dia. Em **Gestão** há um botão para excluir jogos ao vivo encerrados e manter o banco de dados leve.
