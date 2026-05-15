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
import { BattleEntity, Card, CT, ChatMsg, MatchType, MomentaryAction, PlayedCard } from '../src/types';
import { ATTRS, CT_ATTRS, Attr, theme, RANK_ORDER, CARD_RANKS, CardRank, Rank } from '../src/theme';
import { AttrEditor, UnlimitedEditor } from './card-edit';
import { ctDisplayName, formatNumberBR } from '../src/format';
import { resolveCombat, visibleFinalAttrs } from '../src/combat';

type Team = 'team1' | 'team2';

export default function Battle() {
  const router = useRouter();
  const { matchType, turnMinutes } = useLocalSearchParams<{ matchType: MatchType; turnMinutes: string }>();
  const isBoss = String(matchType || '').includes('Boss');
  const totalMinutes = parseInt(String(turnMinutes || '0'), 10);
  const turnSeconds = totalMinutes > 0 ? totalMinutes * 60 : 0;

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
  const [result, setResult] = useState<string>('');

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    Storage.getCards().then(setCards);
    Storage.getCTs().then(setCTs);
  }, []);

  // Timer logic
  useEffect(() => {
    if (phase !== 'play' || isBoss || turnSeconds === 0) return;
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
  }, [phase, currentTeam, isBoss, turnSeconds]);

  const t2Label = isBoss ? 'Boss' : 'Time 2';

  const startPresentation = () => {
    if (!initCT1 || !initCT2) {
      Alert.alert('Atenção', 'Cada lado precisa escolher um O C.T inicial.');
      return;
    }
    const r1 = RANK_ORDER[initCT1.rank];
    const r2 = RANK_ORDER[initCT2.rank];
    let starter: Team;
    if (r1 !== r2) starter = r1 > r2 ? 'team1' : 'team2';
    else {
      const a1 = initCT1.attrs.Ag ?? 0; const a2 = initCT2.attrs.Ag ?? 0;
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
        config: { matchType: matchType as MatchType, turnMinutes: isBoss ? null : totalMinutes, startedAt: Date.now() },
      });
      return next;
    });
  };

  const onSendPlay = (played: PlayedCard[], ctSnap: CT, observation: string, finalAttrs: Record<Attr, number | 'ilimitado'>, activeEntity?: BattleEntity, finalEntityAttrs?: Record<Attr, number | 'ilimitado'>, momentaryActions: MomentaryAction[] = []) => {
    const msg: ChatMsg = {
      id: uid(), turn, team: currentTeam, timestamp: Date.now(),
      playedCards: played, ctSnapshot: ctSnap, activeEntitySnapshot: activeEntity, ctObservation: observation, finalAttrs, finalEntityAttrs, momentaryActions,
    };
    setMessages((m) => [...m, msg]);
    advanceTurn();
  };

  const passTurn = () => {
    addSystem(`${currentTeam === 'team1' ? 'Time 1' : t2Label} passou o turno.`);
    advanceTurn();
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
    setCurrentTeam(currentTeam === 'team1' ? 'team2' : 'team1');
    setTimeLeft(turnSeconds);
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

        <Text style={styles.subInfo}>{matchType} • {isBoss ? 'Contra Boss (sem tempo)' : `${totalMinutes} min/turno`}</Text>

        {cts.length === 0 ? (
          <Text style={styles.empty}>Crie pelo menos um C.T antes de iniciar a luta.</Text>
        ) : (
          <>
            <CTSelector label="Time 1 — O C.T inicial" cts={cts} value={initCT1} onChange={setInitCT1} testID="select-ct1" />
            <CTSelector label={`${t2Label} — O C.T inicial`} cts={cts} value={initCT2} onChange={setInitCT2} testID="select-ct2" />
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
        <View style={[styles.timerBox, isBoss && { opacity: 0.35 }]}>
          <Text style={styles.timerText}>{isBoss ? '∞' : fmt(timeLeft)}</Text>
        </View>
      </View>

      <FlatList
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
          <View style={styles.actionBar}>
            <Button title="Jogar" onPress={() => setPickerVisible(true)} testID="play-btn" style={{ flex: 1 }} small />
            <Button title="Morte" variant="danger" onPress={declareDeath} testID="death-btn" small />
            <Button title="Passar" variant="ghost" onPress={passTurn} testID="pass-btn" small />
            <Button title="Desistir" variant="danger" onPress={giveUp} testID="give-up-btn" small />
          </View>
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
        activeCT={currentTeam === 'team1' ? initCT1 : initCT2}
        onImagePress={setZoomImage}
        onConfirm={(played, ctSnap, obs, finalAttrs, activeEntity, finalEntityAttrs, momentaryActions) => {
          setPickerVisible(false);
          onSendPlay(played, ctSnap, obs, finalAttrs, activeEntity, finalEntityAttrs, momentaryActions);
        }}
      />
      <ZoomableImageModal uri={zoomImage} onClose={() => setZoomImage(null)} />
    </Screen>
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
            {renderEffectLines(p.cardSnapshot)}
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
                {visibleFinalAttrs(msg.finalAttrs!).map((a) => (
                  <Text key={a} style={styles.attrLine}>{a}: {formatNumberBR(msg.finalAttrs![a])}</Text>
                ))}
              </View>
            )}
            {msg.ctObservation ? <Text style={styles.obs}>Obs: {msg.ctObservation}</Text> : null}
          </View>
        )}
        {msg.activeEntitySnapshot ? (
          <View style={styles.entityBlock}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <ZoomableThumb uri={msg.activeEntitySnapshot.image} onPress={onImagePress} />
              <Text style={styles.cardName}>{msg.activeEntitySnapshot.entityType || 'entidade'} {msg.activeEntitySnapshot.name} — Rank {msg.activeEntitySnapshot.rank}</Text>
            </View>
            <Text style={styles.obs}>Custos/aumentos aplicados na entidade ativa.</Text>
            {msg.finalEntityAttrs ? (
              <View style={{ marginTop: 6 }}>
                {ATTRS.map(a => <Text key={a} style={styles.attrLine}>{a}: {formatNumberBR(msg.finalEntityAttrs![a])}</Text>)}
              </View>
            ) : null}
          </View>
        ) : null}
        {msg.momentaryActions?.map(action => <MomentaryBlock key={action.cardId} action={action} />)}

        <Text style={styles.time}>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
      </View>
    </View>
  );
}

