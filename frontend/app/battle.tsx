import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, FlatList, Alert, Modal, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../src/components/Screen';
import Button from '../src/components/Button';
import Input from '../src/components/Input';
import Chip from '../src/components/Chip';
import ZoomableImageModal from '../src/components/ZoomableImageModal';
import { Storage, uid } from '../src/storage';
import { BattleEntity, BossDifficulty, Card, CT, ChatMsg, MatchType, MomentaryAction, PlayedCard } from '../src/types';
import { ATTRS, CT_ATTRS, Attr, theme, RANK_ORDER, CARD_RANKS, CARD_RANK_ORDER, CardRank, Rank } from '../src/theme';
import { AttrEditor, UnlimitedEditor } from './card-edit';
import { ctDisplayName, formatNumberBR, formatSpeed } from '../src/format';
import { applyUpkeep, resolveCombat, subtractAttrs, visibleFinalAttrs } from '../src/combat';
import { BossState, bossCardToSnapshot, createBossCT, createKaelzorState } from '../src/bossData';
import { PlayerActionAnalysis, resolveBossAttack, resolveBossDefense } from '../src/bossRules';
import { calculationDetailsFor } from '../src/historyExport';

type Team = 'team1' | 'team2';
type BattleAttrs = Record<Attr, number | 'ilimitado'>;
type ActiveEffect = { id: string; team: Team; card: Card; remainingTurns?: number; quantityInitial?: number; quantityCurrent?: number };

const emptyBattleAttrs = (): BattleAttrs => ({ Atk: 0, Def: 0, Dur: 0, Ag: 0, Ck: 0, Hp: 0 });
const ctToBattleAttrs = (ct: CT): BattleAttrs => ({ ...emptyBattleAttrs(), ...ct.attrs, Dur: 0 });
const BOSS_DIFFICULTY_LABELS: Record<BossDifficulty, string> = { facil: 'Fácil', medio: 'Médio', dificil: 'Difícil', impossivel: 'Impossível' };
const BOSS_DIFFICULTY_MAX_RANK: Record<BossDifficulty, CardRank> = { facil: 'B', medio: 'A', dificil: 'S', impossivel: 'S' };

function isDiverseSummonCard(card: Card) {
  return card.actionType === 'diverse_summon' || card.cardType === 'invocação diversa';
}

function diverseSummonLabel(card: Card) {
  if (card.summonType === 'clone') return 'clones';
  if (card.summonType === 'grupo') return 'grupos';
  if (card.summonType === 'enxame') return 'enxames';
  if (card.summonType === 'constructo') return 'constructos';
  if (card.summonType === 'invocação menor') return 'invocações menores';
  if (card.summonType === 'objeto invocado') return 'objetos invocados';
  return 'alvos';
}

function initialDiverseQuantity(card: Card) {
  if (!isDiverseSummonCard(card)) return undefined;
  const value = Number(card.summonQuantity || card.targetCount || 0);
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : undefined;
}

