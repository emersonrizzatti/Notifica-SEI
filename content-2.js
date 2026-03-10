// content.js
console.log("Notifica SEI: Content script injetado na página do SEI.");

/**
 * Verifica se o contexto atual permite recarregamento seguro
 * @returns {boolean} True se estiver na tela de listagem sem edições em andamento
 */
function isSafeToRefresh() {
    try {
        // 1. Verifica URL - deve ser a página de listagem
        const isListingPage = window.location.href.includes('controlador.php?acao=procedimento_controlar') || 
                             window.location.href.includes('pagina=lista_processos'); // adapte conforme necessário
        
        // 2. Verifica se a tabela principal está visível
        const isTableVisible = !!document.getElementById('tblProcessosRecebidos') || 
                              !!document.getElementById('tblProcessosGerados');
        
        // 3. Verifica se não há formulários com alterações não salvas
        const noUnsavedChanges = document.querySelectorAll('form[data-dirty="true"], .form-editando').length === 0;
        
        // 4. Verifica se não está em visualização/edição de documento
        const notViewingDocument = !document.querySelector('#divVisualizacaoDocumento, #divEdicaoDocumento');
console.log("isSafeToRefresh: "+isListingPage+" - "+isTableVisible+" - "+noUnsavedChanges+" - "+notViewingDocument;        
        return isListingPage && isTableVisible && noUnsavedChanges && notViewingDocument;
    } catch (error) {
        console.error("Erro ao verificar contexto seguro:", error);
        return false; // Em caso de erro, assume que não é seguro
    }
}

/**
 * Função para extrair dados de uma tabela específica do SEI.
 * @param {string} tableId O ID da tabela a ser processada (ex: "tblProcessosRecebidos").
 * @returns {Array<Object>} Um array de objetos, onde cada objeto representa uma linha de processo com mensagem, nome, número e link.
 */
function extractTableData(tableId) {
    try {
        const table = document.getElementById(tableId);
        if (!table) {
            console.warn(`Notifica SEI: Tabela com ID '${tableId}' não encontrada.`);
            return [];
        }

        const data = [];
        const rows = table.querySelectorAll('tbody > tr');

        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length > 2) {
                // Coluna 2 (índice 1): Mensagem da Notificação
                const notificationLink = cells[1].querySelector('a[aria-label]');
                const notificationMessage = notificationLink ? notificationLink.getAttribute('aria-label') : 'N/A';

                // Coluna 3 (índice 2): Número, Nome e Link do Processo
		const processColumn = cells[2];
		const processLinkElement = processColumn.querySelector('a[href*="controlador.php?acao=procedimento"]') || 
                          processColumn.querySelector('a[href*="processo"]');

                const processNumberText = processColumn.textContent.trim();
                // Extrai nome do processo - tenta múltiplos métodos
		let processName = 'N/A';
		if (processLinkElement) {
		    processName = processLinkElement.getAttribute('aria-label') || 
		                 processLinkElement.textContent.trim() || 
		                 processLinkElement.title;
		}

		// Extrai URL - verifica múltiplos padrões
		let processUrl = '';
		if (processLinkElement) {
		    processUrl = processLinkElement.href;
    
		    // Garante que a URL é absoluta (alguns SEIs usam URLs relativas)
		    if (processUrl && !processUrl.startsWith('http')) {
		        processUrl = new URL(processUrl, window.location.href).href;
		    }
		}
                data.push({
                    tableId: tableId,
                    notification: notificationMessage,
                    processName: processName,
                    processNumber: processNumberText,
                    processUrl: processUrl
                });
            }
        });
        return data;
    } catch (error) {
        console.error("Erro ao extrair dados da tabela:", error);
        return [];
    }
}

/**
 * Função principal para extrair todas as atualizações das tabelas relevantes.
 * @returns {string} Uma string JSON contendo todos os processos com notificações e seus detalhes.
 */
function extractUpdatesData() {
    const receivedProcesses = extractTableData("tblProcessosRecebidos");
    const generatedProcesses = extractTableData("tblProcessosGerados");

    const allProcesses = [...receivedProcesses, ...generatedProcesses];
    return JSON.stringify(allProcesses);
}

// Listener para receber mensagens do background script
const messageHandlers = {
    requestData: () => {
        const data = extractUpdatesData();
        return { data: data };
    },
    checkAndRefresh: () => {
        return { safeToRefresh: isSafeToRefresh() };
    }
    // Adicione outros handlers aqui...
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const handler = messageHandlers[request.action];
    if (handler) {
        Promise.resolve(handler(request))
            .then(response => sendResponse(response))
            .catch(error => sendResponse({ error: error.message }));
        return true; // Indica resposta assíncrona
    }
});

// Verificação de login
function checkLoginAndNotifyBackground() {
    const userElement = document.getElementById('lnkUsuarioSistema');
    if (userElement && !window.hasSentSEILoadedMessage) {
        chrome.runtime.sendMessage({ action: "seiLoaded" });
        window.hasSentSEILoadedMessage = true;
    }
}

document.addEventListener('DOMContentLoaded', checkLoginAndNotifyBackground);