import { Share, Platform, Alert } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
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
    if (card.battleUseType) lines.push(`Tipo usado nesta jogada: ${card.battleUseType}`);
    if (card.targetShape || card.actualTargets || card.maxTargets) {
      lines.push(`Alvo dinâmico: ${[card.targetShape, card.actualTargets ? `${formatNumberBR(card.actualTargets)} alvos reais` : '', card.maxTargets ? `máx. ${formatNumberBR(card.maxTargets)}` : ''].filter(Boolean).join(', ')}`);
    }
    const defenseFlags = [
      card.ignoresCTDefense ? 'ignora DEF do C.T' : '',
      card.ignoresCommonDefense ? 'ignora defesa comum' : '',
      card.directHpDamage ? 'aplica dano direto ao HP' : '',
      card.piercing ? 'perfuração' : '',
      card.compatibleDefenseOnly ? 'exige defesa compatível' : '',
    ].filter(Boolean).join(', ');
    if (defenseFlags) lines.push(`Regra de defesa: ${defenseFlags}.`);
    if (card.combatTargetKind || card.effectTargetLabel) lines.push(`Alvo do efeito: ${[card.combatTargetKind, card.effectTargetLabel].filter(Boolean).join(' / ')}`);
    if (card.fieldPosition) lines.push(`Campo: ${card.fieldPosition}`);
    if (card.temporaryNote) lines.push(`Obs. temporária: ${card.temporaryNote}`);
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
      if (card.battleUseType) parts.push(`Tipo usado nesta jogada: ${card.battleUseType}`);
      if (card.targetShape || card.actualTargets || card.maxTargets) parts.push(`Alvos: ${[card.targetShape, card.actualTargets ? `${formatNumberBR(card.actualTargets)} reais` : '', card.maxTargets ? `máx ${formatNumberBR(card.maxTargets)}` : ''].filter(Boolean).join(' | ')}`);
      if (card.directHpDamage || card.ignoresCTDefense || card.ignoresCommonDefense) parts.push('Este ataque ignora DEF comum e aplica dano direto ao HP quando não houver defesa compatível.');
      if (card.temporaryNote) parts.push(`Observação temporária: ${card.temporaryNote}`);
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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function replaySummary(item: BattleHistoryItem) {
  const started = new Date(item.config.startedAt).toLocaleString();
  const ended = new Date(item.endedAt).toLocaleString();
  const durationMs = Math.max(0, item.endedAt - item.config.startedAt);
  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.floor((durationMs % 60000) / 1000);
  return {
    title: `Luta ${item.config.matchType}`,
    started,
    ended,
    duration: `${minutes}min ${seconds}s`,
    boss: item.config.bossDifficulty ? `Kael’Zor / ${item.config.bossDifficulty}` : '',
    result: item.result || 'Sem resultado registrado',
  };
}

function historyHtml(item: BattleHistoryItem) {
  const summary = replaySummary(item);
  const turns = item.messages.map((msg) => {
    const cards = (msg.playedCards || []).map(({ cardSnapshot: card }) => `
      <div class="card">
        ${card.image ? `<img src="${escapeHtml(card.image)}" />` : ''}
        <div>
          <h3>${escapeHtml(card.name)} <span>Rank ${escapeHtml(card.rank || 'E')}</span></h3>
          ${card.caption ? `<p>${escapeHtml(card.caption)}</p>` : ''}
          <small>${escapeHtml([card.battleUseType, card.targetShape, card.actualTargets ? `${card.actualTargets} alvos` : '', card.directHpDamage ? 'dano direto no HP' : ''].filter(Boolean).join(' • '))}</small>
        </div>
      </div>
    `).join('');
    const calc = (msg.calculationDetails || calculationDetailsFor(msg)).map(line => `<li>${escapeHtml(line)}</li>`).join('');
    return `
      <section>
        <h2>Turno ${msg.turn} • ${escapeHtml(msg.team)}</h2>
        ${msg.text ? `<p>${escapeHtml(msg.text)}</p>` : ''}
        ${cards}
        ${calc ? `<ul>${calc}</ul>` : ''}
      </section>
    `;
  }).join('');
  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: Arial, sans-serif; color: #161616; margin: 28px; }
          .cover { border: 2px solid #c83b18; padding: 18px; margin-bottom: 18px; }
          h1 { margin: 0 0 8px; color: #9f250f; }
          h2 { color: #9f250f; font-size: 16px; border-bottom: 1px solid #eee; padding-bottom: 6px; }
          h3 { margin: 0 0 4px; font-size: 14px; }
          h3 span, small { color: #666; font-weight: normal; }
          p { white-space: pre-wrap; line-height: 1.35; }
          section { break-inside: avoid; margin-bottom: 14px; }
          .card { display: flex; gap: 10px; border: 1px solid #eee; border-radius: 8px; padding: 8px; margin: 6px 0; }
          img { width: 54px; height: 54px; object-fit: cover; border-radius: 6px; }
          li { margin-bottom: 3px; }
        </style>
      </head>
      <body>
        <div class="cover">
          <h1>${escapeHtml(summary.title)}</h1>
          <p>Modo: ${escapeHtml(item.config.matchType)}<br/>
          Data/hora: ${escapeHtml(summary.started)}<br/>
          Encerrada: ${escapeHtml(summary.ended)}<br/>
          Duração: ${escapeHtml(summary.duration)}<br/>
          ${summary.boss ? `Boss/dificuldade: ${escapeHtml(summary.boss)}<br/>` : ''}
          Resultado: ${escapeHtml(summary.result)}</p>
        </div>
        ${turns}
      </body>
    </html>
  `;
}

export async function exportHistoryPdf(item: BattleHistoryItem) {
  try {
    const { uri } = await Print.printToFileAsync({ html: historyHtml(item), base64: false });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Exportar replay em PDF' });
    } else {
      await Share.share({ message: uri });
    }
  } catch {
    Alert.alert('PDF indisponível', 'Não foi possível gerar o PDF neste dispositivo.');
  }
}

export async function exportSummaryCard(item: BattleHistoryItem) {
  const summary = replaySummary(item);
  const mainCards = item.messages.flatMap(msg => msg.playedCards || []).slice(0, 6).map(p => p.cardSnapshot.name).join(', ') || 'Sem cards registrados';
  const text = [
    summary.title,
    `Vencedor/resultado: ${summary.result}`,
    `Duração: ${summary.duration}`,
    `Modo: ${item.config.matchType}`,
    summary.boss ? `Boss: ${summary.boss}` : '',
    `Cards principais: ${mainCards}`,
    `Data: ${summary.ended}`,
  ].filter(Boolean).join('\n');
  await Share.share({ message: text });
}

export function videoExportNotice() {
  Alert.alert('Exportação em vídeo', 'Exportação em vídeo ainda está em fase experimental. O modo espectador e os exports em texto/PDF/card já estão prontos; vídeo nativo exigirá uma etapa futura com captura de frames sem quebrar o EAS build.');
}
