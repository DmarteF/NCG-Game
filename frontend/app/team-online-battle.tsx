import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Screen from '../src/components/Screen';
import Button from '../src/components/Button';
import Input from '../src/components/Input';
import ZoomableImageModal from '../src/components/ZoomableImageModal';
import { ctDisplayName, formatNumberBR, formatSpeed } from '../src/format';
import { TeamParticipant, TeamRoomClient, TeamWSEvent } from '../src/online';
import { withRemoteImageCard, withRemoteImageCT } from '../src/remoteImages';
import { Storage, uid } from '../src/storage';
import { ATTRS, Attr, CARD_RANK_ORDER, CardRank, theme } from '../src/theme';
import { BattleEntity, BossDifficulty, Card, CT, MatchType, MomentaryAction, PlayedCard } from '../src/types';
import { Header } from './profile';
import { PlayModal } from './battle';
import { BossState, bossCardToSnapshot, createBossCT, createKaelzorState } from '../src/bossData';
import { PlayerActionAnalysis, resolveBossAttack, resolveBossDefense } from '../src/bossRules';
import { calculationDetailsFor } from '../src/historyExport';

type Team = 'team1' | 'team2';
type TeamMsg = {
  id: string;
  team: Team | 'system';
  player?: string;
  turn: number;
  text?: string;
  playedCards?: PlayedCard[];
  ctSnapshot?: CT;
  finalAttrs?: Record<Attr, number | 'ilimitado'>;
  calculationDetails?: string[];
  timestamp: number;
};
type PendingOnlineBossAttack = {
  card: Card;
  damagePossible: number;
  speed?: Card['speed'];
  targets: number;
  costText: string;
  turn: number;
  targetPlayerId: string;
};

const TEAM_MATCHES: MatchType[] = ['1x2', '2x2', '2x3', '3x3'];
const emptyOnlineAttrs = (): Record<Attr, number> => ({ Atk: 0, Def: 0, Dur: 0, Ag: 0, Ck: 0, Hp: 0 });
const ctToOnlineAttrs = (ct: CT): Record<Attr, number> => ({ ...emptyOnlineAttrs(), ...ct.attrs, Dur: 0 });
const allBossPlayersDefeated = (ctMap: Record<string, CT>, participants: TeamParticipant[]) => participants
  .filter(p => p.role !== 'spectator' && p.team === 'team1')
  .every(p => Number(ctMap[p.id]?.attrs.Hp || 0) <= 0);

