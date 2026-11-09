# Handoff: configurar este PC como host de desenvolvimento remoto

Leia tudo antes de agir. Responda em português. Pergunte antes de qualquer mudança que apague, mova ou sobrescreva arquivos. Nunca peça nem digite senhas, chaves ou tokens: se algo exigir login, diga ao usuário o que fazer.

## Objetivo
Este PC (Windows, i5-14600K, RTX 5060, 32 GB RAM, SSD de 1 TB) vai rodar o trabalho pesado de desenvolvimento do ADT Studio (worktrees, dev servers, builds, testes, agentes Claude Code em tmux). O laptop do usuário (MacBook Air M4, 16 GB, disco quase cheio) só edita e vê o resultado no navegador, por portas encaminhadas pelo Tailscale. O app "Elsewhere" no Mac acorda este PC por Wake-on-LAN, encaminha portas e lista os worktrees.

## Decisões já tomadas
- Ficar no **Windows + WSL2** (Ubuntu). Sem dual boot, sem particionar.
- O PC também é usado para **jogos**: limitar o armazenamento, a CPU e a memória do WSL, e manter jogos fora do ambiente de dev.
- Tudo de dev vive **dentro do WSL, em `~/`** (nunca em `/mnt/c`).
- **Tailscale dentro do WSL**, com Tailscale SSH, hostname `adt-pc`.
- Sem renderizar o Electron no laptop: o navegador do laptop abre o Vite (porta 5173) encaminhado. Testes E2E rodam headless (Playwright, Electron com xvfb) e geram relatório HTML com screenshots.
- Espaço livre no disco do PC: ~200 GB (o usuário está liberando mais). Teto inicial do WSL: **150 GB**.

## O que fazer (nesta ordem, confirmando com o usuário)
1. Verificar: versão do Windows, `wsl --version`, distro (`wsl -l -v`), espaço livre, RAM.
2. `wsl --update`. Criar/atualizar `%UserProfile%\.wslconfig` com `memory=16GB`, `processors=10`, `vmIdleTimeout=-1`, `autoMemoryReclaim=gradual`, `sparseVhd=true` (mostre o arquivo antes de salvar; se já existir, mescle sem perder nada).
3. No Ubuntu: `/etc/wsl.conf` com `[boot] systemd=true`. Depois `wsl --shutdown` e reabrir.
4. Limitar o disco virtual: `wsl --manage <distro> --resize 150GB` (confira que o comando existe nesta versão do WSL antes).
5. Instalar o Tailscale **no WSL** e rodar `sudo tailscale up --ssh --hostname=adt-pc`. O usuário faz o login no navegador.
6. Instalar `tmux`, `git`, Claude Code, nvm/node 22 e pnpm (confira o que já existe). Clonar os repositórios em `~/` (pergunte quais).
7. Iniciar o WSL junto com o Windows: tarefa agendada "ao iniciar o sistema", executando mesmo sem login, com `wsl.exe -d <distro> --exec sleep infinity`. Perguntar sobre login automático do Windows.
8. Wake-on-LAN, no Windows (PowerShell, como administrador; mostre cada comando antes):
   - Descobrir a placa Ethernet e o **endereço MAC** (`Get-NetAdapter`).
   - Placa: "Permitir que este dispositivo ative o computador" e "Somente um pacote mágico" (`Get-NetAdapterPowerManagement` / `Set-NetAdapterPowerManagement`).
   - Desativar a Inicialização Rápida (Fast Startup).
   - Lembrar o usuário de ativar **Wake on LAN** na BIOS e desativar o modo ErP/EuP.
   - Perguntar se prefere deixar o PC **suspenso** ou **desligado** quando não estiver em uso.
9. Instalar Playwright (Chromium) e as dependências do Electron headless (xvfb, libgtk-3, libnss3 etc.) e rodar um teste simples que gera screenshot.

## Ao terminar, informe ao usuário
- O **MAC** da placa Ethernet.
- O hostname do Tailscale (`adt-pc`) e o IP.
- O usuário Linux do WSL.
- Qualquer passo que ele precise fazer na BIOS.
Com esses dados, ele cola o MAC em Elsewhere → Settings → Connection (host "PC") e usa o botão Wake.

## Restrições
- Não apagar nem mover jogos, saves ou arquivos pessoais.
- Não mexer em BIOS nem em configurações de segurança sem o usuário pedir.
- Se um passo falhar, pare e explique, em vez de improvisar.
