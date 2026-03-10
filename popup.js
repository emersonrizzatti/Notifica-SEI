// popup.js (versão com integração completa)
document.addEventListener('DOMContentLoaded', () => {

    // --- Seletores de Elementos ---
    // Credenciais do SEI
    const loginUser = document.getElementById('loginUser');
    const loginPass = document.getElementById('loginPass');
    const saveLoginButton = document.getElementById('saveLogin');
    
    // Notificações por E-mail
    const googleAuthButton = document.getElementById('googleAuth');
    const emailAuthStatus = document.getElementById('emailAuthStatus');
    const userEmailInput = document.getElementById('userEmail');
    const enableEmailsCheckbox = document.getElementById('enableEmails');

    // Controles de Monitoramento
    const statusElement = document.getElementById('status');
    const startButton = document.getElementById('startMonitor');
    const stopButton = document.getElementById('stopMonitor');
    const clearButton = document.getElementById('clearData');
    const autoStartCheckbox = document.getElementById('autoStartMonitor');
    
    // Lista de Atualizações
    const updatesListContainer = document.getElementById('updatesList');

    // --- Chaves do Storage ---
    const CREDENTIALS_KEY = 'seiCredentials';
    const LAST_UPDATES_KEY = 'lastDetectedUpdates';
    const AUTO_START_KEY = 'autoStartMonitoring';
    const EMAIL_NOTIFY_KEY = 'enableEmailNotifications';
    const USER_EMAIL_KEY = 'userEmailAddress';


    // --- Funções Auxiliares ---
    function updateStatus(text) {
        statusElement.textContent = text;
        statusElement.style.color = text === "Ativo" ? "#28a745" : "#dc3545";
    }
    
    function updateEmailStatus(message, isError = false) {
        emailAuthStatus.textContent = message;
        emailAuthStatus.className = isError ? 'status-error' : 'status-success';
    }

    function displayUpdates(updates) {
        updatesListContainer.innerHTML = '';
        const filteredUpdates = updates?.filter(update => update.notification && update.notification !== 'N/A') || [];

        if (filteredUpdates.length === 0) {
            updatesListContainer.innerHTML = '<p>Nenhuma atualização com notificação válida.</p>';
            return;
        }

        filteredUpdates.forEach(update => {
            const item = document.createElement('div');
            item.className = 'update-item';
            item.innerHTML = `
                <p class="message">Mensagem: ${update.notification}</p>
                <p class="process-info">Processo: <a href="${update.processUrl}" target="_blank">${update.processName || update.processNumber}</a></p>
            `;
            updatesListContainer.appendChild(item);
        });
    }


    // --- Carregamento Inicial ---
    // Carrega todos os estados salvos de uma vez ao abrir o popup
    chrome.storage.local.get([
        CREDENTIALS_KEY,
        LAST_UPDATES_KEY,
        AUTO_START_KEY,
        EMAIL_NOTIFY_KEY,
        USER_EMAIL_KEY
    ], (result) => {
        // Credenciais SEI
        if (result[CREDENTIALS_KEY]?.user) {
            loginUser.value = result[CREDENTIALS_KEY].user;
        }
        // Atualizações
        displayUpdates(result[LAST_UPDATES_KEY]);
        // Configurações de monitoramento
        autoStartCheckbox.checked = result[AUTO_START_KEY] || false;
        // Configurações de e-mail
        enableEmailsCheckbox.checked = result[EMAIL_NOTIFY_KEY] || false;
        userEmailInput.value = result[USER_EMAIL_KEY] || '';
    });

    // Verifica o status do alarme
    chrome.alarms.get("checkSEIUpdates", (alarm) => {
        updateStatus(alarm ? "Ativo" : "Inativo");
    });


    // --- Event Listeners ---

    // Seção de Login do SEI
    saveLoginButton.addEventListener('click', () => {
        const user = loginUser.value;
        const pass = loginPass.value;
        if (!user || !pass) {
            alert("Por favor, preencha o usuário e a senha do SEI.");
            return;
        }
        chrome.storage.local.set({ [CREDENTIALS_KEY]: { user, pass } }, () => {
            alert("Credenciais do SEI salvas!");
            loginPass.value = '';
        });
    });

    // Seção de Notificações por E-mail
    googleAuthButton.addEventListener('click', () => {
        updateEmailStatus("Aguardando autorização do Google...", false);
        googleAuthButton.disabled = true;
        chrome.runtime.sendMessage({ action: "requestGoogleAuth" }, (response) => {
            if (response.status === "success") {
                updateEmailStatus("Autenticado com sucesso!", false);
            } else {
                updateEmailStatus(`Erro: ${response.message}`, true);
            }
            googleAuthButton.disabled = false;
        });
    });

    enableEmailsCheckbox.addEventListener('change', () => {
        chrome.storage.local.set({ [EMAIL_NOTIFY_KEY]: enableEmailsCheckbox.checked });
    });

    userEmailInput.addEventListener('input', () => {
        chrome.storage.local.set({ [USER_EMAIL_KEY]: userEmailInput.value });
    });


    // Seção de Controle do Monitoramento
    startButton.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: "startMonitoring" }, (response) => {
            if (response?.status === "started") updateStatus("Ativo");
        });
    });

    stopButton.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: "stopMonitoring" }, (response) => {
            if (response?.status === "stopped") updateStatus("Inativo");
        });
    });

    clearButton.addEventListener('click', () => {
        if (confirm("Tem certeza que deseja limpar os dados de processos salvos?")) {
            chrome.runtime.sendMessage({ action: "clearData" }, (response) => {
                if (response?.status === "cleared") {
                    alert("Dados limpos.");
                    displayUpdates([]);
                }
            });
        }
    });

    autoStartCheckbox.addEventListener('change', () => {
        chrome.storage.local.set({ [AUTO_START_KEY]: autoStartCheckbox.checked });
    });

});