export default function TeamOnlineBattle() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    code: string; matchType: MatchType; turnMinutes: string; playerName: string; playerVillage: string; playerImage?: string; bossDifficulty?: BossDifficulty;
    team?: Team; leader?: string; bossMode?: string;
    spectator?: string;
  }>();
  const code = String(params.code || '');
  const matchType = (params.matchType || '2x2') as MatchType;
  const bossMode = params.bossMode === '1' || String(matchType).includes('Boss');
  const bossDifficulty = params.bossDifficulty || 'facil';
  const bossMaxRank: Record<BossDifficulty, CardRank> = { facil: 'B', medio: 'A', dificil: 'S', impossivel: 'S' };
  const turnMinutes = bossMode ? 30 : parseInt(String(params.turnMinutes || '20'), 10);
  const myId = useMemo(() => uid(), []);
  const myTeam = (params.team || 'team1') as Team;
  const isLeader = params.leader === '1';
  const isSpectator = params.spectator === '1';
  const me: TeamParticipant = useMemo(() => ({
    id: myId,
    name: String(params.playerName || 'Jogador'),
    village: String(params.playerVillage || '—'),
    image: params.playerImage || undefined,
    team: myTeam,
    leader: isLeader && !isSpectator,
    role: isSpectator ? 'spectator' : 'player',
  }), [isLeader, isSpectator, myId, myTeam, params.playerImage, params.playerName, params.playerVillage]);
  const expectedPlayers = useMemo(() => {
    const [left, right] = matchType.split('x');
    const leftCount = Number(left) || 1;
    if (bossMode) return Math.max(1, Math.min(3, leftCount));
    return Math.max(2, leftCount + (Number(right) || 1));
  }, [bossMode, matchType]);

  const [connStatus, setConnStatus] = useState<'connecting' | 'connected' | 'lost' | 'error'>('connecting');
  const [participants, setParticipants] = useState<TeamParticipant[]>([]);
  const [cts, setCTs] = useState<CT[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [myCT, setMyCT] = useState<CT | null>(null);
  const [ctByPlayer, setCtByPlayer] = useState<Record<string, CT>>({});
  const [started, setStarted] = useState(false);
  const [currentTeam, setCurrentTeam] = useState<Team | 'boss'>('team1');
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const [turn, setTurn] = useState(1);
  const [ended, setEnded] = useState(false);
  const [bossState, setBossState] = useState<BossState>(() => createKaelzorState(bossDifficulty));
  const [pendingBossAttacks, setPendingBossAttacks] = useState<Record<string, PendingOnlineBossAttack>>({});
  const [messages, setMessages] = useState<TeamMsg[]>([]);
  const [chatText, setChatText] = useState('');
  const [playOpen, setPlayOpen] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  const clientRef = useRef<TeamRoomClient | null>(null);
  const listRef = useRef<FlatList<TeamMsg> | null>(null);
  const lastActionAtRef = useRef(0);
  const lastChatAtRef = useRef(0);
  const participantsRef = useRef<TeamParticipant[]>([]);
  const ctByPlayerRef = useRef<Record<string, CT>>({});
  const bossStateRef = useRef<BossState>(bossState);
  const pendingBossAttacksRef = useRef<Record<string, PendingOnlineBossAttack>>({});

  useEffect(() => { participantsRef.current = participants; }, [participants]);
  useEffect(() => { ctByPlayerRef.current = ctByPlayer; }, [ctByPlayer]);
  useEffect(() => { bossStateRef.current = bossState; }, [bossState]);
  useEffect(() => { pendingBossAttacksRef.current = pendingBossAttacks; }, [pendingBossAttacks]);

  useEffect(() => {
    Storage.getCTs().then(setCTs);
    Storage.getCards().then(setCards);
  }, []);

  useEffect(() => {
    const client = new TeamRoomClient();
    clientRef.current = client;
    client.onOpen = () => setConnStatus('connected');
    client.onClose = () => { if (!client.closedByUser) setConnStatus('lost'); };
    client.onEvent = handleEvent;
    client.connect(code, me, isSpectator ? 'spectator' : 'player');
    return () => client.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, myId]);

  useEffect(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
  }, [messages.length]);

  const relay = (payload: any) => clientRef.current?.sendRelay(payload);

  const handleEvent = (event: TeamWSEvent) => {
    if (event.type === 'team_ready') {
      participantsRef.current = event.participants;
      setParticipants(event.participants);
      setConnStatus('connected');
    } else if (event.type === 'participant_joined') {
      participantsRef.current = event.participants;
      setParticipants(event.participants);
      setMessages((items) => [...items, { id: uid(), team: 'system', turn, text: `${event.participant.name} entrou na sala.`, timestamp: Date.now() }]);
    } else if (event.type === 'participant_left') {
      participantsRef.current = event.participants;
      setParticipants(event.participants);
      setMessages((items) => [...items, { id: uid(), team: 'system', turn, text: 'Um jogador saiu da sala.', timestamp: Date.now() }]);
    } else if (event.type === 'team_relay') {
      const payload = event.payload || {};
      if (payload.sourceId === myId) return;
      if (payload.action === 'initial_ct') {
        setCtByPlayer((map) => {
          const next = { ...map, [payload.playerId]: payload.ct };
          ctByPlayerRef.current = next;
          return next;
        });
      } else if (payload.action === 'start_team') {
        setStarted(true);
        setEnded(false);
        setCurrentTeam(payload.currentTeam);
        setCurrentPlayerId(payload.currentPlayerId || null);
        setTurn(payload.turn || 1);
        if (payload.bossState) {
          bossStateRef.current = payload.bossState;
          setBossState(payload.bossState);
        }
        setMessages((items) => [...items, { id: uid(), team: 'system', turn: payload.turn || 1, text: payload.text, timestamp: Date.now() }]);
      } else if (payload.action === 'play') {
        if (payload.playerId && payload.ct) setCtByPlayer((map) => {
          const next = { ...map, [payload.playerId]: payload.ct };
          ctByPlayerRef.current = next;
          return next;
        });
        if (payload.bossState) {
          bossStateRef.current = payload.bossState;
          setBossState(payload.bossState);
        }
        if (payload.pendingBossAttacks) {
          pendingBossAttacksRef.current = payload.pendingBossAttacks;
          setPendingBossAttacks(payload.pendingBossAttacks);
        }
        setMessages((items) => [
          ...items,
          { id: uid(), team: payload.team, player: payload.playerName, turn: payload.turn, playedCards: payload.cards, ctSnapshot: payload.ct, finalAttrs: payload.finalAttrs, text: payload.observation, calculationDetails: payload.calculationDetails, timestamp: Date.now() },
          ...(payload.extraMessages || []).map((msg: TeamMsg) => ({ ...msg, id: uid(), timestamp: Date.now() })),
        ]);
        if (payload.endText) finishBattle(payload.endText, false);
        else advanceAfter(payload.team, payload.playerId);
      } else if (payload.action === 'pass') {
        if (payload.ct) setCtByPlayer((map) => {
          const next = { ...map, [payload.playerId]: payload.ct };
          ctByPlayerRef.current = next;
          return next;
        });
        if (payload.pendingBossAttacks) {
          pendingBossAttacksRef.current = payload.pendingBossAttacks;
          setPendingBossAttacks(payload.pendingBossAttacks);
        }
        setMessages((items) => [...items, { id: uid(), team: 'system', turn: payload.turn, text: `${payload.playerName} passou pelo time.`, timestamp: Date.now() }]);
        if (payload.extraMessages) setMessages((items) => [...items, ...payload.extraMessages.map((msg: TeamMsg) => ({ ...msg, id: uid(), timestamp: Date.now() }))]);
        if (payload.endText) finishBattle(payload.endText, false);
        else advanceAfter(payload.team, payload.playerId);
      } else if (payload.action === 'chat') {
        setMessages((items) => [...items, { id: uid(), team: payload.team, player: payload.playerName, turn: payload.turn || turn, text: payload.text, timestamp: payload.timestamp || Date.now() }]);
      } else if (payload.action === 'boss_action') {
        if (payload.bossState) {
          bossStateRef.current = payload.bossState;
          setBossState(payload.bossState);
        }
        if (payload.pendingBossAttacks) {
          pendingBossAttacksRef.current = payload.pendingBossAttacks;
          setPendingBossAttacks(payload.pendingBossAttacks);
        }
        setMessages((items) => [...items, payload.message]);
        setCurrentTeam('team1');
        setCurrentPlayerId(payload.nextPlayerId || null);
      } else if (payload.action === 'battle_end') {
        finishBattle(payload.text, false);
      }
    } else if (event.type === 'error') {
      setConnStatus('error');
      Alert.alert('Erro', event.message || 'Erro na sala.');
    }
  };

  const confirmCT = async (ct: CT) => {
    if (bossMode) {
      const maxRank = bossMaxRank[bossDifficulty];
      if (CARD_RANK_ORDER[ct.rank as CardRank] > CARD_RANK_ORDER[maxRank]) {
        Alert.alert('Dificuldade inválida', `Esta dificuldade permite apenas C.T até Rank ${maxRank}. Rank SS é exclusivo do Boss. Jogadores podem usar no máximo Rank S.`);
        if (myCT?.id === ct.id) setMyCT(null);
        return;
      }
    }
    setMyCT(ct);
    setCtByPlayer((map) => {
      const next = { ...map, [myId]: ct };
      ctByPlayerRef.current = next;
      return next;
    });
    relay({ action: 'initial_ct', sourceId: myId, playerId: myId, ct: await withRemoteImageCT(ct) });
  };

  const teamAg = (team: Team) => participants.filter(p => p.role !== 'spectator' && p.team === team).reduce((sum, p) => sum + Number(ctByPlayer[p.id]?.attrs.Ag || 0), 0);
  const pickStarter = (): Team | 'boss' => {
    if (bossMode) return 'boss';
    if (matchType === '1x2') return 'team1';
    const ag1 = teamAg('team1');
    const ag2 = teamAg('team2');
    if (ag1 !== ag2) return ag1 > ag2 ? 'team1' : 'team2';
    return Math.random() < 0.5 ? 'team1' : 'team2';
  };

  const startMatch = () => {
    if (isSpectator) return Alert.alert('Espectador', 'Espectadores não podem iniciar a luta.');
    if (!myCT) return Alert.alert('Atenção', 'Confirme seu O C.T inicial.');
    const players = participants.filter(p => p.role !== 'spectator');
    if (players.length < expectedPlayers) return Alert.alert('Aguardando', `Este modo precisa de ${expectedPlayers} jogador(es) conectado(s).`);
    const missing = players.filter(p => !ctByPlayer[p.id]);
    if (missing.length > 0) return Alert.alert('Aguardando', 'Todos os jogadores conectados precisam confirmar O C.T.');
    if (bossMode) {
      const maxRank = bossMaxRank[bossDifficulty];
      const invalid = players.find(p => CARD_RANK_ORDER[(ctByPlayer[p.id]?.rank || 'E') as CardRank] > CARD_RANK_ORDER[maxRank]);
      if (invalid) return Alert.alert('Dificuldade inválida', `${invalid.name} precisa trocar o C.T. Esta dificuldade permite apenas C.T até Rank ${maxRank}. Rank SS é exclusivo do Boss. Jogadores podem usar no máximo Rank S.`);
    }
    const starter = pickStarter();
    const freshBoss = createKaelzorState(bossDifficulty);
    const firstPlayer = starter === 'boss' ? null : firstPlayerForTeam(starter);
    const text = starter === 'boss'
      ? 'Kael’Zor começa. O Fragmento do Vazio já está ativo e a ação do Boss será sincronizada pela sala.'
      : `${starter === 'team1' ? 'Time 1' : 'Time 2'} começa. AG total: Time 1 ${formatNumberBR(teamAg('team1'))} • Time 2 ${formatNumberBR(teamAg('team2'))}.`;
    setStarted(true);
    setEnded(false);
    bossStateRef.current = freshBoss;
    pendingBossAttacksRef.current = {};
    setBossState(freshBoss);
    setPendingBossAttacks({});
    setCurrentTeam(starter);
    setCurrentPlayerId(firstPlayer?.id || null);
    setMessages((items) => [...items, { id: uid(), team: 'system', turn: 1, text, timestamp: Date.now() }]);
    relay({ action: 'start_team', sourceId: myId, currentTeam: starter, currentPlayerId: firstPlayer?.id || null, turn: 1, text, bossState: freshBoss });
    if (starter === 'boss') {
      setTimeout(() => runOnlineBossTurn(1, freshBoss, ctByPlayerRef.current, participantsRef.current), 300);
    }
  };

  const canAct = () => {
    if (isSpectator) return false;
    if (!started) return false;
    if (ended) return false;
    if (currentTeam === 'boss') return false;
    return currentTeam === myTeam && (!currentPlayerId || currentPlayerId === myId);
  };

  const enforceCooldown = () => {
    const now = Date.now();
    if (now - lastActionAtRef.current < 2000) {
      Alert.alert('Aguarde', 'Cooldown de 2 segundos.');
      return false;
    }
    lastActionAtRef.current = now;
    return true;
  };

  const playersForTeam = (team: Team, ctMap = ctByPlayerRef.current, roomParticipants = participantsRef.current) => roomParticipants
    .filter(p => p.role !== 'spectator' && p.team === team && Number(ctMap[p.id]?.attrs.Hp ?? 1) > 0);
  const firstPlayerForTeam = (team: Team) => playersForTeam(team)[0];
  const nextBossPlayerAfter = (playerId: string | null) => {
    const players = playersForTeam('team1');
    if (!playerId) return players[0];
    const index = players.findIndex(p => p.id === playerId);
    return index >= 0 ? players[index + 1] : players[0];
  };

  const advanceAfter = (team: Team, playerId?: string) => {
    if (bossMode) {
      const nextPlayer = nextBossPlayerAfter(playerId || currentPlayerId);
      if (nextPlayer) {
        setCurrentTeam('team1');
        setCurrentPlayerId(nextPlayer.id);
        return;
      }
      setCurrentTeam('boss');
      setCurrentPlayerId(null);
      setTurn((value) => value + 1);
      setTimeout(() => {
        if (isLeader) runOnlineBossTurn(turn + 1, bossStateRef.current, ctByPlayerRef.current, participantsRef.current);
      }, 300);
      return;
    }
    const nextTeam = team === 'team1' ? 'team2' : 'team1';
    setCurrentTeam(nextTeam);
    setCurrentPlayerId(firstPlayerForTeam(nextTeam)?.id || null);
    setTurn((value) => value + 1);
  };

  const sendPlay = async (
    playedCards: PlayedCard[],
    ctSnap: CT,
    observation: string,
    finalAttrs: Record<Attr, number | 'ilimitado'>,
    _keptActiveEffectIds: string[] = [],
    _activeEntity?: BattleEntity,
    _finalEntityAttrs?: Record<Attr, number | 'ilimitado'>,
    momentaryActions: MomentaryAction[] = [],
  ) => {
    if (!myCT || !canAct() || !enforceCooldown()) return;
    const selectedCards = playedCards.map(item => item.cardSnapshot);
    const text = `${observation} ${selectedCards.map(card => `${card.name} ${card.caption}`).join(' ')}`.toLowerCase();
    const hasForbiddenFirstTurn = turn === 1 && (
      selectedCards.some(card => Object.values(card.unlimited || {}).some(Boolean))
      || text.includes('genjutsu')
      || text.includes('hp: 0')
      || text.includes('te mato')
      || text.includes('sem chance de defesa')
    );
    if (hasForbiddenFirstTurn) {
      Alert.alert('Regra do primeiro turno', 'Ações ilimitadas, genjutsu e finalizações declaradas ficam bloqueadas/preparadas no primeiro turno online.');
      return;
    }
    if (bossMode) {
      const maxRank = bossMaxRank[bossDifficulty];
      const invalidCard = selectedCards.find(card => CARD_RANK_ORDER[card.rank as CardRank] > CARD_RANK_ORDER[maxRank]);
      if (invalidCard) return Alert.alert('Dificuldade inválida', invalidCard.rank === 'SS' ? 'Rank SS é exclusivo do Boss. Jogadores podem usar no máximo Rank S.' : `${invalidCard.name} está acima do Rank ${maxRank}.`);
    }
    const numericAttrs = ATTRS.reduce((acc, attr) => {
      const value = finalAttrs[attr];
      acc[attr] = typeof value === 'number' ? value : (myCT.attrs[attr] || 0);
      return acc;
    }, {} as Record<Attr, number>);
    const nextCT = { ...ctSnap, attrs: numericAttrs };
    setMyCT(nextCT);
    setCtByPlayer((map) => {
      const next = { ...map, [myId]: nextCT };
      ctByPlayerRef.current = next;
      return next;
    });
    const played = await Promise.all(selectedCards.map(async card => ({ cardSnapshot: await withRemoteImageCard(card) })));
    let extraMessages: TeamMsg[] = [];
    let nextBoss = bossStateRef.current;
    let nextPending = { ...pendingBossAttacksRef.current };
    let finalCT = nextCT;
    let resolvedFinalAttrs = finalAttrs;
    let endText = '';
    if (bossMode) {
      const pending = nextPending[myId];
      if (pending) {
        const pendingResult = resolveOnlinePendingBossAttack(pending, selectedCards, observation, resolvedFinalAttrs);
        resolvedFinalAttrs = pendingResult.nextAttrs;
        finalCT = { ...nextCT, attrs: ATTRS.reduce((acc, attr) => ({ ...acc, [attr]: typeof resolvedFinalAttrs[attr] === 'number' ? resolvedFinalAttrs[attr] as number : nextCT.attrs[attr] || 0 }), {} as Record<Attr, number>) };
        delete nextPending[myId];
        extraMessages.push(pendingResult.message);
        const updatedMap = { ...ctByPlayerRef.current, [myId]: finalCT };
        if (pendingResult.defeated && allBossPlayersDefeated(updatedMap, participantsRef.current)) endText = 'Kael’Zor venceu.';
      }
      if (!endText) {
        const bossDefense = resolveBossDefense(nextBoss, selectedCards.map(card => ({ cardSnapshot: card })), observation, resolvedFinalAttrs, momentaryActions);
        nextBoss = bossDefense.boss;
        const bossCT = createBossCT(nextBoss);
        const defenseExtra = `ENE restante: ${formatNumberBR(nextBoss.stats.Ene)}\nDano recebido: ${formatNumberBR(bossDefense.damageTaken)}\nHP restante do Boss: ${formatNumberBR(nextBoss.stats.Hp)}`;
        const defenseCard = bossDefense.card ? bossCardToSnapshot(bossDefense.card, defenseExtra) : undefined;
        const defenseMsg: TeamMsg = {
          id: uid(),
          team: defenseCard ? 'team2' : 'system',
          turn,
          text: bossDefense.lines.join('\n'),
          playedCards: defenseCard ? [{ cardSnapshot: defenseCard }] : undefined,
          ctSnapshot: defenseCard ? bossCT : undefined,
          finalAttrs: defenseCard ? ctToOnlineAttrs(bossCT) : undefined,
          calculationDetails: defenseCard ? calculationDetailsFor({ playedCards: [{ cardSnapshot: defenseCard }], ctSnapshot: bossCT, finalAttrs: ctToOnlineAttrs(bossCT) }) : undefined,
          timestamp: Date.now(),
        };
        extraMessages.push(defenseMsg);
        if (bossDefense.defeated) endText = 'Kael’Zor foi derrotado. Os jogadores venceram.';
      }
      bossStateRef.current = nextBoss;
      pendingBossAttacksRef.current = nextPending;
      setBossState(nextBoss);
      setPendingBossAttacks(nextPending);
    }
    setMyCT(finalCT);
    setCtByPlayer((map) => {
      const next = { ...map, [myId]: finalCT };
      ctByPlayerRef.current = next;
      return next;
    });
    const msg: TeamMsg = { id: uid(), team: myTeam, player: me.name, turn, playedCards: selectedCards.map(card => ({ cardSnapshot: card })), ctSnapshot: finalCT, finalAttrs: resolvedFinalAttrs, text: observation, timestamp: Date.now() };
    msg.calculationDetails = calculationDetailsFor(msg);
    setMessages((items) => [...items, msg, ...extraMessages]);
    relay({ action: 'play', sourceId: myId, team: myTeam, playerId: myId, playerName: me.name, turn, cards: played, ct: await withRemoteImageCT(finalCT), finalAttrs: resolvedFinalAttrs, observation, calculationDetails: msg.calculationDetails, extraMessages, bossState: nextBoss, pendingBossAttacks: nextPending, endText });
    setPlayOpen(false);
    if (endText) finishBattle(endText);
    else advanceAfter(myTeam, myId);
  };

  const sendPass = async () => {
    if (!canAct() || !enforceCooldown()) return;
    let nextPending = { ...pendingBossAttacksRef.current };
    let nextCT = myCT;
    let extraMessages: TeamMsg[] = [];
    let endText = '';
    const pending = bossMode ? nextPending[myId] : undefined;
    if (pending && myCT) {
      const pendingResult = resolveOnlinePendingBossAttack(pending, [], 'Jogador passou o turno.', myCT.attrs);
      nextCT = { ...myCT, attrs: ATTRS.reduce((acc, attr) => ({ ...acc, [attr]: typeof pendingResult.nextAttrs[attr] === 'number' ? pendingResult.nextAttrs[attr] as number : myCT.attrs[attr] || 0 }), {} as Record<Attr, number>) };
      delete nextPending[myId];
      extraMessages.push(pendingResult.message);
      setMyCT(nextCT);
      setCtByPlayer((map) => {
        const next = { ...map, [myId]: nextCT! };
        ctByPlayerRef.current = next;
        return next;
      });
      pendingBossAttacksRef.current = nextPending;
      setPendingBossAttacks(nextPending);
      const updatedMap = { ...ctByPlayerRef.current, [myId]: nextCT };
      if (pendingResult.defeated && allBossPlayersDefeated(updatedMap, participantsRef.current)) endText = 'Kael’Zor venceu.';
    }
    setMessages((items) => [...items, { id: uid(), team: 'system', turn, text: `${me.name} passou pelo time.`, timestamp: Date.now() }, ...extraMessages]);
    relay({ action: 'pass', sourceId: myId, team: myTeam, playerId: myId, playerName: me.name, turn, ct: nextCT ? await withRemoteImageCT(nextCT) : undefined, pendingBossAttacks: nextPending, extraMessages, endText });
    if (endText) finishBattle(endText);
    else advanceAfter(myTeam, myId);
  };

  const finishBattle = (text: string, broadcast = true) => {
    setEnded(true);
    setStarted(true);
    setCurrentTeam('team1');
    setCurrentPlayerId(null);
    setMessages((items) => {
      if (items.some(item => item.text === text)) return items;
      const next = [...items, { id: uid(), team: 'system' as const, turn, text, timestamp: Date.now() }];
      Storage.appendHistory({
        id: uid(),
        endedAt: Date.now(),
        result: text,
        messages: next,
        config: { matchType, turnMinutes: bossMode ? null : turnMinutes, startedAt: Date.now(), bossDifficulty: bossMode ? bossDifficulty : undefined },
      });
      return next;
    });
    if (broadcast) relay({ action: 'battle_end', sourceId: myId, text });
  };

  const buildBossFieldAnalysis = (boss: BossState, alive: TeamParticipant[], ctMap: Record<string, CT>): PlayerActionAnalysis => {
    const lowestHp = alive.reduce((min, p) => Math.min(min, Number(ctMap[p.id]?.attrs.Hp || 0)), Number.POSITIVE_INFINITY);
    const memory = boss.bossMemory;
    return {
      isAttack: (memory?.lastDamageTaken || 0) > 0,
      isDefense: false,
      isGenjutsu: !!memory?.playerUsesGenjutsu,
      isSealing: false,
      isArea: alive.length > 1 || !!memory?.playerUsesClones,
      isInstant: false,
      declaredKill: false,
      cloneCount: memory?.playerUsesClones ? Math.max(alive.length, 3) : alive.length,
      declaredTargets: Math.max(1, alive.length),
      maxSpeed: undefined,
      attackPower: memory?.lastDamageTaken || 0,
      defensePower: 0,
      directHpThreat: (memory?.threatScore || 0) >= 8,
      hybridEvasion: false,
      flying: false,
      far: false,
      protectedByClones: !!memory?.playerUsesClones,
      activeMode: !!memory?.playerUsesStrongMode,
      text: alive.map(p => `${p.name} HP ${ctMap[p.id]?.attrs.Hp || 0}`).join(' ') + ` menor HP ${Number.isFinite(lowestHp) ? lowestHp : 0}`,
    };
  };

  const chooseBossTargets = (alive: TeamParticipant[], ctMap: Record<string, CT>, maxTargets: number) => {
    return [...alive]
      .sort((a, b) => {
        const hpA = Number(ctMap[a.id]?.attrs.Hp || 0);
        const hpB = Number(ctMap[b.id]?.attrs.Hp || 0);
        if (hpA !== hpB) return hpA - hpB;
        return alive.indexOf(a) - alive.indexOf(b);
      })
      .slice(0, Math.max(1, Math.min(alive.length, maxTargets)));
  };

  const runOnlineBossTurn = async (bossTurn: number, sourceBoss: BossState, ctMap: Record<string, CT>, roomParticipants: TeamParticipant[]) => {
    if (!bossMode || !isLeader || ended) return;
    const alive = roomParticipants
      .filter(p => p.role !== 'spectator' && p.team === 'team1' && Number(ctMap[p.id]?.attrs.Hp ?? 1) > 0);
    if (alive.length === 0) {
      finishBattle('Kael’Zor venceu.');
      return;
    }
    const fieldAnalysis = buildBossFieldAnalysis(sourceBoss, alive, ctMap);
    const target = chooseBossTargets(alive, ctMap, 1)[0];
    const targetCT = ctMap[target.id];
    const attack = resolveBossAttack(sourceBoss, targetCT, targetCT?.attrs || emptyOnlineAttrs(), fieldAnalysis);
    const nextBoss = attack.boss;
    const bossCT = createBossCT(nextBoss);
    const bossExtra = attack.card?.kind === 'attack' || attack.card?.kind === 'charge'
      ? `ATK base do card: ${formatNumberBR(attack.card.atk)}\nATK final: ${formatNumberBR(attack.card.atk)}\nENE restante: ${formatNumberBR(nextBoss.stats.Ene)}\nDano possível: ${formatNumberBR(attack.damagePossible)}\nAguardando resposta do jogador.`
      : `ENE restante: ${formatNumberBR(nextBoss.stats.Ene)}\nAguardando resposta do jogador.`;
    const bossCards = (attack.cards?.length ? attack.cards : attack.card ? [attack.card] : [])
      .map(card => bossCardToSnapshot(card, card.id === attack.card?.id ? bossExtra : `ENE restante: ${formatNumberBR(nextBoss.stats.Ene)}`));
    const bossCard = bossCards.find(card => card.id === attack.card?.id);
    const targets = attack.card?.kind === 'attack' || attack.card?.kind === 'charge'
      ? chooseBossTargets(alive, ctMap, attack.card.maxTargets || 1)
      : [];
    const nextPending = { ...pendingBossAttacksRef.current };
    if ((attack.card?.kind === 'attack' || attack.card?.kind === 'charge') && bossCard && attack.damagePossible > 0) {
      const costText = Object.entries(attack.card.cost || {}).map(([attr, value]) => `${attr}: ${formatNumberBR(value)}`).join(' • ');
      targets.forEach((player) => {
        const playerDef = Number(ctMap[player.id]?.attrs.Def || 0);
        const damagePossible = Math.max(0, Number(attack.card?.atk || 0) - playerDef);
        nextPending[player.id] = {
          card: bossCard,
          damagePossible,
          speed: attack.card?.speed,
          targets: attack.card?.maxTargets || 1,
          costText,
          turn: bossTurn,
          targetPlayerId: player.id,
        };
      });
    }
    const msg: TeamMsg = {
      id: uid(),
      team: 'team2',
      turn: bossTurn,
      text: attack.lines.join('\n'),
      playedCards: bossCards.length ? await Promise.all(bossCards.map(async cardSnapshot => ({ cardSnapshot: await withRemoteImageCard(cardSnapshot) }))) : undefined,
      ctSnapshot: await withRemoteImageCT(bossCT),
      finalAttrs: ctToOnlineAttrs(bossCT),
      timestamp: Date.now(),
    };
    msg.calculationDetails = calculationDetailsFor({ playedCards: bossCards.length ? bossCards.map(cardSnapshot => ({ cardSnapshot })) : undefined, ctSnapshot: bossCT, finalAttrs: msg.finalAttrs });
    bossStateRef.current = nextBoss;
    pendingBossAttacksRef.current = nextPending;
    setBossState(nextBoss);
    setPendingBossAttacks(nextPending);
    setMessages((items) => [...items, msg]);
    setCurrentTeam('team1');
    setCurrentPlayerId(alive[0]?.id || null);
    relay({ action: 'boss_action', sourceId: myId, turn: bossTurn, bossState: nextBoss, pendingBossAttacks: nextPending, message: msg, nextPlayerId: alive[0]?.id || null });
  };

  const resolveOnlinePendingBossAttack = (
    pending: PendingOnlineBossAttack,
    selectedCards: Card[],
    observation: string,
    proposedAttrs: Record<Attr, number | 'ilimitado'>,
  ) => {
    const lower = `${observation} ${selectedCards.map(card => `${card.name} ${card.caption}`).join(' ')}`.toLowerCase();
    const hasDefense = selectedCards.some(card => card.countsAsDefense || card.actionType === 'defense' || card.battleUseType?.includes('defesa'));
    const movementCards = selectedCards.filter(card => card.countsAsMovement || card.actionType === 'movement' || card.battleUseType?.includes('movimentação') || card.battleUseType?.includes('esquiva'));
    const hasSupport = selectedCards.some(card => card.actionType === 'perception' || card.cardType === 'percepção/rastreamento/reação');
    const hasSummonCover = selectedCards.some(card => ['invocação', 'marionete', 'edo tensei', 'invocação diversa'].includes(card.cardType || ''));
    const hasDefenseText = ['defesa', 'defendo', 'bloqueio', 'barreira', 'escudo', 'esquiva', 'desvio', 'clone', 'invocação', 'invocacao', 'marionete', 'edo'].some(word => lower.includes(word));
    const defValue = selectedCards.reduce((sum, card) => sum + Number(card.boost?.Def || 0) + Number(card.momentaryAttrs?.Def || 0), 0);
    const pendingSpeed = pending.speed === 'instant' ? 99 : Number(pending.speed || 0);
    const bestMoveSpeed = movementCards.reduce((best, card) => Math.max(best, card.speed === 'instant' ? 99 : Number(card.speed || 0)), 0);
    const movementDefense = movementCards.length > 0 ? (bestMoveSpeed >= pendingSpeed ? pending.damagePossible : Math.floor(pending.damagePossible / 2)) : 0;
    const coverDefense = hasSummonCover ? pending.damagePossible : 0;
    const defenseValue = Math.max(defValue, movementDefense, coverDefense);
    const validDefense = hasDefense || movementCards.length > 0 || hasSummonCover || (hasSupport && (hasDefenseText || hasDefense)) || (hasDefenseText && defenseValue > 0);
    const damage = validDefense ? Math.max(0, pending.damagePossible - defenseValue) : pending.damagePossible;
    const nextAttrs = { ...proposedAttrs };
    nextAttrs.Hp = Math.max(0, Number(nextAttrs.Hp || 0) - damage);
    const hp = Number(nextAttrs.Hp || 0);
    const lines = [
      validDefense ? `Jogador respondeu ao ataque ${pending.card.name}.` : `Jogador não apresentou defesa válida contra ${pending.card.name}.`,
      validDefense ? `Defesa/mitigação: ${formatNumberBR(defenseValue)}.` : '',
      `Dano final: ${formatNumberBR(damage)}.`,
      `HP restante: ${formatNumberBR(hp)}.`,
    ].filter(Boolean);
    const message: TeamMsg = {
      id: uid(),
      team: 'system',
      turn,
      text: lines.join('\n'),
      finalAttrs: nextAttrs,
      calculationDetails: [
        `Ataque pendente: ${pending.card.name}.`,
        `Dano possível: ${formatNumberBR(pending.damagePossible)}.`,
        `Speed: ${formatSpeed(pending.speed) || 'Sem Speed'}.`,
        `Custo do Boss: ${pending.costText || 'sem custo'}.`,
        `Defesa válida: ${validDefense ? 'sim' : 'não'}.`,
        `Dano final: ${formatNumberBR(damage)}.`,
      ],
      timestamp: Date.now(),
    };
    return { message, nextAttrs, defeated: hp <= 0 };
  };

  const sendChat = () => {
    const text = chatText.trim();
    if (!text) return;
    const now = Date.now();
    if (now - lastChatAtRef.current < 2000) return Alert.alert('Aguarde', 'Cooldown de chat de 2 segundos.');
    lastChatAtRef.current = now;
    setChatText('');
    setMessages((items) => [...items, { id: uid(), team: myTeam, player: me.name, turn, text, timestamp: now }]);
    relay({ action: 'chat', sourceId: myId, team: myTeam, playerName: me.name, turn, text, timestamp: now });
  };

  const currentPlayerName = currentTeam === 'boss'
    ? 'Boss'
    : participants.find(p => p.id === currentPlayerId)?.name || (currentTeam === 'team1' ? 'Time 1' : 'Time 2');

  return (
    <Screen scroll={false} testID="team-online-battle-screen">
      <Header title={bossMode ? 'MxH Online' : 'Online em equipe'} onBack={() => router.replace('/arena')} />
      {!started ? (
        <>
          <View style={styles.statusBox}>
            <Text style={styles.code}>{code}</Text>
            <Text style={styles.status}>{matchType} • {bossMode ? 'Boss começa • 30 min' : `${turnMinutes} min`} • {connStatus}</Text>
            <Text style={styles.status}>Você: {me.name} • {isSpectator ? 'Espectador' : myTeam === 'team1' ? 'Time 1' : 'Time 2'}</Text>
          </View>

          <View style={styles.teams}>
            <TeamColumn title="Time 1" participants={participants.filter(p => p.team === 'team1')} ctByPlayer={ctByPlayer} />
            <TeamColumn title={bossMode ? 'Boss' : 'Time 2'} participants={participants.filter(p => p.team === 'team2')} ctByPlayer={ctByPlayer} bossMode={bossMode} />
          </View>
        </>
      ) : (
        <View style={styles.compactStatus}>
          <Text style={styles.compactTitle}>{bossMode ? 'MxH Online' : 'Online'} • {matchType}</Text>
          <Text style={styles.compactLine}>Turno {turn} • Vez de {currentPlayerName}</Text>
          <Text style={styles.compactCode}>Sala {code} • {connStatus}</Text>
        </View>
      )}

      {!started ? (
        <View style={styles.setup}>
          <Text style={styles.label}>O C.T inicial</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {cts.map(ct => (
              <Pressable
                key={ct.id}
                onPress={() => confirmCT(ct)}
                style={[
                  styles.ctPick,
                  myCT?.id === ct.id && styles.ctPickActive,
                  bossMode && CARD_RANK_ORDER[ct.rank as CardRank] > CARD_RANK_ORDER[bossMaxRank[bossDifficulty]] && styles.ctPickBlocked,
                ]}
              >
                {ct.image ? <Image source={{ uri: ct.image }} style={styles.ctImg} /> : null}
                <Text style={styles.ctName}>{ctDisplayName(ct)}</Text>
                <Text style={styles.small}>AG {formatNumberBR(ct.attrs.Ag)}</Text>
                {bossMode && CARD_RANK_ORDER[ct.rank as CardRank] > CARD_RANK_ORDER[bossMaxRank[bossDifficulty]] ? <Text style={styles.blockedText}>Bloqueado</Text> : null}
              </Pressable>
            ))}
          </ScrollView>
          {isLeader ? <Button title="Iniciar sala" onPress={startMatch} testID="team-online-start-btn" /> : <Text style={styles.hint}>Aguardando o líder iniciar a sala.</Text>}
        </View>
      ) : (
        <View style={styles.turnBox}>
          <Text style={styles.turnText}>Turno {turn} • {currentPlayerName}</Text>
          <Text style={styles.hint}>{canAct() ? 'Sua vez de agir.' : isSpectator ? 'Espectador: chat liberado, ações bloqueadas.' : 'Aguardando o jogador da vez.'}</Text>
        </View>
      )}

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={item => item.id}
        contentContainerStyle={{ gap: 8, paddingVertical: 10 }}
        renderItem={({ item }) => <TeamMessage item={item} onImagePress={setZoomImage} />}
        ListEmptyComponent={<Text style={styles.hint}>Chat e jogadas aparecerão aqui.</Text>}
      />

      <View style={styles.chatBar}>
        <Input label="Chat" value={chatText} onChangeText={setChatText} placeholder="Mensagem" testID="team-chat-input" style={{ minHeight: 42 }} />
        <Button title="Enviar" onPress={sendChat} small testID="team-chat-send" />
      </View>
      <View style={styles.actions}>
        <Button title="Jogar" onPress={() => setPlayOpen(true)} disabled={!canAct()} style={{ flex: 1 }} small testID="team-play-btn" />
        <Button title="Passar" variant="ghost" onPress={sendPass} disabled={!canAct()} small testID="team-pass-btn" />
      </View>
      <PlayModal
        visible={playOpen}
        cards={bossMode ? cards.filter(card => CARD_RANK_ORDER[card.rank as CardRank] <= CARD_RANK_ORDER[bossMaxRank[bossDifficulty]]) : cards}
        onClose={() => setPlayOpen(false)}
        activeCT={myCT}
        activeEffects={[]}
        bossDifficulty={bossMode ? bossDifficulty : undefined}
        onImagePress={setZoomImage}
        onConfirm={sendPlay}
      />
      <ZoomableImageModal uri={zoomImage} onClose={() => setZoomImage(null)} />
    </Screen>
  );
}

