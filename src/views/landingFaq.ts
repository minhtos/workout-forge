/** The landing page FAQ. The page renders it and the build turns the same array into the FAQPage structured data (scripts/prerender.mjs), so the two cannot drift. */
export const faq = [
  { question: 'Is it free?', answer: 'Yes. Everything in Workout Forge is free to use.' },
  { question: 'Is there a subscription?', answer: 'No. There are no paid plans or in-app purchases.' },
  { question: 'Does it work offline?', answer: 'Yes. It installs like an app and every set saves on your device, with or without a connection.' },
  { question: 'Does it work on iPhone and Android?', answer: 'Yes. On both, you install it from your browser as a web app, with no app store.' },
  { question: 'Where is my data stored?', answer: 'In your browser on this device. If you create an account, your workouts and plan also back up to it.' },
  { question: 'Do I need an account?', answer: 'No. An account is only for backup and using more than one device.' },
]

export function faqJsonLd() {
  return {
    '@type': 'FAQPage',
    '@id': 'https://workoutforge.app/#faq',
    mainEntity: faq.map((item) => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } })),
  }
}
