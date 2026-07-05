// Estatísticas de uso: dictações, palavras, tempo economizado e sequência de dias.

import { loadStats, saveStats } from './storage.js';

// Suposições para estimar o tempo economizado ao ditar em vez de digitar.
const TYPING_WPM = 40; // digitação média
const SPEAKING_WPM = 150; // fala média

function countWords(text) {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function dayKey(date = new Date()) {
  // AAAA-MM-DD no fuso local.
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

/** Registra uma dictação concluída e retorna as estatísticas atualizadas. */
export function recordDictation(text) {
  const words = countWords(text);
  if (!words) return loadStats();

  const stats = loadStats();
  stats.totalDictations += 1;
  stats.totalWords += words;

  const typeMs = (words / TYPING_WPM) * 60000;
  const speakMs = (words / SPEAKING_WPM) * 60000;
  stats.msSaved += Math.max(0, typeMs - speakMs);

  const key = dayKey();
  stats.days[key] = (stats.days[key] || 0) + 1;

  saveStats(stats);
  return stats;
}

/** Calcula a sequência de dias consecutivos com uso, terminando hoje ou ontem. */
export function computeStreak(days) {
  const keys = new Set(Object.keys(days || {}));
  if (!keys.size) return 0;

  const cursor = new Date();
  // Se não houve uso hoje, a sequência ainda vale se houve ontem.
  if (!keys.has(dayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!keys.has(dayKey(cursor))) return 0;
  }

  let streak = 0;
  while (keys.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Formata milissegundos como "3 h 12 min", "12 min" ou "45 s". */
export function formatDuration(ms) {
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds} s`;
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${minutes % 60} min`;
}

/** Retorna um resumo pronto para exibição. */
export function getSummary() {
  const stats = loadStats();
  return {
    totalDictations: stats.totalDictations,
    totalWords: stats.totalWords,
    timeSaved: formatDuration(stats.msSaved),
    streak: computeStreak(stats.days),
  };
}
