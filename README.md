# Cadastro de Participantes da Reunião Vida e Ministério (RVM)

Este repositório contém módulos em Python e em JavaScript/HTML/CSS para gerenciar o cadastro de participantes da Reunião Vida e Ministério (RVM). O módulo web utiliza armazenamento local do navegador para facilitar o cadastro visual e gerar ajustes de programação.

## Estrutura

- `src/rvm/participants.py` — Implementação principal do módulo de cadastro e ajustes.
- `tests/test_participants.py` — Testes unitários (Python) cobrindo fluxo principal de cadastro e geração de ajustes.
- `web/` — Interface web estática com armazenamento local (`index.html`, `styles.css`, `scripts/`).
- `web/tests/registry.test.js` — Testes automatizados (Node.js) para validar o registro de participantes e geração de ajustes.

## Como executar os testes

```powershell
$env:PYTHONPATH = "$(Get-Location)\src"
python -m unittest discover -s tests -p "test_*.py"
```

```powershell
npm test
```

> O comando `npm test` utiliza o runner nativo do Node.js (`node --test`) para validar as regras de cadastro, geração de listas por objetivo e critérios de ajuste da programação no módulo JavaScript.

## Como usar a interface web

1. Abra `web/index.html` no navegador (Edge, Chrome ou equivalente).
2. Cadastre novos participantes escolhendo classificação, objetivos e status.
3. Acompanhe listas separadas por objetivo e atualize ausências/substituições em tempo real.
4. Gere recomendações de ajustes informando data, objetivo e demanda especial.

Os dados são persistidos automaticamente em `localStorage` e já contam com um conjunto inicial de exemplos para exploração.

## Próximos passos sugeridos

- Fornecer exportação/importação do cadastro para facilitar backups.
- Integrar controle das partes designadas na reunião.
- Conectar a interface web com o módulo Python para sincronização entre dispositivos.
