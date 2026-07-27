export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const { question, codes } = req.body || {};

  if (!question || typeof question !== 'string') {
    return res.status(400).json({ error: 'Question manquante.' });
  }

  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "Clé API non configurée sur le serveur. Ajoute PERPLEXITY_API_KEY dans les variables d'environnement Vercel."
    });
  }

  const systemPrompt = `Tu es un assistant de recherche juridique français. On te pose des questions concernant : ${codes || 'le droit français'}.
Réponds toujours en français, de façon claire, directe et concrète, comme pour quelqu'un qui n'est pas juriste.
Appuie-toi en priorité sur les textes officiels de Légifrance (légifrance.gouv.fr) pour le texte exact des articles, et sur Open Dalloz (open.lefebvre-dalloz.fr), la base gratuite de Dalloz, pour les fiches d'orientation et la jurisprudence en accès libre. Ne mentionne jamais de contenu du site payant dalloz.fr classique.
Structure ta réponse ainsi :
1. Réponse directe à la question (2-4 phrases maximum).
2. Article(s) de loi précis en correspondance, écrits sous la forme "Article XXX du Code civil/pénal/de la consommation".
3. Une phrase de nuance si la réponse dépend du contexte ou de la jurisprudence.
Ne mentionne jamais que tu es une IA générique ; reste concentré sur les textes de loi français en vigueur.`;

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question }
        ],
        search_domain_filter: ['legifrance.gouv.fr', 'open.lefebvre-dalloz.fr', 'open-dalloz.fr'],
        return_citations: true
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: errText.slice(0, 300) });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || 'Aucune réponse reçue.';
    const citations = data.citations || (data.search_results || []).map((r) => r.url) || [];

    return res.status(200).json({ text, citations });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
