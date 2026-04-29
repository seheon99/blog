const KOREAN_RANGE = /[가-힯]/g;
const CODE_FENCE = /```[\s\S]*?```/g;
const KOREAN_CPM = 500;
const ENGLISH_WPM = 250;

export function readMinutes(body: string): number {
  const text = body.replace(CODE_FENCE, "");
  const koreanChars = text.match(KOREAN_RANGE)?.length ?? 0;
  const englishWords = text
    .replace(KOREAN_RANGE, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  const minutes = Math.ceil(
    koreanChars / KOREAN_CPM + englishWords / ENGLISH_WPM,
  );
  return Math.max(1, minutes);
}