export default function Battle() {
  const router = useRouter();
  const { matchType, turnMinutes, bossDifficulty } = useLocalSearchParams<{ matchType: MatchType; turnMinutes: string; bossDifficulty?: BossDifficulty }>();
  const isBoss = String(matchType || '').includes('Boss');
  const difficulty = bossDifficulty || 'facil';
  const totalMinutes = parseInt(String(turnMinutes || '0'), 10);
  const turnSeconds = isBoss ? 30 * 60 : totalMinutes > 0 ? totalMinutes * 60 : 0;

  const [cards, setCards] = useState<Card[]>([]);
  const [cts, setCTs] = useState<CT[]>([]);
  const [phase, setPhase] = useState<'init' | 'play' | 'ended'>('init');
  const [initCT1, setInitCT1] = useState<CT | null>(null);
  const [initCT2, setInitCT2] = useState<CT | null>(null);
  const [currentTeam, setCurrentTeam] = useState<Team>('team1');
  const [turn, setTurn] = useState(1);
  const [t1Played, setT1Played] = useState(false);
  const [t2Played, setT2Played] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [timeLeft, setTimeLeft] = useState(turnSeconds);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [localChatText, setLocalChatText] = useState('');
  const [activeEffects, setActiveEffects] = useState<ActiveEffect[]>([]);
  const [battleAttrs, setBattleAttrs] = useState<Record<Team, BattleAttrs>>({ team1: emptyBattleAttrs(), team2: emptyBattleAttrs() });
  const [bossState, setBossState] = useState<BossState>(() => createKaelzorState(difficulty));
  const [result, setResult] = useState<string>('');

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bossBusyRef = useRef(false);
  const lastBossAnalysisRef = useRef<PlayerActionAnalysis | undefined>(undefined);

  useEffect(() => {
    Storage.getCards().then(setCards);
    Storage.getCTs().then(setCTs);
  }, []);

  // Timer logic
  useEffect(() => {
    if (phase !== 'play' || turnSeconds === 0) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleTimeout();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentTeam, turnSeconds]);

  const t2Label = isBoss ? 'Boss' : 'Time 2';
  const bossCT = createBossCT(bossState);
  const activeCards = activeEffects.filter(effect => effect.team === currentTeam);
  const currentActiveCT = isBoss && currentTeam === 'team2'
    ? bossCT
    : (currentTeam === 'team1' ? initCT1 : initCT2)
    ? { ...(currentTeam === 'team1' ? initCT1! : initCT2!), attrs: battleAttrs[currentTeam] as Record<Attr, number> }
    : null;
  const isAutoBossTurn = isBoss && currentTeam === 'team2';

  const startPresentation = () => {
    if (!initCT1 || (!isBoss && !initCT2)) {
      Alert.alert('Atenção', 'Cada lado precisa escolher um O C.T inicial.');
      return;
    }
    if (isBoss) {
      const maxRank = BOSS_DIFFICULTY_MAX_RANK[difficulty];
      if (CARD_RANK_ORDER[initCT1.rank as CardRank] > CARD_RANK_ORDER[maxRank]) {
        Alert.alert('Dificuldade inválida', `Esta dificuldade permite apenas C.T até Rank ${maxRank}.`);
        return;
      }
      const freshBoss = createKaelzorState(difficulty);
      const freshBossCT = createBossCT(freshBoss);
      setBossState(freshBoss);
      setInitCT2(freshBossCT);
      lastBossAnalysisRef.current = undefined;
      setBattleAttrs({ team1: ctToBattleAttrs(initCT1), team2: ctToBattleAttrs(freshBossCT) });
      setActiveEffects([]);
      setCurrentTeam('team2');
      setPhase('play');
      setTimeLeft(turnSeconds);
      addSystem('Kael’Zor começa. O Fragmento Selado do Vazio analisa o campo antes dos shinobi.');
      return;
    }
    setBattleAttrs({ team1: ctToBattleAttrs(initCT1), team2: ctToBattleAttrs(initCT2!) });
    setActiveEffects([]);
    const r1 = RANK_ORDER[initCT1.rank];
    const r2 = RANK_ORDER[initCT2!.rank];
    let starter: Team;
    if (r1 !== r2) starter = r1 > r2 ? 'team1' : 'team2';
    else {
      const a1 = initCT1.attrs.Ag ?? 0; const a2 = initCT2!.attrs.Ag ?? 0;
      if (a1 !== a2) starter = a1 > a2 ? 'team1' : 'team2';
      else starter = Math.random() < 0.5 ? 'team1' : 'team2';
    }
    setCurrentTeam(starter);
    setPhase('play');
    setTimeLeft(turnSeconds);
    addSystem(`${starter === 'team1' ? 'Time 1' : t2Label} começa.`);
  };

  const addSystem = (text: string) => {
    setMessages((m) => [...m, { id: uid(), turn, team: 'system', text, timestamp: Date.now() }]);
  };

  const handleTimeout = () => {
    const loser = currentTeam === 'team1' ? 'Time 1' : t2Label;
    const winner = currentTeam === 'team1' ? t2Label : 'Time 1';
    endBattle(`${loser} perdeu por tempo. ${winner} venceu!`);
  };

  const endBattle = (text: string) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase('ended');
    setResult(text);
    setMessages((m) => {
      const next = [...m, { id: uid(), turn, team: 'system' as const, text, timestamp: Date.now() }];
      Storage.appendHistory({
        id: uid(), endedAt: Date.now(), result: text, messages: next,
        config: { matchType: matchType as MatchType, turnMinutes: isBoss ? null : totalMinutes, startedAt: Date.now(), bossDifficulty: isBoss ? difficulty : undefined },
      });
      return next;
    });
  };

  const onSendPlay = (played: PlayedCard[], ctSnap: CT, observation: string, finalAttrs: Record<Attr, number | 'ilimitado'>, keptActiveEffectIds: string[] = [], activeEntity?: BattleEntity, finalEntityAttrs?: Record<Attr, number | 'ilimitado'>, momentaryActions: MomentaryAction[] = []) => {
    const msg: ChatMsg = {
      id: uid(), turn, team: currentTeam, timestamp: Date.now(),
      playedCards: played, ctSnapshot: ctSnap, activeEntitySnapshot: activeEntity, ctObservation: observation, finalAttrs, finalEntityAttrs, momentaryActions,
    };
    msg.calculationDetails = calculationDetailsFor(msg);
    if (isBoss && currentTeam === 'team1') {
      const defense = resolveBossDefense(bossState, played, observation, finalAttrs, momentaryActions);
      lastBossAnalysisRef.current = defense.analysis;
      const nextBossCT = createBossCT(defense.boss);
      const defenseExtra = `ENE restante: ${formatNumberBR(defense.boss.stats.Ene)}\nDano recebido: ${formatNumberBR(defense.damageTaken)}\nHP restante do Boss: ${formatNumberBR(defense.boss.stats.Hp)}`;
      const defenseCard = defense.card ? bossCardToSnapshot(defense.card, defenseExtra) : undefined;
      const defenseMsg: ChatMsg = {
        id: uid(),
        turn,
        team: defenseCard ? 'team2' : 'system',
        text: defense.lines.join('\n'),
        timestamp: Date.now(),
        playedCards: defenseCard ? [{ cardSnapshot: defenseCard }] : undefined,
        ctSnapshot: defenseCard ? nextBossCT : undefined,
        finalAttrs: defenseCard ? ctToBattleAttrs(nextBossCT) : undefined,
      };
      defenseMsg.calculationDetails = calculationDetailsFor(defenseMsg);
      registerPersistentEffects(played.map(p => p.cardSnapshot), keptActiveEffectIds);
      setBossState(defense.boss);
      setBattleAttrs((attrs) => ({ ...attrs, team1: finalAttrs, team2: ctToBattleAttrs(nextBossCT) }));
      if (defense.defeated) {
        const finalText = 'Kael’Zor foi derrotado. Os selos do Abismo Vermelho foram estabilizados.';
        setPhase('ended');
        setResult(finalText);
        setMessages((m) => {
          const next = [...m, msg, defenseMsg, { id: uid(), turn, team: 'system' as const, text: finalText, timestamp: Date.now() }];
          Storage.appendHistory({
            id: uid(), endedAt: Date.now(), result: finalText, messages: next,
            config: { matchType: matchType as MatchType, turnMinutes: null, startedAt: Date.now(), bossDifficulty: difficulty },
          });
          return next;
        });
        return;
      }
      setMessages((m) => [...m, msg, defenseMsg]);
      advanceTurn();
      return;
    }
    setBattleAttrs((attrs) => ({ ...attrs, [currentTeam]: finalAttrs }));
    registerPersistentEffects(played.map(p => p.cardSnapshot), keptActiveEffectIds);
    setMessages((m) => [...m, msg]);
    advanceTurn();
  };

  const runBossTurn = () => {
    if (!initCT1 || phase !== 'play') return;
    const playerCT = { ...initCT1, attrs: battleAttrs.team1 as Record<Attr, number> };
    const activeDiverseTargets = countActiveDiverseTargets('team1');
    const bossAnalysis = mergeActiveTargetsIntoAnalysis(lastBossAnalysisRef.current, activeDiverseTargets);
    const attack = resolveBossAttack(bossState, playerCT, battleAttrs.team1, bossAnalysis);
    const targetHitLines = applyBossTargetHits(attack);
    const nextBossCT = createBossCT(attack.boss);
    const targetHitExtra = targetHitLines.length > 0 ? `\n${targetHitLines.join('\n')}` : '';
    const bossExtra = attack.card?.kind === 'attack'
      ? `ENE restante: ${formatNumberBR(attack.boss.stats.Ene)}\nDano possível: ${formatNumberBR(attack.damagePossible)}${targetHitExtra}\nAguardando resposta do jogador.`
      : `ENE restante: ${formatNumberBR(attack.boss.stats.Ene)}\nAguardando resposta do jogador.`;
    const bossCard = attack.card
      ? bossCardToSnapshot(attack.card, bossExtra)
      : undefined;
    setBossState(attack.boss);
    setBattleAttrs((attrs) => ({ ...attrs, team2: ctToBattleAttrs(nextBossCT) }));
    const bossMsg: ChatMsg = {
      id: uid(),
      turn,
      team: 'team2',
      text: attack.lines.join('\n'),
      timestamp: Date.now(),
      playedCards: bossCard ? [{ cardSnapshot: bossCard }] : undefined,
      ctSnapshot: nextBossCT,
      finalAttrs: ctToBattleAttrs(nextBossCT),
    };
    bossMsg.calculationDetails = calculationDetailsFor(bossMsg);
    setMessages((m) => [...m, { ...bossMsg, text: [...attack.lines, ...targetHitLines].join('\n') }]);
    advanceTurn();
  };

  const applyBossTargetHits = (attack: ReturnType<typeof resolveBossAttack>) => {
    const card = attack.card;
    if (!card || card.kind !== 'attack' || !card.maxTargets) return [];
    let remainingTargets = card.maxTargets;
    const lines: string[] = [];
    const nextEffects: ActiveEffect[] = [];

    for (const effect of activeEffects) {
      if (effect.team !== 'team1' || !isDiverseSummonCard(effect.card) || remainingTargets <= 0) {
        nextEffects.push(effect);
        continue;
      }
      const current = effect.quantityCurrent ?? initialDiverseQuantity(effect.card) ?? 0;
      if (current <= 0) {
        nextEffects.push(effect);
        continue;
      }

      const hit = Math.min(current, remainingTargets);
      const left = current - hit;
      const label = diverseSummonLabel(effect.card);
      remainingTargets -= hit;
      lines.push(`${formatNumberBR(hit)} ${label} foram atingidos/destruídos.`);
      if (left > 0) {
        lines.push(`${formatNumberBR(left)} ${label} restantes.`);
        nextEffects.push({ ...effect, quantityCurrent: left, card: { ...effect.card, summonQuantity: left } });
      } else {
        lines.push(`Todos os ${label} foram destruídos.`);
      }
    }

    if (lines.length > 0) setActiveEffects(nextEffects);
    return lines;
  };

  const countActiveDiverseTargets = (team: Team) => activeEffects.reduce((total, effect) => {
    if (effect.team !== team || !isDiverseSummonCard(effect.card)) return total;
    return total + (effect.quantityCurrent ?? initialDiverseQuantity(effect.card) ?? 0);
  }, 0);

  const mergeActiveTargetsIntoAnalysis = (analysis: PlayerActionAnalysis | undefined, activeTargets: number): PlayerActionAnalysis | undefined => {
    if (activeTargets <= 0) return analysis;
    return {
      isAttack: analysis?.isAttack ?? false,
      isDefense: analysis?.isDefense ?? false,
      isGenjutsu: analysis?.isGenjutsu ?? false,
      isSealing: analysis?.isSealing ?? false,
      isArea: (analysis?.isArea ?? false) || activeTargets > 3,
      isInstant: analysis?.isInstant ?? false,
      declaredKill: analysis?.declaredKill ?? false,
      cloneCount: Math.max(analysis?.cloneCount ?? 0, activeTargets),
      declaredTargets: Math.max(analysis?.declaredTargets ?? 1, activeTargets),
      maxSpeed: analysis?.maxSpeed,
      attackPower: analysis?.attackPower ?? 0,
      defensePower: analysis?.defensePower ?? 0,
      text: analysis?.text ?? '',
    };
  };

  useEffect(() => {
    if (!isBoss || phase !== 'play' || currentTeam !== 'team2' || bossBusyRef.current) return;
    bossBusyRef.current = true;
    const timer = setTimeout(() => {
      runBossTurn();
      bossBusyRef.current = false;
    }, 900);
    return () => {
      clearTimeout(timer);
      bossBusyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBoss, phase, currentTeam, turn]);

  const registerPersistentEffects = (playedCards: Card[], keptActiveEffectIds: string[]) => {
    const persistent = playedCards.filter(card => card.durationType && card.durationType !== 'instantâneo');
    setActiveEffects((effects) => {
      const playedById = new Map(playedCards.map(card => [card.id, card]));
      let next = effects
        .filter(effect => effect.team !== currentTeam || keptActiveEffectIds.includes(effect.id))
        .map((effect) => {
          if (effect.team !== currentTeam) return effect;
          const played = playedById.get(effect.card.id);
          if (!played) return effect;
          const quantityCurrent = effect.quantityCurrent ?? initialDiverseQuantity(effect.card);
          return {
            ...effect,
            quantityCurrent,
            quantityInitial: effect.quantityInitial ?? quantityCurrent,
            card: {
              ...played,
              summonQuantity: quantityCurrent ?? played.summonQuantity,
            },
          };
        });
      persistent.forEach((card, index) => {
        if (next.some(effect => effect.team === currentTeam && effect.card.id === card.id)) return;
        const quantity = initialDiverseQuantity(card);
        next.push({
          id: `${card.id}:${Date.now()}:${index}`,
          team: currentTeam,
          card: quantity ? { ...card, summonQuantity: quantity } : card,
          remainingTurns: card.durationType === 'turnos' ? card.durationTurns || 0 : undefined,
          quantityInitial: quantity,
          quantityCurrent: quantity,
        });
      });
      return next;
    });
  };

  const passTurn = () => {
    deactivateUnselectedActives(currentTeam, `${currentTeam === 'team1' ? 'Time 1' : t2Label} passou o turno.`);
    advanceTurn();
  };

  const deactivateUnselectedActives = (team: Team, prefix?: string) => {
    const effects = activeEffects.filter(effect => effect.team === team);
    if (effects.length === 0) {
      if (prefix) addSystem(prefix);
      return;
    }
    const nextAttrs = effects.reduce((attrs, effect) => subtractAttrs(attrs, effect.card.boost), battleAttrs[team]);
    setBattleAttrs((attrs) => ({ ...attrs, [team]: nextAttrs }));
    setActiveEffects((items) => items.filter(effect => effect.team !== team));
    const removed = effects.map(effect => effect.card.name).join(', ');
    const finalText = `Atributos atuais: ${CT_ATTRS.map(attr => `${attr}:${formatNumberBR(nextAttrs[attr])}`).join(' • ')}.`;
    addSystem([prefix, `Desativado: ${removed}. Bônus removido.`, finalText].filter(Boolean).join(' '));
  };

  const sendLocalChat = () => {
    const text = localChatText.trim();
    if (!text) return;
    setMessages((m) => [...m, { id: uid(), turn, team: currentTeam, text, timestamp: Date.now() }]);
    setLocalChatText('');
  };

  const advanceTurn = () => {
    const newT1 = currentTeam === 'team1' ? true : t1Played;
    const newT2 = currentTeam === 'team2' ? true : t2Played;
    if (newT1 && newT2) {
      setT1Played(false); setT2Played(false);
      setTurn(t => t + 1);
    } else {
      setT1Played(newT1); setT2Played(newT2);
    }
    const nextTeam = currentTeam === 'team1' ? 'team2' : 'team1';
    setCurrentTeam(nextTeam);
    setTimeLeft(turnSeconds);
  };

  const disableActive = (effectId: string) => {
    const effect = activeEffects.find(e => e.id === effectId);
    if (!effect) return;
    setBattleAttrs((attrs) => ({ ...attrs, [effect.team]: subtractAttrs(attrs[effect.team], effect.card.boost) }));
    setActiveEffects((effects) => effects.filter(e => e.id !== effectId));
    setMessages((m) => [...m, { id: uid(), turn, team: 'system', text: `${effect.card.name} foi desativado.`, timestamp: Date.now() }]);
  };

  const declareDeath = () => {
    const dead = currentTeam === 'team1' ? 'Time 1' : t2Label;
    const winner = currentTeam === 'team1' ? t2Label : 'Time 1';
    endBattle(`${dead} morreu. ${winner} venceu!`);
  };
  const giveUp = () => {
    const loser = currentTeam === 'team1' ? 'Time 1' : t2Label;
    const winner = currentTeam === 'team1' ? t2Label : 'Time 1';
    endBattle(`${loser} desistiu. ${winner} venceu!`);
  };

  if (phase === 'init') {
    return (
      <Screen testID="battle-init-screen">
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} testID="header-back-btn" style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}>
            <Ionicons name="chevron-back" size={22} color={theme.colors.primary} />
          </Pressable>
          <Text style={styles.headerTitle}>Turno de Apresentação</Text>
        </View>

        <Text style={styles.subInfo}>{matchType} • {isBoss ? `Contra Boss • ${BOSS_DIFFICULTY_LABELS[difficulty]}` : `${totalMinutes} min/turno`}</Text>

        {cts.length === 0 ? (
          <Text style={styles.empty}>Crie pelo menos um C.T antes de iniciar a luta.</Text>
        ) : (
          <>
            <CTSelector label="Time 1 — O C.T inicial" cts={cts} value={initCT1} onChange={setInitCT1} testID="select-ct1" />
            {isBoss ? (
              <View style={styles.bossInitCard}>
                <Text style={styles.cardName}>Kael’Zor — Fragmento Selado do Vazio</Text>
                <Text style={styles.obs}>Rank B • Fácil • ENE: {formatNumberBR(bossState.stats.Ene)}</Text>
                <Text style={styles.obs}>HP {formatNumberBR(bossState.stats.Hp)} • ATK {formatNumberBR(bossState.stats.Atk)} • DEF {formatNumberBR(bossState.stats.Def)} • AG {formatNumberBR(bossState.stats.Ag)}</Text>
                <Text style={styles.obs}>Boss automático simples por regras: analisa Speed, dano, texto, clones/alvos e não aceita morte declarada sem cálculo.</Text>
              </View>
            ) : (
              <CTSelector label={`${t2Label} — O C.T inicial`} cts={cts} value={initCT2} onChange={setInitCT2} testID="select-ct2" />
            )}
            <Button title="Iniciar batalha" onPress={startPresentation} testID="start-presentation-btn" style={{ marginTop: 16 }} />
          </>
        )}
      </Screen>
    );
  }

  return (
    <Screen scroll={false} testID="battle-screen">
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} testID="header-back-btn" style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}>
          <Ionicons name="chevron-back" size={20} color={theme.colors.primary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.turnTitle}>Turno {turn}</Text>
          <Text style={styles.turnSub}>{currentTeam === 'team1' ? 'Vez de Time 1' : `Vez de ${t2Label}`}</Text>
        </View>
        <View style={styles.timerBox}>
          <Text style={styles.timerText}>{fmt(timeLeft)}</Text>
        </View>
      </View>

      <FlatList
        ListHeaderComponent={activeCards.length > 0 ? (
          <ActiveCardsBar effects={activeCards} onDisable={disableActive} />
        ) : null}
        data={messages}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingVertical: 12, gap: 8 }}
        renderItem={({ item }) => <ChatBubble msg={item} t2Label={t2Label} onImagePress={setZoomImage} />}
        ListEmptyComponent={<Text style={styles.empty}>Nenhuma jogada ainda. Faça sua jogada.</Text>}
      />

      {phase === 'play' ? (
        <>
          <View style={styles.chatBar}>
            <Input label="Chat local" value={localChatText} onChangeText={setLocalChatText} placeholder="Mensagem de teste" testID="local-chat-input" style={{ minHeight: 42 }} />
            <Button title="Enviar" onPress={sendLocalChat} testID="local-chat-send" small />
          </View>
          {isAutoBossTurn ? (
            <View style={styles.actionBar}>
              <Text style={styles.bossThinking}>Kael’Zor está escolhendo a resposta...</Text>
            </View>
          ) : (
            <View style={styles.actionBar}>
              <Button title="Jogar" onPress={() => setPickerVisible(true)} testID="play-btn" style={{ flex: 1 }} small />
              <Button title="Morte" variant="danger" onPress={declareDeath} testID="death-btn" small />
              <Button title="Passar" variant="ghost" onPress={passTurn} testID="pass-btn" small />
              <Button title="Desistir" variant="danger" onPress={giveUp} testID="give-up-btn" small />
            </View>
          )}
        </>
      ) : (
        <View style={styles.endedBar}>
          <Text style={styles.endedText}>{result}</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Nova Luta" onPress={() => router.replace('/arena')} variant="secondary" small testID="new-battle-btn" />
            <Button title="Voltar ao Menu" onPress={() => router.replace('/')} small testID="back-menu-btn" />
          </View>
        </View>
      )}

      <PlayModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        cards={cards}
        activeCT={currentActiveCT}
        activeEffects={activeEffects.filter(effect => effect.team === currentTeam)}
        bossDifficulty={isBoss ? difficulty : undefined}
        onImagePress={setZoomImage}
        onConfirm={(played, ctSnap, obs, finalAttrs, keptActiveEffectIds, activeEntity, finalEntityAttrs, momentaryActions) => {
          setPickerVisible(false);
          onSendPlay(played, ctSnap, obs, finalAttrs, keptActiveEffectIds, activeEntity, finalEntityAttrs, momentaryActions);
        }}
      />
      <ZoomableImageModal uri={zoomImage} onClose={() => setZoomImage(null)} />
    </Screen>
  );
}

