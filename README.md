# Caderno de Quizzes

Quizzes para a sala de aula, ao estilo Kahoot. Os alunos jogam a solo ou entram num jogo ao vivo com **PIN ou QR, sem conta**. O professor gere tudo a partir do mesmo site.

- Jogo a solo com cronómetro, pontos por rapidez, sequências, sons e tabela de pontuações
- Jogo ao vivo: o anfitrião mostra o PIN e o QR, os alunos respondem no telemóvel e no fim aparece o pódio
- Avatares, editor de quizzes, importação e exportação em JSON e painel de gestão (tempos, pontos, bónus)
- Funciona no telemóvel e no computador

O site é estático (GitHub Pages) e guarda os dados no **Firebase** (Firestore + Authentication), no plano gratuito.

---

## Configuração (cerca de 10 minutos, só uma vez)

### 1. Criar o projeto no Firebase
1. Abre <https://console.firebase.google.com> e carrega em **Criar projeto**. Dá-lhe um nome (por exemplo `caderno-quizzes`). O Google Analytics não é preciso.
2. No menu da esquerda: **Compilação → Firestore Database → Criar base de dados**. Escolhe uma localização perto de ti e começa em **modo de produção**.
3. **Compilação → Authentication → Começar**. No separador **Método de início de sessão** ativa:
   - **Anónimo** (é assim que os alunos entram, sem conta)
   - **Google** (é assim que tu entras como gestor)
4. Ainda em Authentication, separador **Definições → Domínios autorizados**, acrescenta `sebastianmx-dev.github.io`.

### 2. Ligar o site ao projeto
1. Na engrenagem **Definições do projeto → Geral → As tuas apps**, carrega no ícone **`</>`** (Web), dá um nome e regista a app (não é preciso o Firebase Hosting).
2. Copia o bloco `firebaseConfig` que aparece.
3. No GitHub, abre o ficheiro **`firebase-config.js`**, carrega no lápis (editar) e substitui os valores pelos teus. Guarda com **Commit changes**.

### 3. Regras de segurança
1. No Firebase: **Firestore Database → Regras**.
2. Apaga o conteúdo e cola tudo o que está em **[`firestore.rules`](firestore.rules)**. Carrega em **Publicar**.

### 4. Dar-te permissão de gestor
1. **Firestore Database → Dados → Iniciar coleção**. ID da coleção: `admins`.
2. ID do documento: **o teu email Google, exatamente como o usas para entrar**. Acrescenta um campo qualquer (por exemplo `ativo` = `true`) e guarda.
3. Para acrescentar outro professor, cria outro documento com o email dele.

Os emails dos gestores ficam só na tua base de dados, não aparecem no código público.

### 5. Primeiro uso
1. Abre o site e, no fundo da página, carrega em **Entrar como gestor**.
2. Com a biblioteca vazia, carrega em **Carregar quizzes iniciais** para importar os quizzes de exemplo (`data/quizzes.json`).

---

## Como jogar ao vivo
1. Como gestor, carrega em **Ao vivo** num quiz. Projeta o ecrã com o PIN e o QR.
2. Os alunos leem o QR com a câmara do telemóvel (ou abrem o site e escrevem o PIN), escrevem o nome, escolhem um avatar e entram.
3. Carrega em **Começar**. A resposta é revelada quando todos respondem ou quando o tempo acaba.

## Ficheiros
| Ficheiro | Para que serve |
|---|---|
| `index.html` | Página e estilos |
| `app.js` | Toda a lógica: biblioteca, jogo, editor, gestão e jogo ao vivo |
| `backend-firebase.js` | Ligação ao Firestore e ao login (anónimo e Google) |
| `firebase-config.js` | A configuração do teu projeto Firebase |
| `firestore.rules` | Regras de segurança para colar na consola do Firebase |
| `data/quizzes.json` | Quizzes iniciais |

## Limites do plano gratuito
O plano Spark do Firebase inclui 50 000 leituras e 20 000 escritas por dia, o que chega para várias turmas por dia. Na **Gestão** há um botão para apagar jogos ao vivo terminados e manter a base de dados leve.
