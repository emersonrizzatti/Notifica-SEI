// background.js (versão com integração da API do Gmail)

console.log("Notifica SEI: Service Worker iniciado!");

// --- CONSTANTES ---
const CHECK_INTERVAL_MINUTES = 10;
const LAST_SEI_DATA_KEY = 'lastSEIData';
const LAST_UPDATES_KEY = 'lastDetectedUpdates';

// --- FUNÇÕES DE NOTIFICAÇÃO ---

/**
 * Envia uma notificação de DESKTOP para o usuário.
 * Esta função permanece inalterada.
 */
function sendDesktopNotification(title, message, updateDetails = null) {
    let notificationMessage = message;
    let notificationUrl = '';

    if (updateDetails) {
        if (updateDetails.notification && updateDetails.notification !== 'N/A') {
            notificationMessage = `🎉 ${updateDetails.notification}`;
            if (updateDetails.processNumber) {
                notificationMessage += `\nProcesso: ${updateDetails.processName || updateDetails.processNumber}`;
            }
            if (updateDetails.processUrl) {
                notificationUrl = updateDetails.processUrl;
            }
        } else {
            notificationMessage = `🎉 Nova atualização em: ${updateDetails.processName || updateDetails.processNumber || 'Desconhecido'}`;
        }
    }

    chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: title,
        message: notificationMessage,
        priority: 2,
        contextMessage: 'Clique aqui para abrir o processo no SEI',
    });
}

/**
 * Listener para o clique na notificação de desktop, que abre o processo.
 */
chrome.notifications.onClicked.addListener((notificationId) => {
    chrome.storage.local.get([LAST_UPDATES_KEY], (result) => {
        const lastUpdate = result[LAST_UPDATES_KEY]?.[0];
        if (lastUpdate?.processUrl) {
            chrome.tabs.create({ url: lastUpdate.processUrl });
        }
    });
});


/**
 * NOVA FUNÇÃO: Envia uma notificação por E-MAIL usando a API do Gmail.
 */
async function sendEmailViaGmailAPI(updateDetails) {
    try {
        // 1. Verifica se o usuário ativou as notificações por e-mail e configurou um endereço
        const settings = await chrome.storage.local.get(['enableEmailNotifications', 'userEmailAddress']);
        if (!settings.enableEmailNotifications || !settings.userEmailAddress) {
            console.log("Notifica SEI: Notificações por e-mail desativadas ou e-mail não configurado.");
            return;
        }

        // 2. Obtém o token de autenticação do Google.
        // O `interactive: false` tenta pegar o token silenciosamente. Se falhar, o usuário precisa autenticar de novo pelo popup.
        const auth = await chrome.identity.getAuthToken({ interactive: false });
        if (!auth || !auth.token) {
            console.error("Notifica SEI: Falha ao obter token do Google. O usuário precisa se autenticar.");
            sendDesktopNotification("Notifica SEI (Erro de E-mail)", "Falha na autenticação com o Google. Por favor, faça login novamente pela extensão.");
            return;
        }

        // 3. Monta o corpo e o assunto do e-mail
        const toEmail = settings.userEmailAddress;
        const subject = `Notifica SEI: Atualização no Processo ${updateDetails.processName || updateDetails.processNumber}`;
        const body = `
            <p>Uma nova atualização foi detectada pela extensão Notifica SEI.</p>
            <p><strong>Mensagem:</strong> ${updateDetails.notification}</p>
            <p><strong>Processo:</strong> ${updateDetails.processName || updateDetails.processNumber}</p>
            <p>Para acessar diretamente o processo no SEI, <a href="${updateDetails.processUrl}">clique aqui</a>.</p>
            <br>
            <p><small><em>E-mail enviado automaticamente pela extensão Notifica SEI.</em></small></p>
        `;

        // 4. Constrói o e-mail no formato MIME (RFC 2822) exigido pela API
        const emailString = [
            `To: ${toEmail}`,
            `Subject: =?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`, // Codifica o assunto para aceitar acentos
            "Content-Type: text/html; charset=utf-8",
            "MIME-Version: 1.0",
            "",
            body
        ].join("\n");

        // 5. Codifica o e-mail em Base64 URL-safe
        const base64Email = btoa(emailString).replace(/\+/g, '-').replace(/\//g, '_');

        // 6. Envia a requisição para a API do Gmail
        const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${auth.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                raw: base64Email
            })
        });

        const data = await response.json();
        if (response.ok) {
            console.log("Notifica SEI: E-mail de notificação enviado com sucesso!", data.id);
        } else {
            console.error("Notifica SEI: Erro retornado pela API do Gmail:", data);
            throw new Error(data.error?.message || "Erro desconhecido da API");
        }
    } catch (error) {
        console.error("Notifica SEI: Falha crítica ao enviar e-mail.", error);
        sendDesktopNotification("Notifica SEI (Erro de E-mail)", `Não foi possível enviar o e-mail de notificação. Detalhes: ${error.message}`);
    }
}


// --- LÓGICA PRINCIPAL DE VERIFICAÇÃO ---

