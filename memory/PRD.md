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

## Regras críticas implementadas
- Imagem via galeria salva como base64 dataURI
- Custo/Aumento calculados sobre os atributos do C.T enviado
- Atributos ilimitados exibidos como "ilimitado" (nunca Infinity/NaN/undefined)
- Edição de Card/O C.T durante a jogada NÃO altera o salvo
- Histórico estilo WhatsApp (Time 1 à direita, Time 2/Boss à esquerda)
- Timer reseta a cada vez do jogador; Boss não usa timer
- Apresentação: maior Rank começa → maior Ag → random
