// content.js (versão final com simulação de eventos completa)
console.log("Notifica SEI: Content script injetado. Aguardando OutSystems...");

/**
 * Preenche um campo e simula a sequência completa de eventos de um usuário
 * para garantir a compatibilidade com frameworks como OutSystems.
 * @param {HTMLInputElement} element O elemento input a ser preenchido.
 * @param {string} value O valor a ser inserido.
 */
function preencherCampo(element, value) {
    console.log(`Preenchendo o campo ${element.id} com o valor...`);
    element.value = value;

    console.log(`Disparando evento 'input' para ${element.id}`);
    element.dispatchEvent(new Event('input', { bubbles: true }));

    console.log(`Disparando evento 'change' para ${element.id}`);
    element.dispatchEvent(new Event('change', { bubbles: true }));

    console.log(`Disparando evento 'blur' (perdendo foco) para ${element.id}`);
    element.blur();
}


/**
 * Tenta realizar o login automático na página de login do SEI.
 */
function attemptAutoLogin() {
    // Só executa na página de login
    if (!window.location.href.includes('/sip/login.php')) {
        return;
    }

    let attempts = 0;
    const maxAttempts = 50; // Tenta por no máximo 10 segundos

    const loginInterval = setInterval(() => {
        attempts++;

        const accessButton = document.getElementById('sbmAcessar');

        if (accessButton) {
            clearInterval(loginInterval);
            console.log("Notifica SEI: Formulário renderizado pela plataforma OutSystems.");

            const userInput = document.getElementById('txtUsuario');
            const passInput = document.getElementById('pwdSenha');

            if (!userInput || !passInput) {
                console.error("Notifica SEI: Campos de usuário ou senha não encontrados.");
                return;
            }

            chrome.storage.local.get(['seiCredentials'], (result) => {
                if (result.seiCredentials?.user && result.seiCredentials?.pass) {

                    // --- APLICAÇÃO DA ESTRATÉGIA FINAL ---
                    // 1. Preenche os campos usando a nova função de simulação completa
                    preencherCampo(userInput, result.seiCredentials.user);
                    preencherCampo(passInput, result.seiCredentials.pass);

                    // 2. Clica no botão para acionar o fluxo de validação normal
                    console.log("Notifica SEI: Aguardando um instante e clicando no botão 'Acessar'...");
                    setTimeout(() => {
                        accessButton.click();
                    }, 500); // Um delay generoso de meio segundo para garantir que os eventos foram processados

                } else {
                    console.log("Notifica SEI: Nenhuma credencial salva para o login automático.");
                }
            });
        }

        if (attempts >= maxAttempts) {
            clearInterval(loginInterval);
            console.error("Notifica SEI: Timeout. O formulário de login não carregou a tempo.");
        }

    }, 200);
}

function isSafeToRefresh() {
    try {
        const isListingPage = window.location.href.includes('controlador.php?acao=procedimento_controlar') || window.location.href.includes('pagina=lista_processos');
        const isTableVisible = !!document.getElementById('tblProcessosRecebidos') || !!document.getElementById('tblProcessosGerados');
        const noUnsavedChanges = document.querySelectorAll('form[data-dirty="true"], .form-editando').length === 0;
        const notViewingDocument = !document.querySelector('#divVisualizacaoDocumento, #divEdicaoDocumento');
        console.log("isSafeToRefresh: " + isListingPage + " - " + isTableVisible + " - " + noUnsavedChanges + " - " + notViewingDocument);
        return isListingPage && isTableVisible && noUnsavedChanges && notViewingDocument;
    } catch (error) {
        console.error("Erro ao verificar contexto seguro:", error);
        return false;
    }
}

// NOVA FUNÇÃO: Simula o clique nos links para forçar o recarregamento do painel.
function forcePageRefresh() {
    console.log("Atualizando a tela");
    const painelLink = document.getElementById('lnkPainelControle');
    const processosLink = document.getElementById('lnkControleProcessos');

    if (painelLink && processosLink) {
        console.log("Notifica SEI: Simulando clique no Painel de Controle para forçar a atualização.");
        setTimeout(() => {
            console.log("Esperando para clicar no painel");
            painelLink.click();
        }, 25000); // Atraso de 2 segundos para dar tempo do conteúdo atualizar

        setTimeout(() => {
            console.log("esperando pra clicar nos processos");
        }, 25000); // Atraso de 2 segundos para dar tempo do conteúdo atualizar
        processosLink.click();

        return true;
    } else {
        console.error("Notifica SEI: Links de Painel de Controle ou Controle de Processos não encontrados.");
        return false;
    }
}

/**
 * Aplica as modificações visuais (nome do processo e mensagens) nas tabelas do SEI
 * Esta função é chamada continuamente pelo observador para manter as alterações visíveis
 */
