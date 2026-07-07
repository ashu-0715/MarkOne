/**
 * AI generation service.
 * Plug in your preferred LLM provider (Anthropic, OpenAI, etc.) using
 * AI_PROVIDER_API_KEY and AI_PROVIDER_BASE_URL from .env.
 *
 * generateQuestionsFromText and generateQuestionsFromPrompt both return
 * an array of question objects matching the Question model shape, so the
 * rest of the app (question editor, question bank, test creation) doesn't
 * need to know or care which AI provider produced them.
 */

const requireKey = () => {
  if (!process.env.AI_PROVIDER_API_KEY) {
    const err = new Error(
      'AI_PROVIDER_API_KEY is not set. Add your LLM provider key to .env to enable AI question generation.'
    );
    err.statusCode = 501;
    throw err;
  }
};

export const generateQuestionsFromText = async ({ lessonText, types, difficulty, count }) => {
  requireKey();
  // Example call shape (Anthropic Messages API):
  //
  // const response = await fetch(process.env.AI_PROVIDER_BASE_URL, {
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'application/json',
  //     'x-api-key': process.env.AI_PROVIDER_API_KEY,
  //     'anthropic-version': '2023-06-01',
  //   },
  //   body: JSON.stringify({
  //     model: 'claude-sonnet-4-6',
  //     max_tokens: 2000,
  //     messages: [{
  //       role: 'user',
  //       content: `Generate ${count} ${difficulty} difficulty questions of types ${types.join(', ')}
  //                  from this lesson text, and respond ONLY with a JSON array matching:
  //                  { type, questionText, options, correctAnswer, explanation, marks }.
  //                  Lesson: ${lessonText}`
  //     }],
  //   }),
  // });
  // const data = await response.json();
  // return JSON.parse(data.content[0].text);

  throw new Error('AI provider not yet connected. See services/aiService.js');
};

export const generateQuestionsFromPrompt = async ({ prompt, count, difficulty }) => {
  requireKey();
  throw new Error('AI provider not yet connected. See services/aiService.js');
};

export const generateDiagramFromPrompt = async ({ prompt }) => {
  requireKey();
  throw new Error('AI diagram generation not yet connected. See services/aiService.js');
};
