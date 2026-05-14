import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, FlatList, Alert, Modal, ScrollView, Share, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../src/components/Screen';
import Button from '../src/components/Button';
import Input from '../src/components/Input';
import Chip from '../src/components/Chip';
import { Storage, uid } from '../src/storage';
import { Card, CT, PlayedCard } from '../src/types';
import { ATTRS, Attr, theme, RANK_ORDER, CARD_RANKS, CT_RANKS, CardRank, Rank } from '../src/theme';
import { AttrEditor, UnlimitedEditor, sanitizeNum } from './card-edit';
import { RoomClient, WSEvent } from '../src/online';
import * as FileSystem from 'expo-file-system/legacy';

type Side = 'me' | 'opp';
type PlayerInfo = { name: string; village: string; image?: string };

type ChatItem = {
  id: string;
  turn: number;
  team: 'me' | 'opp' | 'system';
  timestamp: number;
  text?: string;
  playedCards?: PlayedCard[];
  ctSnapshot?: CT;
  ctObservation?: string;
  finalAttrs?: Record<Attr, number | 'ilimitado'>;
};

type Phase = 'waiting' | 'init' | 'play' | 'ended';

export default function OnlineBattle() {
  const router = useRouter();
  const params = useLocalSearchParams<{ role: 'host' | 'guest'; code: string; turnMinutes: string; playerName: string; playerVillage: string; playerImage?: string }>();
  const role = params.role as 'host' | 'guest';
  const code = String(params.code || '');
  const totalMinutes = parseInt(String(params.turnMinutes || '20'), 10);
  const turnSeconds = totalMinutes * 60;

  const me: PlayerInfo = useMemo(() => ({
    name: String(params.playerName || 'Jogador'),
    village: String(params.playerVillage || '—'),
    image: params.playerImage ? String(params.playerImage) : undefined,
  }), [params.playerName, params.playerVillage, params.playerImage]);

  const [opponent, setOpponent] = useState<PlayerInfo | null>(null);
  const [connStatus, setConnStatus] = useState<'connecting' | 'waiting' | 'connected' | 'lost' | 'error'>('connecting');
  const [phase, setPhase] = useState<Phase>('waiting');
  const [cts, setCTs] = useState<CT[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [myInitialCT, setMyInitialCT] = useState<CT | null>(null);
  const [oppInitialCT, setOppInitialCT] = useState<CT | null>(null);
  const [currentTurn, setCurrentTurn] = useState<Side>('me');
  const [turn, setTurn] = useState(1);
  const [timeLeft, setTimeLeft] = useState(turnSeconds);
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [chatText, setChatText] = useState('');
  const [result, setResult] = useState('');

  const clientRef = useRef<RoomClient | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef(0);
  const listRef = useRef<FlatList<ChatItem> | null>(null);
  const lastActionAtRef = useRef(0);
  const lastChatAtRef = useRef(0);

  // Load local cards/cts
  useEffect(() => {
    Storage.getCards().then(setCards);
    Storage.getCTs().then(setCTs);
  }, []);

  // WebSocket
  useEffect(() => {
    const c = new RoomClient();
    clientRef.current = c;
    c.onOpen = () => setConnStatus('waiting');
    c.onEvent = (e) => handleEvent(e);
    c.onClose = () => {
      if (!c.closedByUser) setConnStatus((s) => (s === 'connected' ? 'lost' : s));
    };
    c.connect(code, role, me);
    return () => { c.close(); if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, role]);

  // Timer
  useEffect(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (phase !== 'play' || currentTurn !== 'me') return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        const next = t - 1;
        tickRef.current += 1;
        if (tickRef.current % 3 === 0) broadcast({ action: 'tick', timeLeft: Math.max(0, next) });
        if (next <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleTimeout();
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentTurn]);

  const broadcast = (payload: any) => clientRef.current?.sendRelay(payload);

  useEffect(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  }, [messages.length]);

  const canUseTurnAction = () => {
    if (currentTurn !== 'me') {
      Alert.alert('Aguarde', 'Não é sua vez.');
      return false;
    }
    const now = Date.now();
    if (now - lastActionAtRef.current < 2000) {
      Alert.alert('Aguarde', 'Cooldown de 2 segundos.');
      return false;
    }
    lastActionAtRef.current = now;
    return true;
  };

  function handleEvent(e: WSEvent) {
    if (e.type === 'ready') {
      if (e.opponent) {
        setOpponent(e.opponent as PlayerInfo);
        setConnStatus('connected');
        setPhase('init');
      } else {
        setConnStatus('waiting');
      }
    } else if (e.type === 'opponent_joined') {
      setOpponent(e.opponent as PlayerInfo);
      setConnStatus('connected');
      setPhase('init');
    } else if (e.type === 'opponent_disconnected') {
      setConnStatus('lost');
      if (phase !== 'ended') {
        endBattle('Oponente desconectado.');
      }
    } else if (e.type === 'error') {
      setConnStatus('error');
      Alert.alert('Erro', e.message || 'Erro na sala.', [{ text: 'OK', onPress: () => router.back() }]);
    } else if (e.type === 'relay') {
      const p = e.payload;
      if (!p || !p.action) return;
      if (p.action === 'initial_ct') {
        setOppInitialCT(p.ct);
      } else if (p.action === 'start_decision') {
        // Guest receives starter from host
        setMyInitialCT((mine) => mine); // noop
        setPhase('play');
        setCurrentTurn(p.starter === role ? 'me' : 'opp');
        setTimeLeft(turnSeconds);
        const starterName = p.starter === role ? me.name : (opponent?.name || 'Oponente');
        setMessages((m) => [...m, { id: uid(), turn: 1, team: 'system', text: `${starterName} começa.`, timestamp: Date.now() }]);
      } else if (p.action === 'play') {
        setMessages((m) => [...m, { id: uid(), turn: p.turn, team: 'opp', timestamp: Date.now(), playedCards: p.cards, ctSnapshot: p.ct, ctObservation: p.observation, finalAttrs: p.finalAttrs }]);
        advanceTurnFromOpponent();
      } else if (p.action === 'chat') {
        setMessages((m) => [...m, { id: uid(), turn: p.turn || turn, team: 'opp', text: String(p.text || ''), timestamp: p.timestamp || Date.now() }]);
      } else if (p.action === 'pass') {
        setMessages((m) => [...m, { id: uid(), turn: p.turn, team: 'system', text: `${opponent?.name || 'Oponente'} passou o turno.`, timestamp: Date.now() }]);
        advanceTurnFromOpponent();
      } else if (p.action === 'tick') {
        if (currentTurn === 'opp') setTimeLeft(p.timeLeft);
      } else if (p.action === 'death') {
        endBattle(`${opponent?.name || 'Oponente'} morreu. ${me.name} venceu!`);
      } else if (p.action === 'give_up') {
        endBattle(`${opponent?.name || 'Oponente'} desistiu. ${me.name} venceu!`);
      } else if (p.action === 'timeout') {
        endBattle(`${opponent?.name || 'Oponente'} perdeu por tempo. ${me.name} venceu!`);
      }
    }
  }

  // ----- Apresentação -----
  const confirmInitialCT = async () => {
    if (!myInitialCT) return Alert.alert('Atenção', 'Selecione seu O C.T inicial.');
    broadcast({ action: 'initial_ct', ct: await withRemoteImageCT(myInitialCT) });
  };

  // Host decides starter when both initial CTs ready
  useEffect(() => {
    if (role !== 'host') return;
    if (phase !== 'init') return;
    if (!myInitialCT || !oppInitialCT) return;
    const r1 = RANK_ORDER[myInitialCT.rank];
    const r2 = RANK_ORDER[oppInitialCT.rank];
    let starter: 'host' | 'guest';
    if (r1 !== r2) starter = r1 > r2 ? 'host' : 'guest';
    else {
      const a1 = myInitialCT.attrs.Ag ?? 0; const a2 = oppInitialCT.attrs.Ag ?? 0;
      if (a1 !== a2) starter = a1 > a2 ? 'host' : 'guest';
      else starter = Math.random() < 0.5 ? 'host' : 'guest';
    }
    broadcast({ action: 'start_decision', starter });
    setPhase('play');
    setCurrentTurn(starter === role ? 'me' : 'opp');
    setTimeLeft(turnSeconds);
    const starterName = starter === role ? me.name : (opponent?.name || 'Oponente');
    setMessages((m) => [...m, { id: uid(), turn: 1, team: 'system', text: `${starterName} começa.`, timestamp: Date.now() }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myInitialCT, oppInitialCT, phase, role]);

  // ----- Turnos -----
  function advanceTurnFromMe() {
    setCurrentTurn('opp');
    setTurn((t) => t); // opp will increment when their turn ends? No: same scheme as local.
    setTimeLeft(turnSeconds);
  }
  function advanceTurnFromOpponent() {
    setCurrentTurn('me');
    setTurn((t) => t + 1); // each "round" = me+opp; we increment when receiving opp action (so my next play is the new turn). Both sides agree because each side increments after the opponent acts.
    setTimeLeft(turnSeconds);
  }

  const sendPlay = async (played: PlayedCard[], ctSnap: CT, observation: string, finalAttrs: Record<Attr, number | 'ilimitado'>) => {
    if (!canUseTurnAction()) return;
    const myTurn = turn;
    setMessages((m) => [...m, { id: uid(), turn: myTurn, team: 'me', timestamp: Date.now(), playedCards: played, ctSnapshot: ctSnap, ctObservation: observation, finalAttrs }]);
    const remoteCards = await Promise.all(played.map(async p => ({ cardSnapshot: await withRemoteImageCard(p.cardSnapshot) })));
    broadcast({ action: 'play', turn: myTurn, cards: remoteCards, ct: await withRemoteImageCT(ctSnap), observation, finalAttrs });
    advanceTurnFromMe();
  };

  const passTurn = () => {
    if (!canUseTurnAction()) return;
    const myTurn = turn;
    setMessages((m) => [...m, { id: uid(), turn: myTurn, team: 'system', text: `${me.name} passou o turno.`, timestamp: Date.now() }]);
    broadcast({ action: 'pass', turn: myTurn });
    advanceTurnFromMe();
  };

  const handleTimeout = () => {
    broadcast({ action: 'timeout' });
    endBattle(`${me.name} perdeu por tempo. ${opponent?.name || 'Oponente'} venceu!`);
  };

  const declareDeath = () => {
    if (!canUseTurnAction()) return;
    Alert.alert('Confirmar morte?', '', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sim', onPress: () => {
        broadcast({ action: 'death' });
        endBattle(`${me.name} morreu. ${opponent?.name || 'Oponente'} venceu!`);
      }},
    ]);
  };
  const giveUp = () => {
    if (!canUseTurnAction()) return;
    Alert.alert('Desistir?', '', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sim', onPress: () => {
        broadcast({ action: 'give_up' });
        endBattle(`${me.name} desistiu. ${opponent?.name || 'Oponente'} venceu!`);
      }},
    ]);
  };
  const endBattle = (text: string) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase('ended');
    setResult(text);
    setMessages((m) => [...m, { id: uid(), turn, team: 'system', text, timestamp: Date.now() }]);
  };

  const sendChat = () => {
    const text = chatText.trim();
    if (!text) return;
    const now = Date.now();
    if (now - lastChatAtRef.current < 2000) {
      Alert.alert('Aguarde', 'Cooldown de chat de 2 segundos.');
      return;
    }
    lastChatAtRef.current = now;
    setChatText('');
    setMessages((m) => [...m, { id: uid(), turn, team: 'me', text, timestamp: now }]);
    broadcast({ action: 'chat', turn, text, timestamp: now });
  };

  const shareCode = async () => {
    try { await Share.share({ message: `Entre na minha sala Shinobi Arena: ${code}` }); }
    catch { if (Platform.OS === 'web') Alert.alert('Código da sala', code); }
  };

  // ============ Render ============
  if (connStatus === 'connecting' || (phase === 'waiting' && connStatus !== 'connected')) {
    return (
      <Screen testID="online-battle-waiting">
        <SimpleHeader title="Arena Online" onBack={() => router.replace('/online')} />
        <View style={styles.statusBox}>
          <Text style={styles.code}>{code}</Text>
          <Text style={styles.statusTitle}>
            {connStatus === 'connecting' ? 'Conectando...' :
             connStatus === 'waiting' ? 'Aguardando oponente...' :
             connStatus === 'lost' ? 'Oponente desconectado' :
             connStatus === 'error' ? 'Erro de conexão' : '...'}
          </Text>
          <Text style={styles.statusHint}>Compartilhe o código com seu oponente.</Text>
          <Button title="Compartilhar código" variant="secondary" onPress={shareCode} testID="online-share-btn" />
          <View style={{ height: 8 }} />
          <Button title="Cancelar" variant="ghost" onPress={() => router.replace('/online')} testID="online-cancel-btn" />
        </View>
      </Screen>
    );
  }

  if (phase === 'init') {
    return (
      <Screen testID="online-init-screen">
        <SimpleHeader title="Apresentação Online" onBack={() => Alert.alert('Sair?', 'Você irá deixar a sala.', [{ text: 'Ficar', style: 'cancel' }, { text: 'Sair', onPress: () => router.replace('/') }])} />
        <View style={styles.playersRow}>
          <PlayerBadge p={me} label="Você" />
          <Text style={styles.vs}>VS</Text>
          <PlayerBadge p={opponent} label="Oponente" />
        </View>
        <Text style={styles.subInfo}>1x1 Online • {totalMinutes} min/turno • Sala {code}</Text>

        {cts.length === 0 ? (
          <Text style={styles.empty}>Crie pelo menos um O C.T no Menu Card antes de iniciar.</Text>
        ) : (
          <>
            <Text style={styles.label}>Selecione seu O C.T inicial</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
              {cts.map((c) => {
                const active = myInitialCT?.id === c.id;
                return (
                  <Pressable key={c.id} onPress={() => setMyInitialCT(c)} testID={`online-pick-ct-${c.id}`}
                    style={({ pressed }) => [styles.ctCard, active && styles.ctCardActive, { opacity: pressed ? 0.85 : 1 }]}>
                    {c.image ? <Image source={{ uri: c.image }} style={styles.ctImg} /> : <View style={[styles.ctImg, styles.ctImgFallback]}><Ionicons name="shield" size={26} color={theme.colors.gold} /></View>}
                    <Text style={styles.ctName} numberOfLines={1}>{c.name}</Text>
                    <Text style={styles.ctRank}>Rank {c.rank}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {oppInitialCT && <Text style={styles.subInfo}>Oponente já escolheu O C.T.</Text>}
            <Button title="Confirmar O C.T inicial" onPress={confirmInitialCT} disabled={!myInitialCT} testID="online-confirm-init-ct-btn" style={{ marginTop: 16 }} />
          </>
        )}
      </Screen>
    );
  }

  // play / ended
  return (
    <Screen scroll={false} testID="online-battle-screen">
      <View style={styles.topBar}>
        <Pressable onPress={() => Alert.alert('Sair?', 'A luta continuará para o oponente.', [{ text: 'Ficar', style: 'cancel' }, { text: 'Sair', onPress: () => router.replace('/') }])}
          testID="header-back-btn" style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}>
          <Ionicons name="chevron-back" size={20} color={theme.colors.primary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.turnTitle}>Turno {turn} • {code}</Text>
          <Text style={styles.turnSub}>{currentTurn === 'me' ? 'Sua vez' : `Vez de ${opponent?.name || 'Oponente'}`}</Text>
          <Text style={styles.connText}>{connStatus === 'connected' ? 'Conectado' : connStatus}</Text>
        </View>
        <View style={styles.timerBox}><Text style={styles.timerText}>{fmt(timeLeft)}</Text></View>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingVertical: 12, gap: 8 }}
        renderItem={({ item }) => <ChatBubble msg={item} meName={me.name} oppName={opponent?.name || 'Oponente'} onImagePress={setZoomImage} />}
        ListEmptyComponent={<Text style={styles.empty}>Nenhuma jogada ainda.</Text>}
      />

      {phase === 'play' ? (
        <>
        <View style={styles.chatBar}>
          <Input label="Chat" value={chatText} onChangeText={setChatText} placeholder="Mensagem" testID="online-chat-input" style={{ minHeight: 42 }} />
          <Button title="Enviar" onPress={sendChat} testID="online-chat-send" small />
        </View>
        <View style={styles.actionBar}>
          <Button title="Jogar" onPress={() => currentTurn === 'me' ? setPickerVisible(true) : Alert.alert('Aguarde', 'Não é sua vez.')} disabled={currentTurn !== 'me'} testID="online-play-btn" style={{ flex: 1 }} small />
          <Button title="Passar" variant="ghost" onPress={passTurn} disabled={currentTurn !== 'me'} testID="online-pass-btn" small />
          <Button title="Morte" variant="danger" onPress={declareDeath} testID="online-death-btn" small />
          <Button title="Desistir" variant="danger" onPress={giveUp} testID="online-give-up-btn" small />
        </View>
        </>
      ) : (
        <View style={styles.endedBar}>
          <Text style={styles.endedText}>{result}</Text>
          <Button title="Voltar ao Menu" onPress={() => router.replace('/')} small testID="online-back-menu-btn" />
        </View>
      )}

      <PlayModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        cards={cards}
        cts={cts}
        onImagePress={setZoomImage}
        onConfirm={(played, ctSnap, obs, finalAttrs) => { setPickerVisible(false); sendPlay(played, ctSnap, obs, finalAttrs); }}
      />
      <ImageZoomModal uri={zoomImage} onClose={() => setZoomImage(null)} />
    </Screen>
  );
}