function ActiveCardsBar({ effects, onDisable }: { effects: ActiveEffect[]; onDisable: (id: string) => void }) {
  return (
    <View style={styles.activeBar}>
      <Text style={styles.label}>Ativos da luta</Text>
      {effects.map(effect => {
        const card = effect.card;
        const upkeep = ATTRS.filter(a => card.upkeepCost?.[a] != null).map(a => `${a}:${formatNumberBR(card.upkeepCost?.[a])}`).join(' • ');
        const boost = ATTRS.filter(a => card.boost?.[a] != null).map(a => `${a}:${formatNumberBR(card.boost?.[a])}`).join(' • ');
        const quantity = effect.quantityCurrent ?? initialDiverseQuantity(card);
        const quantityInitial = effect.quantityInitial ?? quantity;
        return (
          <View key={effect.id} style={styles.activeItem}>
            <Text style={styles.cardName}>{card.name} • {card.cardType || 'técnica'}</Text>
            <Text style={styles.obs}>Duração: {card.durationType === 'turnos' ? `por turnos (${effect.remainingTurns || 0})` : 'persistente'}{upkeep ? ` • Custo/turno: ${upkeep}` : ''}</Text>
            {quantity ? <Text style={styles.obs}>Quantidade: {formatNumberBR(quantity)}{quantityInitial ? `/${formatNumberBR(quantityInitial)}` : ''}</Text> : null}
            {boost ? <Text style={styles.obs}>Bônus ativo: {boost}</Text> : null}
            <Pressable onPress={() => onDisable(effect.id)} style={styles.activeDisable}><Text style={styles.activeDisableText}>Desativar</Text></Pressable>
          </View>
        );
      })}
    </View>
  );
}