function applyProcessNameDisplay(tableId) {
    try {
        const table = document.getElementById(tableId);
        if (!table) {
            console.log(`[Notifica SEI] ❌ Tabela ${tableId} não encontrada no DOM`);
            return;
        }

        const rows = table.querySelectorAll('tbody > tr');
        let modificationsCount = 0;
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length > 2) {
                // Processa a coluna de notificação (coluna 1)
                const notificationLink = cells[1].querySelector('a[aria-label]');
                const notificationMessage = notificationLink ? notificationLink.getAttribute('aria-label') : 'N/A';
                if (notificationLink && notificationMessage !== 'N/A' && !cells[1].querySelector('.notifica-sei-notification-display')) {
                    const displaySpan = document.createElement('span');
                    displaySpan.className = 'notifica-sei-notification-display';
                    displaySpan.style.cssText = 'display: block; font-size: 0.8em; color: #555;';
                    displaySpan.textContent = `(Msg: ${notificationMessage})`;
                    cells[1].appendChild(displaySpan);
                }

                // Processa a coluna do processo (coluna 2)
                const processColumn = cells[2];
                const processLinkElement = processColumn.querySelector('a[href*="controlador.php?acao=procedimento"]');

                if (processLinkElement) {
                    const processNumberText = processLinkElement.textContent.trim();
                    let processName = processLinkElement.getAttribute('aria-label') || processLinkElement.title;

                    // DEBUG: Log detalhado de cada processo
                    console.log(`[DEBUG] Processo encontrado:`, {
                        numeroTexto: processNumberText,
                        nomeExtraido: processName,
                        temDataset: !!processLinkElement.dataset.originalNumber
                    });

                    // Verifica se o link ainda está mostrando o número (não foi modificado ainda)
                    // OU se perdeu a modificação (após refresh)
                    // Formato do número SEI: 23100.003064/2025-04 (5 dígitos.6 dígitos/4 dígitos-2 dígitos)
                    const isShowingNumber = /^\d{5}\.\d{6}\/\d{4}-\d{2}/.test(processNumberText);

                    console.log(`[DEBUG] Verificações:`, {
                        isShowingNumber,
                        temProcessName: !!processName,
                        processNameNaoNA: processName !== 'N/A',
                        passaTeste: processName && processName !== 'N/A' && isShowingNumber
                    });

                    if (processName && processName !== 'N/A' && isShowingNumber) {
                        console.log(`[Notifica SEI] ✏️ Substituindo "${processNumberText}" por "${processName}"`);
                        processLinkElement.textContent = processName;
                        processLinkElement.dataset.originalNumber = processNumberText;
                        modificationsCount++;

                        // Remove o span anterior se existir (para evitar duplicação)
                        const existingSpan = processColumn.querySelector('.notifica-sei-processnumber-display');
                        if (existingSpan) {
                            existingSpan.remove();
                        }

                        // Adiciona o número do processo abaixo do nome
                        const numberSpan = document.createElement('span');
                        numberSpan.className = 'notifica-sei-processnumber-display';
                        numberSpan.style.cssText = 'display: block; font-size: 0.75em; color: #888;';
                        numberSpan.textContent = `(${processNumberText})`;
                        processColumn.appendChild(numberSpan);
                    }
                }
            }
        });
        console.log(`[Notifica SEI] ✅ Tabela ${tableId}: ${modificationsCount} modificações aplicadas de ${rows.length} linhas`);
    } catch (error) {
        console.error("Erro ao aplicar exibição de nomes de processos:", error);
    }
}

function extractTableData(tableId) {
    try {
        const table = document.getElementById(tableId);
        if (!table) return [];
        const data = [];
        const rows = table.querySelectorAll('tbody > tr');
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length > 2) {
                const notificationLink = cells[1].querySelector('a[aria-label]');
                const notificationMessage = notificationLink ? notificationLink.getAttribute('aria-label') : 'N/A';

                const processColumn = cells[2];
                const processLinkElement = processColumn.querySelector('a[href*="controlador.php?acao=procedimento"]');
                const processNumberText = processLinkElement?.dataset.originalNumber || processLinkElement?.textContent.trim() || processColumn.textContent.trim();
                let processName = processLinkElement ? processLinkElement.getAttribute('aria-label') || processLinkElement.title : 'N/A';
                let processUrl = processLinkElement ? new URL(processLinkElement.href, window.location.href).href : '';

                data.push({ tableId, notification: notificationMessage, processName, processNumber: processNumberText, processUrl });
            }
        });
        return data;
    } catch (error) {
        console.error("Erro ao extrair dados da tabela:", error);
        return [];
    }
}