function fmt(s: number) {
  const m = Math.floor(Math.max(0, s) / 60); const r = Math.max(0, s) % 60;
  return `${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`;
}

async function fileUriToDataUri(uri?: string) {
  if (!uri || uri.startsWith('data:') || !uri.startsWith('file://')) return uri;
  const ext = uri.split('.').pop()?.toLowerCase();
  const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  const data = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  return `data:${mime};base64,${data}`;
}

async function withRemoteImageCard(card: Card): Promise<Card> {
  return { ...card, image: await fileUriToDataUri(card.image) };
}

async function withRemoteImageCT(ct: CT): Promise<CT> {
  return { ...ct, image: await fileUriToDataUri(ct.image) };
}

function SimpleHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.headerRow}>
      <Pressable onPress={onBack} testID="header-back-btn" style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}>
        <Ionicons name="chevron-back" size={22} color={theme.colors.primary} />
      </Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={{ width: 38 }} />
    </View>
  );
}

function PlayerBadge({ p, label }: { p: { name: string; village: string; image?: string } | null; label: string }) {
  return (
    <View style={styles.playerBadge}>
      {p?.image ? <Image source={{ uri: p.image }} style={styles.avatar} /> : <View style={[styles.avatar, styles.avatarFb]}><Ionicons name="person" size={22} color={theme.colors.primary} /></View>}
      <Text style={styles.pTag}>{label}</Text>
      <Text style={styles.pName} numberOfLines={1}>{p?.name || '—'}</Text>
      {p?.village ? <Text style={styles.pVillage} numberOfLines={1}>{p.village}</Text> : null}
    </View>
  );
}