function fmt(s: number) {
  const m = Math.floor(s / 60); const r = s % 60;
  return `${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`;
}

function CTSelector({ label, cts, value, onChange, testID }: { label: string; cts: CT[]; value: CT | null; onChange: (c: CT) => void; testID?: string }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
        {cts.map((c) => {
          const active = value?.id === c.id;
          return (
            <Pressable
              key={c.id}
              onPress={() => onChange(c)}
              testID={`${testID}-${c.id}`}
              style={({ pressed }) => [styles.ctCard, active && styles.ctCardActive, { opacity: pressed ? 0.85 : 1 }]}
            >
              {c.image ? <Image source={{ uri: c.image }} style={styles.ctImg} /> : <View style={[styles.ctImg, styles.ctImgFallback]}><Ionicons name="shield" size={26} color={theme.colors.gold} /></View>}
              <Text style={styles.ctName} numberOfLines={1}>{ctDisplayName(c)}</Text>
              <Text style={styles.ctRank}>Rank {c.rank}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function ChatBubble({ msg, t2Label, onImagePress }: { msg: ChatMsg; t2Label: string; onImagePress: (uri: string) => void }) {
  const [showCalc, setShowCalc] = useState(false);
  if (msg.team === 'system') {
    return (
      <View style={styles.systemRow}>
        <Text style={styles.systemText}>{msg.text}</Text>
      </View>
    );
  }
  const isT1 = msg.team === 'team1';
  return (
    <View style={[styles.bubbleRow, { justifyContent: isT1 ? 'flex-end' : 'flex-start' }]}>
      <View style={[styles.bubble, isT1 ? styles.bubbleT1 : styles.bubbleT2]}>
        <Text style={styles.bubbleHeader}>Turno {msg.turn} • {isT1 ? 'Time 1' : t2Label}</Text>
        {msg.text ? <Text style={styles.chatText}>{msg.text}</Text> : null}

        {msg.playedCards?.map((p, idx) => (
          <View key={idx} style={styles.playedCard}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <ZoomableThumb uri={p.cardSnapshot.image} onPress={onImagePress} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{p.cardSnapshot.name}</Text>
                <RankBadge rank={p.cardSnapshot.rank || 'E'} />
              </View>
            </View>
            {p.cardSnapshot.caption ? <Text style={styles.cardCaption}>{p.cardSnapshot.caption}</Text> : null}
            {renderEffectLines(p.cardSnapshot, msg.momentaryActions?.find(action => action.cardId === p.cardSnapshot.id))}
          </View>
        ))}

        {msg.ctSnapshot && (
          <View style={styles.ctBlock}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <ZoomableThumb uri={msg.ctSnapshot.image} onPress={onImagePress} />
              <Text style={styles.cardName}>{ctDisplayName(msg.ctSnapshot)} — Rank {msg.ctSnapshot.rank}</Text>
            </View>
            {msg.finalAttrs && (
              <View style={{ marginTop: 6 }}>
                {visibleFinalAttrs(msg.finalAttrs!).filter(a => !(msg.ctSnapshot?.resourceName === 'ENE' && a === 'Ck')).map((a) => (
                  <Text key={a} style={styles.attrLine}>{a}: {formatNumberBR(msg.finalAttrs![a])}</Text>
                ))}
                {msg.ctSnapshot.resourceName === 'ENE' ? <Text style={styles.attrLine}>ENE: {formatNumberBR(msg.ctSnapshot.resourceValue || 0)}</Text> : null}
              </View>
            )}
            {msg.ctObservation ? <Text style={styles.obs}>Obs: {msg.ctObservation}</Text> : null}
          </View>
        )}
        {msg.activeEntitySnapshot ? (
          <View style={styles.entityBlock}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <ZoomableThumb uri={msg.activeEntitySnapshot.image} onPress={onImagePress} />
              <Text style={styles.cardName}>{msg.activeEntitySnapshot.entityType || 'invocação'} {msg.activeEntitySnapshot.name} — Rank {msg.activeEntitySnapshot.rank}</Text>
            </View>
            <Text style={styles.obs}>Custos/aumentos aplicados na entidade ativa.</Text>
            {msg.finalEntityAttrs ? (
              <View style={{ marginTop: 6 }}>
                {ATTRS.map(a => <Text key={a} style={styles.attrLine}>{a}: {formatNumberBR(msg.finalEntityAttrs![a])}</Text>)}
              </View>
            ) : null}
          </View>
        ) : null}

        {(msg.calculationDetails?.length || msg.playedCards?.length) ? (
          <View style={styles.calcBox}>
            <Pressable onPress={() => setShowCalc(value => !value)} style={styles.calcButton}>
              <Text style={styles.calcButtonText}>{showCalc ? 'Ocultar cálculo' : 'Ver cálculo'}</Text>
            </Pressable>
            {showCalc ? (msg.calculationDetails || calculationDetailsFor(msg)).map((line, index) => (
              <Text key={index} style={styles.calcLine}>{line}</Text>
            )) : null}
          </View>
        ) : null}

        <Text style={styles.time}>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
      </View>
    </View>
  );
}

function renderEffectLines(c: Card, action?: MomentaryAction) {
  const lines: string[] = [];
  const cost = ATTRS.filter(a => c.cost[a] != null).map(a => `${a}: ${formatNumberBR(c.cost[a])}`).join(', ');
  const boost = ATTRS.filter(a => c.boost[a] != null).map(a => `${a}: ${formatNumberBR(c.boost[a])}`).join(', ');
  const unl = ATTRS.filter(a => c.unlimited[a]).map(a => `${a}: ilimitado`).join(', ');
  const speedValue = (value?: Card['speed']) => value === 'instant' ? 'Instantânea' : value != null ? String(value) : '';
  if (c.actionType === 'movement' || c.cardType === 'movimentação') {
    lines.push('Tipo: Movimentação');
    if (c.movementType) lines.push(`Movimento: ${c.movementType}`);
    if (c.movementRange) lines.push(`Alcance: ${c.movementRange}`);
  }
  if (c.actionType === 'perception' || c.cardType === 'percepção/rastreamento/reação') {
    lines.push(`Tipo: ${c.sensoryType || 'Percepção/reação'}`);
    if (c.detectsUntilSpeed != null) lines.push(`Detecta até Speed: ${speedValue(c.detectsUntilSpeed)}`);
    if (c.reactionUntilSpeed != null) lines.push(`Permite reação até Speed: ${speedValue(c.reactionUntilSpeed)}`);
    if (c.reducesSpeedBy) lines.push(`Reduz Speed em: ${formatNumberBR(c.reducesSpeedBy)}`);
    const flags = [
      c.detectsInvisibility ? 'detecta invisibilidade' : '',
      c.detectsChakra ? 'detecta chakra/energia' : '',
      c.detectsPresence ? 'detecta presença' : '',
      c.tracksTarget ? 'rastreia alvo' : '',
      c.tracksMovement ? 'rastreia movimento' : '',
    ].filter(Boolean).join(' • ');
    if (flags) lines.push(`Capacidades: ${flags}`);
  }
  if (c.actionType === 'diverse_summon' || c.cardType === 'invocação diversa') {
    lines.push(`Tipo: Invocação diversa${c.summonType ? ` / ${c.summonType}` : ''}`);
    if (c.summonQuantity) lines.push(`Quantidade: ${formatNumberBR(c.summonQuantity)}`);
    if (c.summonHpIndividual) lines.push(`HP individual: ${formatNumberBR(c.summonHpIndividual)}`);
    if (c.summonHpTotal) lines.push(`HP total: ${formatNumberBR(c.summonHpTotal)}`);
    if (c.summonAtkIndividual) lines.push(`Atk individual: ${formatNumberBR(c.summonAtkIndividual)}`);
    if (c.summonDefIndividual) lines.push(`Def individual: ${formatNumberBR(c.summonDefIndividual)}`);
  }
  if (c.targetShape) lines.push(`Área/alvo: ${c.targetShape}`);
  if (c.targetCount) lines.push(`Alvos/quantidade: ${formatNumberBR(c.targetCount)}`);
  if (c.maxTargets) lines.push(`Máx. alvos atingidos: ${formatNumberBR(c.maxTargets)}`);
  if (action) {
    for (const attr of ATTRS.filter(a => action.final[a] != null)) {
      lines.push(`${attr} final: ${formatNumberBR(action.final[attr])}`);
      const own = action.own[attr] || 0;
      if (action.usedCTInfluence) {
        const influence = (action.final[attr] || 0) - own;
        lines.push(`Base técnica: ${formatNumberBR(own)}`);
        lines.push(`Influência ${action.source === 'entity' ? 'invocação' : 'C.T'}: +${formatNumberBR(influence)}`);
      }
    }
  } else {
    const momentary = ATTRS.filter(a => c.momentaryAttrs?.[a] != null).map(a => `${a}: ${formatNumberBR(c.momentaryAttrs?.[a])}`).join(', ');
    if (momentary) lines.push(`Ação: ${momentary}`);
  }
  if (cost) lines.push(`Custo: ${cost}`);
  if (boost) lines.push(`Aumento: ${boost}`);
  if (unl) lines.push(unl);
  const upkeep = ATTRS.filter(a => c.upkeepCost?.[a] != null).map(a => `${a}: ${formatNumberBR(c.upkeepCost?.[a])}`).join(', ');
  if (c.durationType && c.durationType !== 'instantâneo') lines.push(`Persistente: ${c.durationType}${c.durationType === 'turnos' ? ` (${c.durationTurns || 0} turnos)` : ''}`);
  if (upkeep) lines.push(`Custo por turno: ${upkeep}`);
  const speed = formatSpeed(c.speed);
  if (speed) lines.push(speed);
  return lines.map((l, i) => <Text key={i} style={styles.fxLine}>{l}</Text>);
}

function ZoomableThumb({ uri, onPress }: { uri?: string; onPress: (uri: string) => void }) {
  if (!uri) return <View style={[styles.cardThumb, styles.cardThumbFb]} />;
  return (
    <Pressable onPress={() => onPress(uri)} hitSlop={8}>
      <Image source={{ uri }} style={styles.cardThumb} />
    </Pressable>
  );
}

function RankBadge({ rank }: { rank: CardRank | Rank }) {
  return <Text style={[styles.inlineRank, rank === 'S-R' && styles.inlineRankSpecial]}>{rank}</Text>;
}

function canCTUseCard(ct: CT | null, card: Card) {
  if (!ct) return true;
  if (ct.rank === 'B') return ['S-R', 'E', 'D', 'C', 'B'].includes(card.rank || 'E');
  const order: Record<CardRank, number> = { 'S-R': 0, E: 1, D: 2, C: 3, B: 4, A: 5, S: 6 };
  return order[card.rank || 'E'] <= order[ct.rank];
}

function canBossDifficultyUseCard(difficulty: BossDifficulty, card: Card) {
  return CARD_RANK_ORDER[card.rank || 'E'] <= CARD_RANK_ORDER[BOSS_DIFFICULTY_MAX_RANK[difficulty]];
}

function cloneCardForPlay(card: Card, captions: Record<string, string>) {
  return {
    ...card,
    caption: captions[card.id] ?? card.caption,
    cost: { ...card.cost },
    boost: { ...card.boost },
    unlimited: { ...card.unlimited },
    entityAttrs: card.entityAttrs ? { ...card.entityAttrs } : undefined,
    entityUnlimited: card.entityUnlimited ? { ...card.entityUnlimited } : undefined,
  };
}

function entityFromCard(card: Card): BattleEntity {
  return {
    id: `${card.id}:entity`,
    name: card.name,
    image: card.image,
    rank: card.rank || 'E',
    attrs: { Atk: 0, Def: 0, Dur: 0, Ag: 0, Ck: 0, Hp: 0, ...(card.entityAttrs || {}) },
    unlimited: {},
    sourceCardId: card.id,
    entityType: card.entityType,
  };
}

// ====== Play Modal ======
function PlayModal({ visible, onClose, cards, activeCT, activeEffects = [], bossDifficulty, onImagePress, onConfirm }:
  { visible: boolean; onClose: () => void; cards: Card[]; activeCT: CT | null; activeEffects?: ActiveEffect[]; bossDifficulty?: BossDifficulty;
    onImagePress: (uri: string) => void;
    onConfirm: (p: PlayedCard[], ct: CT, obs: string, finalAttrs: Record<Attr, number | 'ilimitado'>, keptActiveEffectIds: string[], activeEntity?: BattleEntity, finalEntityAttrs?: Record<Attr, number | 'ilimitado'>, momentaryActions?: MomentaryAction[]) => void }) {

  const [step, setStep] = useState<'cards' | 'card-edit' | 'target' | 'checklist'>('cards');
  const [selectedCards, setSelectedCards] = useState<Card[]>([]);
  const [editIdx, setEditIdx] = useState(0);
  const [activeEntityId, setActiveEntityId] = useState<string | null>(null);
  const [entityCostCardIds, setEntityCostCardIds] = useState<string[]>([]);
  const [entityBoostCardIds, setEntityBoostCardIds] = useState<string[]>([]);
  const [observation, setObservation] = useState('');
  const [cardQuery, setCardQuery] = useState('');
  const [cardRanks, setCardRanks] = useState<CardRank[]>([]);
  const [lastCardIds, setLastCardIds] = useState<string[]>([]);
  const [lastCaptions, setLastCaptions] = useState<Record<string, string>>({});

  useEffect(() => {
    if (visible) {
      setStep('cards'); setEditIdx(0); setActiveEntityId(null); setEntityCostCardIds([]); setEntityBoostCardIds([]); setObservation('');
      setCardQuery(''); setCardRanks([]);
      Storage.getLastPlayedCardIds().then(setLastCardIds);
      Storage.getLastCardCaptions().then((captions) => {
        setLastCaptions(captions);
        setSelectedCards(activeEffects.map(effect => cloneCardForPlay(effect.card, captions)));
      });
    }
  // Reset only when the modal opens; activeEffects is intentionally captured from that open.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const toggleCard = (c: Card) => {
    setSelectedCards((arr) => arr.some(x => x.id === c.id)
      ? arr.filter(x => x.id !== c.id)
      : [...arr, cloneCardForPlay(c, lastCaptions)]);
  };
  const updateCard = (patch: Partial<Card>) => {
    setSelectedCards(arr => arr.map((c, i) => i === editIdx ? { ...c, ...patch } : c));
  };

  const goEditCards = () => {
    if (selectedCards.length === 0) {
      setStep('target');
      return;
    }
    setEditIdx(0); setStep('card-edit');
  };

  const finishCardEdits = () => {
    if (editIdx + 1 < selectedCards.length) setEditIdx(editIdx + 1);
    else setStep('target');
  };
  const toggleCardRank = (rank: CardRank) => setCardRanks((ranks) => ranks.includes(rank) ? ranks.filter(r => r !== rank) : [...ranks, rank]);
  const toggleActiveCard = (card: Card) => setSelectedCards((arr) => arr.some(item => item.id === card.id) ? arr.filter(item => item.id !== card.id) : [...arr, cloneCardForPlay(card, lastCaptions)]);
  const activeCardIds = activeEffects.map(effect => effect.card.id);
  const visibleCards = [...cards].sort((a, b) => {
    const aa = activeCardIds.indexOf(a.id);
    const ba = activeCardIds.indexOf(b.id);
    if (aa !== -1 || ba !== -1) {
      if (aa === -1) return 1;
      if (ba === -1) return -1;
      return aa - ba;
    }
    const ai = lastCardIds.indexOf(a.id);
    const bi = lastCardIds.indexOf(b.id);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  }).filter((c) => {
    const q = cardQuery.trim().toLowerCase();
    const queryOk = !q || `${c.name} ${c.caption} ${c.rank || ''} ${c.cardType || ''} ${c.actionType || ''} ${c.movementType || ''} ${c.movementRange || ''} ${c.summonType || ''} ${c.targetShape || ''} ${c.sensoryType || ''} ${c.detectsInvisibility ? 'detecta invisibilidade' : ''} ${c.detectsChakra ? 'detecta chakra energia' : ''} ${c.detectsPresence ? 'detecta presença' : ''} ${c.tracksTarget ? 'rastreia alvo' : ''} ${c.tracksMovement ? 'rastreia movimento' : ''} ${formatSpeed(c.speed)}`.toLowerCase().includes(q);
    const rankOk = cardRanks.length === 0 || cardRanks.includes(c.rank || 'E');
    const bossOk = !bossDifficulty || canBossDifficultyUseCard(bossDifficulty, c);
    return queryOk && rankOk && bossOk && canCTUseCard(activeCT, c);
  });
  const entities = selectedCards.filter(c => c.entityType).map(entityFromCard);
  const activeEntity = entities.find(e => e.id === activeEntityId);
  const toggleEntityCostCard = (cardId: string) => setEntityCostCardIds(ids => ids.includes(cardId) ? ids.filter(id => id !== cardId) : [...ids, cardId]);
  const toggleEntityBoostCard = (cardId: string) => setEntityBoostCardIds(ids => ids.includes(cardId) ? ids.filter(id => id !== cardId) : [...ids, cardId]);
  const entityCostNames = selectedCards.filter(c => entityCostCardIds.includes(c.id)).map(c => c.name).join(', ');
  const ctCostNames = selectedCards.filter(c => !entityCostCardIds.includes(c.id)).map(c => c.name).join(', ');
  const entityBoostNames = selectedCards.filter(c => entityBoostCardIds.includes(c.id)).map(c => c.name).join(', ');
  const ctBoostNames = selectedCards.filter(c => !entityBoostCardIds.includes(c.id)).map(c => c.name).join(', ');

  const confirmPlay = () => {
    if (!activeCT) { Alert.alert('Atenção', 'O C.T inicial não está definido.'); return; }
    const entityCostIds = activeEntity ? entityCostCardIds : [];
    const entityBoostIds = activeEntity ? entityBoostCardIds : [];
    const selectedCardIds = new Set(selectedCards.map(card => card.id));
    const keptEffects = activeEffects.filter(effect => selectedCardIds.has(effect.card.id));
    const keptEffectIds = keptEffects.map(effect => effect.id);
    const droppedEffects = activeEffects.filter(effect => !keptEffectIds.includes(effect.id));
    const removedEffects = droppedEffects;
    const activeIds = keptEffects.map(effect => effect.card.id);
    let effectiveAttrs = removedEffects.reduce((attrs, effect) => subtractAttrs(attrs, effect.card.boost), activeCT.attrs as BattleAttrs);
    const upkeepNotes: string[] = [];
    for (const effect of keptEffects) {
      const upkeep = ATTRS.filter(attr => effect.card.upkeepCost?.[attr] != null).map(attr => `${attr}:${formatNumberBR(effect.card.upkeepCost?.[attr])}`).join(', ');
      if (!upkeep) continue;
      effectiveAttrs = applyUpkeep(effectiveAttrs, effect.card.upkeepCost);
      upkeepNotes.push(`${effect.card.name}: custo por turno ${upkeep}`);
    }
    const effectiveCT = { ...activeCT, attrs: effectiveAttrs as Record<Attr, number> };
    const cardsForResolve = selectedCards.filter(card => !(card.durationType !== 'instantâneo' && activeIds.includes(card.id)));
    const resolved = resolveCombat(effectiveCT, activeEntity, cardsForResolve, entityCostIds, entityBoostIds);
    const targetNote = activeEntity ? `Alvo ativo: ${activeEntity.entityType || 'invocação'} ${activeEntity.name}.` : 'Alvo ativo: O C.T principal.';
    const costNote = activeEntity && entityCostIds.length > 0 ? `Custo na invocação: ${selectedCards.filter(c => entityCostIds.includes(c.id)).map(c => c.name).join(', ')}.` : 'Custos no O C.T principal.';
    const keptNote = keptEffects.length > 0 ? `Continua ativo: ${keptEffects.map(effect => effect.card.name).join(', ')}.` : '';
    const droppedNote = droppedEffects.length > 0 ? `Desativado: ${droppedEffects.map(effect => effect.card.name).join(', ')}. Bônus removido.` : '';
    const upkeepNote = upkeepNotes.length > 0 ? `Custo por turno aplicado: ${upkeepNotes.join(' • ')}.` : '';
    const obs = [targetNote, costNote, keptNote, droppedNote, upkeepNote, observation.trim()].filter(Boolean).join(' ');
    Storage.saveLastPlayedCardIds(selectedCards.map(c => c.id));
    Storage.getLastCardCaptions().then((captions) => Storage.saveLastCardCaptions({ ...captions, ...Object.fromEntries(selectedCards.map(c => [c.id, c.caption])) }));
    onConfirm(selectedCards.map(c => ({ cardSnapshot: c })), activeCT, obs, resolved.finalAttrs, keptEffectIds, activeEntity, resolved.finalEntityAttrs, resolved.momentaryActions);
  };

  const buildPreview = () => {
    if (!activeCT) return null;
    const resolved = resolveCombat(activeCT, activeEntity, selectedCards, activeEntity ? entityCostCardIds : [], activeEntity ? entityBoostCardIds : []);
    const cost = ATTRS.filter(attr => selectedCards.some(card => card.cost?.[attr] != null)).map(attr => `${attr}: ${formatNumberBR(selectedCards.reduce((sum, card) => sum + Number(card.cost?.[attr] || 0), 0))}`).join(' • ');
    const mainAtk = resolved.momentaryActions.find(action => action.final.Atk != null)?.final.Atk;
    const mainSpeed = selectedCards.map(card => card.speed).find(Boolean);
    const modes = selectedCards.filter(card => card.actionType === 'mode' || card.cardType === 'modo/buff').map(card => card.name).join(', ');
    const weapons = selectedCards.filter(card => card.actionType === 'equipment' || card.cardType === 'arma/equipamento').map(card => card.name).join(', ');
    const clones = selectedCards.filter(card => card.actionType === 'diverse_summon' || card.cardType === 'invocação diversa').map(card => `${card.name}${card.summonQuantity ? ` x${formatNumberBR(card.summonQuantity)}` : ''}`).join(', ');
    const upkeep = selectedCards.flatMap(card => ATTRS.filter(attr => card.upkeepCost?.[attr] != null).map(attr => `${card.name} ${attr}:${formatNumberBR(card.upkeepCost?.[attr])}`)).join(' • ');
    return { resolved, cost, mainAtk, mainSpeed, modes, weapons, clones, upkeep };
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalWrap}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {step === 'cards' ? '1. Selecione Cards' :
               step === 'card-edit' ? `2. Editar Card (${editIdx + 1}/${selectedCards.length})` :
               step === 'target' ? '3. Alvo e Envio' : '4. Checklist'}
            </Text>
            <Pressable onPress={onClose} testID="modal-close-btn"><Ionicons name="close" size={22} color="#fff" /></Pressable>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 90 }} keyboardShouldPersistTaps="handled">
            {step === 'cards' && (
              <>
                {cards.length === 0 && <Text style={styles.empty}>Você não tem cards. Pode prosseguir sem cards.</Text>}
                <Input label="Buscar card" value={cardQuery} onChangeText={setCardQuery} placeholder="Nome, legenda ou rank" testID="play-card-search" />
                <View style={styles.chipsRow}>
                  {CARD_RANKS.map(r => <Chip key={r} label={r} active={cardRanks.includes(r)} onPress={() => toggleCardRank(r)} testID={`play-rank-${r}`} />)}
                </View>
                <View style={{ gap: 10 }}>
                  {visibleCards.map((c) => {
                    const active = selectedCards.some(x => x.id === c.id);
                    return (
                      <Pressable key={c.id} onPress={() => toggleCard(c)} testID={`play-card-${c.id}`}
                        style={({ pressed }) => [styles.pickItem, active && styles.pickItemActive, { opacity: pressed ? 0.85 : 1 }]}>
                        <ZoomableThumb uri={c.image} onPress={onImagePress} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.pickName}>{[`${c.name} — ${c.rank || 'E'}`, formatSpeed(c.speed)].filter(Boolean).join(' • ')}</Text>
                          <Text style={styles.pickSub} numberOfLines={1}>{c.caption}</Text>
                        </View>
                        {active && <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />}
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}

            {step === 'card-edit' && selectedCards[editIdx] && (
              <CardEditInline
                card={selectedCards[editIdx]}
                onChange={updateCard}
              />
            )}

            {step === 'target' && activeCT && (
              <View>
                <Text style={styles.label}>O C.T ativo desta luta</Text>
                <View style={styles.ctBlock}>
                  <Text style={styles.cardName}>{ctDisplayName(activeCT)} — Rank {activeCT.rank}</Text>
                  {CT_ATTRS.map(a => <Text key={a} style={styles.attrLine}>{a}: {formatNumberBR(activeCT.attrs[a] ?? 0)}</Text>)}
                </View>
                {activeEffects.length > 0 ? (
                  <View style={styles.activeConfirmBox}>
                    <Text style={styles.label}>Ativos atuais</Text>
                    <Text style={styles.obs}>Eles continuam apenas se estiverem selecionados. Desmarque para desativar ao enviar.</Text>
                    {activeEffects.map(effect => {
                      const selectedAgain = selectedCards.some(card => card.id === effect.card.id);
                      const boost = ATTRS.filter(a => effect.card.boost?.[a] != null).map(a => `${a}:${formatNumberBR(effect.card.boost?.[a])}`).join(' • ');
                      const quantity = effect.quantityCurrent ?? initialDiverseQuantity(effect.card);
                      const quantityInitial = effect.quantityInitial ?? quantity;
                      return (
                        <View key={effect.id} style={styles.activeConfirmItem}>
                          <Text style={styles.cardName}>{effect.card.name} • {effect.card.cardType || 'técnica'}</Text>
                          <Text style={styles.obs}>{selectedAgain ? 'Continua ativo' : 'Será desativado'}{boost ? ` • Bônus: ${boost}` : ''}{quantity ? ` • Quantidade: ${formatNumberBR(quantity)}${quantityInitial ? `/${formatNumberBR(quantityInitial)}` : ''}` : ''}</Text>
                          <View style={styles.chipsRow}>
                            <Chip
                              label="Manter ativo"
                              active={selectedAgain}
                              onPress={() => !selectedAgain && toggleActiveCard(effect.card)}
                              testID={`keep-active-${effect.id}`}
                            />
                            <Chip
                              label="Desativar"
                              active={!selectedAgain}
                              onPress={() => selectedAgain && toggleActiveCard(effect.card)}
                              testID={`drop-active-${effect.id}`}
                            />
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ) : null}
                {entities.length > 0 ? (
                  <View>
                    <Text style={styles.label}>Alvo dos custos/aumentos</Text>
                    <View style={styles.chipsRow}>
                      <Chip label="O C.T principal" active={!activeEntityId} onPress={() => setActiveEntityId(null)} testID="play-target-ct" />
                      {entities.map(entity => (
                        <Chip
                          key={entity.id}
                          label={`${entity.entityType || 'invocação'} ${entity.name}`}
                          active={activeEntityId === entity.id}
                          onPress={() => setActiveEntityId(entity.id)}
                          testID={`play-target-entity-${entity.sourceCardId}`}
                        />
                      ))}
                    </View>
                  </View>
                ) : null}
                {activeEntity ? (
                  <View style={styles.entityBlock}>
                    <Text style={styles.cardName}>{activeEntity.name} — Rank {activeEntity.rank}</Text>
                    {ATTRS.map(a => <Text key={a} style={styles.attrLine}>{a}: {formatNumberBR(activeEntity.attrs[a])}</Text>)}
                  </View>
                ) : null}
                {activeEntity ? (
                  <View>
                    <Text style={styles.label}>Quais técnicas usam custo da invocação?</Text>
                    <View style={styles.chipsRow}>
                      <Chip label="Nenhuma" active={entityCostCardIds.length === 0} onPress={() => setEntityCostCardIds([])} testID="play-entity-cost-none" />
                      {selectedCards.map(card => (
                        <Chip
                          key={card.id}
                          label={card.name}
                          active={entityCostCardIds.includes(card.id)}
                          onPress={() => toggleEntityCostCard(card.id)}
                          testID={`play-entity-cost-${card.id}`}
                        />
                      ))}
                    </View>
                    <Text style={styles.obs}>Custo no O C.T: {ctCostNames || 'nenhum'}</Text>
                    <Text style={styles.obs}>Custo na invocação: {entityCostNames || 'nenhum'}</Text>
                    <Text style={styles.label}>Quais técnicas aumentam a invocação?</Text>
                    <View style={styles.chipsRow}>
                      <Chip label="Nenhuma" active={entityBoostCardIds.length === 0} onPress={() => setEntityBoostCardIds([])} testID="play-entity-boost-none" />
                      {selectedCards.map(card => (
                        <Chip
                          key={card.id}
                          label={card.name}
                          active={entityBoostCardIds.includes(card.id)}
                          onPress={() => toggleEntityBoostCard(card.id)}
                          testID={`play-entity-boost-${card.id}`}
                        />
                      ))}
                    </View>
                    <Text style={styles.obs}>Aumento no O C.T: {ctBoostNames || 'nenhum'}</Text>
                    <Text style={styles.obs}>Aumento na invocação: {entityBoostNames || 'nenhum'}</Text>
                  </View>
                ) : null}
                <Input
                  label="Observação"
                  value={observation}
                  onChangeText={setObservation}
                  placeholder="Ex: usei fonte de chakra e meu Ck ficou ilimitado."
                  multiline numberOfLines={3}
                  style={{ minHeight: 70, textAlignVertical: 'top' }}
                  testID="play-ct-obs"
                />
              </View>
            )}

            {step === 'checklist' && activeCT && (() => {
              const preview = buildPreview();
              return (
                <View style={styles.checklistBox}>
                  <Text style={styles.label}>Resumo antes de enviar</Text>
                  <Text style={styles.attrLine}>Cards selecionados: {selectedCards.map(card => card.name).join(', ') || 'nenhum'}</Text>
                  <Text style={styles.attrLine}>Custo total: {preview?.cost || 'sem custo'}</Text>
                  <Text style={styles.attrLine}>Alvo do custo: {activeEntity ? activeEntity.name : 'O C.T principal'}</Text>
                  <Text style={styles.attrLine}>Modos ativos: {preview?.modes || 'nenhum'}</Text>
                  <Text style={styles.attrLine}>Armas equipadas: {preview?.weapons || 'nenhuma'}</Text>
                  <Text style={styles.attrLine}>Clones/invocações: {preview?.clones || 'nenhum'}</Text>
                  <Text style={styles.attrLine}>Atk final principal: {formatNumberBR(preview?.mainAtk || 0)}</Text>
                  <Text style={styles.attrLine}>Speed principal: {preview?.mainSpeed === 'instant' ? 'Instantânea' : preview?.mainSpeed ?? 'sem Speed'}</Text>
                  <Text style={styles.attrLine}>Custo por turno: {preview?.upkeep || 'nenhum'}</Text>
                  {preview?.resolved.finalAttrs ? <Text style={styles.obs}>Após cálculo: {CT_ATTRS.map(attr => `${attr}:${formatNumberBR(preview.resolved.finalAttrs[attr])}`).join(' • ')}</Text> : null}
                </View>
              );
            })()}
          </ScrollView>

          <View style={styles.modalFooter}>
            {step === 'cards' && <Button title="Avançar" onPress={goEditCards} testID="play-next-cards" />}
            {step === 'card-edit' && <Button title={editIdx + 1 < selectedCards.length ? 'Próximo card' : 'Escolher alvo'} onPress={finishCardEdits} testID="play-next-card-edit" />}
            {step === 'target' && <Button title="Revisar jogada" onPress={() => setStep('checklist')} testID="play-review-btn" />}
            {step === 'checklist' && (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button title="Voltar e editar" variant="ghost" onPress={() => setStep('target')} style={{ flex: 1 }} testID="play-edit-btn" />
                <Button title="Confirmar jogada" onPress={confirmPlay} style={{ flex: 1 }} testID="play-confirm-btn" />
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function CardEditInline({ card, onChange }: { card: Card; onChange: (p: Partial<Card>) => void }) {
  const showMomentary = card.actionType === 'attack' || card.actionType === 'defense' || card.actionType === 'equipment';
  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 10 }}>
        {card.image ? <Image source={{ uri: card.image }} style={[styles.cardThumb, { width: 50, height: 50 }]} /> : null}
        <Text style={styles.pickName}>{[`${card.name} — ${card.rank || 'E'}`, formatSpeed(card.speed)].filter(Boolean).join(' • ')}</Text>
      </View>
      <Input label="Legenda (desta jogada)" value={card.caption} onChangeText={(t) => onChange({ caption: t })} multiline numberOfLines={3} style={{ minHeight: 70, textAlignVertical: 'top' }} testID="play-card-caption" />
      {showMomentary ? (
        <>
          <Text style={styles.label}>Valor momentâneo</Text>
          <AttrEditor
            label={card.actionType === 'defense' ? 'Defesa momentânea' : card.actionType === 'equipment' ? 'Atk/Def da arma' : 'Ataque momentâneo'}
            values={card.momentaryAttrs || {}}
            setValues={(v) => onChange({ momentaryAttrs: v })}
            keyPrefix={`play-momentary-${card.id}`}
            allowedAttrs={card.actionType === 'attack' ? ['Atk'] : card.actionType === 'defense' ? ['Def'] : ['Atk', 'Def']}
          />
          <Text style={styles.label}>Usar atributo do O C.T/alvo no cálculo?</Text>
          <View style={styles.chipsRow}>
            <Chip label="Não" active={!card.useCTInfluence} onPress={() => onChange({ useCTInfluence: false })} testID={`play-influence-no-${card.id}`} />
            <Chip label="Sim" active={!!card.useCTInfluence} onPress={() => onChange({ useCTInfluence: true })} testID={`play-influence-yes-${card.id}`} />
          </View>
        </>
      ) : null}
      {card.actionType === 'movement' || card.cardType === 'movimentação' ? (
        <Text style={styles.obs}>Movimentação: {[card.movementType, card.movementRange ? `alcance ${card.movementRange}` : ''].filter(Boolean).join(' • ') || 'sem detalhes'}</Text>
      ) : null}
      {card.actionType === 'perception' || card.cardType === 'percepção/rastreamento/reação' ? (
        <Text style={styles.obs}>Percepção/reação: {[card.sensoryType, card.detectsUntilSpeed != null ? `detecta Speed ${card.detectsUntilSpeed === 'instant' ? 'Instantânea' : card.detectsUntilSpeed}` : '', card.reactionUntilSpeed != null ? `reage Speed ${card.reactionUntilSpeed === 'instant' ? 'Instantânea' : card.reactionUntilSpeed}` : ''].filter(Boolean).join(' • ') || 'sem detalhes'}</Text>
      ) : null}
      {card.actionType === 'diverse_summon' || card.cardType === 'invocação diversa' ? (
        <Text style={styles.obs}>Invocação diversa: {[card.summonType, card.summonQuantity ? `qtd ${formatNumberBR(card.summonQuantity)}` : ''].filter(Boolean).join(' • ') || 'sem detalhes'}</Text>
      ) : null}
      <Text style={styles.label}>Custo</Text>
      <AttrEditor label="Custo" values={card.cost} setValues={(v) => onChange({ cost: v })} keyPrefix={`play-cost-${card.id}`} />
      <Text style={styles.label}>Aumento</Text>
      <AttrEditor label="Aumento" values={card.boost} setValues={(v) => onChange({ boost: v })} keyPrefix={`play-boost-${card.id}`} />
      <UnlimitedEditor unlimited={card.unlimited} setUnlimited={(u) => onChange({ unlimited: u })} />
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  subInfo: { color: theme.colors.neon, fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 },
  label: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, marginTop: 8 },
  empty: { color: theme.colors.textMuted, textAlign: 'center', padding: 20 },

  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 8, borderBottomWidth: 1, borderColor: theme.colors.border },
  turnTitle: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  turnSub: { color: theme.colors.neon, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  timerBox: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(255,59,0,0.18)', borderRadius: 10, borderWidth: 1, borderColor: theme.colors.borderActive },
  timerText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 1 },

  ctCard: { width: 130, padding: 10, backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', gap: 6 },
  ctCardActive: { borderColor: theme.colors.borderActive, backgroundColor: 'rgba(255,59,0,0.12)' },
  ctImg: { width: 80, height: 80, borderRadius: 12, backgroundColor: theme.colors.bg },
  ctImgFallback: { alignItems: 'center', justifyContent: 'center' },
  ctName: { color: '#fff', fontSize: 13, fontWeight: '800' },
  ctRank: { color: theme.colors.neon, fontSize: 11, fontWeight: '700' },
  bossInitCard: { backgroundColor: 'rgba(255,59,0,0.08)', borderWidth: 1, borderColor: theme.colors.borderActive, borderRadius: theme.radius.lg, padding: 14, gap: 6, marginBottom: 16 },
  bossThinking: { color: theme.colors.neon, fontSize: 13, fontWeight: '900', textAlign: 'center', flex: 1, paddingVertical: 10 },

  systemRow: { alignItems: 'center', marginVertical: 4 },
  systemText: { color: theme.colors.textMuted, fontSize: 11, fontStyle: 'italic', backgroundColor: 'rgba(255,255,255,0.04)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  bubbleRow: { flexDirection: 'row' },
  bubble: { maxWidth: '85%', padding: 10, borderRadius: 18, borderWidth: 1 },
  bubbleT1: { backgroundColor: 'rgba(255,59,0,0.14)', borderColor: 'rgba(255,59,0,0.3)', borderTopRightRadius: 4 },
  bubbleT2: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', borderTopLeftRadius: 4 },
  bubbleHeader: { color: theme.colors.neon, fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  chatText: { color: '#fff', fontSize: 13, lineHeight: 18 },
  playedCard: { backgroundColor: 'rgba(0,0,0,0.25)', padding: 8, borderRadius: 10, marginVertical: 4, gap: 4 },
  cardThumb: { width: 36, height: 36, borderRadius: 8, backgroundColor: theme.colors.bg },
  cardThumbFb: { borderWidth: 1, borderColor: theme.colors.border },
  cardName: { color: '#fff', fontWeight: '800', fontSize: 13 },
  cardCaption: { color: theme.colors.textSecondary, fontSize: 12, fontStyle: 'italic' },
  fxLine: { color: theme.colors.neon, fontSize: 11, fontWeight: '700' },
  ctBlock: { backgroundColor: 'rgba(255,215,0,0.06)', padding: 8, borderRadius: 10, marginTop: 6, borderWidth: 1, borderColor: 'rgba(255,215,0,0.2)' },
  entityBlock: { backgroundColor: 'rgba(34,197,94,0.08)', padding: 8, borderRadius: 10, marginTop: 6, borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)' },
  attrLine: { color: '#fff', fontSize: 12 },
  obs: { color: theme.colors.textSecondary, fontStyle: 'italic', fontSize: 12, marginTop: 4 },
  calcBox: { marginTop: 8, gap: 4, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.12)', paddingTop: 8 },
  calcButton: { alignSelf: 'flex-start', borderRadius: 8, borderWidth: 1, borderColor: theme.colors.borderActive, paddingHorizontal: 10, paddingVertical: 5 },
  calcButtonText: { color: theme.colors.neon, fontSize: 11, fontWeight: '900' },
  calcLine: { color: theme.colors.textSecondary, fontSize: 11, lineHeight: 16 },
  time: { color: theme.colors.textMuted, fontSize: 10, marginTop: 4, textAlign: 'right' },
  activeBar: { gap: 8, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, padding: 10, marginBottom: 8 },
  activeItem: { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: 8, gap: 4 },
  activeConfirmBox: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, padding: 10, marginTop: 8, marginBottom: 6, gap: 6 },
  activeConfirmItem: { backgroundColor: 'rgba(0,0,0,0.22)', borderRadius: 10, padding: 8, gap: 4 },
  activeDisable: { alignSelf: 'flex-start', borderRadius: 10, borderWidth: 1, borderColor: theme.colors.borderActive, paddingHorizontal: 10, paddingVertical: 4, marginTop: 4 },
  activeDisableText: { color: theme.colors.neon, fontSize: 11, fontWeight: '800' },

  chatBar: { paddingTop: 8, borderTopWidth: 1, borderColor: theme.colors.border, gap: 8 },
  actionBar: { flexDirection: 'row', gap: 6, paddingTop: 8, borderTopWidth: 1, borderColor: theme.colors.border, flexWrap: 'wrap' },
  endedBar: { gap: 10, paddingTop: 12, borderTopWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  endedText: { color: '#fff', fontWeight: '900', fontSize: 14, textAlign: 'center' },

  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: theme.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '92%', borderWidth: 1, borderColor: theme.colors.border },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderColor: theme.colors.border },
  modalTitle: { color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 1 },
  modalFooter: { position: 'absolute', left: 16, right: 16, bottom: 16 },
  pickItem: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: theme.colors.bg, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border },
  pickItemActive: { borderColor: theme.colors.borderActive, backgroundColor: 'rgba(255,59,0,0.1)' },
  pickName: { color: '#fff', fontWeight: '800', fontSize: 14 },
  pickSub: { color: theme.colors.textSecondary, fontSize: 11 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  checklistBox: { gap: 7, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, padding: 12 },
  inlineRank: { alignSelf: 'flex-start', color: '#fff', backgroundColor: theme.colors.primary, overflow: 'hidden', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 1, fontSize: 10, fontWeight: '900', marginTop: 2 },
  inlineRankSpecial: { backgroundColor: theme.colors.gold },
  zoomWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', alignItems: 'center', justifyContent: 'center' },
  zoomClose: { position: 'absolute', top: 42, right: 20, zIndex: 2, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  zoomTapClose: { position: 'absolute', left: 24, right: 24, bottom: 28, zIndex: 2, paddingVertical: 12, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center' },
  zoomTapCloseText: { color: '#fff', fontWeight: '900', fontSize: 12, textTransform: 'uppercase' },
  zoomContent: { minHeight: '100%', alignItems: 'center', justifyContent: 'center' },
  zoomImage: { width: 360, height: 560, maxWidth: '100%' },
});
