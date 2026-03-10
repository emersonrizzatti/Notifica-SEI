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
console.log("isSafeToRefresh: "+isListingPage+" - "+isTableVisible+" - "+noUnsavedChanges+" - "+notViewingDocument;
        return isListingPage && isTableVisible && noUnsavedChanges && notViewingDocument;
    } catch (error) {
        console.error("Erro ao verificar contexto seguro:", error);
        return false;
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
                if (notificationLink && notificationMessage !== 'N/A' && !cells[1].querySelector('.notifica-sei-notification-display')) {
                    const displaySpan = document.createElement('span');
                    displaySpan.className = 'notifica-sei-notification-display';
                    displaySpan.style.cssText = 'display: block; font-size: 0.8em; color: #555;';
                    displaySpan.textContent = `(Msg: ${notificationMessage})`;
                    cells[1].appendChild(displaySpan);
                }
                const processColumn = cells[2];
                const processLinkElement = processColumn.querySelector('a[href*="controlador.php?acao=procedimento"]');
                const processNumberText = processLinkElement ? processLinkElement.textContent.trim() : processColumn.textContent.trim();
                let processName = processLinkElement ? processLinkElement.getAttribute('aria-label') || processLinkElement.title : 'N/A';
                let processUrl = processLinkElement ? new URL(processLinkElement.href, window.location.href).href : '';
                if (processLinkElement && processName !== 'N/A' && !processLinkElement.dataset.originalTextSetByNotificaSEI) {
                    processLinkElement.textContent = processName;
                    processLinkElement.dataset.originalTextSetByNotificaSEI = 'true';
                    if (processNumberText !== 'N/A' && !processColumn.querySelector('.notifica-sei-processnumber-display')) {
                        const numberSpan = document.createElement('span');
                        numberSpan.className = 'notifica-sei-processnumber-display';
                        numberSpan.style.cssText = 'display: block; font-size: 0.75em; color: #888;';
                        numberSpan.textContent = `(${processNumberText})`;
                        processColumn.appendChild(numberSpan);
                    }
                }
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
    const allProcesses = [...extractTableData("tblProcessosRecebidos"), ...extractTableData("tblProcessosGerados")];
    return JSON.stringify(allProcesses);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const handlers = {
        requestData: () => ({ data: extractUpdatesData() }),
        checkAndRefresh: () => ({ safeToRefresh: isSafeToRefresh() })
    };
    if (request.action in handlers) {
        Promise.resolve(handlers[request.action]()).then(sendResponse).catch(error => sendResponse({ error: error.message }));
        return true;
    }
});

function checkLoginAndNotifyBackground() {
    if (document.getElementById('lnkUsuarioSistema') && !window.hasSentSEILoadedMessage) {
        chrome.runtime.sendMessage({ action: "seiLoaded" });
        window.hasSentSEILoadedMessage = true;
    }
}

// Inicia as duas funções principais
attemptAutoLogin();
checkLoginAndNotifyBackground();