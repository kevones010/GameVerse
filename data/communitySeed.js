const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

function isoBefore(now, milliseconds) {
  return new Date(now.getTime() - milliseconds).toISOString();
}

export function createCommunitySeed(now = new Date()) {
  const users = [
    {
      id: "user-veemaster",
      handle: "veemaster",
      displayName: "VeeMaster",
      bio: "Guias tranquilos para aproveitar cada jogo no seu ritmo.",
      avatar: "assets/vee/avatars/vee-avatar-happy.webp",
      createdAt: isoBefore(now, 240 * DAY)
    },
    {
      id: "user-lunaforge",
      handle: "lunaforge",
      displayName: "Luna Forge",
      bio: "JRPGs, arte e boas histórias.",
      avatar: "assets/vee/avatars/vee-avatar-purple.webp",
      createdAt: isoBefore(now, 190 * DAY)
    },
    {
      id: "user-knightshade",
      handle: "knightshade",
      displayName: "Knight Shade",
      bio: "Explorando Hallownest desde sempre.",
      avatar: "assets/vee/avatars/vee-avatar-blue.webp",
      createdAt: isoBefore(now, 160 * DAY)
    },
    {
      id: "user-tarnished",
      handle: "tarnishedbr",
      displayName: "Tarnished BR",
      bio: "Builds estranhas, chefes difíceis e muita insistência.",
      avatar: "assets/vee/avatars/vee-avatar-green.webp",
      createdAt: isoBefore(now, 130 * DAY)
    },
    {
      id: "user-redherb",
      handle: "redherb",
      displayName: "Red Herb",
      bio: "Terror, sobrevivência e inventário organizado.",
      avatar: "assets/vee/avatars/vee-avatar-pink.webp",
      createdAt: isoBefore(now, 95 * DAY)
    },
    {
      id: "user-cloudsave",
      handle: "cloudsave",
      displayName: "Cloud Save",
      bio: "Conversas sobre RPGs que ficam na memória.",
      avatar: "assets/vee/avatars/vee-avatar-default.webp",
      createdAt: isoBefore(now, 70 * DAY)
    }
  ];

  const post = ({ age, updatedAge, ...data }) => ({
    media: [],
    tags: [],
    spoiler: false,
    spoilerLabel: "",
    status: "published",
    visibility: "public",
    ...data,
    createdAt: isoBefore(now, age),
    updatedAt: isoBefore(now, updatedAge ?? age)
  });

  const posts = [
    post({
      id: "post-confidants-sem-spoiler",
      authorId: "user-veemaster",
      gameId: 339958,
      gameName: "Persona 5 Royal",
      gameSlug: "persona-5-royal",
      type: "guide",
      title: "Como organizar os Confidants sem spoilers",
      content: "Priorize os vínculos que liberam ferramentas para o cotidiano e deixe dias livres para imprevistos. Uma agenda flexível costuma ser melhor que tentar otimizar tudo logo de início.",
      tags: ["persona5", "guia", "sem-spoilers"],
      age: 20 * MINUTE,
      likesCount: 143,
      commentsCount: 24,
      savesCount: 81
    }),
    post({
      id: "post-arte-vee-aventura",
      authorId: "user-lunaforge",
      gameId: null,
      gameName: "GameVerse",
      gameSlug: "",
      type: "art",
      title: "Vee em clima de próxima aventura",
      content: "Um estudo rápido de cores para imaginar o Vee escolhendo o próximo universo. Ainda quero experimentar outras combinações no fundo.",
      media: [{
        type: "image",
        url: "assets/vee/states/vee-favorite.webp",
        thumbnail: "assets/vee/states/vee-favorite.webp",
        alt: "Ilustração demonstrativa do mascote Vee",
        width: 1024,
        height: 1024
      }],
      tags: ["vee", "arte", "gameverse"],
      age: 48 * MINUTE,
      likesCount: 119,
      commentsCount: 18,
      savesCount: 42
    }),
    post({
      id: "post-chefe-elden-ring",
      authorId: "user-tarnished",
      gameId: 326243,
      gameName: "Elden Ring",
      gameSlug: "elden-ring",
      type: "question",
      title: "Qual foi o chefe mais difícil na primeira jornada?",
      content: "Quero comparar experiências sem transformar isso em disputa de build. Qual encontro realmente fez você mudar a estratégia?",
      tags: ["elden-ring", "chefes", "pergunta"],
      age: 2 * 60 * MINUTE,
      likesCount: 88,
      commentsCount: 63,
      savesCount: 9
    }),
    post({
      id: "post-metaphor-cena",
      authorId: "user-cloudsave",
      gameId: 963212,
      gameName: "Metaphor: ReFantazio",
      gameSlug: "metaphor-refantazio",
      type: "screenshot",
      title: "Essa cena de Metaphor ficou absurda",
      content: "A direção de arte muda completamente o peso deste momento. Parei alguns minutos só para observar a composição.",
      tags: ["metaphor", "direcao-de-arte", "screenshot"],
      spoiler: true,
      spoilerLabel: "Cena da segunda metade do jogo",
      age: 4 * 60 * MINUTE,
      likesCount: 174,
      commentsCount: 31,
      savesCount: 56
    }),
    post({
      id: "post-turnos-persona",
      authorId: "user-lunaforge",
      gameId: 339958,
      gameName: "Persona 5 Royal",
      gameSlug: "persona-5-royal",
      type: "discussion",
      title: "Combate por turnos ainda pode surpreender muita gente",
      content: "O ritmo das decisões e a apresentação fazem cada batalha parecer mais rápida do que a descrição do gênero sugere. Foi o jogo que mudou minha relação com turnos.",
      tags: ["persona5", "jrpg", "discussao"],
      age: 8 * 60 * MINUTE,
      likesCount: 97,
      commentsCount: 27,
      savesCount: 18
    }),
    post({
      id: "post-elden-inicio",
      authorId: "user-tarnished",
      gameId: 326243,
      gameName: "Elden Ring",
      gameSlug: "elden-ring",
      type: "guide",
      title: "Cinco dicas para começar sem perder a descoberta",
      content: "Explore em círculos pequenos, marque lugares interessantes e teste armas antes de investir todos os recursos. Recuar de um encontro também faz parte da aventura.",
      tags: ["elden-ring", "iniciantes", "guia"],
      age: DAY + 2 * 60 * MINUTE,
      likesCount: 212,
      commentsCount: 35,
      savesCount: 128
    }),
    post({
      id: "post-arte-hollow-knight",
      authorId: "user-knightshade",
      gameId: 9767,
      gameName: "Hollow Knight",
      gameSlug: "hollow-knight",
      type: "art",
      title: "Minha arte inspirada no silêncio de Hallownest",
      content: "Tentei trabalhar apenas com formas simples e contraste. A imagem ainda está em processo, então deixei aqui um pequeno relato da ideia.",
      tags: ["hollow-knight", "fanart", "processo"],
      age: DAY + 7 * 60 * MINUTE,
      likesCount: 156,
      commentsCount: 22,
      savesCount: 67
    }),
    post({
      id: "post-ng-plus-persona",
      authorId: "user-veemaster",
      gameId: 339958,
      gameName: "Persona 5 Royal",
      gameSlug: "persona-5-royal",
      type: "question",
      title: "Vale fazer NG+ em Persona 5 Royal?",
      content: "Terminei com alguns vínculos incompletos e fiquei curioso para experimentar escolhas diferentes. O que mais vale observar numa segunda jornada?",
      tags: ["persona5", "ng-plus", "pergunta"],
      age: 2 * DAY,
      likesCount: 73,
      commentsCount: 46,
      savesCount: 21
    }),
    post({
      id: "post-hollow-banco",
      authorId: "user-knightshade",
      gameId: 9767,
      gameName: "Hollow Knight",
      gameSlug: "hollow-knight",
      type: "screenshot",
      title: "Um momento de calma entre duas áreas difíceis",
      content: "Os bancos sempre parecem um pequeno respiro. Não anexei imagem porque ainda estou escolhendo uma captura que não entregue nenhuma surpresa.",
      tags: ["hollow-knight", "atmosfera", "screenshot"],
      age: 2 * DAY + 5 * 60 * MINUTE,
      likesCount: 64,
      commentsCount: 12,
      savesCount: 14
    }),
    post({
      id: "post-re4-mala",
      authorId: "user-redherb",
      gameId: 795632,
      gameName: "Resident Evil 4",
      gameSlug: "resident-evil-4-2023",
      type: "discussion",
      title: "A maleta virou parte da estratégia",
      content: "Em certos trechos, reorganizar recursos mudou totalmente minha abordagem. A combinação de espaço limitado e preparação continua funcionando muito bem.",
      tags: ["resident-evil", "inventario", "discussao"],
      spoiler: true,
      spoilerLabel: "Discussão sobre equipamentos avançados",
      age: 3 * DAY,
      likesCount: 91,
      commentsCount: 38,
      savesCount: 16
    }),
    post({
      id: "post-persona3-social",
      authorId: "user-cloudsave",
      gameId: 962676,
      gameName: "Persona 3 Reload",
      gameSlug: "persona-3-reload",
      type: "guide",
      title: "Uma rotina simples para não abandonar os vínculos",
      content: "Separe objetivos por período do dia e não trate cada semana como uma lista perfeita. O guia é sobre consistência, não sobre uma agenda fechada.",
      tags: ["persona3", "social-links", "guia"],
      age: 3 * DAY + 8 * 60 * MINUTE,
      likesCount: 134,
      commentsCount: 19,
      savesCount: 76
    }),
    post({
      id: "post-ff7-momento",
      authorId: "user-lunaforge",
      gameId: 259801,
      gameName: "Final Fantasy VII Remake",
      gameSlug: "final-fantasy-vii-remake",
      type: "question",
      title: "Qual momento definiu sua relação com o grupo?",
      content: "Existe uma sequência em que as pequenas conversas mudaram completamente minha leitura dos personagens. Qual foi esse ponto para você?",
      tags: ["final-fantasy", "personagens", "pergunta"],
      spoiler: true,
      spoilerLabel: "Discussão sobre momentos da história",
      age: 4 * DAY,
      likesCount: 102,
      commentsCount: 54,
      savesCount: 24
    }),
    post({
      id: "post-witcher-escolhas",
      authorId: "user-cloudsave",
      gameId: 3328,
      gameName: "The Witcher 3: Wild Hunt",
      gameSlug: "the-witcher-3-wild-hunt",
      type: "discussion",
      title: "As melhores escolhas são as que continuam desconfortáveis",
      content: "Algumas missões não entregam uma resposta claramente correta, e é justamente isso que me faz lembrar delas anos depois.",
      tags: ["the-witcher", "narrativa", "escolhas"],
      age: 5 * DAY,
      likesCount: 128,
      commentsCount: 41,
      savesCount: 33
    }),
    post({
      id: "post-metaphor-arquetipos",
      authorId: "user-veemaster",
      gameId: 963212,
      gameName: "Metaphor: ReFantazio",
      gameSlug: "metaphor-refantazio",
      type: "guide",
      title: "Como experimentar Arquétipos sem travar a equipe",
      content: "Mantenha ao menos uma função confortável enquanto testa a nova combinação. Assim você aprende o sistema sem transformar cada encontro em um bloqueio.",
      tags: ["metaphor", "arquetipos", "guia"],
      age: 6 * DAY,
      likesCount: 116,
      commentsCount: 17,
      savesCount: 69
    }),
    post({
      id: "post-re4-luz",
      authorId: "user-redherb",
      gameId: 795632,
      gameName: "Resident Evil 4",
      gameSlug: "resident-evil-4-2023",
      type: "screenshot",
      title: "A iluminação conta a história antes do combate",
      content: "Uma boa captura desse jogo quase sempre revela como a luz prepara a tensão. Preferi publicar a observação sem usar uma imagem genérica.",
      tags: ["resident-evil", "fotografia", "screenshot"],
      age: 7 * DAY,
      likesCount: 82,
      commentsCount: 14,
      savesCount: 29
    })
  ];

  return {
    schemaVersion: 1,
    users,
    posts,
    comments: [],
    likes: [],
    savedPosts: [],
    follows: [],
    reports: []
  };
}
