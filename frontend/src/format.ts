import { CT } from './types';

export function formatNumberBR(value: number | string | null | undefined) {
  if (value === 'ilimitado') return value;
  const n = typeof value === 'number' ? value : Number(value ?? 0);
  if (!Number.isFinite(n)) return '0';
  return Math.trunc(n).toLocaleString('pt-BR');
}

export function ctDisplayName(ct: Pick<CT, 'name' | 'rank'> | null | undefined) {
  if (!ct) return 'O C.T';
  const name = ct.name?.trim();
  return name || `O C.T Rank ${ct.rank}`;
}
