import { Icon } from '../components/Icon';

// A fresh pep talk every day. Short, upbeat and easy for a 7-year-old to read.
const QUOTES = [
  'Every big win starts with one small step.',
  "Mistakes mean you're learning. Keep going!",
  'Be the reason someone smiles today.',
  "You don't have to be perfect to be awesome.",
  "Hard things get easier every time you try.",
  'Kindness is a superpower.',
  "Believe you can and you're halfway there.",
  'Practice makes progress.',
  'Your best is always good enough.',
  "Try your hardest, then try a bit more!",
  'Brave is doing it even when you feel scared.',
  'Teamwork makes the dream work.',
  'Great things take time. Be patient!',
  "Don't give up. Level up!",
  'Be curious. Ask questions. Learn heaps!',
  'A good friend is the best treasure.',
  'Today is a great day to do something great.',
  'You are stronger than you think.',
  'Small jobs done well add up to big rewards.',
  'Say please, say thank you, and smile.',
  'Every day is a new level. Go get it!',
];

const STAR = 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z';

export function DailyQuote({ day }: { day: string }) {
  // Same quote all day on every device, a new one each morning.
  const n = Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
  const quote = QUOTES[((n % QUOTES.length) + QUOTES.length) % QUOTES.length];
  return (
    <section className="daily-quote" aria-label="Quote of the day">
      <span className="dq-star"><Icon d={STAR} size={30} filled /></span>
      <div className="dq-text">
        <span className="dq-label">TODAY'S POWER-UP</span>
        <p>{quote}</p>
      </div>
    </section>
  );
}
