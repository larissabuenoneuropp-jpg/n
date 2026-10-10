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
          { number: 1, objectives: ["Estabelecer vínculo com a criança", "Observar a modalidade de aprendizagem", "Identificar interesses para uso nas próximas sessões"], instruments: ["EOCA"], activities: ["Conversa sobre interesses", "Jogo livre de aquecimento"], duration_min: 45 },
          { number: 2, objectives: ["Verificar pré-requisitos de alfabetização", "Observar coordenação motora fina", "Observar discriminação visual e auditiva"], instruments: ["IAR"], activities: [], duration_min: 45 },
          { number: 3, objectives: ["Avaliar identificação de letras", "Avaliar leitura de palavras e pseudopalavras", "Avaliar compreensão de frases"], instruments: ["PROLEC"], activities: [], duration_min: 45 },
          { number: 4, objectives: ["Avaliar escrita de palavras e pseudopalavras", "Observar tipos de erros ortográficos", "Observar produção escrita espontânea"], instruments: ["PROESC"], activities: [], duration_min: 45 },
          { number: 5, objectives: ["Rastrear atenção seletiva", "Avaliar memória operacional visuoespacial"], instruments: ["TAC", "Cubos de Corsi"], activities: ["Pausa ativa entre as tarefas"], duration_min: 45 },
          { number: 6, objectives: ["Apresentar resultados aos responsáveis", "Pactuar objetivos do plano de intervenção", "Orientar família e escola"], instruments: [], activities: [], duration_min: 60 },
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
          objectives: [
            themes[i % themes.length],
            "Manter a atenção na tarefa por pelo menos 10 minutos",
            "Realizar a atividade principal com apoio mínimo",
            "Verbalizar a estratégia utilizada",
          ],
          activities: [
            { title: "Aquecimento lúdico", materials: "Jogo de cartas", duration_min: 5 },
            { title: `Atividade principal: ${themes[i % themes.length].toLowerCase()}`, materials: "Cartões ilustrados, alfabeto móvel", duration_min: 25 },
            { title: "Jogo de fechamento", materials: "Jogo de tabuleiro adaptado", duration_min: 10 },
          ],
          materials: "Cartões ilustrados, alfabeto móvel, jogos de tabuleiro adaptados.",
          duration_min: 45,
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
    case "application_guide": {
      const name = String((input.instrumento as Record<string, unknown> | undefined)?.nome ?? "instrumento");
      return {
        preparation: ["Revisar o manual oficial e a folha de registro antes da sessão", "Organizar a sala com poucos estímulos visuais e sonoros", `Separar o material do ${name} na ordem de uso`],
        materials: ["Kit/caderno oficial do instrumento", "Folha de respostas", "Lápis e borracha", "Cronômetro (se previsto no manual)"],
        rapport: "Iniciar com conversa breve sobre interesses da criança e uma atividade lúdica curta para reduzir a ansiedade de desempenho.",
        steps: ["Explicar a atividade em linguagem simples, sem antecipar respostas", "Aplicar os itens exatamente como descrito no manual", "Registrar respostas literais e tempo, quando previsto", "Oferecer pausas breves entre blocos, se necessário", "Encerrar com atividade agradável e devolutiva positiva à criança"],
        observation_points: ["Compreensão das instruções", "Estratégias utilizadas", "Tempo de latência e fadiga", "Reações à dificuldade e ao erro"],
        interruption_criteria: ["Seguir os critérios de suspensão do manual", "Interromper diante de sinais importantes de desregulação e retomar em outra sessão"],
        adaptations: ["Ajustar apenas o ambiente e as pausas — não alterar itens ou instruções padronizadas"],
        scoring_notes: "Corrigir conforme o manual e registrar a pontuação bruta antes de qualquer interpretação.",
        caution: "[MODO DEMONSTRAÇÃO] Roteiro genérico de exemplo. Configure a OpenAI para um roteiro personalizado.",
      };
    }
    case "clinical_record":
      return {
        record: "[MODO DEMONSTRAÇÃO] Na presente aplicação, a criança compreendeu as instruções com apoio inicial e manteve-se engajada durante a maior parte da tarefa. Os resultados registrados indicam [completar com a análise da profissional].",
        highlights: ["Engajamento adequado", "Necessidade de apoio para iniciar a tarefa"],
        comparison: "Comparação com aplicações anteriores: [completar].",
        next_steps: ["Correlacionar com os demais instrumentos", "Considerar na definição dos objetivos do plano de intervenção"],
      };
    case "plan_session":
      return {
        objectives: [
          ...((input.objetivos_atuais as string[] | undefined) ?? []),
          "Identificar o som inicial de palavras com apoio visual",
          "Manter a atenção na tarefa por 10 minutos",
          "Realizar a atividade com no máximo 2 pistas",
        ],
        activities: [
          { title: "Aquecimento lúdico", materials: "Jogo de cartas", duration_min: 5 },
          { title: "Atividade principal com apoio multissensorial", materials: "Alfabeto móvel, cartões", duration_min: 30 },
          { title: "Jogo de fechamento", materials: "Jogo de tabuleiro", duration_min: 10 },
        ],
        materials: "Cartões ilustrados, alfabeto móvel, jogo de tabuleiro adaptado.",
        duration_min: 45,
        strategies: "Modelagem, pistas graduais, reforço positivo. [MODO DEMONSTRAÇÃO]",
        success_criteria: "80% de acertos com apoio mínimo.",
      };
    case "social_post": {
      const theme = String(input.tema ?? "dificuldades de aprendizagem");
      const format = String(input.formato ?? "carrossel");
      return {
        title: `O que ninguém te conta sobre ${theme.toLowerCase()}`,
        hook: `Seu filho se esforça, mas ${theme.toLowerCase()} continua sendo um desafio?`,
        slides: format === "reels" ? [] : [
          { title: "Não é falta de vontade", text: "Muitas crianças se esforçam e, mesmo assim, aprender cansa mais do que deveria." },
          { title: "Sinais que merecem atenção", text: "Evitar tarefas, demorar muito, esquecer o que acabou de aprender ou ficar frustrado com facilidade." },
          { title: "Um exemplo (fictício)", text: "Imagine uma criança de 8 anos que lê devagar e trava na escrita. Com estratégias certas, ela ganha confiança." },
          { title: "Como a neuropsicopedagogia ajuda", text: "Avaliamos como a criança aprende e criamos um plano com objetivos claros." },
          { title: "Vamos conversar?", text: "Me chame no WhatsApp do perfil para agendar uma conversa." },
        ].slice(0, format === "post" ? 1 : 5),
        caption: `Quando aprender dói, a criança não precisa de mais cobrança — precisa de compreensão e estratégia. 💛\n\nSe você se identificou, salve este post e me chame para conversar.\n\n[MODO DEMONSTRAÇÃO — configure a OpenAI para conteúdo personalizado]`,
        hashtags: ["#neuropsicopedagogia", "#neuropsicopedagoga", "#dificuldadesdeaprendizagem", "#maternidade", "#educacaoinfantil", "#aprendizagem", "#balneariocamboriu"],
        cta: "Agende uma conversa pelo WhatsApp",
        reels: format === "reels" ? {
          duration_s: 30, audio_suggestion: "Áudio instrumental suave em alta",
          scenes: [
            { time: "0–3s", visual: "Você olhando para a câmera", on_screen_text: "Não é preguiça.", voiceover: "Se o seu filho se esforça e mesmo assim não consegue..." },
            { time: "3–12s", visual: "Mãos organizando materiais", on_screen_text: "3 sinais de atenção", voiceover: "Fique atenta a três sinais..." },
            { time: "12–25s", visual: "Materiais pedagógicos", on_screen_text: "Existe caminho", voiceover: "Com avaliação e estratégias, a aprendizagem flui melhor." },
            { time: "25–30s", visual: "Logo e contato", on_screen_text: "Agende uma conversa", voiceover: "Me chama no direct!" },
          ],
        } : null,
        stories: ["Enquete: seu filho evita fazer a lição? Sim / Às vezes", "Caixinha: qual sua maior dúvida sobre aprendizagem?", "Convite para agendar conversa"],
        design_tips: "Use as cores da marca, fonte grande e no máximo 30 palavras por slide.",
        best_time: "Terça ou quinta, entre 19h e 21h (confirme nas suas métricas).",
        privacy_notes: "Exemplo fictício; nenhum dado de paciente utilizado.",
      };
    }
    case "chat":
      return { answer: "[MODO DEMONSTRAÇÃO] Configure OPENAI_API_KEY para conversar com a assistente clínica." };
  }
}
