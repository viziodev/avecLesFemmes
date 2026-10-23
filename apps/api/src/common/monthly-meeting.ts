// Dates civiles UTC : Dakar n'a pas de changement d'heure.
export function monthlyMeeting(start: string, index: number, weekday: number, week: number) {
  const base = new Date(start + 'T12:00:00Z');
  const occurrence = (offset: number) => {
    const first = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + offset, 1, 12));
    first.setUTCDate(1 + ((weekday - first.getUTCDay() + 7) % 7) + 7 * (week - 1));
    return first.toISOString().slice(0, 10);
  };
  return occurrence(index + (occurrence(0) < start ? 1 : 0));
}
