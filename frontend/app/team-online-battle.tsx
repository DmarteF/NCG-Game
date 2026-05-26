import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Screen from '../src/components/Screen';
import Button from '../src/components/Button';
import Input from '../src/components/Input';
import ZoomableImageModal from '../src/components/ZoomableImageModal';
import { resolveCombat } from '../src/combat';
import { ctDisplayName, formatNumberBR, formatSpeed } from '../src/format';
import { TeamParticipant, TeamRoomClient, TeamWSEvent } from '../src/online';
import { withRemoteImageCard, withRemoteImageCT } from '../src/remoteImages';
import { Storage, uid } from '../src/storage';
import { ATTRS, Attr, CARD_RANK_ORDER, CardRank, theme } from '../src/theme';
import { BossDifficulty, Card, CT, MatchType, PlayedCard } from '../src/types';
import { Header } from './profile';
import { BossState, bossCardToSnapshot, createBossCT, createKaelzorState } from '../src/bossData';
import { resolveBossAttack, resolveBossDefense } from '../src/bossRules';
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
      setParticipants(event.participants);
      setConnStatus('connected');
    } else if (event.type === 'participant_joined') {
      setParticipants(event.participants);
      setMessages((items) => [...items, { id: uid(), team: 'system', turn, text: `${event.participant.name} entrou na sala.`, timestamp: Date.now() }]);
    } else if (event.type === 'participant_left') {
      setParticipants(event.participants);
      setMessages((items) => [...items, { id: uid(), team: 'system', turn, text: 'Um jogador saiu da sala.', timestamp: Date.now() }]);
    } else if (event.type === 'team_relay') {
      const payload = event.payload || {};
      if (payload.action === 'initial_ct') {
        setCtByPlayer((map) => ({ ...map, [payload.playerId]: payload.ct }));
      } else if (payload.action === 'start_team') {
        setStarted(true);
        setEnded(false);
        setCurrentTeam(payload.currentTeam);
        setCurrentPlayerId(payload.currentPlayerId || null);
        setTurn(payload.turn || 1);
        if (payload.bossState) setBossState(payload.bossState);
        setMessages((items) => [...items, { id: uid(), team: 'system', turn: payload.turn || 1, text: payload.text, timestamp: Date.now() }]);
      } else if (payload.action === 'play') {
        if (payload.playerId && payload.ct) setCtByPlayer((map) => ({ ...map, [payload.playerId]: payload.ct }));
        if (payload.bossState) setBossState(payload.bossState);
        if (payload.pendingBossAttacks) setPendingBossAttacks(payload.pendingBossAttacks);
        setMessages((items) => [
          ...items,
          { id: uid(), team: payload.team, player: payload.playerName, turn: payload.turn, playedCards: payload.cards, ctSnapshot: payload.ct, finalAttrs: payload.finalAttrs, text: payload.observation, calculationDetails: payload.calculationDetails, timestamp: Date.now() },
          ...(payload.extraMessages || []).map((msg: TeamMsg) => ({ ...msg, id: uid(), timestamp: Date.now() })),
        ]);
        if (payload.endText) finishBattle(payload.endText, false);
        else advanceAfter(payload.team, payload.playerId);
      } else if (payload.action === 'pass') {
        if (payload.ct) setCtByPlayer((map) => ({ ...map, [payload.playerId]: payload.ct }));
        if (payload.pendingBossAttacks) setPendingBossAttacks(payload.pendingBossAttacks);
        setMessages((items) => [...items, { id: uid(), team: 'system', turn: payload.turn, text: `${payload.playerName} passou pelo time.`, timestamp: Date.now() }]);
        if (payload.extraMessages) setMessages((items) => [...items, ...payload.extraMessages.map((msg: TeamMsg) => ({ ...msg, id: uid(), timestamp: Date.now() }))]);
        if (payload.endText) finishBattle(payload.endText, false);
        else advanceAfter(payload.team, payload.playerId);
      } else if (payload.action === 'chat') {
        setMessages((items) => [...items, { id: uid(), team: payload.team, player: payload.playerName, turn: payload.turn || turn, text: payload.text, timestamp: payload.timestamp || Date.now() }]);
      } else if (payload.action === 'boss_action') {
        if (payload.bossState) setBossState(payload.bossState);
        if (payload.pendingBossAttacks) setPendingBossAttacks(payload.pendingBossAttacks);
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
        Alert.alert('Dificuldade inválida', `Esta dificuldade permite apenas C.T até Rank ${maxRank}.`);
        if (myCT?.id === ct.id) setMyCT(null);
        return;
      }
    }
    setMyCT(ct);
    setCtByPlayer((map) => ({ ...map, [myId]: ct }));
    relay({ action: 'initial_ct', playerId: myId, ct: await withRemoteImageCT(ct) });
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
      if (invalid) return Alert.alert('Dificuldade inválida', `${invalid.name} precisa trocar o C.T. Esta dificuldade permite apenas C.T até Rank ${maxRank}.`);
    }
    const starter = pickStarter();
    const freshBoss = createKaelzorState(bossDifficulty);
    const firstPlayer = starter === 'boss' ? null : firstPlayerForTeam(starter);
    const text = starter === 'boss'
      ? 'Kael’Zor começa. O Fragmento do Vazio já está ativo e a ação do Boss será sincronizada pela sala.'
      : `${starter === 'team1' ? 'Time 1' : 'Time 2'} começa. AG total: Time 1 ${formatNumberBR(teamAg('team1'))} • Time 2 ${formatNumberBR(teamAg('team2'))}.`;
    setStarted(true);
    setEnded(false);
    setBossState(freshBoss);
    setPendingBossAttacks({});
    setCurrentTeam(starter);
    setCurrentPlayerId(firstPlayer?.id || null);
    setMessages((items) => [...items, { id: uid(), team: 'system', turn: 1, text, timestamp: Date.now() }]);
    relay({ action: 'start_team', currentTeam: starter, currentPlayerId: firstPlayer?.id || null, turn: 1, text, bossState: freshBoss });
    if (starter === 'boss') {
      setTimeout(() => runOnlineBossTurn(1, freshBoss, ctByPlayer, participants), 300);
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

  const playersForTeam = (team: Team, ctMap = ctByPlayer) => participants
    .filter(p => p.role !== 'spectator' && p.team === team && Number(ctMap[p.id]?.attrs.Hp ?? 1) > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
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
        if (isLeader) runOnlineBossTurn(turn + 1, bossState, ctByPlayer, participants);
      }, 300);
      return;
    }
    const nextTeam = team === 'team1' ? 'team2' : 'team1';
    setCurrentTeam(nextTeam);
    setCurrentPlayerId(firstPlayerForTeam(nextTeam)?.id || null);
    setTurn((value) => value + 1);
  };

  const sendPlay = async (selectedCards: Card[], observation: string) => {
    if (!myCT || !canAct() || !enforceCooldown()) return;
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
      if (invalidCard) return Alert.alert('Dificuldade inválida', `${invalidCard.name} está acima do Rank ${maxRank}.`);
    }
    const resolved = resolveCombat(myCT, undefined, selectedCards, []);
    const numericAttrs = ATTRS.reduce((acc, attr) => {
      const value = resolved.finalAttrs[attr];
      acc[attr] = typeof value === 'number' ? value : (myCT.attrs[attr] || 0);
      return acc;
    }, {} as Record<Attr, number>);
    const nextCT = { ...myCT, attrs: numericAttrs };
    setMyCT(nextCT);
    setCtByPlayer((map) => ({ ...map, [myId]: nextCT }));
    const played = await Promise.all(selectedCards.map(async card => ({ cardSnapshot: await withRemoteImageCard(card) })));
    let extraMessages: TeamMsg[] = [];
    let nextBoss = bossState;
    let nextPending = { ...pendingBossAttacks };
    let finalCT = nextCT;
    let finalAttrs = resolved.finalAttrs;
    let endText = '';
    if (bossMode) {
      const pending = nextPending[myId];
      if (pending) {
        const pendingResult = resolveOnlinePendingBossAttack(pending, selectedCards, observation, resolved.finalAttrs);
        finalAttrs = pendingResult.nextAttrs;
        finalCT = { ...nextCT, attrs: ATTRS.reduce((acc, attr) => ({ ...acc, [attr]: typeof finalAttrs[attr] === 'number' ? finalAttrs[attr] as number : nextCT.attrs[attr] || 0 }), {} as Record<Attr, number>) };
        delete nextPending[myId];
        extraMessages.push(pendingResult.message);
        const updatedMap = { ...ctByPlayer, [myId]: finalCT };
        if (pendingResult.defeated && allBossPlayersDefeated(updatedMap, participants)) endText = 'Kael’Zor venceu.';
      }
      if (!endText) {
        const bossDefense = resolveBossDefense(nextBoss, selectedCards.map(card => ({ cardSnapshot: card })), observation, finalAttrs, resolved.momentaryActions);
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
      setBossState(nextBoss);
      setPendingBossAttacks(nextPending);
    }
    setMyCT(finalCT);
    setCtByPlayer((map) => ({ ...map, [myId]: finalCT }));
    const msg: TeamMsg = { id: uid(), team: myTeam, player: me.name, turn, playedCards: selectedCards.map(card => ({ cardSnapshot: card })), ctSnapshot: finalCT, finalAttrs, text: observation, timestamp: Date.now() };
    setMessages((items) => [...items, msg, ...extraMessages]);
    relay({ action: 'play', team: myTeam, playerId: myId, playerName: me.name, turn, cards: played, ct: await withRemoteImageCT(finalCT), finalAttrs, observation, extraMessages, bossState: nextBoss, pendingBossAttacks: nextPending, endText });
    setPlayOpen(false);
    if (endText) finishBattle(endText);
    else advanceAfter(myTeam, myId);
  };

  const sendPass = async () => {
    if (!canAct() || !enforceCooldown()) return;
    let nextPending = { ...pendingBossAttacks };
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
      setCtByPlayer((map) => ({ ...map, [myId]: nextCT! }));
      setPendingBossAttacks(nextPending);
      const updatedMap = { ...ctByPlayer, [myId]: nextCT };
      if (pendingResult.defeated && allBossPlayersDefeated(updatedMap, participants)) endText = 'Kael’Zor venceu.';
    }
    setMessages((items) => [...items, { id: uid(), team: 'system', turn, text: `${me.name} passou pelo time.`, timestamp: Date.now() }, ...extraMessages]);
    relay({ action: 'pass', team: myTeam, playerId: myId, playerName: me.name, turn, ct: nextCT ? await withRemoteImageCT(nextCT) : undefined, pendingBossAttacks: nextPending, extraMessages, endText });
    if (endText) finishBattle(endText);
    else advanceAfter(myTeam, myId);
  };

  const finishBattle = (text: string, broadcast = true) => {
    setEnded(true);
    setStarted(true);
    setCurrentTeam('team1');
    setCurrentPlayerId(null);
    setMessages((items) => items.some(item => item.text === text) ? items : [...items, { id: uid(), team: 'system', turn, text, timestamp: Date.now() }]);
    if (broadcast) relay({ action: 'battle_end', text });
  };

  const runOnlineBossTurn = async (bossTurn: number, sourceBoss: BossState, ctMap: Record<string, CT>, roomParticipants: TeamParticipant[]) => {
    if (!bossMode || !isLeader || ended) return;
    const alive = roomParticipants
      .filter(p => p.role !== 'spectator' && p.team === 'team1' && Number(ctMap[p.id]?.attrs.Hp ?? 1) > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
    if (alive.length === 0) {
      finishBattle('Kael’Zor venceu.');
      return;
    }
    const target = alive[0];
    const targetCT = ctMap[target.id];
    const attack = resolveBossAttack(sourceBoss, targetCT, targetCT?.attrs || emptyOnlineAttrs());
    const nextBoss = attack.boss;
    const bossCT = createBossCT(nextBoss);
    const bossExtra = attack.card?.kind === 'attack'
      ? `ATK base do card: ${formatNumberBR(attack.card.atk)}\nATK final: ${formatNumberBR(attack.card.atk)}\nENE restante: ${formatNumberBR(nextBoss.stats.Ene)}\nDano possível: ${formatNumberBR(attack.damagePossible)}\nAguardando resposta do jogador.`
      : `ENE restante: ${formatNumberBR(nextBoss.stats.Ene)}\nAguardando resposta do jogador.`;
    const bossCard = attack.card ? bossCardToSnapshot(attack.card, bossExtra) : undefined;
    const targets = attack.card?.kind === 'attack'
      ? alive.slice(0, Math.min(alive.length, attack.card.maxTargets || 1))
      : [];
    const nextPending = { ...pendingBossAttacks };
    if (attack.card?.kind === 'attack' && bossCard && attack.damagePossible > 0) {
      const costText = Object.entries(attack.card.cost || {}).map(([attr, value]) => `${attr}: ${formatNumberBR(value)}`).join(' • ');
      targets.forEach((player) => {
        nextPending[player.id] = {
          card: bossCard,
          damagePossible: attack.damagePossible,
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
      playedCards: bossCard ? [{ cardSnapshot: await withRemoteImageCard(bossCard) }] : undefined,
      ctSnapshot: await withRemoteImageCT(bossCT),
      finalAttrs: ctToOnlineAttrs(bossCT),
      timestamp: Date.now(),
    };
    msg.calculationDetails = calculationDetailsFor({ playedCards: bossCard ? [{ cardSnapshot: bossCard }] : undefined, ctSnapshot: bossCT, finalAttrs: msg.finalAttrs });
    setBossState(nextBoss);
    setPendingBossAttacks(nextPending);
    setMessages((items) => [...items, msg]);
    setCurrentTeam('team1');
    setCurrentPlayerId(alive[0]?.id || null);
    relay({ action: 'boss_action', turn: bossTurn, bossState: nextBoss, pendingBossAttacks: nextPending, message: msg, nextPlayerId: alive[0]?.id || null });
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
    relay({ action: 'chat', team: myTeam, playerName: me.name, turn, text, timestamp: now });
  };

  return (
    <Screen scroll={false} testID="team-online-battle-screen">
      <Header title={bossMode ? 'MxH Online' : 'Online em equipe'} onBack={() => router.replace('/arena')} />
      <View style={styles.statusBox}>
        <Text style={styles.code}>{code}</Text>
        <Text style={styles.status}>{matchType} • {bossMode ? 'Boss começa • 30 min' : `${turnMinutes} min`} • {connStatus}</Text>
        <Text style={styles.status}>Você: {me.name} • {isSpectator ? 'Espectador' : myTeam === 'team1' ? 'Time 1' : 'Time 2'}</Text>
      </View>

      <View style={styles.teams}>
        <TeamColumn title="Time 1" participants={participants.filter(p => p.team === 'team1')} ctByPlayer={ctByPlayer} />
        <TeamColumn title={bossMode ? 'Boss' : 'Time 2'} participants={participants.filter(p => p.team === 'team2')} ctByPlayer={ctByPlayer} bossMode={bossMode} />
      </View>

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
          <Text style={styles.turnText}>Turno {turn} • {currentTeam === 'boss' ? 'Boss' : currentTeam === 'team1' ? 'Time 1' : 'Time 2'}</Text>
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
      <TeamPlayModal visible={playOpen} cards={cards} onClose={() => setPlayOpen(false)} onConfirm={sendPlay} />
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
      {item.finalAttrs ? <Text style={styles.small}>Final: {ATTRS.map(attr => `${attr}:${formatNumberBR(item.finalAttrs?.[attr])}`).join(' • ')}</Text> : null}
    </View>
  );
}

function TeamPlayModal({ visible, cards, onClose, onConfirm }: { visible: boolean; cards: Card[]; onClose: () => void; onConfirm: (cards: Card[], observation: string) => void }) {
  const [selected, setSelected] = useState<Card[]>([]);
  const [query, setQuery] = useState('');
  const [observation, setObservation] = useState('');
  useEffect(() => {
    if (visible) {
      setSelected([]);
      setQuery('');
      setObservation('');
    }
  }, [visible]);
  const visibleCards = cards.filter(card => {
    const q = query.trim().toLowerCase();
    return !q || `${card.name} ${card.caption} ${card.rank} ${card.cardType || ''} ${card.actionType || ''} ${card.movementType || ''} ${card.movementRange || ''} ${card.summonType || ''} ${card.targetShape || ''} ${card.sensoryType || ''} ${card.detectsInvisibility ? 'detecta invisibilidade' : ''} ${card.detectsChakra ? 'detecta chakra energia' : ''} ${card.detectsPresence ? 'detecta presença' : ''} ${card.tracksTarget ? 'rastreia alvo' : ''} ${card.tracksMovement ? 'rastreia movimento' : ''} ${formatSpeed(card.speed)}`.toLowerCase().includes(q);
  });
  const toggle = (card: Card) => setSelected(items => items.some(item => item.id === card.id) ? items.filter(item => item.id !== card.id) : [...items, card]);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalWrap}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Jogada da equipe</Text>
          <Input label="Buscar card" value={query} onChangeText={setQuery} placeholder="Nome, legenda ou Speed" testID="team-card-search" />
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 8, paddingVertical: 8 }}>
            {visibleCards.map(card => {
              const active = selected.some(item => item.id === card.id);
              return (
                <Pressable key={card.id} onPress={() => toggle(card)} style={[styles.pickCard, active && styles.pickCardActive]}>
                  <Text style={styles.cardName}>{card.name} • Rank {card.rank}</Text>
                  <Text style={styles.small}>{[formatSpeed(card.speed), card.caption].filter(Boolean).join(' • ')}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Input label="Observação" value={observation} onChangeText={setObservation} placeholder="Descreva alvos, clones, defesa..." multiline numberOfLines={3} style={{ minHeight: 70, textAlignVertical: 'top' }} />
          <View style={styles.modalActions}>
            <Button title="Cancelar" variant="ghost" onPress={onClose} small />
            <Button title="Enviar" onPress={() => onConfirm(selected, observation)} small />
          </View>
        </View>
      </View>
    </Modal>
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
  cardImg: { width: 42, height: 42, borderRadius: 8, backgroundColor: theme.colors.bg },
  cardName: { color: '#fff', fontWeight: '800', fontSize: 12 },
  modalWrap: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' },
  modalCard: { height: '82%', backgroundColor: theme.colors.bg, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 14, borderWidth: 1, borderColor: theme.colors.border },
  modalTitle: { color: '#fff', fontWeight: '900', fontSize: 16, marginBottom: 8 },
  pickCard: { padding: 10, backgroundColor: theme.colors.surface, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border },
  pickCardActive: { borderColor: theme.colors.borderActive, backgroundColor: 'rgba(255,59,0,0.12)' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, paddingTop: 8 },
});
