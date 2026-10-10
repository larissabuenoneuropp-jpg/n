import type { AiTask } from "./prompts";

/**
 * Respostas de demonstração usadas quando OPENAI_API_KEY não está configurada.
 * São genéricas e servem apenas para visualizar o fluxo — não são análise clínica real.
 */
export function mockResponse(task: AiTask, input: Record<string, unknown>): Record<string, unknown> {
  const queixa = String(input.complaint ?? input.difficulties ?? "dificuldades de aprendizagem");
  switch (task) {
    case "assessment_plan":
      return {
        objective: `Investigar os processos cognitivos e acadêmicos relacionados à queixa: ${queixa}.`,
        instruments: [
          { name: "EOCA", session: 1, justification: "Observar a modalidade de aprendizagem e o vínculo com o aprender." },
          { name: "IAR", session: 2, justification: "Verificar pré-requisitos para alfabetização." },
          { name: "PROLEC", session: 3, justification: "Avaliar os processos de leitura (identificação de letras, léxico, sintaxe e semântica)." },
          { name: "PROESC", session: 4, justification: "Avaliar os processos de escrita." },
          { name: "TAC", session: 5, justification: "Rastrear atenção seletiva." },
          { name: "Cubos de Corsi", session: 5, justification: "Avaliar memória operacional visuoespacial." },
        ],
        sessions: [
          { number: 1, objective: "Vínculo e observação da modalidade de aprendizagem", instruments: ["EOCA"], duration_min: 50 },
          { number: 2, objective: "Pré-requisitos de alfabetização", instruments: ["IAR"], duration_min: 50 },
          { number: 3, objective: "Processos de leitura", instruments: ["PROLEC"], duration_min: 50 },
          { number: 4, objective: "Processos de escrita", instruments: ["PROESC"], duration_min: 50 },
          { number: 5, objective: "Atenção e memória", instruments: ["TAC", "Cubos de Corsi"], duration_min: 50 },
          { number: 6, objective: "Devolutiva aos responsáveis", instruments: [], duration_min: 60 },
        ],
        total_sessions: 6,
        justification: "Sequência que parte de instrumentos de menor exigência para os mais específicos, favorecendo o vínculo e reduzindo a ansiedade de desempenho.",
        checklist: ["Anamnese com responsáveis", "Termo de consentimento", "Questionário para a escola", "Agendar devolutiva"],
        warnings: ["[MODO DEMONSTRAÇÃO] Resposta de exemplo — configure OPENAI_API_KEY para sugestões personalizadas."],
      };
    case "intervention_plan": {
      const n = Number(input.sessions_count ?? 8);
      const themes = [
        "Consciência fonológica: rimas e aliterações", "Segmentação silábica", "Correspondência grafema-fonema",
        "Leitura de palavras regulares", "Fluência com textos curtos", "Compreensão leitora", "Escrita de palavras", "Produção de frases",
      ];
      return {
        title: "Plano de intervenção individualizado",
        general_objective: "Promover o desenvolvimento das habilidades de leitura, escrita e funções cognitivas associadas.",
        specific_objectives: ["Ampliar consciência fonológica.", "Consolidar correspondência grafema-fonema.", "Aumentar fluência e compreensão leitora."],
        goals: ["Identificar rimas com 80% de acerto em 4 semanas.", "Ler palavras regulares com 90% de precisão em 8 semanas."],
        progress_criteria: "Desempenho registrado em cada sessão, escalas de progresso (1–5) e reavaliação trimestral.",
        sessions: Array.from({ length: n }, (_, i) => ({
          number: i + 1,
          objective: themes[i % themes.length],
          activities: "Atividade lúdica de aquecimento; atividade principal com apoio multissensorial; fechamento com jogo.",
          materials: "Cartões ilustrados, alfabeto móvel, jogos de tabuleiro adaptados.",
          duration_min: 50,
          strategies: "Instrução explícita, modelagem, pistas graduais, reforço positivo.",
          success_criteria: "80% de acertos com apoio mínimo.",
        })),
      };
    }
    case "session_insights":
      return {
        next_objective: "Consolidar a habilidade trabalhada e introduzir nível seguinte de complexidade.",
        new_activities: ["Bingo de fonemas", "Leitura compartilhada com pistas visuais"],
        strategies: ["Reduzir gradualmente as pistas", "Pausas ativas a cada 15 minutos"],
        difficulties: ["Manutenção da atenção ao final da sessão"],
        emerging_skills: ["Maior autonomia na identificação de sons iniciais"],
        clinical_alerts: [],
        referrals: [],
        _demo: "[MODO DEMONSTRAÇÃO] Sugestão de exemplo.",
      };
    case "evolution_analysis":
      return {
        summary: "[MODO DEMONSTRAÇÃO] Tendência de melhora gradual em autonomia e alcance de metas nas últimas sessões.",
        progress_patterns: ["Aumento da autonomia", "Engajamento estável"],
        stagnation_points: ["Atenção sustentada ao final das sessões"],
        suggested_adaptations: ["Sessões com blocos mais curtos e variados"],
        next_steps: ["Reavaliar metas em 4 semanas"],
      };
    case "report_draft":
      return { text: "[MODO DEMONSTRAÇÃO] Configure OPENAI_API_KEY para gerar a redação. Texto de exemplo: durante o período avaliado, observou-se [completar]." };
    case "chat":
      return { answer: "[MODO DEMONSTRAÇÃO] Configure OPENAI_API_KEY para conversar com a assistente clínica." };
  }
}
