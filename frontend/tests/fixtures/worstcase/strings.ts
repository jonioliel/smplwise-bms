// BREAKUI-297 (P6): the worst-case values of the break-ui pass, as data only (no Playwright, no DOM), so a spec, a harness or a unit test
// can import them. Every value is INVENTED but plausible: a real naming pattern, a real e-mail shape, or the longest value the product
// accepts. Nothing here reaches a device. Rows mix the failures (row 1 long, row 2 one letter, row 3 emoji ...) the way real data does.

/** A real-looking long Hebrew room / area name (87 chars): a facility manager's full description. */
export const HE_LONG = 'חדר ישיבות הנהלה בכירה ואגף כספים והשקעות - אגף צפון, קומה 3, ליד המעליות המרכזיות';
/** A long English name typed by an integrator (60 chars, spaces). */
export const EN_LONG = 'Executive Boardroom & Finance Wing - North Tower, Level 3 East';
/** An entity id that became the name because the device has no friendly name (unbreakable, 41 chars). */
export const ENTITY_ID_AS_NAME = 'light.shelly_plus_1pm_8caab5d3c2f1_channel_1';
/** An e-mail-shaped username (no break opportunity before the @). */
export const EMAIL = 'aleksandra.wisniewska-kowalczyk@northwind-industries-holdings.example.com';
/** One letter (a real short room name: "א" wing). */
export const ONE = 'א';
/** A two-letter Latin name (initials / avatar edge case). */
export const TWO_LATIN = 'Jo';
/** Emoji first (a family home: kids name rooms like this). */
export const EMOJI = '🎮 חדר משחקים של הילדים 🧸';
/** A ZWJ family emoji only (grapheme cluster, not a code point). */
export const EMOJI_ONLY = '👨‍👩‍👧‍👦';
/** Mixed RTL / LTR with numbers, parentheses and a dash: the parentheses and the number order are the bidi trap. */
export const MIXED = 'לובי Lobby-12 (קומה 3) - Gate B7';
/** A negative floor (the "-2" renders as "2-" without an LRM). */
export const NEG_FLOOR = 'קומה -2 חניון תת קרקעי';
/** Arabic (a mixed-language building). */
export const AR = 'غرفة الاجتماعات الكبرى - الطابق الثالث';
/** Russian (a long compound name). */
export const RU = 'Переговорная комната совета директоров';
/** A display name with a long Polish surname and a suffix (initials trap: "AW" vs "A" vs "AI"). */
export const PERSON_LONG = 'Aleksandra Wiśniewska-Kowalczyk Montgomery III';
/** A Hebrew person with a geresh and a double surname. */
export const PERSON_HE_LONG = "אלכסנדרה ויסניבסקה-קובלצ'יק בן-שושן";
/** A one-letter Hebrew display name. */
export const PERSON_ONE = 'ג';

/** Names in the order the fixtures hand them out (row i gets NAMES[i % n]). */
export const NAMES = [HE_LONG, ONE, EMOJI, MIXED, EN_LONG, ENTITY_ID_AS_NAME, AR, NEG_FLOOR, RU, TWO_LATIN, EMOJI_ONLY] as const;

/** Numbers: the realistic upper bounds (a big site) and the edge values. */
export const NUM = {
  huge: 1_234_567.89, // a cumulative energy meter in kWh
  bigCount: 1284, // lights in a large office building
  bigCount2: 2047,
  negTemp: -12.5, // a freezer room
  hot: 104.7, // a sauna / a broken sensor
  zero: 0,
  one: 1, // pluralisation: "1 lights" / "1 נורות"
} as const;
