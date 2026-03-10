# Notifica SEI

Uma extensão para Google Chrome que monitora os processos do Sistema Eletrônico de Informações (SEI) da Unipampa e notifica o usuário sobre atualizações diretamente no navegador e por e-mail.

## Funcionalidades

- **Monitoramento Automático:** Verifica os painéis do SEI silenciosamente para identificar novidades em seus processos.
- **Notificações Desktop:** Exibe alertas de sistema com atalho direto para o processo que foi atualizado.
- **Notificações por E-mail:** Envia alertas detalhados via e-mail utilizando a API oficial do Gmail.
- **Login Automático:** Automatiza o acesso, preenchendo e enviando as credenciais no portal do SEI.
- **Histórico Rápido:** Lista as últimas atualizações detectadas diretamente no painel (popup) da extensão.

## Instalação (Modo Desenvolvedor)

Esta extensão não está disponível na Chrome Web Store. Siga as instruções abaixo para instalá-la no seu navegador Google Chrome:

1. Baixe o código fonte deste repositório ou clone-o com o Git (`git clone https://github.com/emersonrizzatti/Notifica-SEI.git`).
2. Abra o Google Chrome e digite `chrome://extensions/` na barra de endereços.
3. No canto superior direito, ative a chave **Modo do desenvolvedor**.
4. Clique no botão **Carregar sem compactação** (ou *Load unpacked*).
5. Selecione a pasta contendo os arquivos deste repositório.
6. A extensão será carregada e seu ícone (um sino) aparecerá na barra de ferramentas do Chrome (você pode fixá-la clicando no ícone de "quebra-cabeça").

## Configuração e Uso

1. Abra uma aba do navegador no sistema SEI da Unipampa (`https://sei.unipampa.edu.br/`).
2. Clique no ícone da extensão para acessar as configurações.
3. **Login do SEI:** Salve seu nome de usuário e senha na extensão para que ela revalide sua sessão, caso expire.
4. **Para receber alertas por E-mail:**
   - Clique no botão **Conectar com Google** para realizar a autorização OAuth (Isso permite que a extensão envie o e-mail pela sua conta Gmail).
   - Preencha o e-mail de destino no campo indicado.
   - Ative o checkbox "Ativar notificações por e-mail".
5. Clique no botão **Iniciar** para começar a monitorar ativamente os processos. Você também pode marcar "Iniciar automaticamente ao abrir o SEI".

> **Importante:** Para que o monitoramento funcione perfeitamente sem interrupções, mantenha sempre uma aba do SEI aberta. A extensão recarregará a página ocasionalmente e inspecionará a interface para buscar novidades.

## Estrutura do Projeto

- `manifest.json`: Configurações principais e permissões da extensão Chrome V3.
- `background.js`: Service worker que roda em segundo plano gerenciando OAuth, envio de e-mails via API e ciclo de checagem.
- `content.js`: Script injetado nas páginas do SEI (responsável pela automação de login e coleta do DOM para identificar mudanças).
- `popup.html` e `popup.js`: Interface gráfica do usuário que gerencia as opções e histórico no ícone da extensão.