/**
 * Função principal para verificar atualizações.
 * Modificada para incluir a chamada de envio de e-mail.
 */
async function checkForUpdates() {
    console.log(`Notifica SEI: Verificando atualizações no SEI (${new Date().toLocaleTimeString()}).`);

    const seiTabId = await getSEITabId();
    if (!seiTabId) {
        console.log("Notifica SEI: Aba do SEI não encontrada.");
        return;
    }

    try {
        const response = await chrome.tabs.sendMessage(seiTabId, { action: "requestData" });

        if (!response?.data) {
            console.log("Notifica SEI: Nenhuma resposta do content script.");
            return;
        }

        const currentData = JSON.parse(response.data);
        const result = await chrome.storage.local.get([LAST_SEI_DATA_KEY, LAST_UPDATES_KEY]);
        const lastData = result[LAST_SEI_DATA_KEY] ? JSON.parse(result[LAST_SEI_DATA_KEY]) : [];

        if (JSON.stringify(currentData) === JSON.stringify(lastData)) {
            console.log("Notifica SEI: Nenhuma atualização detectada.");
            return;
        }
        
        // Se for a primeira vez rodando, apenas salva os dados e notifica o início.
        if (!lastData.length) {
            await chrome.storage.local.set({ [LAST_SEI_DATA_KEY]: response.data });
            sendDesktopNotification("Notifica SEI", "Monitoramento iniciado. Dados iniciais salvos.");
            return;
        }

        // Lógica de comparação para encontrar atualizações
        const newUpdates = [];
        currentData.forEach(currentProc => {
            const foundInLast = lastData.find(lastProc =>
                lastProc.processNumber === currentProc.processNumber &&
                lastProc.tableId === currentProc.tableId
            );
            if (!foundInLast || (foundInLast.notification !== currentProc.notification)) {
                newUpdates.push({ ...currentProc, timestamp: new Date().toISOString() });
            }
        });

        if (newUpdates.length > 0) {
            console.log(`Notifica SEI: ${newUpdates.length} nova(s) atualização(ões) detectada(s).`);
            const firstUpdate = newUpdates[0];

            // --- PONTO DE AÇÃO ---
            // 1. Envia a notificação de DESKTOP (funcionalidade original)
            sendDesktopNotification("Notifica SEI - Nova Atualização!", "", firstUpdate);

            // 2. Envia a notificação por E-MAIL (nova funcionalidade)
            await sendEmailViaGmailAPI(firstUpdate);
            // --- FIM DO PONTO DE AÇÃO ---

            const lastDetectedUpdates = result[LAST_UPDATES_KEY] || [];
            const updatedList = [...newUpdates, ...lastDetectedUpdates].slice(0, 10);
            await chrome.storage.local.set({
                [LAST_SEI_DATA_KEY]: response.data,
                [LAST_UPDATES_KEY]: updatedList
            });
        }
    } catch (error) {
        console.error("Notifica SEI: Erro ao verificar atualizações:", error);
    }
}

// --- FUNÇÕES AUXILIARES E LISTENERS ---

// Função para obter a aba do SEI (inalterada)
async function getSEITabId() {
    try {
        const tabs = await chrome.tabs.query({ url: "https://sei.unipampa.edu.br/*" });
        return tabs.length > 0 ? tabs[0].id : null;
    } catch (e) { return null; }
}

// Gerenciamento de alarmes (inalterado)
function startMonitoringAlarm() {
    chrome.alarms.create("checkSEIUpdates", {
        periodInMinutes: CHECK_INTERVAL_MINUTES,
        delayInMinutes: 1
    });
    console.log("Notifica SEI: Alarme de monitoramento iniciado.");
}

function stopMonitoringAlarm() {
    chrome.alarms.clear("checkSEIUpdates");
    console.log("Notifica SEI: Alarme de monitoramento parado.");
}

// Listener principal para o alarme (inalterado)
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "checkSEIUpdates") {
        checkForUpdates();
    }
});

// Listener para mensagens do popup e content script (COM ADIÇÕES)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case "startMonitoring":
            startMonitoringAlarm();
            sendResponse({ status: "started" });
            break;

        case "stopMonitoring":
            stopMonitoringAlarm();
            sendResponse({ status: "stopped" });
            break;

        case "clearData":
            chrome.storage.local.remove([LAST_SEI_DATA_KEY, LAST_UPDATES_KEY], () => {
                sendResponse({ status: "cleared" });
            });
            return true; // Resposta assíncrona

        case "manualRefresh":
            checkForUpdates().then(() => sendResponse({ status: "success" }));
            return true; // Resposta assíncrona

        // NOVA AÇÃO: Para o botão "Login com Google" que você irá criar no popup
        case "requestGoogleAuth":
            chrome.identity.getAuthToken({ interactive: true }, (token) => {
                if (chrome.runtime.lastError || !token) {
                    sendResponse({ status: "error", message: chrome.runtime.lastError.message });
                } else {
                    sendResponse({ status: "success", message: "Autenticação com Google bem-sucedida." });
                }
            });
            return true; // Resposta assíncrona
    }
});
