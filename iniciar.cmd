@echo off
rem Radar IA: sobe a versao de producao em http://127.0.0.1:3000
rem (so neste PC; nao exponha na rede). Feche a janela para parar.
cd /d "%~dp0"
if not exist dist\index.js (
  echo Gerando o build pela primeira vez...
  call pnpm build || exit /b 1
)
start "" http://127.0.0.1:3000
call pnpm start