function renderEffectLines(c: Card) {
  const lines: string[] = [];
  const cost = ATTRS.filter(a => c.cost[a] != null).map(a => `${a}: ${formatNumberBR(c.cost[a])}`).join(', ');
  const boost = ATTRS.filter(a => c.boost[a] != null).map(a => `${a}: ${formatNumberBR(c.boost[a])}`).join(', ');
  const unl = ATTRS.filter(a => c.unlimited[a]).map(a => `${a}: ilimitado`).join(', ');
  const momentary = ATTRS.filter(a => c.momentaryAttrs?.[a] != null).map(a => `${a}: ${formatNumberBR(c.momentaryAttrs?.[a])}`).join(', ');
  if (momentary) lines.push(`Ação: ${momentary}${c.useCTInfluence ? ' + atributo base' : ''}`);
  if (cost) lines.push(`Custo: ${cost}`);
  if (boost) lines.push(`Aumento: ${boost}`);
  if (unl) lines.push(unl);
  lines.push(`Speed: ${c.speed ?? 0}`);
  return lines.map((l, i) => <Text key={i} style={styles.fxLine}>{l}</Text>);
}

function MomentaryBlock({ action }: { action: MomentaryAction }) {
  const title = action.type === 'attack' ? 'Ataque momentâneo' : action.type === 'defense' ? 'Defesa momentânea' : 'Arma/equipamento';
  const own = ATTRS.filter(a => action.own[a] != null).map(a => `${a}: ${formatNumberBR(action.own[a])}`).join(' • ');
  const final = ATTRS.filter(a => action.final[a] != null).map(a => `${a}: ${formatNumberBR(action.final[a])}`).join(' • ');
  return (
    <View style={styles.ctBlock}>
      <Text style={styles.cardName}>{title}: {action.cardName}</Text>
      <Text style={styles.attrLine}>Próprio: {own || '0'}</Text>
      <Text style={styles.attrLine}>Influência: {action.usedCTInfluence ? (action.source === 'entity' ? 'Invocação' : 'O C.T') : 'Não'}</Text>
      <Text style={styles.attrLine}>Final: {final || '0'}</Text>
    </View>
  );
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
function PlayModal({ visible, onClose, cards, activeCT, onImagePress, onConfirm }:
  { visible: boolean; onClose: () => void; cards: Card[]; activeCT: CT | null;
    onImagePress: (uri: string) => void;
    onConfirm: (p: PlayedCard[], ct: CT, obs: string, finalAttrs: Record<Attr, number | 'ilimitado'>, activeEntity?: BattleEntity, finalEntityAttrs?: Record<Attr, number | 'ilimitado'>, momentaryActions?: MomentaryAction[]) => void }) {

  const [step, setStep] = useState<'cards' | 'card-edit' | 'target'>('cards');
  const [selectedCards, setSelectedCards] = useState<Card[]>([]);
  const [editIdx, setEditIdx] = useState(0);
  const [activeEntityId, setActiveEntityId] = useState<string | null>(null);
  const [entityCostCardIds, setEntityCostCardIds] = useState<string[]>([]);
  const [observation, setObservation] = useState('');
  const [cardQuery, setCardQuery] = useState('');
  const [cardRanks, setCardRanks] = useState<CardRank[]>([]);
  const [lastCardIds, setLastCardIds] = useState<string[]>([]);

  useEffect(() => {
    if (visible) {
      setStep('cards'); setSelectedCards([]); setEditIdx(0); setActiveEntityId(null); setEntityCostCardIds([]); setObservation('');
      setCardQuery(''); setCardRanks([]);
      Storage.getLastPlayedCardIds().then(setLastCardIds);
    }
  }, [visible]);

  const toggleCard = (c: Card) => {
    setSelectedCards((arr) => arr.some(x => x.id === c.id)
      ? arr.filter(x => x.id !== c.id)
      : [...arr, { ...c, cost: { ...c.cost }, boost: { ...c.boost }, unlimited: { ...c.unlimited }, entityAttrs: c.entityAttrs ? { ...c.entityAttrs } : undefined, entityUnlimited: c.entityUnlimited ? { ...c.entityUnlimited } : undefined }]);
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
  const visibleCards = [...cards].sort((a, b) => {
    const ai = lastCardIds.indexOf(a.id);
    const bi = lastCardIds.indexOf(b.id);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  }).filter((c) => {
    const q = cardQuery.trim().toLowerCase();
    const queryOk = !q || `${c.name} ${c.caption} ${c.rank || ''} ${c.speed ?? 0}`.toLowerCase().includes(q);
    const rankOk = cardRanks.length === 0 || cardRanks.includes(c.rank || 'E');
    return queryOk && rankOk && canCTUseCard(activeCT, c);
  });
  const entities = selectedCards.filter(c => c.entityType).map(entityFromCard);
  const activeEntity = entities.find(e => e.id === activeEntityId);
  const toggleEntityCostCard = (cardId: string) => setEntityCostCardIds(ids => ids.includes(cardId) ? ids.filter(id => id !== cardId) : [...ids, cardId]);
  const entityCostNames = selectedCards.filter(c => entityCostCardIds.includes(c.id)).map(c => c.name).join(', ');
  const ctCostNames = selectedCards.filter(c => !entityCostCardIds.includes(c.id)).map(c => c.name).join(', ');

  const confirmPlay = () => {
    if (!activeCT) { Alert.alert('Atenção', 'O C.T inicial não está definido.'); return; }
    const entityCostIds = activeEntity ? entityCostCardIds : [];
    const resolved = resolveCombat(activeCT, activeEntity, selectedCards, entityCostIds);
    const targetNote = activeEntity ? `Alvo ativo: ${activeEntity.entityType || 'entidade'} ${activeEntity.name}.` : 'Alvo ativo: O C.T principal.';
    const costNote = activeEntity && entityCostIds.length > 0 ? `Custo na invocação: ${selectedCards.filter(c => entityCostIds.includes(c.id)).map(c => c.name).join(', ')}.` : 'Custos no O C.T principal.';
    const obs = [targetNote, costNote, observation.trim()].filter(Boolean).join(' ');
    Storage.saveLastPlayedCardIds(selectedCards.map(c => c.id));
    onConfirm(selectedCards.map(c => ({ cardSnapshot: c })), activeCT, obs, resolved.finalAttrs, activeEntity, resolved.finalEntityAttrs, resolved.momentaryActions);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalWrap}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {step === 'cards' ? '1. Selecione Cards' :
               step === 'card-edit' ? `2. Editar Card (${editIdx + 1}/${selectedCards.length})` :
               '3. Alvo e Envio'}
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
                          <Text style={styles.pickName}>{c.name} — {c.rank || 'E'} • Speed: {c.speed ?? 0}</Text>
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
                {entities.length > 0 ? (
                  <View>
                    <Text style={styles.label}>Alvo dos custos/aumentos</Text>
                    <View style={styles.chipsRow}>
                      <Chip label="O C.T principal" active={!activeEntityId} onPress={() => setActiveEntityId(null)} testID="play-target-ct" />
                      {entities.map(entity => (
                        <Chip
                          key={entity.id}
                          label={`${entity.entityType || 'entidade'} ${entity.name}`}
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
          </ScrollView>

          <View style={styles.modalFooter}>
            {step === 'cards' && <Button title="Avançar" onPress={goEditCards} testID="play-next-cards" />}
            {step === 'card-edit' && <Button title={editIdx + 1 < selectedCards.length ? 'Próximo card' : 'Escolher alvo'} onPress={finishCardEdits} testID="play-next-card-edit" />}
            {step === 'target' && <Button title="Enviar Jogada" onPress={confirmPlay} testID="play-confirm-btn" />}
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
        <Text style={styles.pickName}>{card.name} — {card.rank || 'E'} • Speed: {card.speed ?? 0}</Text>
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
  time: { color: theme.colors.textMuted, fontSize: 10, marginTop: 4, textAlign: 'right' },

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
  inlineRank: { alignSelf: 'flex-start', color: '#fff', backgroundColor: theme.colors.primary, overflow: 'hidden', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 1, fontSize: 10, fontWeight: '900', marginTop: 2 },
  inlineRankSpecial: { backgroundColor: theme.colors.gold },
  zoomWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', alignItems: 'center', justifyContent: 'center' },
  zoomClose: { position: 'absolute', top: 42, right: 20, zIndex: 2, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  zoomTapClose: { position: 'absolute', left: 24, right: 24, bottom: 28, zIndex: 2, paddingVertical: 12, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center' },
  zoomTapCloseText: { color: '#fff', fontWeight: '900', fontSize: 12, textTransform: 'uppercase' },
  zoomContent: { minHeight: '100%', alignItems: 'center', justifyContent: 'center' },
  zoomImage: { width: 360, height: 560, maxWidth: '100%' },
});