function TeamColumn({ title, participants, ctByPlayer, bossMode }: { title: string; participants: TeamParticipant[]; ctByPlayer: Record<string, CT>; bossMode?: boolean }) {
  return (
    <View style={styles.teamCol}>
      <Text style={styles.teamTitle}>{title}</Text>
      {bossMode && title === 'Boss' ? <Text style={styles.playerLine}>Kael’Zor</Text> : null}
      {participants.map(p => <Text key={p.id} style={styles.playerLine}>{p.name} {ctByPlayer[p.id] ? '• C.T ok' : '• aguardando C.T'}</Text>)}
    </View>
  );
}

function TeamMessage({ item, onImagePress }: { item: TeamMsg; onImagePress: (uri: string) => void }) {
  const [showCalc, setShowCalc] = useState(false);
  return (
    <View style={[styles.bubble, item.team === 'system' ? styles.systemBubble : item.team === 'team1' ? styles.t1Bubble : styles.t2Bubble]}>
      <Text style={styles.bubbleHead}>{item.team === 'system' ? 'Sistema' : `${item.player || item.team} • Turno ${item.turn}`}</Text>
      {item.text ? <Text style={styles.bubbleText}>{item.text}</Text> : null}
      {item.playedCards?.map(({ cardSnapshot }) => (
        <View key={cardSnapshot.id} style={styles.playedCard}>
          {cardSnapshot.image ? <Pressable onPress={() => onImagePress(cardSnapshot.image!)}><Image source={{ uri: cardSnapshot.image }} style={styles.cardImg} /></Pressable> : null}
          <View style={{ flex: 1 }}>
            <Text style={styles.cardName}>{cardSnapshot.name} • Rank {cardSnapshot.rank}</Text>
            <Text style={styles.small}>{[formatSpeed(cardSnapshot.speed), cardSnapshot.caption].filter(Boolean).join(' • ')}</Text>
          </View>
        </View>
      ))}
      {item.ctSnapshot ? (
        <View style={styles.ctSnapshotBox}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            {item.ctSnapshot.image ? <Pressable onPress={() => onImagePress(item.ctSnapshot!.image!)}><Image source={{ uri: item.ctSnapshot.image }} style={styles.cardImg} /></Pressable> : null}
            <Text style={styles.cardName}>{ctDisplayName(item.ctSnapshot)} • Rank {item.ctSnapshot.rank}</Text>
          </View>
          {item.finalAttrs ? <Text style={styles.small}>{ATTRS.map(attr => `${attr}:${formatNumberBR(item.finalAttrs?.[attr])}`).join(' • ')}</Text> : null}
          {item.ctSnapshot.resourceName ? <Text style={styles.small}>{item.ctSnapshot.resourceName}: {formatNumberBR(item.ctSnapshot.resourceValue || 0)}</Text> : null}
        </View>
      ) : item.finalAttrs ? <Text style={styles.small}>Final: {ATTRS.map(attr => `${attr}:${formatNumberBR(item.finalAttrs?.[attr])}`).join(' • ')}</Text> : null}
      {item.calculationDetails?.length ? (
        <>
          <Pressable onPress={() => setShowCalc(value => !value)} style={styles.calcButton}>
            <Text style={styles.calcButtonText}>{showCalc ? 'Ocultar cálculo' : 'Ver cálculo'}</Text>
          </Pressable>
          {showCalc ? (
            <View style={styles.calcBox}>
              {item.calculationDetails.map((line, index) => <Text key={`${item.id}-calc-${index}`} style={styles.small}>{line}</Text>)}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

export function teamForJoin(matchType: MatchType, participants: TeamParticipant[]): Team {
  if (String(matchType).includes('Boss')) return 'team1';
  if (matchType === '1x2') return 'team2';
  const t1 = participants.filter(p => p.team === 'team1').length;
  const t2 = participants.filter(p => p.team === 'team2').length;
  return t1 <= t2 ? 'team1' : 'team2';
}

export function isTeamMatch(matchType: MatchType) {
  return TEAM_MATCHES.includes(matchType) || String(matchType).includes('Boss');
}

const styles = StyleSheet.create({
  statusBox: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, padding: 10, gap: 4 },
  code: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: 2 },
  status: { color: theme.colors.textSecondary, fontSize: 12 },
  compactStatus: { backgroundColor: 'rgba(255,59,0,0.08)', borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, gap: 2 },
  compactTitle: { color: theme.colors.neon, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  compactLine: { color: '#fff', fontSize: 13, fontWeight: '900' },
  compactCode: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '700' },
  teams: { flexDirection: 'row', gap: 8, marginTop: 8 },
  teamCol: { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, padding: 8, minHeight: 70 },
  teamTitle: { color: theme.colors.neon, fontWeight: '900', fontSize: 11, textTransform: 'uppercase' },
  playerLine: { color: '#fff', fontSize: 12, marginTop: 4 },
  setup: { gap: 10, marginTop: 8 },
  label: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  ctPick: { width: 120, padding: 8, backgroundColor: theme.colors.surface, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border },
  ctPickActive: { borderColor: theme.colors.borderActive, backgroundColor: 'rgba(255,59,0,0.12)' },
  ctPickBlocked: { opacity: 0.45, borderColor: 'rgba(255,51,68,0.45)', backgroundColor: 'rgba(255,51,68,0.08)' },
  ctImg: { width: '100%', height: 58, borderRadius: 8, backgroundColor: theme.colors.bg },
  ctName: { color: '#fff', fontWeight: '800', fontSize: 12, marginTop: 4 },
  blockedText: { color: theme.colors.danger, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', marginTop: 2 },
  small: { color: theme.colors.textSecondary, fontSize: 11, lineHeight: 15 },
  hint: { color: theme.colors.textMuted, fontSize: 12, textAlign: 'center', lineHeight: 18 },
  turnBox: { backgroundColor: 'rgba(255,59,0,0.08)', borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, padding: 10, marginTop: 8 },
  turnText: { color: '#fff', fontWeight: '900', textAlign: 'center' },
  chatBar: { paddingTop: 8, borderTopWidth: 1, borderColor: theme.colors.border, gap: 8 },
  actions: { flexDirection: 'row', gap: 8, paddingTop: 8 },
  bubble: { borderWidth: 1, borderRadius: 12, padding: 10, gap: 5 },
  systemBubble: { borderColor: theme.colors.border, backgroundColor: 'rgba(255,255,255,0.04)' },
  t1Bubble: { borderColor: 'rgba(255,59,0,0.35)', backgroundColor: 'rgba(255,59,0,0.12)' },
  t2Bubble: { borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(255,255,255,0.06)' },
  bubbleHead: { color: theme.colors.neon, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  bubbleText: { color: '#fff', fontSize: 13, lineHeight: 18 },
  playedCard: { flexDirection: 'row', gap: 8, backgroundColor: 'rgba(0,0,0,0.22)', borderRadius: 8, padding: 6 },
  ctSnapshotBox: { gap: 5, backgroundColor: 'rgba(255,215,0,0.06)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,215,0,0.22)', padding: 8 },
  cardImg: { width: 42, height: 42, borderRadius: 8, backgroundColor: theme.colors.bg },
  cardName: { color: '#fff', fontWeight: '800', fontSize: 12 },
  calcButton: { alignSelf: 'flex-start', borderRadius: 8, borderWidth: 1, borderColor: theme.colors.borderActive, paddingHorizontal: 10, paddingVertical: 6, marginTop: 4 },
  calcButtonText: { color: theme.colors.neon, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  calcBox: { gap: 3, borderTopWidth: 1, borderColor: theme.colors.border, paddingTop: 6, marginTop: 2 },
  modalWrap: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' },
  modalCard: { height: '82%', backgroundColor: theme.colors.bg, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 14, borderWidth: 1, borderColor: theme.colors.border },
  modalTitle: { color: '#fff', fontWeight: '900', fontSize: 16, marginBottom: 8 },
  pickCard: { padding: 10, backgroundColor: theme.colors.surface, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border },
  pickCardActive: { borderColor: theme.colors.borderActive, backgroundColor: 'rgba(255,59,0,0.12)' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, paddingTop: 8 },
});