function extractUpdatesData() {
    console.log("[Notifica SEI] 📊 Iniciando extração de dados das tabelas");
    // Garante que as modificações visuais estejam aplicadas antes de extrair
    applyProcessNameDisplay('tblProcessosRecebidos');
    applyProcessNameDisplay('tblProcessosGerados');

    const allProcesses = [...extractTableData("tblProcessosRecebidos"), ...extractTableData("tblProcessosGerados")];
    console.log(`[Notifica SEI] ✅ Extração concluída: ${allProcesses.length} processos encontrados`);
    return JSON.stringify(allProcesses);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log(`[Notifica SEI] 📨 Mensagem recebida: ${request.action}`);
    switch (request.action) {
        case "requestData":
            console.log("[Notifica SEI] Respondendo com dados atuais (sem refresh)");
            sendResponse({ data: extractUpdatesData() });
            break;

        case "checkAndRefresh":
            const safe = isSafeToRefresh();
            console.log(`[Notifica SEI] Verificação de segurança para refresh: ${safe}`);
            sendResponse({ safeToRefresh: safe });
            break;

        case "forceRefreshAndGetData":
            if (isSafeToRefresh()) {
                console.log("[Notifica SEI] ✅ Contexto seguro - extraindo dados SEM forçar refresh (observador mantém nomes visíveis)");
                sendResponse({ status: "data_sent_observer_active", data: extractUpdatesData() });

                // NÃO fazemos refresh aqui porque o MutationObserver + setInterval já mantém os nomes visíveis
                // Apenas fazemos refresh a cada 5 verificações (5 minutos) para garantir dados frescos do servidor
                if (!window.notificaSeiRefreshCounter) {
                    window.notificaSeiRefreshCounter = 0;
                }
                window.notificaSeiRefreshCounter++;

                if (window.notificaSeiRefreshCounter >= 5) {
                    console.log("[Notifica SEI] 🔄 Contador atingiu 5 - forçando refresh da página em 2 segundos");
                    window.notificaSeiRefreshCounter = 0;
                    setTimeout(() => {
                        forcePageRefresh();
                    }, 2000);
                } else {
                    console.log(`[Notifica SEI] ⏭️ Pulando refresh (contador: ${window.notificaSeiRefreshCounter}/5)`);
                }
            } else {
                console.log("[Notifica SEI] ⚠️ Contexto não seguro para refresh - apenas extraindo dados");
                sendResponse({ status: "not_safe_to_refresh", data: extractUpdatesData() });
            }
            break;
    }
});

function checkLoginAndNotifyBackground() {
    if (document.getElementById('lnkUsuarioSistema') && !window.hasSentSEILoadedMessage) {
        chrome.runtime.sendMessage({ action: "seiLoaded" });
        window.hasSentSEILoadedMessage = true;
    }
}

/**
 * Inicializa o observador de mutações para manter os nomes dos processos sempre visíveis
 * Este observador detecta quando o DOM é modificado (como após um refresh) e reaplica as alterações
 */
function initializeProcessNameObserver() {
    console.log("[Notifica SEI] 🚀 Inicializando observador de nomes de processos...");

    // Aplica as modificações inicialmente
    applyProcessNameDisplay('tblProcessosRecebidos');
    applyProcessNameDisplay('tblProcessosGerados');

    // Configura o observador para detectar mudanças no DOM
    const targetNode = document.body;
    const config = {
        childList: true,
        subtree: true,
        attributes: false
    };

    // Callback executado quando o DOM muda
    const callback = function (mutationsList, observer) {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                // Verifica se alguma das tabelas foi modificada
                const relevantChange = Array.from(mutation.addedNodes).some(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        return node.id === 'tblProcessosRecebidos' ||
                            node.id === 'tblProcessosGerados' ||
                            node.querySelector('#tblProcessosRecebidos') ||
                            node.querySelector('#tblProcessosGerados');
                    }
                    return false;
                });

                if (relevantChange) {
                    console.log("[Notifica SEI] 🔍 MutationObserver detectou mudança nas tabelas - reaplicando modificações");
                    // Aguarda um pouco para garantir que o DOM está estável
                    setTimeout(() => {
                        applyProcessNameDisplay('tblProcessosRecebidos');
                        applyProcessNameDisplay('tblProcessosGerados');
                    }, 100);
                }
            }
        }
    };

    // Cria e inicia o observador
    const observer = new MutationObserver(callback);
    observer.observe(targetNode, config);

    console.log('[Notifica SEI] ✅ Observador MutationObserver ativo e monitorando o DOM');

    // Também aplica as modificações periodicamente como camada adicional de segurança
    console.log('[Notifica SEI] ⏰ Iniciando verificação periódica a cada 3 segundos');
    setInterval(() => {
        console.log('[Notifica SEI] ⏰ Verificação periódica - reaplicando modificações');
        applyProcessNameDisplay('tblProcessosRecebidos');
        applyProcessNameDisplay('tblProcessosGerados');
    }, 2000); // Verifica e reaplica a cada 2 segundos
}

// Inicia as funções principais
attemptAutoLogin();
checkLoginAndNotifyBackground();

// Aguarda o carregamento completo do DOM antes de iniciar o observador
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeProcessNameObserver);
} else {
    // DOM já está carregado
    initializeProcessNameObserver();
}