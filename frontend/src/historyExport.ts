import { Share, Platform, Alert } from 'react-native';
import { ATTRS } from './theme';
import { BattleHistoryItem, ChatMsg } from './types';
import { formatNumberBR, formatSpeed } from './format';

function lineForAttrs(prefix: string, attrs?: Record<string, number | 'ilimitado'>) {
  if (!attrs) return '';
  return `${prefix}: ${ATTRS.map(attr => `${attr} ${formatNumberBR(attrs[attr])}`).join(' | ')}`;
}

export function calculationDetailsFor(msg: Pick<ChatMsg, 'playedCards' | 'momentaryActions' | 'finalAttrs' | 'finalEntityAttrs' | 'ctSnapshot' | 'ctObservation'>) {
  const lines: string[] = [];
  for (const played of msg.playedCards || []) {
    const card = played.cardSnapshot;
    const action = msg.momentaryActions?.find(item => item.cardId === card.id);
    lines.push(`Card: ${card.name} (Rank ${card.rank || 'E'}${formatSpeed(card.speed) ? `, ${formatSpeed(card.speed)}` : ''})`);
    const cost = ATTRS.filter(attr => card.cost?.[attr] != null).map(attr => `${attr}: ${formatNumberBR(card.cost?.[attr])}`).join(', ');
    const boost = ATTRS.filter(attr => card.boost?.[attr] != null).map(attr => `${attr}: ${formatNumberBR(card.boost?.[attr])}`).join(', ');
    const momentary = ATTRS.filter(attr => card.momentaryAttrs?.[attr] != null).map(attr => `${attr}: ${formatNumberBR(card.momentaryAttrs?.[attr])}`).join(', ');
    if (momentary) lines.push(`Atk/Def base da técnica: ${momentary}`);
    if (action) {
      for (const attr of ATTRS.filter(a => action.final[a] != null)) {
        const own = Number(action.own[attr] || 0);
        const final = Number(action.final[attr] || 0);
        lines.push(`${attr} final: ${formatNumberBR(final)}`);
        if (action.usedCTInfluence) lines.push(`Influência do ${action.source === 'entity' ? 'alvo ativo' : 'C.T'}: +${formatNumberBR(final - own)}`);
      }
    }
    if (cost) lines.push(`Custo aplicado: ${cost}`);
    if (boost) lines.push(`Bônus de modo/arma/invocação: ${boost}`);
    if (card.upkeepCost && Object.keys(card.upkeepCost).length > 0) {
      const upkeep = ATTRS.filter(attr => card.upkeepCost?.[attr] != null).map(attr => `${attr}: ${formatNumberBR(card.upkeepCost?.[attr])}`).join(', ');
      if (upkeep) lines.push(`Custo por turno: ${upkeep}`);
    }
    if (card.maxTargets || card.targetCount || card.summonQuantity) {
      lines.push(`Alvos/clones: ${[card.targetCount ? `alvos ${formatNumberBR(card.targetCount)}` : '', card.maxTargets ? `máx. atingidos ${formatNumberBR(card.maxTargets)}` : '', card.summonQuantity ? `quantidade ${formatNumberBR(card.summonQuantity)}` : ''].filter(Boolean).join(', ')}`);
    }
  }
  const finalAttrs = lineForAttrs('ENE/CK/AG/HP restante', msg.finalAttrs);
  if (finalAttrs) lines.push(finalAttrs);
  const entityAttrs = lineForAttrs('Alvo ativo restante', msg.finalEntityAttrs);
  if (entityAttrs) lines.push(entityAttrs);
  if (msg.ctSnapshot?.resourceName === 'ENE') lines.push(`ENE restante: ${formatNumberBR(msg.ctSnapshot.resourceValue || 0)}`);
  if (msg.ctObservation) lines.push(`Resultado: ${msg.ctObservation}`);
  return lines;
}

export function exportHistoryText(item: BattleHistoryItem) {
  const title = `Histórico da luta - ${item.config.matchType}`;
  const started = new Date(item.config.startedAt).toLocaleString();
  const ended = new Date(item.endedAt).toLocaleString();
  const parts = [
    title,
    `Modo: ${item.config.matchType}`,
    `Data/hora: ${started}`,
    `Encerrada: ${ended}`,
    item.config.bossDifficulty ? `Boss/dificuldade: ${item.config.bossDifficulty}` : '',
    `Vencedor/resultado: ${item.result || 'sem vencedor registrado'}`,
    '',
    'Turnos:',
  ].filter(Boolean);

  for (const msg of item.messages) {
    parts.push(`Turno ${msg.turn} - ${msg.team}`);
    if (msg.text) parts.push(msg.text);
    for (const played of msg.playedCards || []) {
      const card = played.cardSnapshot;
      const cost = ATTRS.filter(attr => card.cost?.[attr] != null).map(attr => `${attr}: ${formatNumberBR(card.cost?.[attr])}`).join(', ');
      parts.push(`Card usado: ${card.name} | Rank ${card.rank || 'E'} | ${formatSpeed(card.speed) || 'Sem Speed'}`);
      if (card.caption) parts.push(`Legenda: ${card.caption}`);
      if (cost) parts.push(`Custo: ${cost}`);
    }
    const calc = msg.calculationDetails || calculationDetailsFor(msg);
    if (calc.length > 0) parts.push(`Cálculo resumido: ${calc.join(' | ')}`);
    parts.push('');
  }
  return parts.join('\n');
}

export async function copyOrShareHistory(item: BattleHistoryItem) {
  const text = exportHistoryText(item);
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    Alert.alert('Histórico copiado', 'O texto da luta foi copiado.');
    return;
  }
  await Share.share({ message: text });
}