function ChatBubble({ msg, meName, oppName, onImagePress }: { msg: ChatItem; meName: string; oppName: string; onImagePress: (uri: string) => void }) {
  if (msg.team === 'system') {
    return <View style={styles.systemRow}><Text style={styles.systemText}>{msg.text}</Text></View>;
  }
  const isMe = msg.team === 'me';
  return (
    <View style={[styles.bubbleRow, { justifyContent: isMe ? 'flex-end' : 'flex-start' }]}>
      <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOpp]}>
        <Text style={styles.bubbleHeader}>Turno {msg.turn} • {isMe ? meName : oppName}</Text>
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
              <Text style={styles.cardName}>O C.T {msg.ctSnapshot.name} — Rank {msg.ctSnapshot.rank}</Text>
            </View>
            {msg.finalAttrs && (
              <View style={{ marginTop: 6 }}>
                {ATTRS.map((a) => (<Text key={a} style={styles.attrLine}>{a}: {String(msg.finalAttrs![a])}</Text>))}
              </View>
            )}
            {msg.ctObservation ? <Text style={styles.obs}>Obs: {msg.ctObservation}</Text> : null}
          </View>
        )}
        <Text style={styles.time}>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
      </View>
    </View>
  );
}

function renderEffectLines(c: Card) {
  const lines: string[] = [];
  const cost = ATTRS.filter(a => c.cost[a] != null).map(a => `${a}: ${c.cost[a]}`).join(', ');
  const boost = ATTRS.filter(a => c.boost[a] != null).map(a => `${a}: ${c.boost[a]}`).join(', ');
  const unl = ATTRS.filter(a => c.unlimited[a]).map(a => `${a}: ilimitado`).join(', ');
  if (cost) lines.push(`Custo: ${cost}`);
  if (boost) lines.push(`Aumento: ${boost}`);
  if (unl) lines.push(unl);
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

function ImageZoomModal({ uri, onClose }: { uri: string | null; onClose: () => void }) {
  return (
    <Modal visible={!!uri} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.zoomWrap}>
        <Pressable onPress={onClose} style={styles.zoomClose}><Ionicons name="close" size={24} color="#fff" /></Pressable>
        <ScrollView style={{ flex: 1, alignSelf: 'stretch' }} contentContainerStyle={styles.zoomContent} maximumZoomScale={4} minimumZoomScale={1} centerContent>
          {uri ? <Image source={{ uri }} style={styles.zoomImage} resizeMode="contain" /> : null}
        </ScrollView>
      </View>
    </Modal>
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

// ======= Play Modal (same flow as Teste Local) =======
function PlayModal({ visible, onClose, cards, cts, onImagePress, onConfirm }:
  { visible: boolean; onClose: () => void; cards: Card[]; cts: CT[];
    onImagePress: (uri: string) => void;
    onConfirm: (p: PlayedCard[], ct: CT, obs: string, finalAttrs: Record<Attr, number | 'ilimitado'>) => void }) {

  const [step, setStep] = useState<'cards' | 'card-edit' | 'ct-pick' | 'ct-edit'>('cards');
  const [selectedCards, setSelectedCards] = useState<Card[]>([]);
  const [editIdx, setEditIdx] = useState(0);
  const [selectedCT, setSelectedCT] = useState<CT | null>(null);
  const [observation, setObservation] = useState('');
  const [cardQuery, setCardQuery] = useState('');
  const [cardRanks, setCardRanks] = useState<CardRank[]>([]);
  const [ctQuery, setCTQuery] = useState('');
  const [ctRanks, setCTRanks] = useState<Rank[]>([]);

  useEffect(() => {
    if (visible) {
      setStep('cards'); setSelectedCards([]); setEditIdx(0); setSelectedCT(null); setObservation('');
      setCardQuery(''); setCardRanks([]); setCTQuery(''); setCTRanks([]);
    }
  }, [visible]);

  const toggleCard = (c: Card) => {
    setSelectedCards((arr) => arr.some(x => x.id === c.id)
      ? arr.filter(x => x.id !== c.id)
      : [...arr, { ...c, cost: { ...c.cost }, boost: { ...c.boost }, unlimited: { ...c.unlimited } }]);
  };
  const updateCard = (patch: Partial<Card>) => setSelectedCards(arr => arr.map((c, i) => i === editIdx ? { ...c, ...patch } : c));

  const goEditCards = () => { if (selectedCards.length === 0) setStep('ct-pick'); else { setEditIdx(0); setStep('card-edit'); } };
  const finishCardEdits = () => { if (editIdx + 1 < selectedCards.length) setEditIdx(editIdx + 1); else setStep('ct-pick'); };
  const toggleCardRank = (rank: CardRank) => setCardRanks((ranks) => ranks.includes(rank) ? ranks.filter(r => r !== rank) : [...ranks, rank]);
  const toggleCTRank = (rank: Rank) => setCTRanks((ranks) => ranks.includes(rank) ? ranks.filter(r => r !== rank) : [...ranks, rank]);
  const visibleCards = cards.filter((c) => {
    const q = cardQuery.trim().toLowerCase();
    const queryOk = !q || `${c.name} ${c.caption} ${c.rank || ''}`.toLowerCase().includes(q);
    const rankOk = cardRanks.length === 0 || cardRanks.includes(c.rank || 'E');
    return queryOk && rankOk && canCTUseCard(selectedCT, c);
  });
  const visibleCTs = cts.filter((ct) => {
    const q = ctQuery.trim().toLowerCase();
    const queryOk = !q || `${ct.name} ${ct.rank} ${ATTRS.map(a => `${a}:${ct.unlimited[a] ? '∞' : (ct.attrs[a] ?? 0)}`).join(' ')}`.toLowerCase().includes(q);
    const rankOk = ctRanks.length === 0 || ctRanks.includes(ct.rank);
    return queryOk && rankOk;
  });

  const confirmPlay = () => {
    if (!selectedCT) return Alert.alert('Atenção', 'Selecione O C.T para enviar.');
    const finalAttrs: Record<Attr, number | 'ilimitado'> = {} as any;
    for (const a of ATTRS) {
      if (selectedCT.unlimited[a]) { finalAttrs[a] = 'ilimitado'; continue; }
      let v = sanitizeNum(String(selectedCT.attrs[a] ?? 0));
      let unl = false;
      for (const c of selectedCards) {
        if (c.unlimited[a]) { unl = true; break; }
        if (c.cost[a] != null) v -= (c.cost[a] as number);
        if (c.boost[a] != null) v += (c.boost[a] as number);
      }
      finalAttrs[a] = unl ? 'ilimitado' : (isFinite(v) ? v : 0);
    }
    onConfirm(selectedCards.map(c => ({ cardSnapshot: c })), selectedCT, observation.trim(), finalAttrs);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalWrap}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {step === 'cards' ? '1. Selecione Cards' :
               step === 'card-edit' ? `2. Editar Card (${editIdx + 1}/${selectedCards.length})` :
               step === 'ct-pick' ? '3. Selecione O C.T' : '4. Editar O C.T'}
            </Text>
            <Pressable onPress={onClose} testID="online-modal-close-btn"><Ionicons name="close" size={22} color="#fff" /></Pressable>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 90 }} keyboardShouldPersistTaps="handled">
            {step === 'cards' && (
              <>
                {cards.length === 0 && <Text style={styles.empty}>Sem cards. Pode prosseguir sem cards.</Text>}
                <Input label="Buscar card" value={cardQuery} onChangeText={setCardQuery} placeholder="Nome, legenda ou rank" testID="online-play-card-search" />
                <View style={styles.chipsRow}>
                  {CARD_RANKS.map(r => <Chip key={r} label={r} active={cardRanks.includes(r)} onPress={() => toggleCardRank(r)} testID={`online-play-rank-${r}`} />)}
                </View>
                <View style={{ gap: 10 }}>
                  {visibleCards.map((c) => {
                    const active = selectedCards.some(x => x.id === c.id);
                    return (
                      <Pressable key={c.id} onPress={() => toggleCard(c)} testID={`online-play-card-${c.id}`}
                        style={({ pressed }) => [styles.pickItem, active && styles.pickItemActive, { opacity: pressed ? 0.85 : 1 }]}>
                        <ZoomableThumb uri={c.image} onPress={onImagePress} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.pickName}>{c.name} — {c.rank || 'E'}</Text>
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
              <CardEditInline card={selectedCards[editIdx]} onChange={updateCard} />
            )}

            {step === 'ct-pick' && (
              <View style={{ gap: 10 }}>
                <Input label="Buscar O C.T" value={ctQuery} onChangeText={setCTQuery} placeholder="Nome, rank ou atributo" testID="online-play-ct-search" />
                <View style={styles.chipsRow}>
                  {CT_RANKS.map(r => <Chip key={r} label={r} active={ctRanks.includes(r)} onPress={() => toggleCTRank(r)} testID={`online-play-ct-rank-${r}`} />)}
                </View>
                {visibleCTs.map((c) => {
                  const active = selectedCT?.id === c.id;
                  return (
                    <Pressable key={c.id} onPress={() => setSelectedCT({ ...c, attrs: { ...c.attrs }, unlimited: { ...c.unlimited } })}
                      testID={`online-play-ct-${c.id}`}
                      style={({ pressed }) => [styles.pickItem, active && styles.pickItemActive, { opacity: pressed ? 0.85 : 1 }]}>
                      <ZoomableThumb uri={c.image} onPress={onImagePress} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pickName}>{c.name} — Rank {c.rank}</Text>
                        <Text style={styles.pickSub}>{ATTRS.map(a => `${a}:${c.unlimited[a] ? '∞' : (c.attrs[a] ?? 0)}`).join(' • ')}</Text>
                      </View>
                      {active && <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />}
                    </Pressable>
                  );
                })}
              </View>
            )}

            {step === 'ct-edit' && selectedCT && (
              <View>
                <Text style={styles.label}>Editar O C.T (apenas esta jogada)</Text>
                {ATTRS.map(a => (
                  <Input
                    key={a}
                    label={`${a}${selectedCT.unlimited[a] ? ' (ilimitado)' : ''}`}
                    keyboardType="numeric"
                    editable={!selectedCT.unlimited[a]}
                    value={selectedCT.unlimited[a] ? '' : String(selectedCT.attrs[a] ?? 0)}
                    onChangeText={(t) => setSelectedCT({ ...selectedCT, attrs: { ...selectedCT.attrs, [a]: sanitizeNum(t) } })}
                    placeholder={selectedCT.unlimited[a] ? 'ilimitado' : '0'}
                    testID={`online-play-ct-attr-${a}`}
                  />
                ))}
                <UnlimitedEditor unlimited={selectedCT.unlimited} setUnlimited={(u) => setSelectedCT({ ...selectedCT, unlimited: u })} />
                <Input
                  label="Observação"
                  value={observation}
                  onChangeText={setObservation}
                  placeholder="Ex: usei fonte de chakra e meu Ck ficou ilimitado."
                  multiline numberOfLines={3}
                  style={{ minHeight: 70, textAlignVertical: 'top' }}
                  testID="online-play-ct-obs"
                />
              </View>
            )}
          </ScrollView>

          <View style={styles.modalFooter}>
            {step === 'cards' && <Button title="Avançar" onPress={goEditCards} testID="online-play-next-cards" />}
            {step === 'card-edit' && <Button title={editIdx + 1 < selectedCards.length ? 'Próximo card' : 'Selecionar O C.T'} onPress={finishCardEdits} testID="online-play-next-card-edit" />}
            {step === 'ct-pick' && <Button title="Editar O C.T" onPress={() => selectedCT ? setStep('ct-edit') : Alert.alert('Atenção', 'Selecione O C.T')} testID="online-play-next-ct" />}
            {step === 'ct-edit' && <Button title="Enviar Jogada" onPress={confirmPlay} testID="online-play-confirm-btn" />}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function CardEditInline({ card, onChange }: { card: Card; onChange: (p: Partial<Card>) => void }) {
  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 10 }}>
        {card.image ? <Image source={{ uri: card.image }} style={[styles.cardThumb, { width: 50, height: 50 }]} /> : null}
        <Text style={styles.pickName}>{card.name} — {card.rank || 'E'}</Text>
      </View>
      <Input label="Legenda (desta jogada)" value={card.caption} onChangeText={(t) => onChange({ caption: t })} multiline numberOfLines={3} style={{ minHeight: 70, textAlignVertical: 'top' }} testID="online-play-card-caption" />
      <Text style={styles.label}>Custo</Text>
      <AttrEditor label="Custo" values={card.cost} setValues={(v) => onChange({ cost: v })} keyPrefix={`online-play-cost-${card.id}`} />
      <Text style={styles.label}>Aumento</Text>
      <AttrEditor label="Aumento" values={card.boost} setValues={(v) => onChange({ boost: v })} keyPrefix={`online-play-boost-${card.id}`} />
      <UnlimitedEditor unlimited={card.unlimited} setUnlimited={(u) => onChange({ unlimited: u })} />
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 1, textAlign: 'center' },

  statusBox: { gap: 12, marginTop: 24, alignItems: 'center', backgroundColor: theme.colors.surface, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: theme.colors.border },
  code: { color: theme.colors.neon, fontSize: 32, fontWeight: '900', letterSpacing: 6, textAlign: 'center' },
  statusTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  statusHint: { color: theme.colors.textMuted, fontSize: 12, textAlign: 'center', marginBottom: 8 },

  playersRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  vs: { color: theme.colors.neon, fontSize: 18, fontWeight: '900' },
  playerBadge: { flex: 1, alignItems: 'center', gap: 4, backgroundColor: theme.colors.surface, padding: 10, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: theme.colors.bg },
  avatarFb: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border },
  pTag: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  pName: { color: '#fff', fontSize: 13, fontWeight: '800' },
  pVillage: { color: theme.colors.neon, fontSize: 10, fontWeight: '700' },

  subInfo: { color: theme.colors.neon, fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10, textAlign: 'center' },
  label: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, marginTop: 8 },
  empty: { color: theme.colors.textMuted, textAlign: 'center', padding: 20 },

  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 8, borderBottomWidth: 1, borderColor: theme.colors.border },
  turnTitle: { color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 1 },
  turnSub: { color: theme.colors.neon, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  connText: { color: theme.colors.success, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginTop: 2 },
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
  bubbleMe: { backgroundColor: 'rgba(255,59,0,0.14)', borderColor: 'rgba(255,59,0,0.3)', borderTopRightRadius: 4 },
  bubbleOpp: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', borderTopLeftRadius: 4 },
  bubbleHeader: { color: theme.colors.neon, fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  playedCard: { backgroundColor: 'rgba(0,0,0,0.25)', padding: 8, borderRadius: 10, marginVertical: 4, gap: 4 },
  cardThumb: { width: 36, height: 36, borderRadius: 8, backgroundColor: theme.colors.bg },
  cardThumbFb: { borderWidth: 1, borderColor: theme.colors.border },
  cardName: { color: '#fff', fontWeight: '800', fontSize: 13 },
  cardCaption: { color: theme.colors.textSecondary, fontSize: 12, fontStyle: 'italic' },
  chatText: { color: '#fff', fontSize: 13, lineHeight: 18 },
  fxLine: { color: theme.colors.neon, fontSize: 11, fontWeight: '700' },
  ctBlock: { backgroundColor: 'rgba(255,215,0,0.06)', padding: 8, borderRadius: 10, marginTop: 6, borderWidth: 1, borderColor: 'rgba(255,215,0,0.2)' },
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
  zoomContent: { minHeight: '100%', alignItems: 'center', justifyContent: 'center' },
  zoomImage: { width: 360, height: 560, maxWidth: '100%' },
});
