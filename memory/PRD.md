# Shinobi Arena — Naruto Card Game

Mobile-first React Native (Expo) prototype, 100% local (sem servidor/backend), seguindo o documento de requisitos.

## Stack
- Expo SDK 54 + expo-router (file-based routing)
- AsyncStorage para persistência local
- expo-image-picker (galeria; permissão de fotos)
- expo-linear-gradient para o visual premium ninja

## Telas
- `/` Home — SHINOBI ARENA, perfil resumido, botões: Criar/Editar Perfil, Arena, Menu Card, Modo Online (em breve)
- `/profile` — Foto (galeria), nome, vila (Yukigakure / Tsukigakure / Takigakure)
- `/menu-card` — Abas "Cards" e "O C.T"
- `/card-edit` — Criar/editar Card (custo, aumento, atributo ilimitado)
- `/ct-edit` — Criar/editar O C.T (rank E..S, atributos, ilimitado)
- `/arena` — Configuração de batalha (1x1...3x3, *xBoss, tempo por turno)
- `/battle` — Apresentação, sistema de turnos, timer reset por turno, modal de jogada (cards → edição → O C.T → edição → envio), histórico tipo chat, Morte/Desistir/Encerrar

## Modo Online 1x1 (adicionado em iteração 2)

- **Backend FastAPI:** WebSocket `/api/ws/{code}` + `POST /api/rooms` (cria sala em memória) + `GET /api/rooms/{code}` (verifica). Salas vivem em memória apenas (sem MongoDB), limpeza automática de salas vazias com >1h.
- **Protocolo:** Cliente envia primeiro `{type:'hello', role, player}`. Depois `{type:'relay', payload}` é encaminhado ao oponente. Servidor notifica `opponent_joined`/`opponent_disconnected`/`error{code:'not_found'|'full'}`.
- **Telas novas:** `/online` (lobby Criar/Entrar) e `/online-battle` (apresentação 1x1, batalha sincronizada, modal de jogada idêntica ao local).
- **Sincronização:** Cada cliente envia jogada completa (cards + O C.T + atributos finais já calculados) via relay. Host decide ordem inicial (Rank > Ag > random) e envia `start_decision`. Timer roda local no jogador da vez e faz broadcast a cada ~3s para sincronizar o adversário.
- **Sem regressão:** Teste Local (battle.tsx, arena.tsx, etc) não foi alterado.

